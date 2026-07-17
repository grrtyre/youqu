# -*- coding: utf-8 -*-
"""
提示词速唤便携版 —— 输入法式提示词库
- 全局热键唤起快速面板（默认 Ctrl+Shift+P）
- 失焦自动隐藏
- 系统托盘常驻
- 小界面 ≤400×500
- 苹果白高端风格

入口：python main.py
打包：pyinstaller --onefile --noconsole --name "提示词速唤便携版" --icon icon.ico main.py
"""
from __future__ import annotations

import os
import sys
import json
from typing import Optional

from PySide6.QtCore import Qt, QObject, Signal, QTimer
from PySide6.QtGui import QIcon, QAction, QPixmap, QPainter, QColor, QFont
from PySide6.QtWidgets import (
    QApplication, QSystemTrayIcon, QMenu, QMessageBox
)

from store import PromptStore
from quick_panel import QuickPanel
from manager_window import ManagerWindow
from styles import APPLE_QSS, COLOR_ACCENT
from global_hotkey import GlobalHotkeyManager, parse_hotkey, MOD_CONTROL, MOD_SHIFT, MOD_ALT

APP_NAME = "提示词速唤"
APP_VERSION = "1.0.0"
DEFAULT_HOTKEY = "Ctrl+Shift+P"


def _data_path() -> str:
    """数据文件路径：用户家目录下 .mimo-prompt-manager/prompts.json"""
    home = os.path.expanduser("~")
    base = os.path.join(home, ".mimo-prompt-manager")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, "prompts.json")


def _config_path() -> str:
    home = os.path.expanduser("~")
    base = os.path.join(home, ".mimo-prompt-manager")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, "config.json")


def _load_config() -> dict:
    p = _config_path()
    if not os.path.exists(p):
        return {"hotkey": DEFAULT_HOTKEY}
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"hotkey": DEFAULT_HOTKEY}


def _save_config(cfg: dict) -> None:
    with open(_config_path(), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def _make_tray_icon() -> QIcon:
    """生成简约蓝白托盘图标（16×16 圆角蓝色方块带白色 P 字）"""
    pix = QPixmap(64, 64)
    pix.fill(Qt.transparent)
    p = QPainter(pix)
    p.setRenderHint(QPainter.Antialiasing, True)
    p.setRenderHint(QPainter.TextAntialiasing, True)
    # 圆角蓝底
    p.setPen(Qt.NoPen)
    p.setBrush(QColor(COLOR_ACCENT))
    p.drawRoundedRect(4, 4, 56, 56, 14, 14)
    # P 字
    p.setPen(QColor("#ffffff"))
    f = QFont("Segoe UI", 32, QFont.Bold)
    p.setFont(f)
    p.drawText(pix.rect(), Qt.AlignCenter, "P")
    p.end()
    return QIcon(pix)


class TrayApp(QObject):
    """托盘应用主控制器"""

    show_panel_signal = Signal()
    show_manager_signal = Signal()

    def __init__(self, app: QApplication):
        super().__init__()
        self._app = app
        self._store = PromptStore(_data_path())
        self._cfg = _load_config()

        # UI 组件
        self._panel: Optional[QuickPanel] = None
        self._manager: Optional[ManagerWindow] = None

        # 托盘
        self._tray = QSystemTrayIcon(_make_tray_icon(), self)
        self._tray.setToolTip(f"{APP_NAME} · {self._cfg.get('hotkey', DEFAULT_HOTKEY)} 唤起")

        # 全局热键
        self._hotkey_mgr = GlobalHotkeyManager()
        self._setup_ui()
        self._setup_tray_menu()
        self._setup_hotkey()

        self._tray.show()

        # 提示用户已启动
        self._tray.showMessage(
            APP_NAME,
            f"已就绪。按 {self._cfg.get('hotkey', DEFAULT_HOTKEY)} 唤起快速面板。",
            QSystemTrayIcon.Information,
            2500,
        )

    def _setup_ui(self):
        # 信号转槽
        self.show_panel_signal.connect(self._on_show_panel)
        self.show_manager_signal.connect(self._on_show_manager)

    def _setup_tray_menu(self):
        menu = QMenu()
        menu.setStyleSheet(APPLE_QSS)
        # 字体大些
        f = menu.font()
        f.setPointSize(10)
        menu.setFont(f)

        act_show = QAction("唤起快速面板", menu)
        act_show.triggered.connect(lambda: self.show_panel_signal.emit())
        menu.addAction(act_show)

        act_mgr = QAction("打开管理窗口", menu)
        act_mgr.triggered.connect(lambda: self.show_manager_signal.emit())
        menu.addAction(act_mgr)

        menu.addSeparator()

        act_hotkey = QAction(f"热键：{self._cfg.get('hotkey', DEFAULT_HOTKEY)}", menu)
        act_hotkey.setEnabled(False)
        menu.addAction(act_hotkey)

        act_about = QAction("关于", menu)
        act_about.triggered.connect(self._on_about)
        menu.addAction(act_about)

        menu.addSeparator()

        act_quit = QAction("退出", menu)
        act_quit.triggered.connect(self._on_quit)
        menu.addAction(act_quit)

        self._tray.setContextMenu(menu)
        self._tray.activated.connect(self._on_tray_activated)

    def _setup_hotkey(self):
        spec = self._cfg.get("hotkey", DEFAULT_HOTKEY)
        mods, vk = parse_hotkey(spec)
        if vk == 0:
            print(f"无效热键：{spec}")
            return
        ok = self._hotkey_mgr.register(mods, vk, lambda: self.show_panel_signal.emit())
        if ok is None:
            # 尝试备用热键
            print(f"主热键 {spec} 注册失败，尝试 Alt+Shift+P")
            self._hotkey_mgr.register(MOD_ALT | MOD_SHIFT, 0x50, lambda: self.show_panel_signal.emit())

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            # 单击：唤起快速面板
            self.show_panel_signal.emit()
        elif reason == QSystemTrayIcon.DoubleClick:
            # 双击：管理窗口
            self.show_manager_signal.emit()

    def _on_show_panel(self):
        if self._panel is None:
            self._panel = QuickPanel(self._store)
            self._panel.copied.connect(self._on_copied)
        self._panel.show_near_cursor()

    def _on_copied(self, title: str):
        self._tray.showMessage(APP_NAME, f"已复制：{title}", QSystemTrayIcon.Information, 1500)

    def _on_show_manager(self):
        if self._manager is None or not self._manager.isVisible():
            self._manager = ManagerWindow(self._store)
        self._manager.show()
        self._manager.raise_()
        self._manager.activateWindow()

    def _on_about(self):
        QMessageBox.about(
            None,
            f"关于 {APP_NAME}",
            f"<div style='font-family: Segoe UI, sans-serif;'>"
            f"<h3 style='color: #1d1d1f; margin: 0 0 8px 0;'>{APP_NAME} 便携版 v{APP_VERSION}</h3>"
            f"<p style='color: #6e6e73; margin: 0 0 4px 0;'>输入法式提示词库 —— 热键唤起 · 失焦隐藏 · 托盘常驻</p>"
            f"<p style='color: #86868b; margin: 4px 0 0 0; font-size: 11px;'>原生 Python + PySide6 重构 · 苹果白高端风格</p>"
            f"</div>"
        )

    def _on_quit(self):
        self._hotkey_mgr.stop()
        self._tray.hide()
        self._app.quit()


def main():
    # 高 DPI 支持
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    app.setQuitOnLastWindowClosed(False)  # 关闭窗口不退出，托盘常驻
    app.setStyleSheet(APPLE_QSS)

    # 防止重复启动（简单文件锁）
    lock_path = os.path.join(os.path.expanduser("~"), ".mimo-prompt-manager", "lock")
    try:
        if os.path.exists(lock_path):
            # 检查进程是否仍存活
            with open(lock_path, "r") as f:
                old_pid = int(f.read().strip() or "0")
            if old_pid > 0:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                h = kernel32.OpenProcess(0x1000, False, old_pid)  # QUERY_LIMITED
                if h:
                    kernel32.CloseHandle(h)
                    QMessageBox.warning(None, APP_NAME, "程序已在运行。请通过托盘图标操作。")
                    sys.exit(0)
        with open(lock_path, "w") as f:
            f.write(str(os.getpid()))
    except Exception as e:
        print(f"lock setup warn: {e}")

    tray_app = TrayApp(app)

    # 应用退出时清理锁文件
    def _cleanup():
        try:
            if os.path.exists(lock_path):
                os.remove(lock_path)
        except Exception:
            pass
    app.aboutToQuit.connect(_cleanup)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
