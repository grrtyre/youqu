# -*- coding: utf-8 -*-
"""剪贴板管家·便携版 - 主程序

输入法式体验：全局热键唤起、失焦自动隐藏、系统托盘常驻、小界面。
原生 Python + PySide6，单 exe 便携分发。
"""

from __future__ import annotations

import os
import sys
import time
import ctypes
import signal
from ctypes import wintypes
from pathlib import Path

# 确保能 import 同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtCore import (
    Qt, QTimer, Signal, QObject, QEvent, QAbstractNativeEventFilter,
    QSettings, QPoint, QRect,
)
from PySide6.QtGui import (
    QFont, QIcon, QPixmap, QPainter, QColor, QKeyEvent,
    QAction, QShortcut, QKeySequence,
)
from PySide6.QtWidgets import (
    QApplication, QWidget, QLineEdit, QPushButton, QLabel,
    QVBoxLayout, QHBoxLayout, QFrame, QScrollArea, QGraphicsDropShadowEffect,
    QSystemTrayIcon, QMenu, QButtonGroup, QSizePolicy,
)

from clipboard_core import ClipboardStore, ClipboardItem, relative_time, classify
from styles import APPLE_WHITE_QSS


# ================================================================
#  Win32 API 绑定
# ================================================================

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# RegisterHotKey
user32.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
user32.RegisterHotKey.restype = wintypes.BOOL
user32.UnregisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int]
user32.UnregisterHotKey.restype = wintypes.BOOL

# GetForegroundWindow
user32.GetForegroundWindow.restype = wintypes.HWND
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
user32.SetForegroundWindow.restype = wintypes.BOOL

# keybd_event（用于模拟 Ctrl+V）
VK_CONTROL = 0x11
VK_V = 0x56
KEYEVENTF_KEYUP = 0x0002
user32.keybd_event.argtypes = [wintypes.BYTE, wintypes.BYTE, wintypes.DWORD, ctypes.POINTER(ctypes.c_ulong)]

# 热键修饰符
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_ALT = 0x0001
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

HOTKEY_ID = 0x9001
WM_HOTKEY = 0x0312

# 单实例互斥锁
MUTEX_NAME = "Global\\ClipboardManagerPortable_SingleInstance"


def send_ctrl_v():
    """模拟 Ctrl+V 粘贴到当前前台窗口。"""
    user32.keybd_event(VK_CONTROL, 0, 0, None)
    user32.keybd_event(VK_V, 0, 0, None)
    user32.keybd_event(VK_V, 0, KEYEVENTF_KEYUP, None)
    user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, None)


class MSG(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("message", wintypes.UINT),
        ("wParam", wintypes.WPARAM),
        ("lParam", wintypes.LPARAM),
        ("time", wintypes.DWORD),
        ("pt", wintypes.POINT),
    ]


# ================================================================
#  全局热键过滤器
# ================================================================

class HotkeyFilter(QAbstractNativeEventFilter):
    """拦截 Windows 原生消息，捕获 WM_HOTKEY。"""

    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        if eventType == b"windows_generic_MSG" or eventType == "windows_generic_MSG":
            try:
                addr = int(message)
                msg = MSG.from_address(addr)
                if msg.message == WM_HOTKEY and msg.wParam == HOTKEY_ID:
                    self._callback()
                    return (True, 0)
            except Exception:
                pass
        return (False, 0)


# ================================================================
#  数据目录
# ================================================================

def app_data_dir() -> str:
    """便携版数据目录：exe 同级 data/ 或开发时 portable/data/。"""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    d = os.path.join(base, "data")
    os.makedirs(d, exist_ok=True)
    return d


def icon_path() -> str:
    """图标路径。"""
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, "assets", "icon.ico")


# ================================================================
#  类型标签映射
# ================================================================

KIND_LABELS = {
    "text": "文本",
    "code": "代码",
    "link": "链接",
    "email": "邮箱",
    "phone": "电话",
}

KIND_EMOJI = {
    "text": "📝",
    "code": "⌘",
    "link": "🔗",
    "email": "✉",
    "phone": "📞",
}


# ================================================================
#  条目卡片
# ================================================================

class ItemCard(QFrame):
    """单条剪贴板记录的卡片控件。"""

    clicked = Signal(str)       # item_id
    paste_requested = Signal(str)  # item_id -> 复制并粘贴
    pin_toggled = Signal(str)
    fav_toggled = Signal(str)
    deleted = Signal(str)

    def __init__(self, item: ClipboardItem, parent=None):
        super().__init__(parent)
        self.item = item
        self.setObjectName("itemCard")
        self.setProperty("selected", False)
        self.setFixedHeight(52)
        self.setCursor(Qt.PointingHandCursor)

        # 卡片阴影增强深度（更强、更柔和）
        card_shadow = QGraphicsDropShadowEffect(self)
        card_shadow.setBlurRadius(18)
        card_shadow.setColor(QColor(0, 0, 0, 28))
        card_shadow.setOffset(0, 3)
        self.setGraphicsEffect(card_shadow)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 10, 0)
        layout.setSpacing(0)

        # 左侧色条（按类型上色）
        self.accent_bar = QFrame(self)
        self.accent_bar.setObjectName("accentBar")
        self.accent_bar.setProperty("kind", item.kind if item.kind in KIND_LABELS else "text")
        layout.addWidget(self.accent_bar)

        # 内容区
        content_layout = QHBoxLayout()
        content_layout.setContentsMargins(10, 7, 0, 7)
        content_layout.setSpacing(10)

        # 预览文本（preview() 已做换行→空格 + 省略号截断）
        full_text = item.preview(120)
        self.preview_label = QLabel(full_text)
        self.preview_label.setObjectName("itemPreview")
        self.preview_label.setWordWrap(False)
        self.preview_label.setToolTip(item.content)
        content_layout.addWidget(self.preview_label, 1)
        layout.addLayout(content_layout)

        # 类型 pill
        self.kind_label = QLabel(KIND_LABELS.get(item.kind, "文本"))
        self.kind_label.setObjectName("kindPill")
        if item.kind in KIND_LABELS:
            self.kind_label.setProperty(item.kind, True)
        self.kind_label.setFixedHeight(18)
        layout.addWidget(self.kind_label)

        # 时间
        self.time_label = QLabel(relative_time(item.timestamp))
        self.time_label.setObjectName("itemTime")
        self.time_label.setFixedWidth(52)
        self.time_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        layout.addWidget(self.time_label)

        # 操作按钮（文字按钮，不用 emoji）
        self.pin_btn = QPushButton("置顶")
        self.pin_btn.setObjectName("actionBtn")
        self.pin_btn.setProperty("active", "true" if item.pinned else "false")
        self.pin_btn.setFixedHeight(22)
        self.pin_btn.setToolTip("置顶")
        self.pin_btn.clicked.connect(lambda: self.pin_toggled.emit(item.id))
        layout.addWidget(self.pin_btn)

        self.fav_btn = QPushButton("收藏")
        self.fav_btn.setObjectName("actionBtn")
        self.fav_btn.setProperty("fav", "true" if item.favorite else "false")
        self.fav_btn.setFixedHeight(22)
        self.fav_btn.setToolTip("收藏")
        self.fav_btn.clicked.connect(lambda: self.fav_toggled.emit(item.id))
        layout.addWidget(self.fav_btn)

        self.del_btn = QPushButton("删除")
        self.del_btn.setObjectName("actionBtn")
        self.del_btn.setFixedHeight(22)
        self.del_btn.setToolTip("删除")
        self.del_btn.clicked.connect(lambda: self.deleted.emit(item.id))
        layout.addWidget(self.del_btn)

    def set_selected(self, selected: bool):
        self.setProperty("selected", selected)
        # 触发样式刷新
        self.style().unpolish(self)
        self.style().polish(self)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            # 点击卡片区域（非按钮）-> 复制并粘贴
            child = self.childAt(event.position().toPoint())
            if not isinstance(child, QPushButton):
                self.paste_requested.emit(self.item.id)
        super().mousePressEvent(event)


# ================================================================
#  弹出窗口
# ================================================================

FILTERS = [
    ("all", "全部"),
    ("favorite", "收藏"),
    ("code", "代码"),
    ("link", "链接"),
    ("text", "文本"),
]


class ClipboardPopup(QWidget):
    """输入法式弹出窗口：无边框、半透明阴影、失焦自动隐藏。"""

    paste_to_foreground = Signal(str)  # content -> 复制并粘贴到前台

    def __init__(self, store: ClipboardStore, parent=None):
        super().__init__(parent)
        self.store = store
        self._prev_hwnd = None  # 弹出前的前台窗口句柄
        self._selected_index = -1
        self._cards: list[ItemCard] = []
        self._filter = "all"
        self._keyword = ""

        # 窗口属性
        self.setWindowFlags(
            Qt.FramelessWindowHint
            | Qt.WindowStaysOnTopHint
            | Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_ShowWithoutActivating, False)
        self.setFixedSize(380, 500)

        self._build_ui()
        self.setStyleSheet(APPLE_WHITE_QSS)

        # 失焦自动隐藏
        self.installEventFilter(self)

    def _build_ui(self):
        # 外层透明容器
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(0)

        # 内容容器（白色圆角 + 阴影）
        self.content = QFrame()
        self.content.setObjectName("contentWidget")
        root.addWidget(self.content)

        # 阴影效果
        shadow = QGraphicsDropShadowEffect(self.content)
        shadow.setBlurRadius(28)
        shadow.setColor(QColor(0, 0, 0, 45))
        shadow.setOffset(0, 4)
        self.content.setGraphicsEffect(shadow)

        content_layout = QVBoxLayout(self.content)
        content_layout.setContentsMargins(0, 0, 0, 0)
        content_layout.setSpacing(0)

        # ---- 标题栏 ----
        header = QFrame()
        header.setObjectName("headerBar")
        header.setFixedHeight(46)
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(14, 0, 14, 0)
        header_layout.setSpacing(8)
        # 应用图标方块（替代 emoji）
        icon_label = QLabel("剪")
        icon_label.setObjectName("appIcon")
        icon_label.setAlignment(Qt.AlignCenter)
        header_layout.addWidget(icon_label)
        title = QLabel("剪贴板管家")
        title.setObjectName("appTitle")
        header_layout.addWidget(title)
        self.count_badge = QLabel("0")
        self.count_badge.setObjectName("appBadge")
        self.count_badge.setFixedHeight(20)
        self.count_badge.setAlignment(Qt.AlignCenter)
        header_layout.addWidget(self.count_badge)
        header_layout.addStretch()
        content_layout.addWidget(header)

        # 搜索 + 筛选区域
        top_frame = QFrame()
        top_frame.setContentsMargins(14, 10, 14, 8)
        top_layout = QVBoxLayout(top_frame)
        top_layout.setContentsMargins(0, 0, 0, 0)
        top_layout.setSpacing(12)

        # 搜索框（不用 emoji 图标）
        self.search_box = QLineEdit()
        self.search_box.setObjectName("searchBox")
        self.search_box.setPlaceholderText("搜索剪贴板历史")
        self.search_box.setFixedHeight(36)
        self.search_box.textChanged.connect(self._on_search_changed)
        top_layout.addWidget(self.search_box)

        # 筛选标签
        tabs_frame = QFrame()
        tabs_layout = QHBoxLayout(tabs_frame)
        tabs_layout.setContentsMargins(0, 0, 0, 0)
        tabs_layout.setSpacing(6)
        self.tab_group = QButtonGroup(self)
        self.tab_group.setExclusive(True)
        for kind, label in FILTERS:
            btn = QPushButton(label)
            btn.setObjectName("tab")
            btn.setCheckable(True)
            btn.setProperty("kind", kind)
            btn.clicked.connect(lambda checked, k=kind: self._on_filter_changed(k))
            if kind == "all":
                btn.setChecked(True)
            self.tab_group.addButton(btn)
            tabs_layout.addWidget(btn)
        tabs_layout.addStretch()
        top_layout.addWidget(tabs_frame)

        content_layout.addWidget(top_frame)

        # ---- 列表区域 ----
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.scroll.setFrameShape(QFrame.NoFrame)

        self.list_widget = QWidget()
        self.list_layout = QVBoxLayout(self.list_widget)
        self.list_layout.setContentsMargins(12, 6, 12, 10)
        self.list_layout.setSpacing(9)
        self.list_layout.addStretch()
        self.scroll.setWidget(self.list_widget)
        content_layout.addWidget(self.scroll, 1)

        # 空状态（纯文字，不用 emoji）
        self.empty_widget = QWidget()
        empty_layout = QVBoxLayout(self.empty_widget)
        empty_layout.setContentsMargins(0, 50, 0, 0)
        empty_layout.setSpacing(6)
        empty_layout.setAlignment(Qt.AlignCenter)
        empty_title = QLabel("暂无剪贴板记录")
        empty_title.setObjectName("emptyTitle")
        empty_title.setAlignment(Qt.AlignCenter)
        empty_desc = QLabel("复制的内容会自动出现在这里")
        empty_desc.setObjectName("emptyDesc")
        empty_desc.setAlignment(Qt.AlignCenter)
        empty_layout.addWidget(empty_title)
        empty_layout.addWidget(empty_desc)
        content_layout.addWidget(self.empty_widget)
        self.empty_widget.hide()

        # ---- 底部状态栏 ----
        status_bar = QFrame()
        status_bar.setObjectName("statusBar")
        status_bar.setFixedHeight(38)
        status_layout = QHBoxLayout(status_bar)
        status_layout.setContentsMargins(14, 0, 14, 0)
        status_layout.setSpacing(10)
        self.status_label = QLabel("0 条记录")
        self.status_label.setObjectName("statusText")
        status_layout.addWidget(self.status_label)
        status_layout.addStretch()
        hint = QLabel("Ctrl+Shift+V 唤起")
        hint.setObjectName("statusHint")
        status_layout.addWidget(hint)
        # 竖线分隔
        sep = QFrame()
        sep.setFixedWidth(1)
        sep.setFixedHeight(14)
        sep.setStyleSheet("background: #e0e0e4; border: none;")
        status_layout.addWidget(sep)
        self.clear_btn = QPushButton("清空")
        self.clear_btn.setObjectName("clearBtn")
        self.clear_btn.clicked.connect(self._on_clear)
        status_layout.addWidget(self.clear_btn)
        content_layout.addWidget(status_bar)

    # ---- 列表刷新 ----

    def refresh(self):
        """刷新列表显示。"""
        # 清空旧卡片
        while self.list_layout.count() > 1:  # 保留末尾 stretch
            item = self.list_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
        self._cards.clear()

        items = self.store.search(self._keyword, self._filter)
        total = self.store.count()
        self.count_badge.setText(str(total))

        if not items:
            self.scroll.hide()
            self.empty_widget.show()
            self.status_label.setText("0 条记录")
            return

        self.scroll.show()
        self.empty_widget.hide()

        # 限制显示数量（性能）
        show_count = min(len(items), 100)
        for it in items[:show_count]:
            card = ItemCard(it, self.list_widget)
            card.paste_requested.connect(self._on_paste)
            card.pin_toggled.connect(self._on_pin_toggled)
            card.fav_toggled.connect(self._on_fav_toggled)
            card.deleted.connect(self._on_deleted)
            self.list_layout.insertWidget(self.list_layout.count() - 1, card)
            self._cards.append(card)

        shown = show_count
        if total > 100:
            self.status_label.setText(f"{shown} / {total} 条记录")
        else:
            self.status_label.setText(f"{total} 条记录")
        self._selected_index = -1

    def _on_search_changed(self, text):
        self._keyword = text
        self.refresh()

    def _on_filter_changed(self, kind):
        self._filter = kind
        self.refresh()

    def _on_clear(self):
        removed = self.store.clear()
        if removed > 0:
            self._save_and_refresh()

    def _on_pin_toggled(self, item_id):
        self.store.toggle_pin(item_id)
        self._save_and_refresh()

    def _on_fav_toggled(self, item_id):
        self.store.toggle_favorite(item_id)
        self._save_and_refresh()

    def _on_deleted(self, item_id):
        self.store.remove(item_id)
        self._save_and_refresh()

    def _on_paste(self, item_id):
        item = self.store.get_by_id(item_id)
        if item:
            self.hide_popup()
            self.paste_to_foreground.emit(item.content)

    def _save_and_refresh(self):
        self.store.save(os.path.join(app_data_dir(), "clipboard.json"))
        self.refresh()

    # ---- 弹出 / 隐藏 ----

    def show_popup(self):
        # 记录当前前台窗口（用于粘贴目标）
        self._prev_hwnd = user32.GetForegroundWindow()
        self.refresh()
        self._position_near_cursor()
        self.show()
        self.raise_()
        self.activateWindow()
        self.search_box.setFocus()

    def hide_popup(self):
        self.hide()
        self.search_box.clear()

    def _position_near_cursor(self):
        """在光标附近弹出，若空间不足则靠近屏幕右下角。"""
        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        screen = QApplication.primaryScreen().geometry()

        x = pt.x + 12
        y = pt.y + 12
        # 确保不超出屏幕
        if x + self.width() > screen.right():
            x = pt.x - self.width() - 12
        if y + self.height() > screen.bottom():
            y = pt.y - self.height() - 12
        # 最终保底
        x = max(4, min(x, screen.right() - self.width() - 4))
        y = max(4, min(y, screen.bottom() - self.height() - 4))
        self.move(x, y)

    # ---- 失焦自动隐藏 ----

    def eventFilter(self, obj, event):
        if obj is self and event.type() == QEvent.Deactivate:
            # 失焦时隐藏（延迟 50ms 避免点击卡片时误隐藏）
            QTimer.singleShot(50, self._check_hide)
        return super().eventFilter(obj, event)

    def _check_hide(self):
        if not self.isActiveWindow():
            self.hide_popup()

    # ---- 键盘导航 ----

    def keyPressEvent(self, event: QKeyEvent):
        key = event.key()
        if key == Qt.Key_Escape:
            self.hide_popup()
        elif key == Qt.Key_Down:
            self._move_selection(1)
        elif key == Qt.Key_Up:
            self._move_selection(-1)
        elif key == Qt.Key_Return or key == Qt.Key_Enter:
            if 0 <= self._selected_index < len(self._cards):
                card = self._cards[self._selected_index]
                self._on_paste(card.item.id)
        else:
            super().keyPressEvent(event)

    def _move_selection(self, delta):
        if not self._cards:
            return
        # 清除旧选中
        if 0 <= self._selected_index < len(self._cards):
            self._cards[self._selected_index].set_selected(False)
        self._selected_index += delta
        if self._selected_index < 0:
            self._selected_index = len(self._cards) - 1
        elif self._selected_index >= len(self._cards):
            self._selected_index = 0
        card = self._cards[self._selected_index]
        card.set_selected(True)
        # 滚动到可见
        self.scroll.ensureWidgetVisible(card)


# ================================================================
#  主应用
# ================================================================

class ClipboardApp(QObject):
    """主应用：托盘 + 热键 + 剪贴板监听 + 弹出窗口。"""

    def __init__(self, app: QApplication):
        super().__init__()
        self.app = app
        self.store = ClipboardStore()
        self._load_data()

        # 弹出窗口
        self.popup = ClipboardPopup(self.store)
        self.popup.paste_to_foreground.connect(self._paste_to_foreground)

        # 全局热键
        self._setup_hotkey()

        # 系统托盘
        self._setup_tray()

        # 剪贴板监听
        self.clipboard = app.clipboard()
        self.clipboard.dataChanged.connect(self._on_clipboard_changed)
        self._suppress_next = False  # 防止自己设的剪贴板内容被重复记录

    def _load_data(self):
        data_path = os.path.join(app_data_dir(), "clipboard.json")
        self.store.load(data_path)

    def _setup_hotkey(self):
        """注册全局热键 Ctrl+Shift+V。"""
        self.hotkey_filter = HotkeyFilter(self.toggle_popup)
        self.app.installNativeEventFilter(self.hotkey_filter)

        mods = MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT
        vk = 0x56  # V
        ok = user32.RegisterHotKey(None, HOTKEY_ID, mods, vk)
        if not ok:
            # 热键注册失败，可能已被其他程序占用
            print(f"[警告] 全局热键 Ctrl+Shift+V 注册失败（可能被其他程序占用）", file=sys.stderr)

    def _setup_tray(self):
        """系统托盘图标 + 右键菜单。"""
        icon_file = icon_path()
        if os.path.exists(icon_file):
            icon = QIcon(icon_file)
        else:
            icon = QIcon()
        self.tray = QSystemTrayIcon(icon, self.app)
        self.tray.setToolTip("剪贴板管家·便携版")

        menu = QMenu()
        show_action = QAction("显示剪贴板", menu)
        show_action.triggered.connect(self.toggle_popup)
        menu.addAction(show_action)
        menu.addSeparator()
        quit_action = QAction("退出", menu)
        quit_action.triggered.connect(self._quit)
        menu.addAction(quit_action)

        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self.tray.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:  # 单击
            self.toggle_popup()

    # ---- 剪贴板监听 ----

    def _on_clipboard_changed(self):
        if self._suppress_next:
            self._suppress_next = False
            return
        text = self.clipboard.text()
        if text and text.strip():
            self.store.add(text)
            self.store.save(os.path.join(app_data_dir(), "clipboard.json"))

    # ---- 弹出 / 隐藏 ----

    def toggle_popup(self):
        if self.popup.isVisible():
            self.popup.hide_popup()
        else:
            self.popup.show_popup()

    # ---- 粘贴到前台 ----

    def _paste_to_foreground(self, content: str):
        """复制内容到剪贴板并模拟 Ctrl+V 粘贴到前台窗口。"""
        # 设置剪贴板
        self._suppress_next = True
        self.clipboard.setText(content)

        # 恢复前台窗口
        if self.popup._prev_hwnd:
            QTimer.singleShot(80, lambda: self._do_paste(self.popup._prev_hwnd))
        else:
            QTimer.singleShot(80, lambda: self._do_paste(None))

    def _do_paste(self, hwnd):
        if hwnd:
            user32.SetForegroundWindow(hwnd)
        QTimer.singleShot(60, send_ctrl_v)

    # ---- 退出 ----

    def _quit(self):
        self.store.save(os.path.join(app_data_dir(), "clipboard.json"))
        user32.UnregisterHotKey(None, HOTKEY_ID)
        self.tray.hide()
        self.app.quit()


# ================================================================
#  单实例锁
# ================================================================

def acquire_single_instance() -> bool:
    """尝试获取单实例互斥锁。成功返回 True，已有实例运行返回 False。"""
    handle = kernel32.CreateMutexW(None, False, MUTEX_NAME)
    last_error = kernel32.GetLastError()
    if last_error == 183:  # ERROR_ALREADY_EXISTS
        return False
    return True


# ================================================================
#  入口
# ================================================================

def main():
    # 高 DPI
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("剪贴板管家·便携版")
    app.setQuitOnLastWindowClosed(False)  # 关闭窗口不退出，托盘常驻

    # 设置字体
    font = QFont()
    font.setFamilies(["Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Helvetica Neue"])
    font.setPointSize(9)
    app.setFont(font)

    # 设置图标
    icon_file = icon_path()
    if os.path.exists(icon_file):
        app.setWindowIcon(QIcon(icon_file))

    # 单实例
    if not acquire_single_instance():
        print("剪贴板管家·便携版 已在运行中。", file=sys.stderr)
        sys.exit(0)

    # 创建应用
    clipboard_app = ClipboardApp(app)

    # Ctrl+C 退出
    signal.signal(signal.SIGINT, lambda *_: app.quit())

    # 测试模式：--show 启动时直接显示弹窗；--demo 注入示例数据
    if "--demo" in sys.argv:
        _inject_demo_data(clipboard_app.store)
        clipboard_app.store.save(os.path.join(app_data_dir(), "clipboard.json"))
    if "--show" in sys.argv:
        QTimer.singleShot(300, clipboard_app.popup.show_popup)

    # 启动时不显示窗口，后台运行
    sys.exit(app.exec())


def _inject_demo_data(store: ClipboardStore):
    """注入示例数据（仅用于截图测试）。"""
    samples = [
        "def hello_world():\n    print('Hello, World!')\n    return True",
        "https://github.com/grrtyre/youqu",
        "user@example.com",
        "欢迎使用剪贴板管家·便携版",
        "const debounce = (fn, delay) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n};",
        "13800138000",
        "Ctrl+Shift+V 全局唤起",
        "npm install pyside6",
        "import os\nimport sys\nfrom pathlib import Path",
        "The quick brown fox jumps over the lazy dog",
    ]
    for s in samples:
        store.add(s)


if __name__ == "__main__":
    main()
