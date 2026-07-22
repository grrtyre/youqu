# -*- coding: utf-8 -*-
"""main.py - 环境音便携版入口

系统托盘常驻 + 全局热键唤起 + 失焦自动隐藏。
像输入法一样的体验：需要时出现，不需要时隐藏。
"""
import sys
import os
import time

# 确保当前目录在 path 中（PyInstaller 打包后需要）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtCore import Qt, QTimer, QObject
from PySide6.QtGui import QIcon, QPixmap, QPainter, QColor, QAction
from PySide6.QtWidgets import QApplication, QSystemTrayIcon, QMenu
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtGui import QImage

import synth
import store
from audio_engine import SoundEngine
from widget import AmbientWidget
from styles import APPLE_WHITE_QSS


def make_tray_icon():
    """生成托盘图标（苹果白风格线性声波图标）"""
    svg = """<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="14" fill="#007aff"/>
        <g fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round">
            <path d="M14 32c5-8 10-8 14 0s9 8 14 0"/>
            <path d="M14 22c5-8 10-8 14 0s9 8 14 0"/>
            <path d="M14 42c5-8 10-8 14 0s9 8 14 0"/>
        </g>
    </svg>"""
    renderer = QSvgRenderer(svg.encode("utf-8"))
    image = QImage(64, 64, QImage.Format_ARGB32)
    image.fill(Qt.transparent)
    painter = QPainter(image)
    renderer.render(painter)
    painter.end()
    return QIcon(QPixmap.fromImage(image))


class AppController(QObject):
    """应用控制器：协调托盘、热键、窗口"""

    def __init__(self, app):
        super().__init__()
        self.app = app
        self.demo_mode = "--demo" in sys.argv

        # 音频引擎
        self.engine = SoundEngine()
        self.engine.prepare()
        if not self.demo_mode:
            self.engine.start_output()

        # 主窗口
        self.widget = AmbientWidget(self.engine)
        self.widget.setStyleSheet(APPLE_WHITE_QSS)

        # 演示模式
        if self.demo_mode:
            self.engine.set_demo_mode(True)
            self.widget._auto_hide = False
            self.widget.set_demo_mode()

        # 系统托盘
        self.tray = QSystemTrayIcon(make_tray_icon(), self.app)
        self.tray.setToolTip("环境音便携版 · Ctrl+Shift+A 唤起")
        self.tray.activated.connect(self._on_tray_activated)
        self._build_tray_menu()
        self.tray.show()

        # 全局热键
        self._init_hotkey()

        # 首次显示（演示模式直接显示，否则延迟显示等待用户操作）
        if self.demo_mode:
            self.widget.show()
            # 居中显示
            screen = self.app.primaryScreen().geometry()
            self.widget.move(
                (screen.width() - self.widget.width()) // 2,
                (screen.height() - self.widget.height()) // 2,
            )
            self.widget.raise_()
            self.widget.activateWindow()

    def _build_tray_menu(self):
        menu = QMenu()
        menu.setStyleSheet("""
            QMenu {
                background: #ffffff;
                border: 1px solid #d1d1d6;
                border-radius: 8px;
                padding: 6px;
                font-size: 13px;
            }
            QMenu::item {
                padding: 6px 24px;
                border-radius: 4px;
                color: #1d1d1f;
            }
            QMenu::item:selected {
                background: #007aff;
                color: #ffffff;
            }
            QMenu::separator {
                height: 1px;
                background: #e5e5ea;
                margin: 4px 8px;
            }
        """)

        show_action = QAction("显示面板", self)
        show_action.triggered.connect(self.toggle_widget)
        menu.addAction(show_action)

        stop_action = QAction("全部停止", self)
        stop_action.triggered.connect(self._stop_all)
        menu.addAction(stop_action)

        menu.addSeparator()

        quit_action = QAction("退出", self)
        quit_action.triggered.connect(self._quit)
        menu.addAction(quit_action)

        self.tray.setContextMenu(menu)

    def _init_hotkey(self):
        try:
            from hotkey import HotkeyListener
            self.hotkey = HotkeyListener(
                on_toggle=self.toggle_widget,
                on_stop_all=self._stop_all,
            )
            self.hotkey.start()
        except Exception as e:
            print(f"[main] 全局热键注册失败: {e}")
            self.hotkey = None

    def toggle_widget(self):
        if self.widget.isVisible():
            self.widget.hide()
        else:
            self.widget.show()
            self.widget.raise_()
            self.widget.activateWindow()
            # 定位到屏幕右下角附近
            screen = self.app.primaryScreen().geometry()
            x = screen.width() - self.widget.width() - 20
            y = screen.height() - self.widget.height() - 60
            # 确保不超出屏幕
            self.widget.move(max(10, x), max(10, y))

    def _stop_all(self):
        self.engine.stop_all()
        for card in self.widget.cards.values():
            if card.active:
                card.active = False
                card.toggle_btn.setText("▶")
                card.icon_label.setPixmap(card._icon_normal)
                card.icon_label.setObjectName("soundIcon")
                card.setObjectName("soundCard")
                card.style().unpolish(card)
                card.style().polish(card)
                card.icon_label.style().unpolish(card.icon_label)
                card.icon_label.style().polish(card.icon_label)
        self.widget._update_status()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            self.toggle_widget()

    def _quit(self):
        self.engine.stop_all()
        self.engine.stop_output()
        if self.hotkey:
            self.hotkey.stop()
        self.tray.hide()
        self.app.quit()


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)  # 窗口关闭不退出，托盘常驻

    # 检查托盘是否可用
    if not QSystemTrayIcon.isSystemTrayAvailable():
        print("[main] 系统托盘不可用，程序将退出")
        sys.exit(1)

    controller = AppController(app)

    # 非演示模式：启动后显示一次欢迎提示
    if not controller.demo_mode:
        controller.tray.showMessage(
            "环境音便携版",
            "已驻留系统托盘，按 Ctrl+Shift+A 唤起面板",
        )

    # 演示模式：延迟截图后退出
    # 使用 Qt 内置 grab() 渲染组件到 QPixmap，不使用 CopyFromScreen
    screenshot_path = None
    for i, arg in enumerate(sys.argv):
        if arg == "--screenshot" and i + 1 < len(sys.argv):
            screenshot_path = sys.argv[i + 1]
            break

    if controller.demo_mode and screenshot_path:
        def capture_and_quit():
            pixmap = controller.widget.grab()
            pixmap.save(screenshot_path, "PNG")
            app.quit()
        # 延迟 500ms 让 QSS 和 paint 事件完成
        QTimer.singleShot(500, capture_and_quit)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
