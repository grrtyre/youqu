# -*- coding: utf-8 -*-
"""快速面板 —— 输入法式唤起：热键出现 → 搜索 → 复制/填变量 → 自动隐藏"""
from __future__ import annotations

from typing import Optional, List, Dict, Any

from PySide6.QtCore import Qt, QTimer, QPropertyAnimation, QPoint, QEasingCurve, QSize, QObject, Signal, QPointF
from PySide6.QtGui import QFont, QKeyEvent, QIcon, QCursor, QPixmap, QPainter, QColor, QPen
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QFrame, QScrollArea,
    QPushButton, QSizePolicy, QApplication, QGraphicsDropShadowEffect
)

from store import PromptStore, extract_vars, fill_vars
from styles import APPLE_QSS, COLOR_BG, COLOR_CARD, COLOR_ACCENT, COLOR_TEXT_2, COLOR_TEXT_3


class VarFillDialog(QWidget):
    """变量填写浮层（小型，覆盖在面板上方）"""

    submitted = Signal(str)  # 填好后的最终文本
    cancelled = Signal()

    def __init__(self, prompt: Dict[str, Any], parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.Dialog)
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setStyleSheet(APPLE_QSS)
        self._prompt = prompt
        self._vars: List[str] = extract_vars(prompt.get("content", ""))
        self._inputs: Dict[str, QLineEdit] = {}

        self._build_ui()
        self._adjust_size()

    def _build_ui(self):
        root = QFrame(self)
        root.setObjectName("cardSurface")
        layout = QVBoxLayout(root)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(12)

        # 标题
        title = QLabel("填写变量并复制")
        title.setObjectName("titleLabel")
        layout.addWidget(title)

        sub = QLabel(self._prompt.get("title", ""))
        sub.setStyleSheet(f"color: {COLOR_TEXT_2}; font-size: 11.5px;")
        layout.addWidget(sub)

        # 变量表单
        if not self._vars:
            hint = QLabel("这条提示词没有变量，可直接复制。")
            hint.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 12px;")
            layout.addWidget(hint)
        else:
            for name in self._vars:
                row = QVBoxLayout()
                row.setSpacing(4)
                lbl = QLabel("变量  " + name)
                lbl.setObjectName("varName")
                row.addWidget(lbl)
                inp = QLineEdit()
                inp.setPlaceholderText(f"请输入 {name}")
                inp.setMinimumHeight(34)
                row.addWidget(inp)
                self._inputs[name] = inp
                layout.addLayout(row)

        # 按钮
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        cancel_btn = QPushButton("取消")
        cancel_btn.setMinimumWidth(72)
        cancel_btn.clicked.connect(self._cancel)
        btn_row.addWidget(cancel_btn)

        copy_btn = QPushButton("复制并关闭")
        copy_btn.setObjectName("primaryBtn")
        copy_btn.setMinimumWidth(100)
        copy_btn.clicked.connect(self._submit)
        btn_row.addWidget(copy_btn)
        layout.addLayout(btn_row)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(root)

        # 自动聚焦第一个输入框
        QTimer.singleShot(60, self._focus_first)

    def _focus_first(self):
        if self._inputs:
            first = list(self._inputs.values())[0]
            first.setFocus()
        else:
            # 直接触发提交按钮
            pass

    def _adjust_size(self):
        # 大约：宽 360, 高度根据变量数变化
        h = 130 + len(self._vars) * 60 + 20
        self.setFixedSize(360, max(180, min(h, 480)))

    def _submit(self):
        values = {name: inp.text() for name, inp in self._inputs.items()}
        result = fill_vars(self._prompt.get("content", ""), values)
        self.submitted.emit(result)

    def _cancel(self):
        self.cancelled.emit()

    def keyPressEvent(self, e: QKeyEvent):
        if e.key() == Qt.Key_Escape:
            self._cancel()
            return
        if e.key() == Qt.Key_Return or e.key() == Qt.Key_Enter:
            # 如果当前焦点在最后一个输入框，则提交
            foc = QApplication.focusWidget()
            if foc in self._inputs.values():
                idx = list(self._inputs.values()).index(foc)
                if idx == len(self._inputs) - 1:
                    self._submit()
                    return
                # 否则切到下一个
                nxt = list(self._inputs.values())[idx + 1]
                nxt.setFocus()
                return
            self._submit()
            return
        super().keyPressEvent(e)


class QuickPanel(QWidget):
    """输入法式快速面板"""

    copied = Signal(str)  # 发送复制提示信号

    def __init__(self, store: PromptStore, parent: Optional[QWidget] = None):
        super().__init__(parent)
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.WindowStaysOnTopHint
            | Qt.Tool
        )
        self.setAttribute(Qt.WA_ShowWithoutActivating, False)
        self.setAttribute(Qt.WA_MacAlwaysShowToolWindow, True)
        self.setWindowTitle("提示词速唤面板")
        self.setStyleSheet(APPLE_QSS)
        self._store = store
        self._all_items: List[Dict[str, Any]] = []
        self._filtered: List[Dict[str, Any]] = []
        self._selected_idx: int = -1
        self._var_dialog: Optional[VarFillDialog] = None
        self._auto_hide_timer = QTimer(self)
        self._auto_hide_timer.setSingleShot(True)
        self._auto_hide_timer.timeout.connect(self.hide)

        self._build_ui()
        self.setFixedSize(380, 460)

    def _build_ui(self):
        root = QFrame(self)
        root.setObjectName("root")
        root.setStyleSheet(f"background: {COLOR_BG}; border-radius: 14px;")
        outer = QVBoxLayout(root)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        # 顶部品牌区 —— 增强层次感
        top = QHBoxLayout()
        top.setContentsMargins(18, 16, 16, 4)
        top.setSpacing(8)
        brand_box = QVBoxLayout()
        brand_box.setSpacing(3)
        title = QLabel("提示词速唤")
        title.setObjectName("brandTitle")
        title.setStyleSheet("font-size: 15px; font-weight: 700; color: #1d1d1f; letter-spacing: 0.2px;")
        brand_box.addWidget(title)

        sub = QLabel("输入法式唤起 · 输入即搜 · 回车复制")
        sub.setStyleSheet(f"color: {COLOR_TEXT_3}; font-size: 11px; letter-spacing: 0.1px;")
        brand_box.addWidget(sub)
        top.addLayout(brand_box)
        top.addStretch()
        # 关闭按钮
        close_btn = QPushButton("×")
        close_btn.setObjectName("iconBtn")
        close_btn.setFixedSize(30, 30)
        close_btn.setStyleSheet("font-size: 20px; color: #6e6e73; background: transparent; border: none; font-weight: 300;")
        close_btn.clicked.connect(self.hide)
        top.addWidget(close_btn)
        outer.addLayout(top)

        # 搜索框 —— 加深度阴影感
        search_row = QHBoxLayout()
        search_row.setContentsMargins(18, 8, 18, 12)
        search_row.setSpacing(0)
        self._search = QLineEdit()
        self._search.setObjectName("searchInput")
        self._search.setPlaceholderText("搜索提示词标题、内容、标签…")
        self._search.setTextMargins(8, 0, 8, 0)
        self._search.setMinimumHeight(38)
        self._search.textChanged.connect(self._on_search_changed)
        self._search.returnPressed.connect(self._on_enter)
        # 加放大镜图标（左侧 leading position）
        from PySide6.QtGui import QAction, QIcon, QPixmap, QPainter, QColor, QFont as QFont2
        magnifier = QAction(self._search)
        # 自绘放大镜
        pix = QPixmap(14, 14)
        pix.fill(Qt.transparent)
        p = QPainter(pix)
        p.setRenderHint(QPainter.Antialiasing, True)
        p.setPen(QPen(QColor("#86868b"), 1.4))
        p.setBrush(Qt.NoBrush)
        p.drawEllipse(5, 5, 7, 7)
        p.drawLine(QPointF(10.5, 10.5), QPointF(13, 13))
        p.end()
        magnifier.setIcon(QIcon(pix))
        self._search.addAction(magnifier, QLineEdit.LeadingPosition)
        search_row.addWidget(self._search)
        outer.addLayout(search_row)

        # 列表区
        self._list_container = QFrame()
        self._list_container.setStyleSheet(f"background: {COLOR_BG};")
        list_outer = QVBoxLayout(self._list_container)
        list_outer.setContentsMargins(12, 0, 12, 0)
        list_outer.setSpacing(6)

        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll.setFrameShape(QFrame.NoFrame)
        self._scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self._scroll.setStyleSheet(f"background: {COLOR_BG}; border: none;")

        self._list_widget = QWidget()
        self._list_widget.setStyleSheet(f"background: {COLOR_BG};")
        self._list_layout = QVBoxLayout(self._list_widget)
        self._list_layout.setContentsMargins(0, 0, 0, 8)
        self._list_layout.setSpacing(8)  # 卡片间距加大
        self._list_layout.addStretch()
        self._scroll.setWidget(self._list_widget)
        list_outer.addWidget(self._scroll)
        outer.addWidget(self._list_container, 1)

        # 底部提示条 —— 增加呼吸空间
        hint_bar = QFrame()
        hint_bar.setObjectName("hintBar")
        hint_bar.setStyleSheet(
            "background: #ffffff; border-top: 1px solid #ececf0;"
            "border-bottom-left-radius: 14px; border-bottom-right-radius: 14px;"
        )
        hint_layout = QHBoxLayout(hint_bar)
        hint_layout.setContentsMargins(18, 14, 18, 18)
        hint_layout.setSpacing(12)
        self._hint_label = QLabel("↑↓ 选择  ·  Enter 复制  ·  Tab 填变量  ·  Esc 隐藏")
        self._hint_label.setObjectName("hintText")
        self._hint_label.setStyleSheet("color: #6e6e73; font-size: 11.5px; letter-spacing: 0.4px; font-weight: 500;")
        hint_layout.addWidget(self._hint_label)
        hint_layout.addStretch()
        self._count_label = QLabel("")
        self._count_label.setObjectName("hintText")
        self._count_label.setStyleSheet("color: #86868b; font-size: 10.5px; font-weight: 500;")
        hint_layout.addWidget(self._count_label)
        outer.addWidget(hint_bar)

        # 外层
        wrapper = QVBoxLayout(self)
        wrapper.setContentsMargins(0, 0, 0, 0)
        wrapper.addWidget(root)

    # ===== 数据加载 =====
    def refresh_data(self):
        self._all_items = self._store.search(limit=80)
        self._apply_filter()

    def _apply_filter(self):
        kw = self._search.text().strip().lower()
        if kw:
            self._filtered = []
            for p in self._all_items:
                hay = " ".join([
                    p.get("title", ""),
                    p.get("content", ""),
                    " ".join(p.get("tags") or []),
                    p.get("category", ""),
                ]).lower()
                if kw in hay:
                    self._filtered.append(p)
        else:
            self._filtered = list(self._all_items)

        # 渲染列表
        self._render_list()
        if self._filtered:
            self._selected_idx = 0
        else:
            self._selected_idx = -1
        self._update_count()
        self._apply_selection_style()

    def _render_list(self):
        # 清空（保留最后的 stretch）
        while self._list_layout.count() > 1:
            item = self._list_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()

        if not self._filtered:
            empty = QLabel("没有匹配的提示词")
            empty.setObjectName("emptyHint")
            empty.setAlignment(Qt.AlignCenter)
            empty.setFixedHeight(80)
            self._list_layout.insertWidget(0, empty)
            return

        for i, p in enumerate(self._filtered):
            card = self._build_card(p, i)
            self._list_layout.insertWidget(i, card)

    def _build_card(self, p: Dict[str, Any], idx: int) -> QFrame:
        card = QFrame()
        card.setObjectName("cardItem")
        card.setFixedHeight(68)
        card.setCursor(Qt.PointingHandCursor)
        card._idx = idx  # type: ignore

        # 卡片细腻阴影 —— 模拟 macOS 卡片层次感
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setBlurRadius(10)
        shadow.setColor(QColor(0, 0, 0, 14))
        shadow.setOffset(0, 1)
        card.setGraphicsEffect(shadow)

        layout = QHBoxLayout(card)
        layout.setContentsMargins(12, 9, 12, 9)
        layout.setSpacing(10)

        # 左侧主信息
        info_box = QVBoxLayout()
        info_box.setSpacing(3)

        title_row = QHBoxLayout()
        title_row.setSpacing(6)
        from PySide6.QtCore import Qt as _Qt
        from PySide6.QtGui import QFontMetrics, QFont
        title = QLabel()
        title.setObjectName("cardTitle")
        # 标题用更大字号 + 更深颜色，增强对比度
        title.setStyleSheet("font-size: 13.5px; font-weight: 700; color: #1d1d1f; letter-spacing: 0.1px;")
        title.setWordWrap(False)
        title.setMaximumWidth(220)
        f = QFont("Segoe UI", 9, QFont.Bold)
        title.setFont(f)
        full_title = p.get("title", "")
        metrics = QFontMetrics(f)
        title.setText(metrics.elidedText(full_title, _Qt.ElideRight, 220))
        title_row.addWidget(title)
        if p.get("favorite"):
            star = QLabel("★")
            star.setStyleSheet("color: #ff9f0a; font-size: 13px;")
            title_row.addWidget(star)
        title_row.addStretch()
        info_box.addLayout(title_row)

        snippet_text = p.get("content", "").replace("\n", " ")
        # 手动省略号，snippet 用更浅的灰色与标题区分
        if len(snippet_text) > 46:
            snippet_text = snippet_text[:46] + "…"
        snippet = QLabel(snippet_text)
        snippet.setStyleSheet("color: #86868b; font-size: 11px; letter-spacing: 0.1px;")
        snippet.setWordWrap(False)
        snippet.setFixedHeight(16)  # 固定单行高度，保持垂直节奏
        info_box.addWidget(snippet)
        layout.addLayout(info_box, 1)

        # 右侧元信息
        meta_col = QVBoxLayout()
        meta_col.setSpacing(3)
        meta_col.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        var_count = len(extract_vars(p.get("content", "")))
        if var_count:
            var_badge = QLabel(f"⚙ {var_count}")
            var_badge.setStyleSheet(
                "color: #007aff; font-size: 10px; background: #e8f1ff;"
                "border-radius: 8px; padding: 2px 7px;"
            )
            var_badge.setAlignment(Qt.AlignCenter)
            var_badge.setFixedHeight(18)
            meta_col.addWidget(var_badge)
        cat = p.get("category")
        if cat:
            cat_badge = QLabel(cat)
            cat_badge.setStyleSheet(
                "color: #6e6e73; font-size: 10px; background: #f0f0f5;"
                "border-radius: 8px; padding: 2px 7px;"
            )
            cat_badge.setAlignment(Qt.AlignCenter)
            cat_badge.setFixedHeight(18)
            meta_col.addWidget(cat_badge)
        layout.addLayout(meta_col)

        return card

    def _update_count(self):
        self._count_label.setText(f"共 {len(self._filtered)} 条")

    def _apply_selection_style(self):
        for i in range(self._list_layout.count() - 1):  # 跳过末尾 stretch
            item = self._list_layout.itemAt(i)
            w = item.widget() if item else None
            if not w:
                continue
            if i == self._selected_idx:
                w.setObjectName("cardItemSelected")
            else:
                w.setObjectName("cardItem")
            # 强制重新应用样式
            w.style().unpolish(w)
            w.style().polish(w)
        # 滚动到选中项
        if 0 <= self._selected_idx < self._list_layout.count() - 1:
            item = self._list_layout.itemAt(self._selected_idx)
            w = item.widget() if item else None
            if w:
                self._scroll.ensureWidgetVisible(w, 0, 20)

    # ===== 事件 =====
    def _on_search_changed(self, _text: str):
        self._apply_filter()

    def _on_enter(self):
        if 0 <= self._selected_idx < len(self._filtered):
            p = self._filtered[self._selected_idx]
            self._do_copy_or_fill(p)

    def _do_copy_or_fill(self, p: Dict[str, Any]):
        vars_ = extract_vars(p.get("content", ""))
        if vars_:
            self._open_var_dialog(p)
        else:
            self._copy_text(p.get("content", ""), p)

    def _open_var_dialog(self, p: Dict[str, Any]):
        # 在面板正上方弹出变量填写小窗口
        self._var_dialog = VarFillDialog(p)
        # 居中显示在面板上
        geom = self.geometry()
        dlg_w = self._var_dialog.width()
        x = geom.x() + (geom.width() - dlg_w) // 2
        y = geom.y() + 40
        self._var_dialog.move(x, y)

        # 用闭包捕获最终结果
        prompt_id = p.get("id")
        def on_submit(final_text: str):
            self._copy_text(final_text, {"id": prompt_id, "title": p.get("title", "")}, is_filled=True)
            self._var_dialog = None
        def on_cancel():
            # 取消后回到主面板
            self._var_dialog = None
            self._search.setFocus()

        self._var_dialog.submitted.connect(on_submit)
        self._var_dialog.cancelled.connect(on_cancel)
        self._var_dialog.show()
        self._var_dialog.raise_()
        self._var_dialog.activateWindow()

    def _copy_text(self, text: str, p: Dict[str, Any], is_filled: bool = False):
        clip = QApplication.clipboard()
        clip.setText(text)
        if p.get("id"):
            self._store.bump_usage(p["id"])
        self.copied.emit(p.get("title", ""))
        self.hide()

    # ===== 键盘 =====
    def keyPressEvent(self, e: QKeyEvent):
        if e.key() == Qt.Key_Escape:
            self.hide()
            return
        if e.key() == Qt.Key_Down:
            if self._filtered:
                self._selected_idx = (self._selected_idx + 1) % len(self._filtered)
                self._apply_selection_style()
            return
        if e.key() == Qt.Key_Up:
            if self._filtered:
                self._selected_idx = (self._selected_idx - 1) % len(self._filtered)
                self._apply_selection_style()
            return
        if e.key() == Qt.Key_Tab:
            # Tab = 填变量
            if 0 <= self._selected_idx < len(self._filtered):
                p = self._filtered[self._selected_idx]
                self._open_var_dialog(p)
            return
        super().keyPressEvent(e)

    # ===== 显示/隐藏 =====
    def show_near_cursor(self):
        self.refresh_data()
        self._search.clear()
        self._search.setFocus()

        # 默认在鼠标附近显示
        cursor_pos = QCursor.pos()
        screen = QApplication.screenAt(cursor_pos)
        if screen is None:
            screen = QApplication.primaryScreen()
        sg = screen.availableGeometry()

        x = cursor_pos.x() + 16
        y = cursor_pos.y() + 16
        w = self.width()
        h = self.height()
        if x + w > sg.right() - 8:
            x = cursor_pos.x() - w - 16
        if y + h > sg.bottom() - 8:
            y = cursor_pos.y() - h - 16
        if x < sg.left() + 8:
            x = sg.left() + 8
        if y < sg.top() + 8:
            y = sg.top() + 8
        self.move(x, y)

        self.show()
        self.raise_()
        self.activateWindow()
        self._search.setFocus()

    def focusOutEvent(self, e):
        # 失焦自动隐藏（但要排除变量弹窗的情况）
        if self._var_dialog and self._var_dialog.isVisible():
            return
        # 稍延迟，避免点击列表项时被误触发
        QTimer.singleShot(120, self._check_hide)

    def _check_hide(self):
        if self._var_dialog and self._var_dialog.isVisible():
            return
        # 如果当前焦点仍在面板或其子控件中，不隐藏
        foc = QApplication.focusWidget()
        if foc and self.isAncestorOf(foc):
            return
        self.hide()
