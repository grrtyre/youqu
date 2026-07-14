# -*- coding: utf-8 -*-
"""拾色管家·便携版 - 主程序入口

输入法式体验：
- 全局热键 Ctrl+Shift+C 唤起取色覆盖层
- 取色完成 → 颜色进入历史 + 自动复制 HEX 到剪贴板 + 显示主面板
- 系统托盘常驻
- 单实例锁
- 苹果白高端风格

原生 Python + PySide6 + Win32 API，单 exe 便携分发。
"""

from __future__ import annotations

import os
import sys
import ctypes
import signal
from ctypes import wintypes
from pathlib import Path

# 确保 import 同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtCore import Qt, QTimer, QObject, QAbstractNativeEventFilter, Signal
from PySide6.QtGui import QFont, QIcon, QGuiApplication
from PySide6.QtWidgets import QApplication, QSystemTrayIcon, QMenu

from color_core import load_store, save_store, default_data, hex_to_rgb
from panel import ColorPickerPanel
from picker_overlay import PickerOverlay


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

# 修饰符
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_ALT = 0x0001
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

HOTKEY_ID = 0x9002
WM_HOTKEY = 0x0312

# 单实例互斥锁
MUTEX_NAME = "Global\\ColorPickerPortable_SingleInstance_v2"


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
#  路径辅助
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


def store_path() -> str:
    return os.path.join(app_data_dir(), "color-picker-data.json")


# ================================================================
#  主应用
# ================================================================

class ColorPickerApp(QObject):
    """主应用：托盘 + 热键 + 取色覆盖层 + 主面板。"""

    def __init__(self, app: QApplication, auto_hide: bool = True):
        super().__init__()
        self.app = app
        # 加载数据
        self.store = load_store(store_path())
        # 主面板
        self.panel = ColorPickerPanel(self.store, store_path(), auto_hide=auto_hide)
        self.panel.pick_requested.connect(self.start_picking)
        # 取色覆盖层（按需创建）
        self.overlay: PickerOverlay | None = None
        # 全局热键
        self._setup_hotkey()
        # 系统托盘
        self._setup_tray()

    # ---- 全局热键 ----

    def _setup_hotkey(self):
        self.hotkey_filter = HotkeyFilter(self._on_hotkey)
        self.app.installNativeEventFilter(self.hotkey_filter)

        mods = MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT
        vk = 0x43  # C
        ok = user32.RegisterHotKey(None, HOTKEY_ID, mods, vk)
        if not ok:
            print('[警告] 全局热键 Ctrl+Shift+C 注册失败（可能被其他程序占用）', file=sys.stderr)

    def _on_hotkey(self):
        """热键触发：开始取色。"""
        # 隐藏面板（避免出现在截屏里）
        if self.panel.isVisible():
            self.panel.hide_popup()
        # 等一帧让面板真正隐藏后再开始取色
        QTimer.singleShot(120, self.start_picking)

    # ---- 系统托盘 ----

    def _setup_tray(self):
        icon_file = icon_path()
        if os.path.exists(icon_file):
            icon = QIcon(icon_file)
        else:
            icon = QIcon()
        self.tray = QSystemTrayIcon(icon, self.app)
        self.tray.setToolTip('拾色管家·便携版  (Ctrl+Shift+C 取色)')

        menu = QMenu()
        pick_action = menu.addAction('开始取色  Ctrl+Shift+C')
        pick_action.triggered.connect(self.start_picking)
        menu.addSeparator()
        show_action = menu.addAction('显示面板')
        show_action.triggered.connect(self._show_panel)
        menu.addSeparator()
        quit_action = menu.addAction('退出')
        quit_action.triggered.connect(self._quit)

        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self.tray.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:  # 单击
            self._show_panel()
        elif reason == QSystemTrayIcon.MiddleClick:
            self.start_picking()

    # ---- 取色流程 ----

    def start_picking(self):
        """启动全屏取色覆盖层。"""
        if self.overlay is not None:
            return  # 已在取色中
        self.overlay = PickerOverlay()
        self.overlay.color_picked.connect(self._on_color_picked)
        self.overlay.cancelled.connect(self._on_pick_cancelled)
        # 等一帧确保面板已隐藏
        QTimer.singleShot(20, self.overlay.start)

    def _on_color_picked(self, color: dict):
        """取色完成。"""
        # 关闭覆盖层
        if self.overlay is not None:
            self.overlay.close()
            self.overlay.deleteLater()
            self.overlay = None

        hex_str = color['hex']
        # 自动复制 HEX 到剪贴板
        QGuiApplication.clipboard().setText(hex_str)
        # 设置当前色（同时进入历史）
        self.panel.set_current_color(hex_str)
        # 显示面板
        self.panel.show_popup()
        # 托盘通知
        if self.tray.isVisible():
            self.tray.showMessage(
                '已取色 ' + hex_str.upper(),
                '已复制到剪贴板，点击面板查看更多格式',
                QSystemTrayIcon.Information,
                1500,
            )

    def _on_pick_cancelled(self):
        """取色取消。"""
        if self.overlay is not None:
            self.overlay.close()
            self.overlay.deleteLater()
            self.overlay = None

    # ---- 面板 ----

    def _show_panel(self):
        self.panel.show_popup()

    # ---- 退出 ----

    def _quit(self):
        save_store(store_path(), self.store)
        user32.UnregisterHotKey(None, HOTKEY_ID)
        self.tray.hide()
        self.app.quit()


# ================================================================
#  单实例锁
# ================================================================

def acquire_single_instance() -> bool:
    """尝试获取单实例互斥锁。"""
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
    app.setApplicationName('拾色管家·便携版')
    app.setQuitOnLastWindowClosed(False)  # 关闭面板不退出，托盘常驻

    # 字体
    font = QFont()
    font.setFamilies(['Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', 'Helvetica Neue'])
    font.setPointSize(9)
    app.setFont(font)

    # 图标
    icon_file = icon_path()
    if os.path.exists(icon_file):
        app.setWindowIcon(QIcon(icon_file))

    # 单实例
    if not acquire_single_instance():
        print('拾色管家·便携版 已在运行中。', file=sys.stderr)
        sys.exit(0)

    # 截图模式：禁用失焦自动隐藏，方便 PrintWindow 后台截取
    screenshot_mode = '--screenshot' in sys.argv

    # 创建应用
    picker_app = ColorPickerApp(app, auto_hide=not screenshot_mode)

    # Ctrl+C 退出
    signal.signal(signal.SIGINT, lambda *_: app.quit())

    # --demo: 注入示例数据
    if '--demo' in sys.argv:
        _inject_demo_data(picker_app.store)
        save_store(store_path(), picker_app.store)
        picker_app.panel._current_hex = '#007AFF'
    # --show: 启动时显示面板
    if '--show' in sys.argv:
        QTimer.singleShot(300, picker_app.panel.show_popup)

    sys.exit(app.exec())


def _inject_demo_data(store: dict):
    """注入示例数据（仅用于截图测试）。"""
    # 历史颜色
    samples = [
        '#007AFF', '#34C759', '#FF3B30', '#FF9500', '#AF52DE',
        '#5AC8FA', '#FFD60A', '#5856D6', '#FF2D55', '#30B0C7',
        '#8E8E93', '#00C7BE',
    ]
    for hex_str in samples:
        rgb = hex_to_rgb(hex_str)
        if rgb:
            from color_core import push_history
            push_history(store, hex_str, rgb)
    # 设置当前色
    if not store.get('history'):
        from color_core import push_history
        push_history(store, '#007AFF', {'r': 0, 'g': 122, 'b': 255})


if __name__ == '__main__':
    main()
