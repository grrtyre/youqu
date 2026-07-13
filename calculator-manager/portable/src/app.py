# -*- coding: utf-8 -*-
"""计算器便携版 · 主程序
Spotlight 式计算器：全局热键唤起、实时求值、失焦隐藏、托盘常驻
苹果白高端风格 —— 白底浅灰、细腻阴影、系统字体、蓝色 #007aff 强调
"""
import sys
import os
import json
import ctypes
from ctypes import wintypes

from PySide6.QtCore import Qt, QTimer, QEvent, QAbstractNativeEventFilter, QObject, Signal
from PySide6.QtGui import QIcon, QFont, QFontDatabase, QKeySequence, QShortcut, QColor, QPainter, QPen
from PySide6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QFrame, QSystemTrayIcon, QMenu, QGraphicsDropShadowEffect,
    QSizePolicy, QPushButton,
)
from PySide6.QtGui import QClipboard

# 引入引擎
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import calc_engine as eng  # noqa: E402

# ============ Windows API 常量 ============
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_NOREPEAT = 0x4000
VK_C = 0x43
WM_HOTKEY = 0x0312
HOTKEY_ID = 9001

user32 = ctypes.windll.user32


def register_hotkey(hwnd=None) -> bool:
    """注册全局热键 Ctrl+Alt+C"""
    return bool(user32.RegisterHotKey(None, HOTKEY_ID, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, VK_C))


def unregister_hotkey():
    user32.UnregisterHotKey(None, HOTKEY_ID)


class HotkeyFilter(QAbstractNativeEventFilter):
    """捕获 Windows 原生 WM_HOTKEY 消息"""
    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        if eventType == b"windows_generic_MSG":
            try:
                msg = wintypes.MSG.from_address(int(message))
                if msg.message == WM_HOTKEY and msg.wParam == HOTKEY_ID:
                    self._callback()
                    return True, 0
            except Exception:
                pass
        return False, 0


# ============ 样式 ============
APPLE_QSS = """
QWidget#root {
    background: #ffffff;
    border-radius: 18px;
}
QLabel#title {
    color: #6e6e73;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
}
QFrame#inputCard {
    background: #f5f5f7;
    border-radius: 14px;
}
QLineEdit#input {
    background: transparent;
    border: none;
    padding: 16px 18px 6px 18px;
    color: #1d1d1f;
    font-size: 24px;
    font-weight: 500;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}
QFrame#cardDivider {
    background: #e5e5ea;
    max-height: 1px;
    margin: 0 18px;
}
QLabel#resultPrefix {
    color: #007aff;
    font-size: 14px;
    font-weight: 600;
}
QLabel#result {
    color: #1d1d1f;
    font-size: 28px;
    font-weight: 700;
}
QFrame#toolbar {
    background: #f5f5f7;
    border-radius: 10px;
}
QLabel#hint {
    color: #8e8e93;
    font-size: 11px;
}
QLabel#hintPill {
    color: #3d3d42;
    font-size: 13px;
    font-weight: 500;
    background: #f0f0f5;
    border-radius: 9px;
    padding: 7px 16px;
}
QLabel#error {
    color: #ff3b30;
    font-size: 12px;
    font-weight: 500;
}
QLabel#shortcut {
    color: #8e8e93;
    font-size: 11px;
    font-weight: 500;
}
QLabel#shortcutKey {
    color: #1d1d1f;
    font-size: 11px;
    font-weight: 600;
    background: #ffffff;
    border-radius: 4px;
    padding: 2px 6px;
}
QPushButton#pill {
    background: #ffffff;
    border: 1px solid #d8d8de;
    border-radius: 10px;
    padding: 10px 0;
    min-width: 46px;
    max-width: 46px;
    color: #1d1d1f;
    font-size: 16px;
    font-weight: 500;
}
QPushButton#pill:hover {
    background: #f0f0f5;
    border-color: #c0c0c8;
}
QPushButton#pill:pressed {
    background: #007aff;
    color: #ffffff;
    border-color: #007aff;
}
QPushButton#pillFunc {
    background: #ffffff;
    border: 1px solid #c8e0fc;
    border-radius: 10px;
    padding: 10px 0;
    min-width: 46px;
    max-width: 46px;
    color: #007aff;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#pillFunc:hover {
    background: #e8f0fe;
    border-color: #007aff;
}
QPushButton#pillFunc:pressed {
    background: #007aff;
    color: #ffffff;
    border-color: #007aff;
}
"""


class CalculatorWindow(QWidget):
    def __init__(self):
        super().__init__()
        self._building_ui = True
        self.setWindowTitle("计算器便携版")
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.Tool | Qt.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WA_TranslucentBackground, True)
        self.setAttribute(Qt.WA_ShowWithoutActivating, False)
        self.setFixedSize(420, 320)

        # 数据
        self._variables: dict = {}
        self._history: list = []
        self._history_index = -1
        self._last_input = ""
        self._data_path = self._data_file()

        self._build_ui()
        self._load_data()
        self._apply_shadow()
        self._building_ui = False

        # 失焦自动隐藏：显示后短时间内抑制，避免刚弹出就被隐藏
        self._suppress_hide = True
        # 截图模式：禁用失焦隐藏，便于后台截图
        self._shot_mode = os.environ.get("PORTABLE_SHOT_MODE") == "1"

    # ---- UI 构建 ----
    def _build_ui(self):
        root = QFrame(self)
        root.setObjectName("root")
        root.setGeometry(0, 0, 420, 320)
        lay = QVBoxLayout(root)
        lay.setContentsMargins(22, 14, 22, 14)
        lay.setSpacing(10)

        # 顶部标题行
        top = QHBoxLayout()
        top.setSpacing(6)
        self._title = QLabel("计算器")
        self._title.setObjectName("title")
        top.addWidget(self._title)
        top.addStretch()
        self._badge = QLabel("⌘ Ctrl Alt C")
        self._badge.setObjectName("shortcutKey")
        top.addWidget(self._badge)
        lay.addLayout(top)

        # 输入 + 结果统一卡片
        card = QFrame()
        card.setObjectName("inputCard")
        cl = QVBoxLayout(card)
        cl.setContentsMargins(0, 0, 0, 8)
        cl.setSpacing(0)
        self._input = QLineEdit()
        self._input.setObjectName("input")
        self._input.setPlaceholderText("输入表达式…  如 2+3*4、sin(pi/2)、sqrt(16)")
        self._input.setAttribute(Qt.WA_MacShowFocusRect, 0)
        self._input.textChanged.connect(self._on_input_changed)
        cl.addWidget(self._input)
        # 卡片内分割线
        div = QFrame()
        div.setObjectName("cardDivider")
        div.setFixedHeight(1)
        cl.addWidget(div)
        # 结果行
        rc = QHBoxLayout()
        rc.setContentsMargins(18, 8, 18, 4)
        rc.setSpacing(8)
        rc.addStretch()
        self._result_prefix = QLabel("")
        self._result_prefix.setObjectName("resultPrefix")
        rc.addWidget(self._result_prefix)
        self._result = QLabel("")
        self._result.setObjectName("result")
        self._result.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        rc.addWidget(self._result)
        cl.addLayout(rc)
        # 错误提示（卡片内底部）
        self._error = QLabel("")
        self._error.setObjectName("error")
        self._error.setAlignment(Qt.AlignLeft)
        self._error.setContentsMargins(18, 0, 18, 6)
        cl.addWidget(self._error)
        lay.addWidget(card)

        # 快捷符号按钮行（白色描边统一 + 蓝色函数强调）
        pills = QHBoxLayout()
        pills.setSpacing(8)
        for label, insert in [("π", "pi"), ("e", "e"), ("^", "^"), ("!", "!"),
                              ("(", "("), (")", ")")]:
            btn = self._make_pill(label, insert, "pill")
            pills.addWidget(btn)
        for label, insert in [("√", "sqrt("), ("sin", "sin(")]:
            btn = self._make_pill(label, insert, "pillFunc")
            pills.addWidget(btn)
        pills.addStretch()
        lay.addLayout(pills)

        # 底部快捷键提示（浅灰 pill 背景）
        self._hint = QLabel("上下 历史    Enter 复制结果    Esc 清空 / 隐藏")
        self._hint.setObjectName("hintPill")
        self._hint.setAlignment(Qt.AlignCenter)
        lay.addWidget(self._hint, alignment=Qt.AlignCenter)

        root.setStyleSheet(APPLE_QSS)
        self._root = root

    def _make_pill(self, label, insert, obj_name):
        btn = QPushButton(label)
        btn.setObjectName(obj_name)
        btn.setFixedHeight(38)
        btn.setCursor(Qt.PointingHandCursor)
        btn.clicked.connect(lambda _=False, t=insert: self._insert_text(t))
        return btn

    def _insert_text(self, text: str):
        self._input.insert(text)
        self._input.setFocus()

    def _apply_shadow(self):
        shadow = QGraphicsDropShadowEffect(self._root)
        shadow.setBlurRadius(40)
        shadow.setColor(QColor(0, 0, 0, 50))
        shadow.setOffset(0, 8)
        self._root.setGraphicsEffect(shadow)

    def _center_on_screen(self):
        screen = QApplication.primaryScreen().availableGeometry()
        x = screen.center().x() - self.width() // 2
        y = int(screen.height() * 0.28)
        self.move(x, y)

    # ---- 数据持久化 ----
    def _data_file(self) -> str:
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        d = os.path.join(base, "calculator-portable")
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, "data.json")

    def _load_data(self):
        try:
            with open(self._data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._variables = data.get("variables", {})
            self._history = data.get("history", [])
        except Exception:
            self._variables = {}
            self._history = []

    def _save_data(self):
        try:
            with open(self._data_path, "w", encoding="utf-8") as f:
                json.dump({"variables": self._variables, "history": self._history[-200:]}, f, ensure_ascii=False)
        except Exception:
            pass

    # ---- 实时求值 ----
    def _on_input_changed(self, text):
        if self._building_ui:
            return
        text = text.strip()
        if not text:
            self._result.setText("")
            self._result_prefix.setText("")
            self._error.setText("")
            return
        try:
            assign = eng.try_parse_assignment(text, self._variables)
            if assign is not None:
                self._result_prefix.setText(f"{assign['name']} =")
                self._result.setText(eng.format_result(assign['value']))
                self._error.setText("按 Enter 确认赋值")
                self._error.setStyleSheet("color:#34c759;font-size:12px;font-weight:500;")
                return
            val = eng.evaluate(text, self._variables)
            self._result_prefix.setText("=")
            self._result.setText(eng.format_result(val))
            self._error.setText("")
            self._error.setStyleSheet("")
        except Exception as e:
            self._result.setText("")
            self._result_prefix.setText("")
            self._error.setText(str(e))

    # ---- 键盘事件 ----
    def keyPressEvent(self, event):
        key = event.key()
        mods = event.modifiers()
        if key == Qt.Key_Escape:
            if self._input.text():
                self._input.clear()
            else:
                self.hide()
            return
        if key in (Qt.Key_Return, Qt.Key_Enter):
            self._commit()
            return
        if key == Qt.Key_Up:
            self._browse_history(-1)
            return
        if key == Qt.Key_Down:
            self._browse_history(1)
            return
        super().keyPressEvent(event)

    def _browse_history(self, delta):
        if not self._history:
            return
        self._history_index = max(-1, min(len(self._history) - 1, self._history_index + delta))
        if 0 <= self._history_index < len(self._history):
            self._input.setText(self._history[self._history_index])
            self._input.setCursorPosition(len(self._input.text()))

    def _commit(self):
        text = self._input.text().strip()
        if not text:
            self.hide()
            return
        try:
            assign = eng.try_parse_assignment(text, self._variables)
            if assign is not None:
                self._variables[assign["name"]] = assign["value"]
                self._history.insert(0, text)
                self._history_index = -1
                self._save_data()
                self._input.clear()
                self.hide()
                return
            val = eng.evaluate(text, self._variables)
            result_str = eng.format_result(val)
            self._history.insert(0, text)
            self._history_index = -1
            self._save_data()
            # 复制到剪贴板
            QApplication.clipboard().setText(result_str)
            self._input.clear()
            self.hide()
        except Exception as e:
            self._error.setText(str(e))

    # ---- 失焦自动隐藏 ----
    def changeEvent(self, event):
        if event.type() == QEvent.ActivationChange and self.isVisible():
            if not self.isActiveWindow() and not self._suppress_hide and not self._shot_mode:
                # 延迟隐藏 150ms，给托盘菜单/输入法等交互留时间
                QTimer.singleShot(150, self._maybe_hide)
        super().changeEvent(event)

    def _maybe_hide(self):
        if self.isVisible() and not self.isActiveWindow():
            self.hide()

    def focusOutEvent(self, event):
        super().focusOutEvent(event)

    # ---- 显示/隐藏 ----
    def toggle(self):
        if self.isVisible():
            self.hide()
        else:
            self._show_at_cursor_or_center()

    def _show_at_cursor_or_center(self):
        self._suppress_hide = True
        if self._shot_mode and not self._input.text():
            # 截图模式：预填示例表达式，展示 UI 效果
            self._input.setText("2 + 3 * 4")
        self.show()
        self.raise_()
        self.activateWindow()
        self._input.setFocus()
        self._input.selectAll()
        # 600ms 后解除抑制，开始监听失焦
        QTimer.singleShot(600, self._release_suppress)

    def _release_suppress(self):
        self._suppress_hide = False

    def showEvent(self, event):
        super().showEvent(event)
        self.raise_()
        self.activateWindow()

    # ---- 系统托盘 ----
    def setup_tray(self, app_icon: QIcon):
        self._tray = QSystemTrayIcon(app_icon, self)
        self._tray.setToolTip("计算器便携版 · Ctrl+Alt+C 唤起")
        menu = QMenu()
        act_show = menu.addAction("显示计算器")
        act_show.triggered.connect(self._show_at_cursor_or_center)
        menu.addSeparator()
        act_quit = menu.addAction("退出")
        act_quit.triggered.connect(QApplication.quit)
        self._tray.setContextMenu(menu)
        self._tray.activated.connect(self._on_tray_activated)
        self._tray.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:
            self._show_at_cursor_or_center()


def main():
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setApplicationName("计算器便携版")

    # 字体
    QFontDatabase.addApplicationFont("C:/Windows/Fonts/segoeui.ttf")
    font = QFont("Segoe UI", 10)
    app.setFont(font)

    # 图标（兼容 PyInstaller onefile：优先 sys._MEIPASS，其次源码相对路径）
    base_dir = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    icon_path = os.path.join(base_dir, "assets", "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = os.path.join(base_dir, "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icon.ico")
    app_icon = QIcon(icon_path) if os.path.exists(icon_path) else QIcon()
    app.setWindowIcon(app_icon)

    win = CalculatorWindow()
    win.setup_tray(app_icon)

    # 注册全局热键
    if not register_hotkey():
        # 热键注册失败，仍然可用托盘唤起
        pass
    hotkey_filter = HotkeyFilter(win.toggle)
    app.installNativeEventFilter(hotkey_filter)

    # 首次显示
    QTimer.singleShot(300, win._show_at_cursor_or_center)

    code = app.exec()
    unregister_hotkey()
    sys.exit(code)


if __name__ == "__main__":
    main()
