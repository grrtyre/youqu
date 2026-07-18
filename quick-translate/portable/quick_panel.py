# -*- coding: utf-8 -*-
"""快速面板 —— 输入法式翻译小组件。
设计：380×500 无边框圆角小窗口，贴近鼠标出现，失焦自动隐藏。
布局：
  顶部标题栏（可拖拽）+ 工具栏（语言选择 + 交换 + 引擎）
  中部源文输入 + 译文显示
  底部历史记录折叠区 + 快捷键提示
"""
from __future__ import annotations

import threading
from typing import Callable, Optional

from PySide6.QtCore import Qt, QEvent, QPoint, QTimer, Signal, QSize
from PySide6.QtGui import (
    QFont, QCursor, QGuiApplication, QPainter, QColor, QPalette,
    QKeyEvent, QKeySequence, QShortcut, QIcon, QPixmap,
)
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFrame, QLabel, QPushButton,
    QComboBox, QPlainTextEdit, QTextEdit, QListWidget, QListWidgetItem,
    QSizePolicy, QSpacerItem, QApplication, QMenu, QStyle,
    QGraphicsDropShadowEffect,
)

import engine
from store import (
    load_store, save_store, add_history, clear_history,
    update_settings, get_settings,
)
from styles import APPLE_QSS

# 面板尺寸
PANEL_W = 380
PANEL_H = 500


class SourceEdit(QPlainTextEdit):
    """源文输入框。"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("SourceText")
        self.setPlaceholderText("输入要翻译的文本，Ctrl+Enter 翻译…")
        self.setFrameStyle(QFrame.NoFrame)
        self.setUndoRedoEnabled(True)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)


class TargetView(QTextEdit):
    """译文显示区（只读）。"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("TargetText")
        self.setReadOnly(True)
        self.setFrameStyle(QFrame.NoFrame)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)


class QuickPanel(QWidget):
    """快速翻译面板主窗口。"""

    # 自定义信号
    translate_requested = Signal(str, str, str, str)  # text, from, to, engine
    hidden = Signal()

    def __init__(self, icon: Optional[QIcon] = None):
        super().__init__()
        self._icon = icon
        self._store = load_store()
        self._history_expanded = False
        self._translate_thread: Optional[threading.Thread] = None
        self._auto_hide_timer = QTimer(self)
        self._auto_hide_timer.setSingleShot(True)
        self._auto_hide_timer.timeout.connect(self._do_auto_hide)

        # 窗口属性：无边框 + 工具窗口 + 始终在顶层
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.Tool
            | Qt.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setAttribute(Qt.WA_ShowWithoutActivating, False)
        self.setFocusPolicy(Qt.StrongFocus)
        self.setFixedSize(PANEL_W, PANEL_H)

        self._build_ui()
        self.setStyleSheet(APPLE_QSS)

        # 加载设置到 UI
        self._load_settings_to_ui()

        # 失焦事件安装
        self.installEventFilter(self)

    # ============== UI 构建 ==============
    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # 根容器
        root_frame = QFrame()
        root_frame.setObjectName("Root")
        root_layout = QVBoxLayout(root_frame)
        root_layout.setContentsMargins(10, 8, 10, 10)
        root_layout.setSpacing(8)
        root.addWidget(root_frame)

        # ---- 顶部标题栏 ----
        titlebar = QFrame()
        titlebar.setObjectName("TitleBar")
        titlebar.setFixedHeight(40)
        titlebar_layout = QHBoxLayout(titlebar)
        titlebar_layout.setContentsMargins(12, 0, 8, 0)
        titlebar_layout.setSpacing(8)

        # 蓝色翻译图标徽标（A→文）
        dot = QLabel("译")
        dot.setObjectName("AccentDot")
        dot.setFixedSize(24, 24)
        dot.setAlignment(Qt.AlignCenter)
        titlebar_layout.addWidget(dot)

        # 应用标题
        title = QLabel("快速翻译器")
        title.setObjectName("AppTitle")
        titlebar_layout.addWidget(title)

        sub = QLabel("Quick Translate")
        sub.setObjectName("AppSubtitle")
        titlebar_layout.addWidget(sub)

        titlebar_layout.addStretch()

        # 关闭按钮（隐藏到托盘）
        btn_close = QPushButton("×")
        btn_close.setObjectName("BtnClose")
        btn_close.setFixedSize(28, 28)
        btn_close.setCursor(Qt.PointingHandCursor)
        btn_close.setToolTip("隐藏到托盘 (Esc)")
        btn_close.clicked.connect(self.hide_panel)
        titlebar_layout.addWidget(btn_close)

        root_layout.addWidget(titlebar)

        # ---- 工具栏 ----
        toolbar = QFrame()
        toolbar.setObjectName("Toolbar")
        toolbar.setFixedHeight(48)
        toolbar_layout = QHBoxLayout(toolbar)
        toolbar_layout.setContentsMargins(12, 6, 12, 6)
        toolbar_layout.setSpacing(6)

        self.cmb_source = QComboBox()
        self.cmb_source.setObjectName("SourceLang")
        self._fill_lang_combo(self.cmb_source, include_auto=True)
        self.cmb_source.setMinimumWidth(96)
        self.cmb_source.currentIndexChanged.connect(self._on_settings_changed)
        toolbar_layout.addWidget(self.cmb_source)

        btn_swap = QPushButton("⇄")
        btn_swap.setObjectName("BtnSwap")
        btn_swap.setFixedSize(32, 28)
        btn_swap.setCursor(Qt.PointingHandCursor)
        btn_swap.setToolTip("交换源/目标语言 (Ctrl+Shift+S)")
        btn_swap.clicked.connect(self._swap_langs)
        toolbar_layout.addWidget(btn_swap)

        self.cmb_target = QComboBox()
        self.cmb_target.setObjectName("TargetLang")
        self._fill_lang_combo(self.cmb_target, include_auto=False)
        self.cmb_target.setMinimumWidth(96)
        self.cmb_target.currentIndexChanged.connect(self._on_settings_changed)
        toolbar_layout.addWidget(self.cmb_target)

        toolbar_layout.addStretch()

        self.cmb_engine = QComboBox()
        self.cmb_engine.setObjectName("EngineSelect")
        self.cmb_engine.addItem("智能", "auto")
        self.cmb_engine.addItem("Google", "google")
        self.cmb_engine.addItem("MyMemory", "mymemory")
        self.cmb_engine.setFixedWidth(88)
        self.cmb_engine.currentIndexChanged.connect(self._on_settings_changed)
        toolbar_layout.addWidget(self.cmb_engine)

        root_layout.addWidget(toolbar)

        # ---- 翻译区 ----
        translate_area = QFrame()
        translate_area.setObjectName("TranslateArea")
        ta_layout = QVBoxLayout(translate_area)
        ta_layout.setContentsMargins(8, 8, 8, 8)
        ta_layout.setSpacing(6)

        # 源文容器（带浅灰背景）
        src_pane = QFrame()
        src_pane.setObjectName("TranslateSourcePane")
        src_layout = QVBoxLayout(src_pane)
        src_layout.setContentsMargins(8, 6, 8, 6)
        src_layout.setSpacing(4)

        # 源文 tag + 字符计数
        src_header = QHBoxLayout()
        src_header.setContentsMargins(0, 0, 0, 0)
        src_header.setSpacing(6)
        src_tag = QLabel("● 源文")
        src_tag.setObjectName("PaneTag")
        src_header.addWidget(src_tag)
        src_header.addStretch()
        self.lbl_count = QLabel("0 字")
        self.lbl_count.setObjectName("Meta")
        src_header.addWidget(self.lbl_count)
        btn_clear = QPushButton("清空")
        btn_clear.setObjectName("BtnGhost")
        btn_clear.setCursor(Qt.PointingHandCursor)
        btn_clear.clicked.connect(self._clear_source)
        src_header.addWidget(btn_clear)
        src_layout.addLayout(src_header)

        self.edit_source = SourceEdit()
        self.edit_source.setFixedHeight(88)
        self.edit_source.textChanged.connect(self._update_char_count)
        src_layout.addWidget(self.edit_source)
        ta_layout.addWidget(src_pane)

        # 译文容器（带浅蓝背景）
        tgt_pane = QFrame()
        tgt_pane.setObjectName("TranslateTargetPane")
        tgt_layout = QVBoxLayout(tgt_pane)
        tgt_layout.setContentsMargins(8, 6, 8, 6)
        tgt_layout.setSpacing(4)

        # 译文 tag + 引擎信息
        tgt_header = QHBoxLayout()
        tgt_header.setContentsMargins(0, 0, 0, 0)
        tgt_header.setSpacing(6)
        tgt_tag = QLabel("● 译文")
        tgt_tag.setObjectName("PaneTagAccent")
        tgt_header.addWidget(tgt_tag)
        tgt_header.addStretch()
        self.lbl_meta = QLabel("")
        self.lbl_meta.setObjectName("Meta")
        tgt_header.addWidget(self.lbl_meta)
        tgt_layout.addLayout(tgt_header)

        self.view_target = TargetView()
        self.view_target.setFixedHeight(88)
        tgt_layout.addWidget(self.view_target)
        ta_layout.addWidget(tgt_pane)

        # 译文操作区
        act_layout = QHBoxLayout()
        act_layout.setContentsMargins(0, 0, 0, 0)
        act_layout.setSpacing(6)
        self.status_pill = QLabel("")
        self.status_pill.setObjectName("StatusPill")
        self.status_pill.setFixedHeight(22)
        self.status_pill.setVisible(False)
        act_layout.addWidget(self.status_pill)
        act_layout.addStretch()
        btn_copy = QPushButton("复制译文")
        btn_copy.setObjectName("BtnCopy")
        btn_copy.setCursor(Qt.PointingHandCursor)
        btn_copy.setToolTip("复制译文到剪贴板 (Ctrl+C)")
        btn_copy.clicked.connect(self._copy_target)
        act_layout.addWidget(btn_copy)
        ta_layout.addLayout(act_layout)

        root_layout.addWidget(translate_area)

        # 给翻译区加阴影
        shadow_translate = QGraphicsDropShadowEffect(translate_area)
        shadow_translate.setBlurRadius(16)
        shadow_translate.setColor(QColor(0, 122, 255, 30))
        shadow_translate.setOffset(0, 2)
        translate_area.setGraphicsEffect(shadow_translate)

        # ---- 历史记录 ----
        history_frame = QFrame()
        history_frame.setObjectName("HistorySection")
        hf_layout = QVBoxLayout(history_frame)
        hf_layout.setContentsMargins(0, 0, 0, 0)
        hf_layout.setSpacing(0)

        hist_header = QHBoxLayout()
        hist_header.setContentsMargins(10, 6, 10, 6)
        hist_header.setSpacing(6)
        self.btn_hist_toggle = QPushButton("▶ 历史记录")
        self.btn_hist_toggle.setObjectName("HistoryToggle")
        self.btn_hist_toggle.setCursor(Qt.PointingHandCursor)
        self.btn_hist_toggle.clicked.connect(self._toggle_history)
        hist_header.addWidget(self.btn_hist_toggle)
        hist_header.addStretch()
        self.lbl_hist_count = QLabel("0")
        self.lbl_hist_count.setObjectName("HistoryCount")
        self.lbl_hist_count.setFixedHeight(20)
        hist_header.addWidget(self.lbl_hist_count)
        hf_layout.addLayout(hist_header)

        self.lst_history = QListWidget()
        self.lst_history.setObjectName("HistoryList")
        self.lst_history.setFrameStyle(QFrame.NoFrame)
        self.lst_history.setSpacing(2)
        self.lst_history.itemClicked.connect(self._on_history_click)
        self.lst_history.setContextMenuPolicy(Qt.CustomContextMenu)
        self.lst_history.customContextMenuRequested.connect(self._on_history_menu)
        self.lst_history.setVisible(False)
        self.lst_history.setMaximumHeight(120)
        hf_layout.addWidget(self.lst_history)

        root_layout.addWidget(history_frame)

        # 给历史记录区加阴影
        shadow_history = QGraphicsDropShadowEffect(history_frame)
        shadow_history.setBlurRadius(12)
        shadow_history.setColor(QColor(0, 0, 0, 20))
        shadow_history.setOffset(0, 1)
        history_frame.setGraphicsEffect(shadow_history)

        # ---- 底部快捷键提示 ----
        footer = QFrame()
        footer.setObjectName("Footer")
        footer.setFixedHeight(28)
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(14, 0, 14, 0)
        footer_layout.setSpacing(10)

        # 左：仅展示最关键的快捷键
        kbd_main = QLabel("Ctrl + Enter")
        kbd_main.setObjectName("KbdKey")
        footer_layout.addWidget(kbd_main)
        act_main = QLabel("翻译")
        act_main.setObjectName("KbdHint")
        footer_layout.addWidget(act_main)

        sep1 = QLabel("·")
        sep1.setObjectName("FootLabel")
        footer_layout.addWidget(sep1)

        kbd2 = QLabel("Esc")
        kbd2.setObjectName("KbdKey")
        footer_layout.addWidget(kbd2)
        act2 = QLabel("隐藏")
        act2.setObjectName("KbdHint")
        footer_layout.addWidget(act2)

        footer_layout.addStretch()

        root_layout.addWidget(footer)

        # 默认填充一段示例文本（首次启动可见效果）
        if not self.edit_source.toPlainText().strip():
            self.edit_source.setPlainText("Hello, this is Quick Translate portable.")

    def _fill_lang_combo(self, combo: QComboBox, include_auto: bool = True):
        combo.clear()
        for code, name in engine.LANGUAGES:
            if not include_auto and code == "auto":
                continue
            combo.addItem(name, code)

    # ============== 设置加载/保存 ==============
    def _load_settings_to_ui(self):
        s = get_settings(self._store)
        # 设置源语言
        idx = self.cmb_source.findData(s.get("from", "auto"))
        if idx >= 0:
            self.cmb_source.setCurrentIndex(idx)
        idx = self.cmb_target.findData(s.get("to", "zh"))
        if idx >= 0:
            self.cmb_target.setCurrentIndex(idx)
        idx = self.cmb_engine.findData(s.get("engine", "auto"))
        if idx >= 0:
            self.cmb_engine.setCurrentIndex(idx)
        self._refresh_history()

    def _on_settings_changed(self):
        s = get_settings(self._store)
        s["from"] = self.cmb_source.currentData()
        s["to"] = self.cmb_target.currentData()
        s["engine"] = self.cmb_engine.currentData()
        update_settings(self._store, **s)
        save_store(self._store)

    # ============== 事件处理 ==============
    def eventFilter(self, obj, event):
        # 失焦自动隐藏（点击别处自动消失）
        if obj is self and event.type() == QEvent.ActivationChange:
            if not self.isActiveWindow() and self.isVisible():
                # 延迟 150ms 隐藏，避免点击子控件时误触发
                self._auto_hide_timer.start(150)
            else:
                self._auto_hide_timer.stop()
        return super().eventFilter(obj, event)

    def _do_auto_hide(self):
        if not self.isActiveWindow() and self.isVisible():
            self.hide_panel()

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Escape:
            self.hide_panel()
            return
        # Ctrl+Enter / Ctrl+Return 翻译
        if event.modifiers() & Qt.ControlModifier and event.key() in (Qt.Key_Return, Qt.Key_Enter):
            self.do_translate()
            return
        # Ctrl+Shift+S 交换
        if (event.modifiers() & Qt.ControlModifier) and (event.modifiers() & Qt.ShiftModifier) and event.key() == Qt.Key_S:
            self._swap_langs()
            return
        super().keyPressEvent(event)

    def show_near_cursor(self):
        """贴近鼠标位置显示面板。"""
        cursor_pos = QCursor.pos()
        # 获取屏幕几何
        screen = QGuiApplication.screenAt(cursor_pos)
        if screen is None:
            screen = QGuiApplication.primaryScreen()
        geo = screen.availableGeometry()

        x = cursor_pos.x() + 12
        y = cursor_pos.y() + 12
        # 防止超出屏幕
        if x + PANEL_W > geo.right():
            x = cursor_pos.x() - PANEL_W - 12
        if y + PANEL_H > geo.bottom():
            y = cursor_pos.y() - PANEL_H - 12
        if x < geo.left():
            x = geo.left() + 8
        if y < geo.top():
            y = geo.top() + 8

        self.move(x, y)
        self.show()
        self.activateWindow()
        self.raise_()
        # 焦点给源文输入框
        self.edit_source.setFocus()

    def hide_panel(self):
        """隐藏面板（不退出）。"""
        self.hide()
        self.hidden.emit()

    # ============== 翻译逻辑 ==============
    def do_translate(self, text: Optional[str] = None):
        """执行翻译。text 为 None 时使用源文输入框内容。"""
        if text is not None:
            self.edit_source.setPlainText(text)

        src_text = self.edit_source.toPlainText().strip()
        if not src_text:
            self.view_target.setPlainText("")
            self.lbl_meta.setText("")
            return

        from_lang = self.cmb_source.currentData()
        to_lang = self.cmb_target.currentData()
        engine_name = self.cmb_engine.currentData()

        # UI 进入加载状态
        self.status_pill.setText("● 翻译中…")
        self.status_pill.setVisible(True)
        self.setEnabled(False)

        # 后台线程翻译，避免阻塞 UI
        def worker():
            try:
                result = engine.translate(src_text, from_lang, to_lang, engine_name)
                # 通过信号回主线程
                QTimer.singleShot(0, lambda: self._on_translate_done(result, src_text, from_lang, to_lang))
            except Exception as e:
                err = str(e) or "翻译失败"
                QTimer.singleShot(0, lambda: self._on_translate_error(err))

        t = threading.Thread(target=worker, daemon=True)
        t.start()

    def _on_translate_done(self, result: dict, src_text: str, from_lang: str, to_lang: str):
        self.setEnabled(True)
        self.status_pill.setVisible(False)

        tgt_text = result.get("text", "")
        detected = result.get("detectedSource")
        eng_name = result.get("engine")

        self.view_target.setPlainText(tgt_text)

        # 元信息
        meta_parts = []
        if detected:
            meta_parts.append(f"检测: {engine.lang_name(detected)}")
        if eng_name:
            meta_parts.append(f"引擎: {eng_name.title()}")
        self.lbl_meta.setText(" · ".join(meta_parts) if meta_parts else "")

        # 写入历史
        add_history(
            self._store, src_text, tgt_text, from_lang, to_lang,
            detected=detected, engine=eng_name
        )
        save_store(self._store)
        self._refresh_history()

    def _on_translate_error(self, err: str):
        self.setEnabled(True)
        self.status_pill.setText("● " + err)
        self.status_pill.setVisible(True)
        # 3 秒后自动隐藏
        QTimer.singleShot(3000, lambda: self.status_pill.setVisible(False))

    # ============== 历史记录 ==============
    def _refresh_history(self):
        history = self._store.get("history", [])
        count = len(history)
        self.lbl_hist_count.setText(str(count))
        self.lst_history.clear()
        # 折叠状态下，在按钮文本上显示最近一条预览
        if count > 0 and not self._history_expanded:
            latest = history[0]
            src_prev = latest.get("src", "")[:24]
            tgt_prev = latest.get("tgt", "")[:24]
            suffix = "…" if len(latest.get("src", "")) > 24 else ""
            self.btn_hist_toggle.setText(f"▶ 历史 · 最近：{src_prev}{suffix} → {tgt_prev}{suffix}")
        else:
            self.btn_hist_toggle.setText("▼ 历史记录" if self._history_expanded else "▶ 历史记录")
        for item in history[:50]:  # 最多显示 50 条
            src = item.get("src", "")
            tgt = item.get("tgt", "")
            src_lang = item.get("srcLang", "")
            tgt_lang = item.get("tgtLang", "")
            display = f"{src[:40]}{'…' if len(src) > 40 else ''}  →  {tgt[:40]}{'…' if len(tgt) > 40 else ''}"
            list_item = QListWidgetItem(display)
            list_item.setToolTip(f"{src}\n→\n{tgt}\n\n{engine.lang_name(src_lang)} → {engine.lang_name(tgt_lang)}")
            list_item.setData(Qt.UserRole, item)
            self.lst_history.addItem(list_item)

    def _toggle_history(self):
        self._history_expanded = not self._history_expanded
        if self._history_expanded:
            self.btn_hist_toggle.setText("▼ 历史记录")
            self.lst_history.setVisible(True)
        else:
            self.btn_hist_toggle.setText("▶ 历史记录")
            self.lst_history.setVisible(False)

    def _on_history_click(self, item: QListWidgetItem):
        data = item.data(Qt.UserRole)
        if not data:
            return
        # 回填源文并翻译
        self.edit_source.setPlainText(data.get("src", ""))
        # 还原语言设置
        idx = self.cmb_source.findData(data.get("srcLang", "auto"))
        if idx >= 0:
            self.cmb_source.setCurrentIndex(idx)
        idx = self.cmb_target.findData(data.get("tgtLang", "zh"))
        if idx >= 0:
            self.cmb_target.setCurrentIndex(idx)
        # 仅回填译文，不重新翻译
        self.view_target.setPlainText(data.get("tgt", ""))
        self.lbl_meta.setText("来自历史记录")

    def _on_history_menu(self, pos):
        item = self.lst_history.itemAt(pos)
        if not item:
            return
        menu = QMenu(self)
        act_delete = menu.addAction("删除该条")
        act_clear = menu.addAction("清空全部历史")
        action = menu.exec(self.lst_history.mapToGlobal(pos))
        if action == act_delete:
            data = item.data(Qt.UserRole)
            history = self._store.get("history", [])
            history = [
                h for h in history
                if not (
                    h.get("src") == data.get("src")
                    and h.get("tgt") == data.get("tgt")
                    and h.get("srcLang") == data.get("srcLang")
                    and h.get("tgtLang") == data.get("tgtLang")
                )
            ]
            self._store["history"] = history
            save_store(self._store)
            self._refresh_history()
        elif action == act_clear:
            clear_history(self._store)
            save_store(self._store)
            self._refresh_history()

    # ============== 辅助 ==============
    def _clear_source(self):
        self.edit_source.clear()
        self.view_target.clear()
        self.lbl_meta.setText("")
        self.edit_source.setFocus()

    def _swap_langs(self):
        # 如果源是 auto，先尝试用检测结果交换
        src_idx = self.cmb_source.currentIndex()
        tgt_idx = self.cmb_target.currentIndex()
        # 不允许交换到 auto
        if self.cmb_source.currentData() == "auto":
            # 检测源文语言
            src_text = self.edit_source.toPlainText().strip()
            if src_text:
                import re
                detected = "zh" if re.search(r"[\u4e00-\u9fff]", src_text) else "en"
                idx = self.cmb_source.findData(detected)
                if idx >= 0:
                    self.cmb_source.setCurrentIndex(idx)
        # 交换
        self.cmb_source.setCurrentIndex(self.cmb_target.currentIndex())
        self.cmb_target.setCurrentIndex(tgt_idx)
        # 同时交换文本
        src_text = self.edit_source.toPlainText()
        tgt_text = self.view_target.toPlainText()
        if tgt_text.strip():
            self.edit_source.setPlainText(tgt_text)
            self.view_target.setPlainText(src_text)

    def _copy_target(self):
        text = self.view_target.toPlainText()
        if text:
            cb = QGuiApplication.clipboard()
            cb.setText(text)
            # 简单反馈
            self.status_pill.setText("✓ 已复制")
            self.status_pill.setVisible(True)
            QTimer.singleShot(1500, lambda: self.status_pill.setVisible(False))

    def _update_char_count(self):
        text = self.edit_source.toPlainText()
        self.lbl_count.setText(f"{len(text)} 字")

    def translate_clipboard(self):
        """翻译剪贴板内容。"""
        cb = QGuiApplication.clipboard()
        text = cb.text()
        if text and text.strip():
            self.edit_source.setPlainText(text)
            self.do_translate()
