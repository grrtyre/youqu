# -*- coding: utf-8 -*-
"""
世界时钟·便携版 —— 主入口
像输入法一样的体验：需要时出现，不需要时隐藏，融入系统，不占桌面

功能：
- 单实例锁（CreateMutex）
- 全局热键 Ctrl+Shift+W 唤起面板
- 系统托盘常驻
- 失焦自动隐藏
- 启动时静默驻留托盘，不打扰用户
"""
from __future__ import annotations

import os
import sys
import io
import ctypes

# PyInstaller --noconsole 模式下 sys.stdout/stderr 为 None，print 会抛异常
# 用 StringIO 替代，避免回调中 print 导致面板无法显示
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = io.StringIO()

# 让 PyInstaller --onefile 找到 PySide6 插件
if getattr(sys, "frozen", False):
    os.environ["QT_QPA_PLATFORM_PLUGIN_PATH"] = os.path.join(
        sys._MEIPASS, "PySide6", "plugins"
    )

import ctypes
from ctypes import wintypes as wt, c_void_p, c_wchar_p, c_int, c_uint, c_bool, c_long

from PySide6.QtCore import Qt, QObject, QEvent, QTimer, QPoint
from PySide6.QtGui import QIcon, QPixmap, QPainter, QColor, QAction, QFont, QPen
from PySide6.QtWidgets import (
    QApplication, QSystemTrayIcon, QMenu, QWidget,
)
from PySide6.QtCore import QAbstractNativeEventFilter

# 同目录导入（frozen 模式下 PyInstaller 已处理路径，无需手动 insert）
if not getattr(sys, "frozen", False):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from panel import WorldClockPanel
import tz_core as tz


# ============================================================
# Win32 API 绑定（ctypes）
# ============================================================

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# 单实例锁
CreateMutexW = kernel32.CreateMutexW
CreateMutexW.argtypes = [c_void_p, wt.BOOL, c_wchar_p]
CreateMutexW.restype = wt.HANDLE
GetLastError = kernel32.GetLastError
GetLastError.restype = wt.DWORD
ERROR_ALREADY_EXISTS = 183

# 全局热键
RegisterHotKey = user32.RegisterHotKey
RegisterHotKey.argtypes = [wt.HWND, c_int, c_uint, c_uint]
RegisterHotKey.restype = c_bool
UnregisterHotKey = user32.UnregisterHotKey
UnregisterHotKey.argtypes = [wt.HWND, c_int]
UnregisterHotKey.restype = c_bool

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

VK_W = 0x57
WM_HOTKEY = 0x0312

# 工作区获取（用于面板定位到右下角）
SystemParametersInfoW = user32.SystemParametersInfoW
SystemParametersInfoW.argtypes = [c_uint, c_uint, c_void_p, c_uint]
SystemParametersInfoW.restype = c_bool
SPI_GETWORKAREA = 0x0030


class RECT(ctypes.Structure):
    _fields_ = [("left", c_long), ("top", c_long),
                ("right", c_long), ("bottom", c_long)]


def get_work_area() -> RECT:
    r = RECT()
    SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(r), 0)
    return r


# ============================================================
# 全局热键监听
# ============================================================

class HotkeyFilter(QAbstractNativeEventFilter):
    """拦截 Windows WM_HOTKEY 消息"""

    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        # eventType 形如 b"windows_generic_MSG"
        if eventType == b"windows_generic_MSG" or eventType == "windows_generic_MSG":
            try:
                import PySide6
                # 获取 MSG 指针
                msg = ctypes.wintypes.MSG.from_address(int(message))
                if msg.message == WM_HOTKEY:
                    self._callback(msg.wParam)
                    return (True, 0)
            except Exception:
                pass
        return (False, 0)


# ============================================================
# 单实例锁
# ============================================================

class SingleInstance:
    """基于命名 Mutex 的单实例锁"""

    def __init__(self, name: str):
        self._mutex = CreateMutexW(None, False, name)
        self._owned = (GetLastError() != ERROR_ALREADY_EXISTS)

    @property
    def is_first(self) -> bool:
        return self._owned


# ============================================================
# 托盘图标（动态生成，避免外部资源依赖）
# ============================================================

def make_tray_icon(size: int = 64) -> QIcon:
    """绘制一个苹果白风格的地球图标"""
    pm = QPixmap(size, size)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.Antialiasing, True)
    p.setRenderHint(QPainter.TextAntialiasing, True)
    # 背景圆
    p.setPen(Qt.NoPen)
    p.setBrush(QColor("#007aff"))
    p.drawEllipse(2, 2, size - 4, size - 4)
    # 内圆（地球）
    p.setBrush(QColor("#ffffff"))
    p.setPen(QPen(QColor("#007aff"), 1.5))
    p.drawEllipse(int(size * 0.22), int(size * 0.22), int(size * 0.56), int(size * 0.56))
    # 经纬线
    p.setPen(QPen(QColor("#007aff"), 1))
    cx = size / 2
    cy = size / 2
    r = size * 0.28
    # 竖线
    p.drawLine(int(cx), int(cy - r), int(cx), int(cy + r))
    # 横线
    p.drawLine(int(cx - r), int(cy), int(cx + r), int(cy))
    # 弧线
    p.drawArc(int(cx - r * 0.6), int(cy - r), int(r * 1.2), int(r * 2), 0, 180 * 16)
    p.drawArc(int(cx - r * 0.6), int(cy - r), int(r * 1.2), int(r * 2), 180 * 16, 180 * 16)
    p.end()
    return QIcon(pm)


# ============================================================
# 主程序
# ============================================================

HOTKEY_ID = 1
MUTEX_NAME = "Global\\youqu_world_clock_portable_v1"


class AppMain(QObject):
    def __init__(self, app: QApplication):
        super().__init__()
        self.app = app
        self.panel: WorldClockPanel | None = None
        self.tray: QSystemTrayIcon | None = None
        self.hotkey_filter: HotkeyFilter | None = None
        self.toast_timer = QTimer(self)
        self.toast_timer.setSingleShot(True)
        self.toast_timer.timeout.connect(self._hide_toast)

    def start(self):
        # 创建面板（不显示）
        self.panel = WorldClockPanel()
        self.panel.show_toast.connect(self._show_toast)
        # 失焦自动隐藏
        self.panel.installEventFilter(self)

        # 注册全局热键 Ctrl+Shift+W
        ok = RegisterHotKey(None, HOTKEY_ID, MOD_CONTROL | MOD_SHIFT | MOD_NOREPEAT, VK_W)
        if not ok:
            # 热键被占用，提示但继续运行（用户仍可从托盘唤起）
            if self.tray:
                self.tray.showMessage(
                    "世界时钟便携版",
                    "全局热键 Ctrl+Shift+W 注册失败，可能是被其他程序占用。请通过托盘图标唤起。",
                    QSystemTrayIcon.Warning,
                    3000,
                )
        self.hotkey_filter = HotkeyFilter(self._on_hotkey)
        self.app.installNativeEventFilter(self.hotkey_filter)

        # 创建托盘
        self.tray = QSystemTrayIcon(make_tray_icon(64), self)
        self.tray.setToolTip("世界时钟便携版 · Ctrl+Shift+W 唤起")
        self.tray.activated.connect(self._on_tray_activated)
        menu = QMenu()
        act_show = QAction("显示面板", menu)
        act_show.triggered.connect(self._show_panel)
        menu.addAction(act_show)
        menu.addSeparator()
        act_quit = QAction("退出", menu)
        act_quit.triggered.connect(self.app.quit)
        menu.addAction(act_quit)
        self.tray.setContextMenu(menu)
        self.tray.show()

        # 启动时静默驻留托盘
        # 不弹窗打扰用户
        # 首次启动 800ms 后显示一次气泡提示
        QTimer.singleShot(800, self._show_startup_toast)

        # 截图模式：环境变量 WORLD_CLOCK_SCREENSHOT=1 时启动后立即显示面板
        shot = os.environ.get("WORLD_CLOCK_SCREENSHOT")
        if shot == "1":
            QTimer.singleShot(1200, self._show_panel)

    def _show_startup_toast(self):
        if self.tray:
            self.tray.showMessage(
                "世界时钟便携版已启动",
                "驻留托盘 · 按 Ctrl+Shift+W 唤起 · 失焦自动隐藏",
                QSystemTrayIcon.Information,
                2500,
            )

    def _on_hotkey(self, hotkey_id: int):
        if hotkey_id == HOTKEY_ID:
            if self.panel.isVisible():
                self.panel.hide()
            else:
                self._show_panel()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            # 单击：显示/隐藏面板
            if self.panel.isVisible():
                self.panel.hide()
            else:
                self._show_panel()
        elif reason == QSystemTrayIcon.MiddleClick:
            # 中键：显示面板
            self._show_panel()

    def _show_panel(self):
        # 定位到屏幕右下角（像输入法候选框）
        wa = get_work_area()
        pw = self.panel.width()
        ph = self.panel.height()
        margin = 12
        x = wa.right - pw - margin
        y = wa.bottom - ph - margin
        # 多屏时确保不超出
        if x < wa.left:
            x = wa.left + margin
        if y < wa.top:
            y = wa.top + margin
        self.panel.move(x, y)
        self.panel.show()
        self.panel.raise_()
        self.panel.activateWindow()

    # 失焦自动隐藏
    def eventFilter(self, obj, event):
        if obj is self.panel and event.type() == QEvent.WindowDeactivate:
            # 截图模式下临时禁用失焦隐藏
            if os.environ.get("WORLD_CLOCK_SCREENSHOT") == "1":
                return False
            # 短暂延迟，避免点击托盘时面板已隐藏
            QTimer.singleShot(120, self._maybe_hide_on_deactivate)
        return False

    def _maybe_hide_on_deactivate(self):
        # 如果当前激活窗口不是面板本身，则隐藏
        if self.panel and self.panel.isVisible():
            active = QApplication.activeWindow()
            if active is not self.panel:
                self.panel.hide()

    # Toast 提示（用托盘气泡）
    def _show_toast(self, text: str):
        if self.tray:
            self.tray.showMessage("世界时钟", text, QSystemTrayIcon.Information, 1500)

    def _hide_toast(self):
        pass


def main():
    # 单实例锁
    si = SingleInstance(MUTEX_NAME)
    if not si.is_first:
        # 已有实例运行，提示并退出
        app = QApplication(sys.argv)
        tray = QSystemTrayIcon(make_tray_icon(64))
        tray.show()
        tray.showMessage(
            "世界时钟便携版",
            "已在后台运行，请按 Ctrl+Shift+W 唤起。",
            QSystemTrayIcon.Information,
            2000,
        )
        QTimer.singleShot(2200, app.quit)
        sys.exit(app.exec())

    # 高 DPI 支持
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)  # 关闭面板不退出应用
    app.setApplicationName("世界时钟便携版")
    app.setApplicationDisplayName("世界时钟便携版")

    # 应用样式
    try:
        from styles import APP_QSS
        app.setStyleSheet(APP_QSS)
    except Exception:
        pass

    main_obj = AppMain(app)
    main_obj.start()

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
