# -*- coding: utf-8 -*-
"""便签管家便携版 - 主入口
像输入法一样的体验：
  · 全局热键 Ctrl+Alt+N 唤起快速记录小窗
  · 全局热键 Ctrl+Alt+L 唤起便签列表小窗
  · 系统托盘常驻，失焦自动隐藏
  · 内存占用低，启动快，单 EXE 便携分发
"""

from __future__ import annotations

import os
import sys
import threading
from typing import Optional

# 确保 PySide6 在 PyInstaller 打包后能找到 plugins
if getattr(sys, "frozen", False):
    import PySide6
    pyside_dir = os.path.dirname(PySide6.__file__)
    os.environ["QT_PLUGIN_PATH"] = os.path.join(pyside_dir, "plugins")

from PySide6.QtCore import Qt, QObject, Signal, QTimer, QSize
from PySide6.QtGui import (
    QAction,
    QColor,
    QFont,
    QIcon,
    QImage,
    QPainter,
    QPainterPath,
    QPixmap,
    QBrush,
)
from PySide6.QtWidgets import (
    QApplication,
    QMenu,
    QSystemTrayIcon,
    QMessageBox,
)

import note_store
from capture_window import CaptureWindow
from list_window import ListWindow
from styles import APPLE_BLUE, APPLE_WHITE


# === 全局热键信号桥（keyboard 库的回调在子线程，需要信号转发到主线程）===

class HotkeyBridge(QObject):
    show_capture_requested = Signal()
    show_list_requested = Signal()
    quit_requested = Signal()


def make_tray_icon(size: int = 64) -> QIcon:
    """用 QPainter 绘制苹果白风格便签图标"""
    pix = QPixmap(size, size)
    pix.fill(Qt.transparent)
    p = QPainter(pix)
    p.setRenderHint(QPainter.Antialiasing, True)
    p.setRenderHint(QPainter.TextAntialiasing, True)

    # 圆角白色卡片背景
    path = QPainterPath()
    path.addRoundedRect(2, 2, size - 4, size - 4, size * 0.22, size * 0.22)
    p.fillPath(path, QBrush(QColor(APPLE_WHITE)))

    # 蓝色描边
    pen = p.pen()
    pen.setColor(QColor(APPLE_BLUE))
    pen.setWidthF(size * 0.06)
    p.setPen(pen)
    p.drawPath(path)

    # 三条横线（便签纸纹理）
    pen.setColor(QColor("#86868b"))
    pen.setWidthF(size * 0.05)
    p.setPen(pen)
    margin = size * 0.24
    line_spacing = size * 0.16
    for i in range(3):
        y = margin + i * line_spacing
        p.drawLine(int(margin), int(y), int(size - margin), int(y))

    # 右上角蓝色小圆点（强调色）
    p.setPen(Qt.NoPen)
    p.setBrush(QBrush(QColor(APPLE_BLUE)))
    p.drawEllipse(int(size * 0.72), int(size * 0.18), int(size * 0.14), int(size * 0.14))

    p.end()
    return QIcon(pix)


class TrayApp(QObject):
    """系统托盘应用主控"""

    def __init__(self, app: QApplication) -> None:
        super().__init__()
        self.app = app
        self.data_path = note_store.default_data_path()

        # 子窗口
        self.capture_window: Optional[CaptureWindow] = None
        self.list_window: Optional[ListWindow] = None

        # 热键桥
        self.hotkey_bridge = HotkeyBridge()
        self.hotkey_bridge.show_capture_requested.connect(self.show_capture)
        self.hotkey_bridge.show_list_requested.connect(self.show_list)
        self.hotkey_bridge.quit_requested.connect(self._quit)

        # 托盘图标
        self.tray = QSystemTrayIcon(make_tray_icon(64), parent=self)
        self.tray.setToolTip("便签管家便携版 · Ctrl+Alt+N 快速记录")
        self._build_tray_menu()
        self.tray.show()

        # 启动时显示一次托盘通知
        QTimer.singleShot(800, self._show_startup_hint)

        # 注册全局热键（在子线程中）
        self._hotkey_thread: Optional[threading.Thread] = None
        self._register_hotkeys()

    def _build_tray_menu(self) -> None:
        menu = QMenu()
        menu.setStyleSheet("""
            QMenu {
                background: white;
                border: 1px solid #e5e5ea;
                border-radius: 8px;
                padding: 6px;
                font-size: 13px;
            }
            QMenu::item {
                padding: 6px 18px 6px 22px;
                border-radius: 6px;
                margin: 1px 4px;
            }
            QMenu::item:selected {
                background: #007aff;
                color: white;
            }
            QMenu::separator {
                height: 1px;
                background: #f0f0f4;
                margin: 4px 8px;
            }
        """)

        act_new = QAction("📝 快速记录 (Ctrl+Alt+N)", menu)
        act_new.triggered.connect(self.show_capture)
        menu.addAction(act_new)

        act_list = QAction("📚 便签列表 (Ctrl+Alt+L)", menu)
        act_list.triggered.connect(self.show_list)
        menu.addAction(act_list)

        menu.addSeparator()

        # 显示便签数
        try:
            data = note_store.load_all(self.data_path)
            stats = note_store.get_stats(data["notes"])
            act_stats = QAction(f"📊 共 {stats['total']} 条 · 置顶 {stats['pinned']}", menu)
            act_stats.setEnabled(False)
            menu.addAction(act_stats)
            menu.addSeparator()
        except Exception:
            pass

        act_data = QAction("📁 打开数据目录", menu)
        act_data.triggered.connect(self._open_data_dir)
        menu.addAction(act_data)

        act_about = QAction("ℹ 关于", menu)
        act_about.triggered.connect(self._show_about)
        menu.addAction(act_about)

        menu.addSeparator()

        act_quit = QAction("✕ 退出", menu)
        act_quit.triggered.connect(self._quit)
        menu.addAction(act_quit)

        self.tray.setContextMenu(menu)

    # === 全局热键 ===

    def _register_hotkeys(self) -> None:
        """在子线程中注册全局热键"""
        def worker():
            try:
                import keyboard
                # 注册热键（suppress=False 不拦截原始按键）
                keyboard.add_hotkey("ctrl+alt+n", lambda: self.hotkey_bridge.show_capture_requested.emit())
                keyboard.add_hotkey("ctrl+alt+l", lambda: self.hotkey_bridge.show_list_requested.emit())
                # 等待退出信号
                while not self._quit_flag.is_set():
                    keyboard.wait(0.5)
                keyboard.unhook_all()
            except Exception as e:
                # 热键注册失败 - 不阻塞主程序
                sys.stderr.write(f"[hotkey] 注册失败: {e}\n")

        self._quit_flag = threading.Event()
        self._hotkey_thread = threading.Thread(target=worker, daemon=True)
        self._hotkey_thread.start()

    # === 窗口管理 ===

    def show_capture(self) -> None:
        if self.capture_window is None:
            self.capture_window = CaptureWindow(self.data_path, parent_tray=self)
        self.capture_window.show_near_cursor()

    def show_list(self) -> None:
        if self.list_window is None:
            self.list_window = ListWindow(self.data_path, parent_tray=self)
        self.list_window.show_near_cursor()

    def edit_note(self, note_id: str) -> None:
        """编辑便签 - 复用捕获窗口"""
        data = note_store.load_all(self.data_path)
        note = next((n for n in data["notes"] if n["id"] == note_id), None)
        if not note:
            return
        if self.capture_window is None:
            self.capture_window = CaptureWindow(self.data_path, parent_tray=self)
        # 填充数据并切换为编辑模式
        self.capture_window._edit_mode = True
        self.capture_window._edit_id = note_id
        self.capture_window.title_input.setText(note.get("title", ""))
        self.capture_window.content_input.setPlainText(note.get("content", ""))
        self.capture_window._select_color(note.get("color", "default"))
        self.capture_window.category_combo.setCurrentText(note.get("category", "其他"))
        self.capture_window.show_near_cursor()

    # === 回调 ===

    def on_note_added(self) -> None:
        self._build_tray_menu()

    def on_note_changed(self) -> None:
        self._build_tray_menu()

    # === 其他动作 ===

    def _open_data_dir(self) -> None:
        path = os.path.dirname(self.data_path)
        os.makedirs(path, exist_ok=True)
        os.startfile(path)

    def _show_about(self) -> None:
        QMessageBox.information(
            None,
            "关于便签管家便携版",
            "<div style='font-family: Microsoft YaHei UI; line-height: 1.6;'>"
            "<h3 style='color: #007aff; margin: 0 0 8px 0;'>📝 便签管家便携版 v1.0.0</h3>"
            "<p style='color: #1d1d1f;'>像输入法一样的便签体验：需要时出现，不需要时隐藏。</p>"
            "<p style='color: #86868b; font-size: 12px;'>"
            "· 全局热键 Ctrl+Alt+N 唤起快速记录<br>"
            "· 全局热键 Ctrl+Alt+L 唤起便签列表<br>"
            "· 系统托盘常驻，失焦自动隐藏<br>"
            "· 数据本地存储，零联网零上传<br>"
            "</p>"
            "<p style='color: #86868b; font-size: 11px; margin-top: 12px;'>"
            "原生 PySide6 重构 · 苹果白高端风格"
            "</p>"
            "</div>"
        )

    def _show_startup_hint(self) -> None:
        self.tray.showMessage(
            "便签管家便携版已启动",
            "按 Ctrl+Alt+N 快速记录\n按 Ctrl+Alt+L 查看便签列表",
            QSystemTrayIcon.Information,
            3000,
        )

    def _quit(self) -> None:
        self._quit_flag.set()
        # 关闭所有窗口
        if self.capture_window is not None:
            self.capture_window.hide()
        if self.list_window is not None:
            self.list_window.hide()
        self.tray.hide()
        QTimer.singleShot(100, self.app.quit)


def main() -> int:
    # 高 DPI 支持
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    app = QApplication(sys.argv)
    app.setApplicationName("便签管家便携版")
    app.setApplicationVersion("1.0.0")
    app.setQuitOnLastWindowClosed(False)  # 关闭窗口不退出（托盘常驻）

    # 设置应用图标
    app.setWindowIcon(make_tray_icon(256))

    # 单实例检查
    # 用 Qt.singleApplication 风格 - 通过 QSharedMemory 或简单文件锁
    # 这里使用 socket 端口占用做轻量检查
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
        s.bind(("127.0.0.1", 51738))
        s.listen(1)
        # 持有 socket 不关闭，作为单实例锁
        app._single_lock_socket = s  # type: ignore[attr-defined]
    except OSError:
        # 已有实例运行
        mb = QMessageBox()
        mb.setIcon(QMessageBox.Information)
        mb.setWindowTitle("便签管家便携版")
        mb.setText("便签管家便携版已在运行中，请使用托盘图标或全局热键唤起。")
        mb.exec()
        return 0

    tray_app = TrayApp(app)

    # 首次启动自动唤起一次捕获窗口（让用户看到界面）
    QTimer.singleShot(1200, tray_app.show_capture)

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
