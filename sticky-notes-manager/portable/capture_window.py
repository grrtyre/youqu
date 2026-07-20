# -*- coding: utf-8 -*-
"""便签管家便携版 - 快速捕获小窗
输入法式体验：全局热键唤起 → 写标题/内容 → 保存 → 自动隐藏
"""

from __future__ import annotations

import os
import sys
from typing import Optional

from PySide6.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QPoint, QRect
from PySide6.QtGui import QColor, QCursor, QFont, QGuiApplication, QIcon, QPainter, QPaintEvent, QKeyEvent, QBrush, QPalette
from PySide6.QtWidgets import (
    QComboBox,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QPushButton,
    QSizePolicy,
    QPlainTextEdit,
    QVBoxLayout,
    QWidget,
)

import note_store
from note_store import COLORS, CATEGORIES
from styles import (
    APPLE_BLUE,
    APPLE_BORDER,
    APPLE_BG,
    APPLE_TEXT,
    APPLE_TEXT_SECONDARY,
    APPLE_TEXT_TERTIARY,
    GLOBAL_QSS,
)


class ColorDotButton(QPushButton):
    """颜色圆点按钮"""

    def __init__(self, color_key: str, parent: Optional[QWidget] = None) -> None:
        super().__init__(parent)
        self.color_key = color_key
        self.setCheckable(True)
        self.setObjectName("colorDot")
        dot = COLORS[color_key]["dot"]
        # 用 styleSheet 给按钮"画"圆点
        self.setStyleSheet(
            f"QPushButton#colorDot {{ background: {dot}; border-radius: 11px; border: 2px solid transparent; }}"
            f"QPushButton#colorDot:hover {{ border: 2px solid {APPLE_BORDER}; }}"
            f"QPushButton#colorDot:checked {{ border: 2px solid {APPLE_TEXT_SECONDARY}; }}"
        )
        self.setFixedSize(22, 22)
        self.setCursor(Qt.PointingHandCursor)
        self.setToolTip(COLORS[color_key]["name"])


class CaptureWindow(QMainWindow):
    """快速捕获便签小窗"""

    WIDTH = 380
    HEIGHT = 320

    def __init__(self, data_path: Optional[str] = None, parent_tray: Optional[object] = None) -> None:
        super().__init__()
        self.data_path = data_path or note_store.default_data_path()
        self.parent_tray = parent_tray
        self._current_color = "default"
        self._current_category = "其他"

        # 窗口属性
        self.setWindowTitle("便签管家 - 快速记录")
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.WindowStaysOnTopHint
            | Qt.Tool
            | Qt.WindowDoesNotAcceptFocus  # 不抢焦点 - 实际仍需接受焦点，故不用
        )
        # 重新设置 flags（保留焦点接受能力）
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setMinimumSize(self.WIDTH, self.HEIGHT)
        self.setMaximumSize(self.WIDTH, self.HEIGHT)
        self.setStyleSheet("QMainWindow { background: transparent; }")

        self._build_ui()
        self.setStyleSheet(GLOBAL_QSS)

        # 失焦自动隐藏（200ms 延迟，避免点击窗口内控件时误判）
        self._blur_timer = QTimer(self)
        self._blur_timer.setSingleShot(True)
        self._blur_timer.timeout.connect(self._on_blur_hide)
        self._blur_delay = 200

        # 进入/退出动画
        self._fade_anim: Optional[QPropertyAnimation] = None

    # === UI 构建 ===

    def _build_ui(self) -> None:
        # 外层阴影容器（透明背景，圆角白色卡片）
        outer = QWidget(self)
        outer.setObjectName("outerContainer")
        outer.setStyleSheet("QWidget#outerContainer { background: transparent; }")
        self.setCentralWidget(outer)

        root = QFrame(outer)
        root.setObjectName("rootFrame")
        # 给 root 加一层细腻阴影通过 QGraphicsDropShadowEffect
        from PySide6.QtWidgets import QGraphicsDropShadowEffect

        shadow = QGraphicsDropShadowEffect(root)
        shadow.setBlurRadius(28)
        shadow.setColor(QColor(0, 0, 0, 50))
        shadow.setOffset(0, 6)
        root.setGraphicsEffect(shadow)

        root_layout = QVBoxLayout(outer)
        root_layout.setContentsMargins(10, 10, 10, 10)
        root_layout.addWidget(root)

        layout = QVBoxLayout(root)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(10)

        # 标题栏（更明显的视觉权重）
        header = QHBoxLayout()
        header.setSpacing(8)
        title_icon = QLabel("📝")
        title_icon.setStyleSheet("font-size: 16px; background: transparent;")
        title_label = QLabel("快速记录")
        title_label.setObjectName("titleLabel")
        title_label.setStyleSheet("background: transparent;")
        header.addWidget(title_icon)
        header.addWidget(title_label)
        header.addStretch()

        hint = QLabel("Esc 关闭 · Ctrl+Enter 保存")
        hint.setObjectName("hintLabel")
        hint.setStyleSheet("background: transparent;")
        header.addWidget(hint)
        layout.addLayout(header)

        # 标题栏下细分隔线（清晰视觉分离）
        header_divider = QFrame(root)
        header_divider.setObjectName("divider")
        header_divider.setFixedHeight(1)
        layout.addWidget(header_divider)

        # 标题输入
        self.title_input = QLineEdit(root)
        self.title_input.setPlaceholderText("标题（可选）")
        self.title_input.setMaxLength(80)
        layout.addWidget(self.title_input)

        # 内容输入
        self.content_input = QPlainTextEdit(root)
        self.content_input.setPlaceholderText("记下点什么…")
        self.content_input.setFixedHeight(72)
        # 左对齐 + 顶对齐（通过 document 的 defaultTextOption）
        from PySide6.QtGui import QTextOption
        doc = self.content_input.document()
        opt = doc.defaultTextOption()
        opt.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        doc.setDefaultTextOption(opt)
        layout.addWidget(self.content_input)

        # 颜色圆点行 + 分类
        meta_row = QHBoxLayout()
        meta_row.setSpacing(10)

        color_label = QLabel("颜色")
        color_label.setObjectName("sectionLabel")
        color_label.setStyleSheet("background: transparent;")
        meta_row.addWidget(color_label)

        self.color_dots: list[ColorDotButton] = []
        for key in COLORS.keys():
            dot = ColorDotButton(key, root)
            dot.clicked.connect(lambda checked=False, k=key: self._select_color(k))
            self.color_dots.append(dot)
            meta_row.addWidget(dot)

        meta_row.addSpacing(14)

        cat_label = QLabel("分类")
        cat_label.setObjectName("sectionLabel")
        cat_label.setStyleSheet("background: transparent;")
        meta_row.addWidget(cat_label)

        self.category_combo = QComboBox(root)
        self.category_combo.addItems(CATEGORIES)
        self.category_combo.setCurrentText("其他")
        self.category_combo.setFixedHeight(28)
        self.category_combo.currentTextChanged.connect(self._on_category_changed)
        meta_row.addWidget(self.category_combo)
        meta_row.addStretch()
        layout.addLayout(meta_row)

        # 默认选中 default 颜色
        self._select_color("default")

        # 细分隔线
        divider = QFrame(root)
        divider.setObjectName("divider")
        divider.setFixedHeight(1)
        layout.addWidget(divider)

        # 底部按钮行
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)

        self.continue_btn = QPushButton("保存并继续", root)
        self.continue_btn.setObjectName("ghostBtn")
        self.continue_btn.setCursor(Qt.PointingHandCursor)
        self.continue_btn.setFixedHeight(30)
        self.continue_btn.setToolTip("Ctrl+Shift+Enter")
        self.continue_btn.clicked.connect(lambda: self._save_and_continue())

        self.cancel_btn = QPushButton("取消", root)
        # 普通次级按钮（带边框，与 ghost 区分）
        self.cancel_btn.setCursor(Qt.PointingHandCursor)
        self.cancel_btn.setFixedHeight(30)
        self.cancel_btn.setStyleSheet(
            f"QPushButton {{ background: {APPLE_BG}; border: 1px solid {APPLE_BORDER}; border-radius: 8px; padding: 0 14px; color: {APPLE_TEXT}; font-size: 13px; }}"
            f"QPushButton:hover {{ background: #ebebf0; }}"
            f"QPushButton:pressed {{ background: {APPLE_BORDER}; }}"
        )
        self.cancel_btn.clicked.connect(self.hide)

        self.save_btn = QPushButton("保存并关闭", root)
        self.save_btn.setObjectName("primaryBtn")
        self.save_btn.setCursor(Qt.PointingHandCursor)
        self.save_btn.setDefault(True)
        self.save_btn.setFixedHeight(30)
        self.save_btn.setMinimumWidth(96)
        self.save_btn.setToolTip("Ctrl+Enter")
        self.save_btn.clicked.connect(self._save_and_close)

        btn_row.addWidget(self.continue_btn)
        btn_row.addStretch()

        # 字数统计（嵌入按钮行，节省垂直空间）
        self.counter = QLabel("0 字")
        self.counter.setObjectName("counterLabel")
        self.counter.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self.counter.setStyleSheet("background: transparent;")
        btn_row.addWidget(self.counter)

        btn_row.addSpacing(4)
        btn_row.addWidget(self.cancel_btn)
        btn_row.addWidget(self.save_btn)
        layout.addLayout(btn_row)

        self.content_input.textChanged.connect(self._update_counter)
        self.title_input.textChanged.connect(self._update_counter)

    # === 事件处理 ===

    def _select_color(self, key: str) -> None:
        self._current_color = key
        for dot in self.color_dots:
            dot.setChecked(dot.color_key == key)

    def _on_category_changed(self, text: str) -> None:
        self._current_category = text

    def _update_counter(self) -> None:
        text = (self.title_input.text() + " " + self.content_input.toPlainText()).strip()
        self.counter.setText(f"{len(text)} 字")

    def _save_and_continue(self) -> bool:
        if not self._commit_save():
            return False
        self.title_input.clear()
        self.content_input.clear()
        self._select_color("default")
        self.category_combo.setCurrentText("其他")
        self.title_input.setFocus()
        return True

    def _save_and_close(self) -> None:
        if self._commit_save():
            self.hide()

    def _commit_save(self) -> bool:
        title = self.title_input.text().strip()
        content = self.content_input.toPlainText().strip()
        if not title and not content:
            return False
        data = note_store.load_all(self.data_path)
        new_notes, _ = note_store.add_note(data["notes"], {
            "title": title,
            "content": content,
            "color": self._current_color,
            "category": self._current_category,
        })
        note_store.save_all(new_notes, data["trash"], self.data_path)
        # 通知托盘
        if self.parent_tray is not None and hasattr(self.parent_tray, "on_note_added"):
            self.parent_tray.on_note_added()
        return True

    def _on_blur_hide(self) -> None:
        """失焦后延迟隐藏"""
        # 如果有弹出的子对话框激活，不隐藏
        if QGuiApplication.focusWindow() is None:
            self.hide()

    # === 窗口显示/隐藏 ===

    def show_near_cursor(self) -> None:
        """在鼠标附近显示（输入法式）"""
        # 自动清理回收站
        try:
            data = note_store.load_all(self.data_path)
            new_trash = note_store.auto_clean_trash(data["trash"])
            if len(new_trash) != len(data["trash"]):
                note_store.save_all(data["notes"], new_trash, self.data_path)
        except Exception:
            pass

        # 计算显示位置（鼠标右下角偏移，避免遮挡）
        cursor_pos = QCursor.pos()
        screen = QGuiApplication.screenAt(cursor_pos)
        if screen is None:
            screen = QGuiApplication.primaryScreen()
        geo = screen.availableGeometry()

        x = cursor_pos.x() + 12
        y = cursor_pos.y() + 12
        if x + self.WIDTH > geo.right():
            x = cursor_pos.x() - self.WIDTH - 12
        if y + self.HEIGHT > geo.bottom():
            y = cursor_pos.y() - self.HEIGHT - 12
        x = max(geo.left(), min(x, geo.right() - self.WIDTH))
        y = max(geo.top(), min(y, geo.bottom() - self.HEIGHT))

        self.move(x, y)
        self._show_with_fade()

    def _show_with_fade(self) -> None:
        """淡入显示"""
        self.show()
        self.raise_()
        self.activateWindow()
        self.title_input.setFocus()

        # 动画
        if self._fade_anim is not None:
            self._fade_anim.stop()
        # 用 windowOpacity 实现淡入
        self.setWindowOpacity(0.0)
        self._fade_anim = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade_anim.setDuration(120)
        self._fade_anim.setStartValue(0.0)
        self._fade_anim.setEndValue(1.0)
        self._fade_anim.setEasingCurve(QEasingCurve.OutCubic)
        self._fade_anim.start()

    def hide(self) -> None:  # type: ignore[override]
        """淡出隐藏"""
        if not self.isVisible():
            return
        if self._fade_anim is not None:
            self._fade_anim.stop()
        self._fade_anim = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade_anim.setDuration(100)
        self._fade_anim.setStartValue(self.windowOpacity())
        self._fade_anim.setEndValue(0.0)
        self._fade_anim.setEasingCurve(QEasingCurve.InCubic)
        self._fade_anim.finished.connect(super().hide)
        self._fade_anim.start()
        # 清空输入（避免下次显示残留）
        QTimer.singleShot(120, self._reset_inputs)

    def _reset_inputs(self) -> None:
        self.title_input.clear()
        self.content_input.clear()
        self._select_color("default")
        self.category_combo.setCurrentText("其他")

    # === 事件重写 ===

    def keyPressEvent(self, event: QKeyEvent) -> None:  # type: ignore[override]
        key = event.key()
        mod = event.modifiers()
        if key == Qt.Key_Escape:
            self.hide()
            return
        if key == Qt.Key_Return or key == Qt.Key_Enter:
            if mod & Qt.ControlModifier and mod & Qt.ShiftModifier:
                self._save_and_continue()
                return
            if mod & Qt.ControlModifier:
                self._save_and_close()
                return
        super().keyPressEvent(event)

    def changeEvent(self, event) -> None:  # type: ignore[override]
        """失焦自动隐藏"""
        if event.type() == event.Type.ActivationChange:
            if not self.isActiveWindow() and self.isVisible():
                self._blur_timer.start(self._blur_delay)
            else:
                self._blur_timer.stop()
        super().changeEvent(event)
