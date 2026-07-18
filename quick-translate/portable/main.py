# -*- coding: utf-8 -*-
"""快速翻译器 · 便携版入口
- 系统托盘常驻
- 全局热键 Ctrl+Shift+T 唤起 + 翻译剪贴板
- 失焦自动隐藏（在 QuickPanel 内实现）
- 单 EXE 分发
"""
from __future__ import annotations

import os
import sys
import threading
from pathlib import Path

from PySide6.QtCore import QObject, QTimer, Qt
from PySide6.QtGui import QIcon, QAction, QGuiApplication
from PySide6.QtWidgets import (
    QApplication, QSystemTrayIcon, QMenu, QMessageBox,
)

from quick_panel import QuickPanel
from hotkey import GlobalHotkey, HOTKEY_MODIFIERS
from store import load_store, save_store, get_settings, update_settings


def _resource_path(rel: str) -> str:
    """兼容开发模式与 PyInstaller 打包模式。"""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, rel)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), rel)


def _icon_path() -> str:
    return _resource_path(os.path.join("assets", "icon.png"))


def _icon_ico_path() -> str:
    return _resource_path(os.path.join("assets", "icon.ico"))


class TranslateApp(QObject):
    """应用主控制器。"""

    def __init__(self):
        super().__init__()
        self.app = QApplication.instance() or QApplication(sys.argv)
        # 不在任务栏显示
        try:
            self.app.setQuitOnLastWindowClosed(False)
        except Exception:
            pass

        # 图标
        self.icon = QIcon(_icon_path())
        if self.icon.isNull():
            self.icon = QIcon(_icon_ico_path())
        self.app.setWindowIcon(self.icon)

        # 主面板
        self.panel = QuickPanel(icon=self.icon)
        self.panel.hidden.connect(self._on_panel_hidden)

        # 系统托盘
        self.tray = QSystemTrayIcon(self.icon, self.app)
        self.tray.setToolTip("快速翻译器 · 便携版\n全局热键: Ctrl+Shift+T")
        self._build_tray_menu()
        self.tray.show()

        # 全局热键
        self.hotkey = GlobalHotkey()
        # Ctrl+Shift+T = 唤起并翻译剪贴板
        self.hotkey.register(
            HOTKEY_MODIFIERS.CONTROL | HOTKEY_MODIFIERS.SHIFT,
            0x54,  # VK_T
            self._on_global_hotkey,
        )
        # 启动热键监听线程
        self.hotkey.start()

        # 首次启动提示
        if not self.tray.supportsMessages():
            pass
        else:
            # 启动 500ms 后弹一次托盘提示
            QTimer.singleShot(800, self._show_start_hint)

    def _build_tray_menu(self):
        menu = QMenu()

        act_show = QAction("显示翻译面板", menu)
        act_show.triggered.connect(self.show_panel)
        menu.addAction(act_show)

        act_translate_cb = QAction("翻译剪贴板", menu)
        act_translate_cb.triggered.connect(self.translate_clipboard)
        menu.addAction(act_translate_cb)

        menu.addSeparator()

        act_quit = QAction("退出", menu)
        act_quit.triggered.connect(self._quit)
        menu.addAction(act_quit)

        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)

    def _on_tray_activated(self, reason):
        # 左键单击托盘图标 → 显示面板
        if reason == QSystemTrayIcon.Trigger:
            self.show_panel()

    def _show_start_hint(self):
        try:
            self.tray.showMessage(
                "快速翻译器 · 便携版",
                "已在系统托盘运行\n全局热键: Ctrl+Shift+T 翻译剪贴板",
                QSystemTrayIcon.Information,
                2500,
            )
        except Exception:
            pass

    def show_panel(self):
        """显示面板。"""
        # 用 QTimer.singleShot 确保在主线程执行
        QTimer.singleShot(0, lambda: self.panel.show_near_cursor())

    def translate_clipboard(self):
        """显示面板并翻译剪贴板。"""
        QTimer.singleShot(0, lambda: self._do_translate_clipboard())

    def _do_translate_clipboard(self):
        self.panel.show_near_cursor()
        # 等面板显示后再读剪贴板
        QTimer.singleShot(50, self.panel.translate_clipboard)

    def _on_global_hotkey(self):
        """全局热键回调（来自子线程）。"""
        # 转主线程执行
        QTimer.singleShot(0, self._do_global_hotkey)

    def _do_global_hotkey(self):
        # 如果面板已显示则隐藏；否则显示并翻译剪贴板
        if self.panel.isVisible():
            self.panel.hide_panel()
        else:
            self.translate_clipboard()

    def _on_panel_hidden(self):
        pass

    def _quit(self):
        """退出应用。"""
        self.hotkey.stop()
        self.tray.hide()
        self.app.quit()

    def run(self):
        return self.app.exec()


def main():
    # 单实例检查：通过命名互斥体
    try:
        import ctypes
        from ctypes import wintypes
        kernel32 = ctypes.windll.kernel32
        mutex_name = "Global\\mimo-quick-translate-portable-single-instance"
        CreateMutex = kernel32.CreateMutexW
        CreateMutex.argtypes = [wintypes.LPCVOID, wintypes.BOOL, wintypes.LPCWSTR]
        CreateMutex.restype = wintypes.HANDLE
        mutex = CreateMutex(None, False, mutex_name)
        last_error = kernel32.GetLastError()
        if last_error == 183:  # ERROR_ALREADY_EXISTS
            # 已经有实例运行，退出
            return 0
    except Exception:
        pass

    app = TranslateApp()
    return app.run()


if __name__ == "__main__":
    sys.exit(main())
