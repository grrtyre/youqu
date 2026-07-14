# -*- coding: utf-8 -*-
"""拾色管家·便携版 - 主面板

输入法式弹出面板（380×500）：
- 顶部当前色大色块 + HEX/RGB/HSL 多格式按钮（点击复制）
- 中部历史颜色网格（点击复制）
- 底部默认调色板网格（点击复制）
- 失焦自动隐藏
- 苹果白高端风格
"""

from __future__ import annotations

import os
from typing import Optional

from PySide6.QtCore import Qt, Signal, QTimer, QEvent
from PySide6.QtGui import (
    QPixmap, QIcon, QColor, QFont, QKeyEvent, QGuiApplication,
)
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QFrame, QLabel, QPushButton,
    QScrollArea, QGraphicsDropShadowEffect, QButtonGroup, QGridLayout,
    QSizePolicy,
)

from color_core import (
    format_color, push_history, add_color_to_palette, remove_color_from_palette,
    clear_history,
)
from styles import APPLE_WHITE_QSS


# ================================================================
#  颜色单元格（历史 / 调色板网格中的小卡片）
# ================================================================

class ColorCell(QFrame):
    """单个颜色卡片：色块 + HEX 标签。"""

    clicked = Signal(str)        # hex
    remove_clicked = Signal(str) # hex（调色板移除）

    def __init__(self, hex_str: str, show_remove: bool = False, parent=None):
        super().__init__(parent)
        self.hex_str = hex_str
        self.setObjectName('colorCell')
        self.setFixedSize(78, 60)
        self.setCursor(Qt.PointingHandCursor)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # 色块
        swatch = QLabel()
        swatch.setObjectName('colorSwatch')
        swatch.setFixedHeight(40)
        swatch.setStyleSheet(f'background: {hex_str}; border-top-left-radius: 9px; border-top-right-radius: 9px;')
        layout.addWidget(swatch)

        # HEX 标签
        label = QLabel(hex_str.upper())
        label.setObjectName('colorLabel')
        label.setAlignment(Qt.AlignCenter)
        layout.addWidget(label)

        if show_remove:
            rm_btn = QPushButton('×')
            rm_btn.setObjectName('iconBtn')
            rm_btn.setFixedSize(14, 14)
            # 更弱化的删除图标：半透明白底，hover 时才变红
            rm_btn.setStyleSheet(
                'QPushButton { background: rgba(255,255,255,0.82); border-radius: 7px; '
                'border: none; '
                'color: #8e8e93; font-size: 11px; font-weight: 600; padding: 0; }'
                'QPushButton:hover { background: #ff3b30; color: white; }'
            )
            # 浮在右上角
            rm_btn.setParent(self)
            rm_btn.move(58, 4)
            rm_btn.clicked.connect(lambda: self.remove_clicked.emit(self.hex_str))
            rm_btn.show()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit(self.hex_str)


# ================================================================
#  主面板
# ================================================================

class ColorPickerPanel(QWidget):
    """输入法式弹出主面板。"""

    pick_requested = Signal()       # 请求开始取色
    color_copied = Signal(str)      # 已复制颜色到剪贴板（用于状态提示）

    def __init__(self, store: dict, store_path: str, parent=None, auto_hide: bool = True):
        super().__init__(parent)
        self.store = store
        self.store_path = store_path
        self._current_hex: Optional[str] = None
        self._auto_hide = auto_hide
        self._screenshot_mode = not auto_hide  # 截图模式：浅灰背景替代透明

        # 窗口属性：无边框 + 置顶 + 工具窗口
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.WindowStaysOnTopHint
            | Qt.Tool
        )
        if self._screenshot_mode:
            # 截图模式：不透明，浅灰底（PrintWindow 无法正确渲染透明背景）
            self.setAttribute(Qt.WA_TranslucentBackground, False)
            self.setStyleSheet('background: #f5f5f7;')
        else:
            self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(380, 500)

        self._build_ui()
        self.setStyleSheet(APPLE_WHITE_QSS + ('\n#contentWidget { background: #ffffff; border-radius: 16px; }' if self._screenshot_mode else ''))

        # 失焦自动隐藏（可通过 auto_hide=False 禁用，用于截图测试）
        if self._auto_hide:
            self.installEventFilter(self)

    # ----------------------------------------------------------------
    #  UI 构建
    # ----------------------------------------------------------------

    def _build_ui(self):
        # 外层透明容器（留 12px 边距给阴影）
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(0)

        # 内容容器（白色圆角 + 阴影）
        self.content = QFrame()
        self.content.setObjectName('contentWidget')
        root.addWidget(self.content)

        # 更细腻的多层阴影：大模糊 + 小偏移 + 低透明度
        shadow = QGraphicsDropShadowEffect(self.content)
        shadow.setBlurRadius(36)
        shadow.setColor(QColor(0, 0, 0, 38))
        shadow.setOffset(0, 6)
        self.content.setGraphicsEffect(shadow)

        layout = QVBoxLayout(self.content)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._build_header(layout)
        self._build_current(layout)
        self._build_history(layout)
        self._build_palette(layout)
        self._build_status(layout)

    def _build_header(self, parent_layout: QVBoxLayout):
        header = QFrame()
        header.setObjectName('headerBar')
        header.setFixedHeight(46)
        h_layout = QHBoxLayout(header)
        h_layout.setContentsMargins(14, 0, 14, 0)
        h_layout.setSpacing(8)

        # 应用图标方块
        icon_label = QLabel('拾')
        icon_label.setObjectName('appIcon')
        icon_label.setFixedSize(22, 22)
        icon_label.setAlignment(Qt.AlignCenter)
        h_layout.addWidget(icon_label)

        title = QLabel('拾色管家·便携版')
        title.setObjectName('appTitle')
        h_layout.addWidget(title)
        h_layout.addStretch()

        # 取色按钮
        pick_btn = QPushButton('开始取色')
        pick_btn.setObjectName('primaryBtn')
        pick_btn.setCursor(Qt.PointingHandCursor)
        pick_btn.clicked.connect(self.pick_requested.emit)
        h_layout.addWidget(pick_btn)

        parent_layout.addWidget(header)

    def _build_current(self, parent_layout: QVBoxLayout):
        """当前颜色大色块 + 多格式按钮。"""
        cur_frame = QFrame()
        cur_layout = QVBoxLayout(cur_frame)
        cur_layout.setContentsMargins(16, 10, 16, 6)
        cur_layout.setSpacing(8)

        # 大色块 + 信息行
        top = QHBoxLayout()
        top.setSpacing(12)
        top.setAlignment(Qt.AlignLeft)

        self.swatch_label = QLabel()
        self.swatch_label.setObjectName('currentSwatch')
        self.swatch_label.setFixedSize(68, 68)
        self.swatch_label.setStyleSheet('background: #007aff; border-radius: 14px; border: 1px solid rgba(0,0,0,0.06);')
        top.addWidget(self.swatch_label)

        info_col = QVBoxLayout()
        info_col.setSpacing(3)
        info_col.setContentsMargins(0, 2, 0, 2)
        self.hex_label = QLabel('#007AFF')
        self.hex_label.setObjectName('currentHex')
        info_col.addWidget(self.hex_label)
        self.rgb_label = QLabel('rgb(0, 122, 255)')
        self.rgb_label.setObjectName('currentRgb')
        info_col.addWidget(self.rgb_label)
        info_col.addStretch()
        top.addLayout(info_col)
        top.addStretch()
        cur_layout.addLayout(top)

        # 多格式复制按钮（更宽敞、更大方）
        fmt_row = QHBoxLayout()
        fmt_row.setSpacing(8)
        self.format_buttons: dict[str, QPushButton] = {}
        for fmt, label in [('hex', 'HEX'), ('rgb', 'RGB'), ('hsl', 'HSL')]:
            btn = QPushButton(label)
            btn.setObjectName('formatBtn')
            btn.setProperty('active', 'true' if fmt == 'hex' else 'false')
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(lambda checked, f=fmt: self._copy_format(f))
            self.format_buttons[fmt] = btn
            fmt_row.addWidget(btn)
        fmt_row.addStretch()
        cur_layout.addLayout(fmt_row)

        parent_layout.addWidget(cur_frame)

    def _build_history(self, parent_layout: QVBoxLayout):
        """历史颜色区。"""
        section = QFrame()
        s_layout = QVBoxLayout(section)
        s_layout.setContentsMargins(16, 4, 16, 6)
        s_layout.setSpacing(6)

        title_row = QHBoxLayout()
        title = QLabel('历史拾色')
        title.setObjectName('sectionTitle')
        title_row.addWidget(title)
        title_row.addStretch()
        self.history_count_label = QLabel('0')
        self.history_count_label.setObjectName('sectionTitle')
        title_row.addWidget(self.history_count_label)
        s_layout.addLayout(title_row)

        # 滚动容器
        self.history_scroll = QScrollArea()
        self.history_scroll.setWidgetResizable(True)
        self.history_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.history_scroll.setFrameShape(QFrame.NoFrame)
        self.history_scroll.setFixedHeight(96)

        self.history_grid_widget = QWidget()
        self.history_grid = QGridLayout(self.history_grid_widget)
        self.history_grid.setContentsMargins(0, 0, 6, 0)
        self.history_grid.setSpacing(6)
        self.history_scroll.setWidget(self.history_grid_widget)
        s_layout.addWidget(self.history_scroll)

        parent_layout.addWidget(section)

        # 区段分隔线（极淡）
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet('background: #f0f0f2; border: none; margin-left: 16px; margin-right: 16px;')
        parent_layout.addWidget(sep)

    def _build_palette(self, parent_layout: QVBoxLayout):
        """默认调色板区。"""
        section = QFrame()
        s_layout = QVBoxLayout(section)
        s_layout.setContentsMargins(16, 4, 16, 12)
        s_layout.setSpacing(6)

        title_row = QHBoxLayout()
        title = QLabel('调色板')
        title.setObjectName('sectionTitle')
        title_row.addWidget(title)
        title_row.addStretch()
        s_layout.addLayout(title_row)

        # 滚动容器
        self.palette_scroll = QScrollArea()
        self.palette_scroll.setWidgetResizable(True)
        self.palette_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.palette_scroll.setFrameShape(QFrame.NoFrame)
        self.palette_scroll.setFixedHeight(96)

        self.palette_grid_widget = QWidget()
        self.palette_grid = QGridLayout(self.palette_grid_widget)
        self.palette_grid.setContentsMargins(0, 0, 6, 0)
        self.palette_grid.setSpacing(6)
        self.palette_scroll.setWidget(self.palette_grid_widget)
        s_layout.addWidget(self.palette_scroll)

        parent_layout.addWidget(section)

    def _build_status(self, parent_layout: QVBoxLayout):
        """底部状态栏。"""
        status = QFrame()
        status.setObjectName('statusBar')
        status.setFixedHeight(34)
        s_layout = QHBoxLayout(status)
        s_layout.setContentsMargins(14, 0, 14, 0)
        s_layout.setSpacing(10)

        self.status_label = QLabel('就绪')
        self.status_label.setObjectName('statusText')
        s_layout.addWidget(self.status_label)
        s_layout.addStretch()

        hint = QLabel('Ctrl+Shift+C 取色')
        hint.setObjectName('statusHint')
        s_layout.addWidget(hint)

        sep = QFrame()
        sep.setFixedWidth(1)
        sep.setFixedHeight(12)
        sep.setStyleSheet('background: #e0e0e4; border: none;')
        s_layout.addWidget(sep)

        clear_btn = QPushButton('清空历史')
        clear_btn.setObjectName('clearBtn')
        clear_btn.setCursor(Qt.PointingHandCursor)
        clear_btn.clicked.connect(self._on_clear_history)
        s_layout.addWidget(clear_btn)

        parent_layout.addWidget(status)

    # ----------------------------------------------------------------
    #  数据刷新
    # ----------------------------------------------------------------

    def refresh(self):
        """刷新整个面板（当前色 + 历史 + 调色板）。"""
        # 当前色
        if self._current_hex:
            self._apply_current_color(self._current_hex)

        # 历史
        self._refresh_history()
        # 调色板
        self._refresh_palette()

    def _refresh_history(self):
        # 清空
        while self.history_grid.count():
            item = self.history_grid.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        history = self.store.get('history', [])
        self.history_count_label.setText(f'{len(history)}')
        cols = 4
        for i, entry in enumerate(history[:40]):
            cell = ColorCell(entry.get('hex', '#000000').upper(), show_remove=False)
            cell.clicked.connect(self._on_cell_clicked)
            self.history_grid.addWidget(cell, i // cols, i % cols)
        if not history:
            empty = QLabel('暂无历史，按 Ctrl+Shift+C 开始取色')
            empty.setObjectName('sectionTitle')
            empty.setAlignment(Qt.AlignCenter)
            self.history_grid.addWidget(empty, 0, 0, 1, cols)

    def _refresh_palette(self):
        # 清空
        while self.palette_grid.count():
            item = self.palette_grid.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        # 取第一个调色板（便携版简化：只显示第一个）
        palettes = self.store.get('palettes', [])
        palette = palettes[0] if palettes else {'colors': []}
        cols = 4
        for i, hex_str in enumerate(palette.get('colors', [])[:40]):
            cell = ColorCell(hex_str.upper(), show_remove=True)
            cell.clicked.connect(self._on_cell_clicked)
            cell.remove_clicked.connect(self._on_palette_remove)
            self.palette_grid.addWidget(cell, i // cols, i % cols)

    # ----------------------------------------------------------------
    #  当前色操作
    # ----------------------------------------------------------------

    def set_current_color(self, hex_str: str):
        """设置当前颜色（取色完成时调用）。"""
        self._current_hex = hex_str
        self._apply_current_color(hex_str)
        # 添加到历史
        from color_core import hex_to_rgb
        rgb = hex_to_rgb(hex_str)
        if rgb:
            push_history(self.store, hex_str, rgb)
            self._save_store()
            self._refresh_history()

    def _apply_current_color(self, hex_str: str):
        from color_core import hex_to_rgb, format_color
        rgb = hex_to_rgb(hex_str)
        if not rgb:
            return
        fmt = format_color(rgb)
        self.swatch_label.setStyleSheet(
            f'background: {hex_str}; border-radius: 14px; '
            f'border: 1px solid rgba(0,0,0,0.06);'
        )
        self.hex_label.setText(hex_str.upper())
        self.rgb_label.setText(fmt['rgb'])
        self._current_fmt = fmt

    # ----------------------------------------------------------------
    #  事件处理
    # ----------------------------------------------------------------

    def _copy_format(self, fmt: str):
        if not self._current_hex:
            return
        from color_core import hex_to_rgb, format_color
        rgb = hex_to_rgb(self._current_hex)
        if not rgb:
            return
        fmt_obj = format_color(rgb)
        text = fmt_obj.get(fmt, self._current_hex)
        QGuiApplication.clipboard().setText(text)
        self.color_copied.emit(f'已复制 {text}')
        # 更新激活态
        for k, btn in self.format_buttons.items():
            btn.setProperty('active', 'true' if k == fmt else 'false')
            btn.style().unpolish(btn)
            btn.style().polish(btn)
        # 状态提示
        self.status_label.setText(f'已复制：{text}')

    def _on_cell_clicked(self, hex_str: str):
        """点击历史/调色板单元格：设为当前色并复制 HEX。"""
        self.set_current_color(hex_str)
        QGuiApplication.clipboard().setText(hex_str)
        self.color_copied.emit(f'已复制 {hex_str}')
        self.status_label.setText(f'已复制：{hex_str}')

    def _on_palette_remove(self, hex_str: str):
        """从调色板移除颜色。"""
        palettes = self.store.get('palettes', [])
        if palettes:
            remove_color_from_palette(self.store, palettes[0]['id'], hex_str)
            self._save_store()
            self._refresh_palette()
            self.status_label.setText(f'已从调色板移除 {hex_str}')

    def _on_clear_history(self):
        removed = clear_history(self.store)
        self._save_store()
        self._refresh_history()
        self.status_label.setText(f'已清空 {removed} 条历史')

    def _save_store(self):
        from color_core import save_store
        save_store(self.store_path, self.store)

    # ----------------------------------------------------------------
    #  弹出 / 隐藏
    # ----------------------------------------------------------------

    def show_popup(self):
        self.refresh()
        self._position_near_cursor()
        self.show()
        self.raise_()
        self.activateWindow()

    def hide_popup(self):
        self.hide()

    def _position_near_cursor(self):
        """在光标附近弹出，空间不足则靠右下角。"""
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        screen = QGuiApplication.primaryScreen().geometry()

        x = pt.x + 12
        y = pt.y + 12
        if x + self.width() > screen.right():
            x = pt.x - self.width() - 12
        if y + self.height() > screen.bottom():
            y = pt.y - self.height() - 12
        x = max(4, min(x, screen.right() - self.width() - 4))
        y = max(4, min(y, screen.bottom() - self.height() - 4))
        self.move(x, y)

    # ----------------------------------------------------------------
    #  失焦自动隐藏
    # ----------------------------------------------------------------

    def eventFilter(self, obj, event):
        if obj is self and event.type() == QEvent.Deactivate:
            QTimer.singleShot(80, self._check_hide)
        return super().eventFilter(obj, event)

    def _check_hide(self):
        if not self.isActiveWindow():
            self.hide_popup()

    def keyPressEvent(self, event: QKeyEvent):
        if event.key() == Qt.Key_Escape:
            self.hide_popup()
        else:
            super().keyPressEvent(event)
