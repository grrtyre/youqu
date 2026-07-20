# -*- coding: utf-8 -*-
"""便签管家便携版 - 便签列表窗口
小窗口（≤400×500）：搜索、分类筛选、便签列表、置顶/编辑/删除
"""

from __future__ import annotations

from typing import Optional, List, Dict, Any

from PySide6.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve, QSize
from PySide6.QtGui import QColor, QCursor, QGuiApplication, QIcon, QKeyEvent, QFont
from PySide6.QtWidgets import (
    QComboBox,
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

import note_store
from note_store import COLORS, CATEGORIES
from styles import (
    APPLE_BG,
    APPLE_BORDER,
    APPLE_TEXT,
    APPLE_TEXT_SECONDARY,
    APPLE_TEXT_TERTIARY,
    APPLE_BLUE,
    GLOBAL_QSS,
)


class NoteCard(QWidget):
    """便签卡片 widget"""

    def __init__(self, note: Dict[str, Any], parent_window: "ListWindow") -> None:
        super().__init__(parent_window)
        self.note = note
        self.parent_window = parent_window
        self._build_ui()

    def _build_ui(self) -> None:
        # 卡片本体
        self.setObjectName("noteCard" if not self.note.get("pinned") else "noteCardPinned")
        if self.note.get("pinned"):
            self.setStyleSheet(
                "QFrame#noteCardPinned { background: #fffdf5; border: 1px solid #ffe694; border-radius: 10px; }"
                "QFrame#noteCardPinned:hover { border: 1px solid #ffcc66; }"
            )
        else:
            self.setStyleSheet(
                f"QFrame#noteCard {{ background: white; border: 1px solid {APPLE_BORDER}; border-radius: 10px; }}"
                f"QFrame#noteCard:hover {{ border: 1px solid #c7c7cc; background: #fafafc; }}"
            )

        layout = QVBoxLayout(self)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(8)

        # 第 1 行：颜色点 + 标题 + 置顶按钮
        top = QHBoxLayout()
        top.setSpacing(8)

        color_dot = QLabel()
        dot_color = COLORS.get(self.note.get("color", "default"), COLORS["default"])["dot"]
        color_dot.setFixedSize(10, 10)
        color_dot.setStyleSheet(
            f"background: {dot_color}; border-radius: 5px; border: 1px solid rgba(0,0,0,15);"
        )
        # 垂直居中对齐
        color_dot.setAlignment(Qt.AlignVCenter)
        top.addWidget(color_dot)

        title = QLabel(self.note.get("title") or "（无标题）")
        title.setObjectName("noteTitle")
        title.setStyleSheet("background: transparent;")
        # 截断长标题
        title_elided = self._elide_text(self.note.get("title") or "（无标题）", 200)
        title.setText(title_elided)
        title.setToolTip(self.note.get("title") or "")
        top.addWidget(title, 1)

        # 置顶按钮
        pin_btn = QPushButton("📌" if self.note.get("pinned") else "📍", self)
        pin_btn.setObjectName("toolBtn")
        pin_btn.setCheckable(True)
        pin_btn.setChecked(bool(self.note.get("pinned")))
        pin_btn.setFixedSize(28, 28)
        pin_btn.setCursor(Qt.PointingHandCursor)
        pin_btn.setToolTip("已置顶" if self.note.get("pinned") else "点击置顶")
        pin_btn.clicked.connect(lambda: self.parent_window.toggle_pin(self.note["id"]))
        top.addWidget(pin_btn)

        layout.addLayout(top)

        # 第 2 行：内容预览
        content_text = self.note.get("content") or ""
        if content_text:
            content = QLabel(self._elide_text(content_text.replace("\n", " "), 280))
            content.setObjectName("noteContent")
            content.setWordWrap(False)
            content.setStyleSheet("background: transparent;")
            content.setToolTip(content_text)
            layout.addWidget(content)

        # 第 3 行：分类标签 + 时间 + 操作（垂直居中对齐）
        bottom = QHBoxLayout()
        bottom.setSpacing(8)

        cat_tag = QLabel(self.note.get("category", "其他"))
        cat_tag.setObjectName("noteCategoryTag")
        cat_tag.setStyleSheet(
            f"font-size: 11px; color: {APPLE_BLUE}; background: #e3f0ff; "
            f"border-radius: 4px; padding: 2px 8px; font-weight: 500;"
        )
        cat_tag.setAlignment(Qt.AlignVCenter)
        bottom.addWidget(cat_tag)

        time_label = QLabel(note_store.format_relative_time(self.note.get("updatedAt", 0)))
        time_label.setObjectName("noteMeta")
        time_label.setStyleSheet("background: transparent;")
        time_label.setAlignment(Qt.AlignVCenter)
        bottom.addWidget(time_label)

        bottom.addStretch()

        edit_btn = QPushButton("编辑", self)
        edit_btn.setObjectName("toolBtn")
        edit_btn.setCursor(Qt.PointingHandCursor)
        edit_btn.setFixedHeight(24)
        edit_btn.setStyleSheet(
            f"QPushButton#toolBtn {{ color: {APPLE_TEXT_SECONDARY}; background: transparent; border: none; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }}"
            f"QPushButton#toolBtn:hover {{ background: {APPLE_BG}; color: {APPLE_BLUE}; }}"
        )
        edit_btn.clicked.connect(lambda: self.parent_window.edit_note(self.note["id"]))
        bottom.addWidget(edit_btn)

        del_btn = QPushButton("删除", self)
        del_btn.setObjectName("toolBtn")
        del_btn.setCursor(Qt.PointingHandCursor)
        del_btn.setFixedHeight(24)
        del_btn.setStyleSheet(
            f"QPushButton#toolBtn {{ color: #ff3b30; background: transparent; border: none; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }}"
            f"QPushButton#toolBtn:hover {{ background: #fff0f0; }}"
        )
        del_btn.clicked.connect(lambda: self.parent_window.delete_note(self.note["id"]))
        bottom.addWidget(del_btn)

        layout.addLayout(bottom)

    def _elide_text(self, text: str, max_pixels: int) -> str:
        """简单截断（按字符数）"""
        if not text:
            return ""
        max_chars = 40
        if len(text) > max_chars:
            return text[:max_chars] + "…"
        return text


class ListWindow(QMainWindow):
    """便签列表窗口"""

    WIDTH = 380
    HEIGHT = 500

    def __init__(self, data_path: Optional[str] = None, parent_tray: Optional[object] = None) -> None:
        super().__init__()
        self.data_path = data_path or note_store.default_data_path()
        self.parent_tray = parent_tray
        self._notes: List[Dict[str, Any]] = []
        self._trash: List[Dict[str, Any]] = []
        self._keyword = ""
        self._category = "全部"

        self.setWindowTitle("便签管家 - 便签列表")
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setMinimumSize(self.WIDTH, self.HEIGHT)
        self.setMaximumSize(self.WIDTH, self.HEIGHT)
        self.setStyleSheet("QMainWindow { background: transparent; }")

        self._build_ui()
        self.setStyleSheet(GLOBAL_QSS)

        self._blur_timer = QTimer(self)
        self._blur_timer.setSingleShot(True)
        self._blur_timer.timeout.connect(self._on_blur_hide)
        self._blur_delay = 250

        self._fade_anim: Optional[QPropertyAnimation] = None

    def _build_ui(self) -> None:
        outer = QWidget(self)
        outer.setObjectName("outerContainer")
        outer.setStyleSheet("QWidget#outerContainer { background: transparent; }")
        self.setCentralWidget(outer)

        root = QFrame(outer)
        root.setObjectName("rootFrame")
        shadow = QGraphicsDropShadowEffect(root)
        shadow.setBlurRadius(28)
        shadow.setColor(QColor(0, 0, 0, 50))
        shadow.setOffset(0, 6)
        root.setGraphicsEffect(shadow)

        root_layout = QVBoxLayout(outer)
        root_layout.setContentsMargins(10, 10, 10, 10)
        root_layout.addWidget(root)

        layout = QVBoxLayout(root)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(8)

        # 标题栏
        header = QHBoxLayout()
        header.setSpacing(8)
        title = QLabel("📚 便签列表")
        title.setObjectName("titleLabel")
        title.setStyleSheet("background: transparent;")
        header.addWidget(title)
        header.addStretch()

        new_btn = QPushButton("＋ 新建", root)
        new_btn.setObjectName("primaryBtn")
        new_btn.setCursor(Qt.PointingHandCursor)
        new_btn.setFixedHeight(26)
        new_btn.clicked.connect(self._on_new_note)
        header.addWidget(new_btn)

        close_btn = QPushButton("×", root)
        close_btn.setObjectName("ghostBtn")
        close_btn.setStyleSheet(
            f"QPushButton {{ background: transparent; border: none; color: {APPLE_TEXT_SECONDARY}; font-size: 18px; padding: 0 8px; }}"
            f"QPushButton:hover {{ color: {APPLE_TEXT}; }}"
        )
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.setFixedSize(28, 28)
        close_btn.clicked.connect(self.hide)
        header.addWidget(close_btn)
        layout.addLayout(header)

        # 统计行
        self.stats_label = QLabel("")
        self.stats_label.setObjectName("hintLabel")
        self.stats_label.setStyleSheet("background: transparent;")
        layout.addWidget(self.stats_label)

        # 搜索框 + 分类
        filter_row = QHBoxLayout()
        filter_row.setSpacing(6)

        self.search_input = QLineEdit(root)
        self.search_input.setObjectName("searchBox")
        self.search_input.setPlaceholderText("搜索标题或内容…")
        self.search_input.setFixedHeight(30)
        self.search_input.textChanged.connect(self._on_search_changed)
        filter_row.addWidget(self.search_input, 1)

        self.category_combo = QComboBox(root)
        self.category_combo.addItems(["全部"] + CATEGORIES)
        self.category_combo.setFixedHeight(30)
        self.category_combo.setFixedWidth(80)
        self.category_combo.currentTextChanged.connect(self._on_category_changed)
        filter_row.addWidget(self.category_combo)
        layout.addLayout(filter_row)

        # 列表
        self.list_widget = QListWidget(root)
        self.list_widget.setFrameShape(QListWidget.NoFrame)
        self.list_widget.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.list_widget.setSpacing(8)
        self.list_widget.setContentsMargins(0, 0, 0, 0)
        self.list_widget.setStyleSheet(
            f"QListWidget {{ background: transparent; border: none; }}"
            f"QListWidget::item {{ background: transparent; border: none; padding: 0; margin: 0; }}"
        )
        self.list_widget.itemDoubleClicked.connect(self._on_item_double_clicked)
        layout.addWidget(self.list_widget, 1)

        # 底部信息栏（带细分隔线，回收站按钮左对齐避免漂浮感）
        footer_divider = QFrame(root)
        footer_divider.setObjectName("divider")
        footer_divider.setFixedHeight(1)
        layout.addWidget(footer_divider)

        footer = QHBoxLayout()
        footer.setSpacing(8)
        footer.setContentsMargins(0, 4, 0, 0)

        trash_btn = QPushButton("🗑 回收站", root)
        trash_btn.setObjectName("ghostBtn")
        trash_btn.setCursor(Qt.PointingHandCursor)
        trash_btn.setStyleSheet(
            f"QPushButton {{ background: transparent; border: none; color: {APPLE_TEXT_SECONDARY}; font-size: 11px; padding: 4px 8px; border-radius: 4px; }}"
            f"QPushButton:hover {{ color: {APPLE_BLUE}; background: {APPLE_BG}; }}"
        )
        trash_btn.clicked.connect(self._show_trash)
        footer.addWidget(trash_btn)

        footer.addStretch()

        self.empty_state = QLabel("")
        self.empty_state.setObjectName("hintLabel")
        self.empty_state.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        self.empty_state.setStyleSheet(
            f"color: {APPLE_TEXT_TERTIARY}; font-size: 11px; background: transparent;"
        )
        footer.addWidget(self.empty_state)
        layout.addLayout(footer)

    # === 数据加载与渲染 ===

    def reload(self) -> None:
        """重新加载并渲染"""
        data = note_store.load_all(self.data_path)
        # 自动清理过期回收站
        new_trash = note_store.auto_clean_trash(data["trash"])
        if len(new_trash) != len(data["trash"]):
            note_store.save_all(data["notes"], new_trash, self.data_path)
            data["trash"] = new_trash
        self._notes = data["notes"]
        self._trash = data["trash"]
        self._refresh_list()
        self._update_stats()

    def _refresh_list(self) -> None:
        """刷新列表显示"""
        filtered = note_store.filter_by_category(self._notes, self._category)
        filtered = note_store.search_notes(filtered, self._keyword)
        filtered = note_store.sort_notes(filtered)

        self.list_widget.clear()

        if not filtered:
            self.empty_state.setText(
                "暂无便签 · 全局快捷键唤起快速记录" if not self._notes else "没有匹配的便签"
            )
            self.empty_state.setVisible(True)
            return

        self.empty_state.setVisible(False)

        for note in filtered:
            item = QListWidgetItem(self.list_widget)
            item.setData(Qt.UserRole, note["id"])
            card = NoteCard(note, self)
            item.setSizeHint(card.sizeHint())
            self.list_widget.setItemWidget(item, card)

    def _update_stats(self) -> None:
        stats = note_store.get_stats(self._notes)
        self.stats_label.setText(
            f"共 {stats['total']} 条 · 置顶 {stats['pinned']} · 回收站 {len(self._trash)} 条"
        )

    # === 事件回调 ===

    def _on_search_changed(self, text: str) -> None:
        self._keyword = text
        self._refresh_list()

    def _on_category_changed(self, text: str) -> None:
        self._category = text
        self._refresh_list()

    def _on_new_note(self) -> None:
        self.hide()
        if self.parent_tray is not None and hasattr(self.parent_tray, "show_capture"):
            self.parent_tray.show_capture()

    def _on_item_double_clicked(self, item: QListWidgetItem) -> None:
        note_id = item.data(Qt.UserRole)
        self.edit_note(note_id)

    # === 操作 ===

    def toggle_pin(self, note_id: str) -> None:
        new_notes, _ = note_store.toggle_pin(self._notes, note_id)
        self._notes = new_notes
        note_store.save_all(self._notes, self._trash, self.data_path)
        self._refresh_list()
        self._update_stats()

    def delete_note(self, note_id: str) -> None:
        new_notes, new_trash, _ = note_store.move_to_trash(self._notes, self._trash, note_id)
        self._notes = new_notes
        self._trash = new_trash
        note_store.save_all(self._notes, self._trash, self.data_path)
        self._refresh_list()
        self._update_stats()
        if self.parent_tray is not None and hasattr(self.parent_tray, "on_note_changed"):
            self.parent_tray.on_note_changed()

    def edit_note(self, note_id: str) -> None:
        """编辑便签 - 通过托盘唤起捕获窗口（编辑模式）"""
        if self.parent_tray is not None and hasattr(self.parent_tray, "edit_note"):
            self.hide()
            self.parent_tray.edit_note(note_id)

    def _show_trash(self) -> None:
        """简易回收站提示"""
        if not self._trash:
            self.empty_state.setText("回收站为空")
            self.empty_state.setVisible(True)
            return
        # 简单列表 - 显示数量与最近条目
        recent = self._trash[:3]
        msg = f"回收站共 {len(self._trash)} 条（最近删除）：\n"
        for t in recent:
            title = t.get("title") or "（无标题）"
            days_left = note_store.get_trash_days_left(t)
            msg += f"  · {title}（剩 {days_left} 天自动清理）\n"
        if len(self._trash) > 3:
            msg += f"  …还有 {len(self._trash) - 3} 条"
        self.empty_state.setText(msg)
        self.empty_state.setVisible(True)

    # === 窗口显示 ===

    def show_near_cursor(self) -> None:
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
        self.reload()
        self._show_with_fade()

    def _show_with_fade(self) -> None:
        self.show()
        self.raise_()
        self.activateWindow()
        self.search_input.setFocus()

        if self._fade_anim is not None:
            self._fade_anim.stop()
        self.setWindowOpacity(0.0)
        self._fade_anim = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade_anim.setDuration(120)
        self._fade_anim.setStartValue(0.0)
        self._fade_anim.setEndValue(1.0)
        self._fade_anim.setEasingCurve(QEasingCurve.OutCubic)
        self._fade_anim.start()

    def hide(self) -> None:  # type: ignore[override]
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

    def _on_blur_hide(self) -> None:
        if QGuiApplication.focusWindow() is None:
            self.hide()

    def changeEvent(self, event) -> None:  # type: ignore[override]
        if event.type() == event.Type.ActivationChange:
            if not self.isActiveWindow() and self.isVisible():
                self._blur_timer.start(self._blur_delay)
            else:
                self._blur_timer.stop()
        super().changeEvent(event)

    def keyPressEvent(self, event: QKeyEvent) -> None:  # type: ignore[override]
        if event.key() == Qt.Key_Escape:
            self.hide()
            return
        super().keyPressEvent(event)
