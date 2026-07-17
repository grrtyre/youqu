# -*- coding: utf-8 -*-
"""main.py - 密码生成器便携版主程序

像输入法一样的体验：按热键唤起 → 生成密码 → 复制 → 失焦自动隐藏。

特性：
- 全局热键 Ctrl+Shift+P 唤起（Win32 RegisterHotKey，无额外依赖）
- 失焦自动隐藏（输入法式行为）
- 系统托盘常驻（关闭窗口不退出）
- 小界面 380×460（≤400×500）
- 苹果白高端风格（QSS）
- 密码学安全（secrets 模块）

截图模式：--screenshot 参数禁用失焦隐藏与托盘，常驻显示供 PrintWindow 后台截取。
"""

from __future__ import annotations

import ctypes
import os
import sys
import time
from ctypes import wintypes

from PySide6.QtCore import Qt, QTimer, QEvent, QPoint, QPropertyAnimation, QRect, Signal
from PySide6.QtGui import (
    QAction,
    QColor,
    QFont,
    QIcon,
    QGuiApplication,
    QKeySequence,
    QLinearGradient,
    QMouseEvent,
    QPainter,
    QPalette,
    QPen,
    QPixmap,
    QShortcut,
)
from PySide6.QtWidgets import (
    QApplication,
    QButtonGroup,
    QCheckBox,
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMenu,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSlider,
    QSystemTrayIcon,
    QVBoxLayout,
    QWidget,
)

import pg_core
import resources
import store

# ============ Win32 全局热键 ============
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
VK_F8 = 0x77
VK_P = 0x50
WM_HOTKEY = 0x0312

user32 = ctypes.WinDLL("user32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
# 设置常用 Win32 函数签名（capture_self 使用）
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetWindowRect.restype = wintypes.BOOL
gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.SelectObject.restype = wintypes.HGDIOBJ
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.DeleteObject.restype = wintypes.BOOL
gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteDC.restype = wintypes.BOOL


class HotkeyManager:
    """通过 Win32 RegisterHotKey 注册全局热键，借助 Qt 原生事件过滤器接收 WM_HOTKEY。"""

    def __init__(self):
        self._ids = {}
        self._callbacks = {}
        self._filter = None

    def register(self, hotkey_id: int, mods: int, vk: int, callback):
        if not user32.RegisterHotKey(None, hotkey_id, mods, vk):
            err = ctypes.get_last_error()
            return False, err
        self._ids[hotkey_id] = (mods, vk)
        self._callbacks[hotkey_id] = callback
        return True, 0

    def unregister_all(self):
        for hid in list(self._ids.keys()):
            user32.UnregisterHotKey(None, hid)
        self._ids.clear()

    def install(self, app):
        from PySide6.QtCore import QAbstractNativeEventFilter

        manager = self

        class _Filter(QAbstractNativeEventFilter):
            def nativeEventFilter(self, eventType, message):
                if eventType == b"windows_generic_MSG":
                    msg = wintypes.MSG.from_address(int(message))
                    if msg.message == WM_HOTKEY and msg.wParam in manager._callbacks:
                        manager._callbacks[msg.wParam]()
                        return True, 0
                return False, 0

        self._filter = _Filter()
        app.installNativeEventFilter(self._filter)


# ============ 配色常量（对齐原版 styles.css） ============
C_BG = "#f5f5f7"
C_SURFACE = "#ffffff"
C_SURFACE_2 = "#fafafa"
C_BORDER = "rgba(0,0,0,0.08)"
C_BORDER_SOFT = "rgba(0,0,0,0.06)"
C_TEXT = "#1d1d1f"
C_TEXT_2 = "#6e6e73"
C_TEXT_3 = "#8e8e93"
C_ACCENT = "#007aff"
C_ACCENT_HOVER = "#0066d6"
C_ACCENT_SOFT = "rgba(0,122,255,0.08)"
C_SUCCESS = "#34c759"
C_WARNING = "#ff9500"
C_DANGER = "#ff3b30"
C_DIGIT = "#007aff"
C_SYMBOL = "#ff9500"

# 强度等级颜色（六阶语义色）
STRENGTH_COLORS = ["#d1d1d6", "#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#30b0c7", "#00c6ff"]


def colored_password_html(password: str) -> str:
    """把密码转成带字符类型着色的 HTML（数字蓝、符号橙、字母默认）。

    增强对比度：数字/符号使用更深的颜色 + 600 字重；字母用 500 字重避免过细。
    """
    import html as html_mod

    # 加深数字蓝（#007aff → #0058b0）和符号橙（#ff9500 → #d96b00），提升白底对比度
    C_DIGIT_DEEP = "#0058b0"
    C_SYMBOL_DEEP = "#d96b00"
    out = []
    for ch in password:
        esc = html_mod.escape(ch)
        if ch.isdigit():
            out.append(f'<span style="color:{C_DIGIT_DEEP};font-weight:700">{esc}</span>')
        elif ch in pg_core.CHARSETS["symbols"]:
            out.append(f'<span style="color:{C_SYMBOL_DEEP};font-weight:700">{esc}</span>')
        else:
            out.append(f'<span style="color:{C_TEXT};font-weight:600">{esc}</span>')
    return "".join(out)


# ============ 强度条（自定义绘制） ============
class StrengthBar(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(6)
        self._score = 0
        self._ratio = 0.0
        self._color = QColor("#d1d1d6")

    def set_score(self, score: int, ratio: float):
        self._score = max(0, min(6, score))
        self._ratio = max(0.0, min(1.0, ratio))
        self._color = QColor(STRENGTH_COLORS[self._score])
        self.update()

    def paintEvent(self, _e):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        w = self.width()
        h = self.height()
        # 轨道
        track = QRect(0, h // 2 - 1, w, 2)
        p.setPen(Qt.NoPen)
        p.setBrush(QColor("#eaeaee"))
        p.drawRoundedRect(track, 1, 1)
        # 填充
        if self._ratio > 0:
            fw = max(2, int(w * self._ratio))
            p.setBrush(self._color)
            p.drawRoundedRect(QRect(0, h // 2 - 1, fw, 2), 1, 1)


# ============ 主窗口 ============
class MainWindow(QWidget):
    def __init__(self, screenshot_mode: bool = False):
        super().__init__()
        self.screenshot_mode = screenshot_mode
        self._drag_offset = None
        self.history = store.load_history()
        self.settings = store.load_settings()

        # 窗口属性：无边框 + 工具窗口（不占任务栏）
        # 不使用 WA_TranslucentBackground：PrintWindow 无法渲染半透明顶级窗口，
        # 改用不透明窗口 + 圆角容器 + QGraphicsDropShadowEffect 实现苹果白卡片。
        flags = Qt.FramelessWindowHint | Qt.Tool
        # 仅正常模式置顶；截图模式不置顶避免打扰用户前台工作
        if not screenshot_mode:
            flags |= Qt.WindowStaysOnTopHint
        self.setWindowFlags(flags)
        # 不透明背景（#f5f5f7），PrintWindow 可正常渲染
        self.setAutoFillBackground(True)
        pal = self.palette()
        pal.setColor(QPalette.Window, QColor(C_BG))
        self.setPalette(pal)
        WIN_W, WIN_H = 388, 472  # 4px 阴影边距
        CARD_W, CARD_H = 380, 460
        self.setFixedSize(WIN_W, WIN_H)

        # 中心容器（白色圆角卡片）
        self._container = QFrame(self)
        self._container.setObjectName("container")
        self._container.setGeometry((WIN_W - CARD_W) // 2, (WIN_H - CARD_H) // 2, CARD_W, CARD_H)
        # 阴影效果（细腻 Apple 风阴影）
        shadow = QGraphicsDropShadowEffect(self._container)
        shadow.setBlurRadius(18)
        shadow.setOffset(0, 2)
        shadow.setColor(QColor(0, 0, 0, 28))
        self._container.setGraphicsEffect(shadow)

        layout = QVBoxLayout(self._container)
        layout.setContentsMargins(18, 14, 18, 14)
        layout.setSpacing(10)

        # === 顶部标题栏 ===
        header = self._build_header()
        layout.addLayout(header)

        # === 密码展示卡 ===
        self.pwd_card, pwd_layout = self._build_password_card()
        layout.addWidget(self.pwd_card)

        # === 强度信息行 ===
        strength_row = self._build_strength_row()
        layout.addLayout(strength_row)

        # === 模式切换 ===
        mode_row = self._build_mode_tabs()
        layout.addLayout(mode_row)

        # === 配置区（随机/口令两套） ===
        self.config_container = QWidget()
        self.config_container.setObjectName("configContainer")
        self.config_layout = QVBoxLayout(self.config_container)
        self.config_layout.setContentsMargins(0, 0, 0, 0)
        self.config_layout.setSpacing(8)
        self._build_random_config()
        self._build_passphrase_config()
        self.passphrase_config.setVisible(False)
        layout.addWidget(self.config_container)

        # === 预设行 ===
        preset_row = self._build_presets()
        layout.addLayout(preset_row)

        # === 历史区 ===
        history_block = self._build_history()
        layout.addWidget(history_block, 1)

        # === 底部提示 ===
        footer = QLabel(f"⌘ Ctrl+Shift+P 唤起 · Esc 隐藏 · Enter 重新生成")
        footer.setObjectName("footer")
        footer.setAlignment(Qt.AlignCenter)
        layout.addWidget(footer)

        # 还原设置
        self._apply_settings()

        # 生成首个密码
        self.regenerate()

        # 截图模式：预填演示历史，展示历史区完整样式（不写磁盘）
        if screenshot_mode and not self.history:
            self.history = [
                {"password": "Xk9$mP2!nQrL8vW#", "kind": "random", "ts": time.time() - 120},
                {"password": "aB3#kL9@vN7pQ4rT", "kind": "random", "ts": time.time() - 3600},
                {"password": "River-Spring-Eagle-42", "kind": "passphrase", "ts": time.time() - 7200},
            ]
            self._refresh_history()

        # 失焦隐藏定时器（延迟，避免误触）
        self._focus_timer = QTimer(self)
        self._focus_timer.setSingleShot(True)
        self._focus_timer.setInterval(120)
        self._focus_timer.timeout.connect(self._on_focus_check)

        # 截图模式：居中显示且不隐藏
        if screenshot_mode:
            QTimer.singleShot(60, self._center_on_screen)

    # ----- UI 构造 -----
    def _build_header(self):
        h = QHBoxLayout()
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(10)
        # 品牌徽标（渐变圆角，平衡右侧复制按钮的视觉重量）
        icon_lbl = QLabel("🔐")
        icon_lbl.setObjectName("brandIcon")
        icon_lbl.setAlignment(Qt.AlignCenter)
        icon_lbl.setFixedSize(28, 28)
        title = QLabel("密码生成器")
        title.setObjectName("title")
        sub = QLabel("便携版")
        sub.setObjectName("subtitle")
        h.addWidget(icon_lbl)
        h.addWidget(title)
        h.addWidget(sub)
        h.addStretch()
        self.close_btn = QPushButton("×")
        self.close_btn.setObjectName("closeBtn")
        self.close_btn.setFixedSize(22, 22)
        self.close_btn.setCursor(Qt.PointingHandCursor)
        self.close_btn.clicked.connect(self.hide_window)
        h.addWidget(self.close_btn)
        return h

    def _build_password_card(self):
        card = QFrame()
        card.setObjectName("pwdCard")
        v = QVBoxLayout(card)
        v.setContentsMargins(14, 12, 14, 12)
        v.setSpacing(6)
        self.pwd_label = QLabel("")
        self.pwd_label.setObjectName("pwdLabel")
        self.pwd_label.setTextFormat(Qt.RichText)
        self.pwd_label.setTextInteractionFlags(Qt.TextSelectableByMouse)
        self.pwd_label.setMinimumHeight(34)
        self.pwd_label.setCursor(Qt.IBeamCursor)
        self.pwd_label.setWordWrap(False)
        v.addWidget(self.pwd_label)
        meta = QHBoxLayout()
        meta.setContentsMargins(0, 0, 0, 0)
        meta.setSpacing(10)
        self.meta_label = QLabel("")
        self.meta_label.setObjectName("meta")
        meta.addWidget(self.meta_label)
        meta.addStretch()
        copy_btn = QPushButton("📋 复制")
        copy_btn.setObjectName("copyBtn")
        copy_btn.setCursor(Qt.PointingHandCursor)
        copy_btn.clicked.connect(self.copy_current)
        meta.addWidget(copy_btn)
        v.addLayout(meta)
        return card, v

    def _build_strength_row(self):
        h = QHBoxLayout()
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(8)
        self.strength_bar = StrengthBar()
        h.addWidget(self.strength_bar, 1)
        self.strength_label = QLabel("—")
        self.strength_label.setObjectName("strengthLabel")
        self.strength_label.setAlignment(Qt.AlignVCenter | Qt.AlignRight)
        self.strength_label.setMinimumWidth(52)
        h.addWidget(self.strength_label)
        return h

    def _build_mode_tabs(self):
        h = QHBoxLayout()
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(6)
        self.mode_group = QButtonGroup(self)
        self.mode_group.setExclusive(True)
        self.btn_random = QPushButton("随机密码")
        self.btn_random.setObjectName("modeBtn")
        self.btn_random.setCheckable(True)
        self.btn_random.setChecked(True)
        self.btn_random.clicked.connect(lambda: self._switch_mode("random"))
        self.btn_pass = QPushButton("记忆口令")
        self.btn_pass.setObjectName("modeBtn")
        self.btn_pass.setCheckable(True)
        self.btn_pass.clicked.connect(lambda: self._switch_mode("passphrase"))
        self.mode_group.addButton(self.btn_random, 0)
        self.mode_group.addButton(self.btn_pass, 1)
        h.addWidget(self.btn_random)
        h.addWidget(self.btn_pass)
        h.addStretch()
        return h

    def _build_random_config(self):
        self.random_config = QWidget()
        v = QVBoxLayout(self.random_config)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(8)

        # 长度行
        len_row = QHBoxLayout()
        len_row.setContentsMargins(0, 0, 0, 0)
        len_lbl = QLabel("长度")
        len_lbl.setObjectName("cfgLabel")
        self.len_value = QLabel("16")
        self.len_value.setObjectName("lenValue")
        len_row.addWidget(len_lbl)
        len_row.addStretch()
        len_row.addWidget(self.len_value)
        v.addLayout(len_row)

        self.len_slider = QSlider(Qt.Horizontal)
        self.len_slider.setRange(4, 64)
        self.len_slider.setValue(16)
        self.len_slider.setObjectName("lenSlider")
        self.len_slider.valueChanged.connect(self._on_len_changed)
        v.addWidget(self.len_slider)

        # 字符类型行
        type_row = QHBoxLayout()
        type_row.setContentsMargins(0, 0, 0, 0)
        type_row.setSpacing(10)
        self.chk_upper = QCheckBox("大写 A")
        self.chk_lower = QCheckBox("小写 a")
        self.chk_digits = QCheckBox("数字 9")
        self.chk_symbols = QCheckBox("符号 !")
        for chk in (self.chk_upper, self.chk_lower, self.chk_digits, self.chk_symbols):
            chk.setObjectName("typeChk")
            chk.setChecked(True)
            chk.toggled.connect(self.regenerate)
            type_row.addWidget(chk)
        type_row.addStretch()
        v.addLayout(type_row)

        # 排除易混
        self.chk_exclude = QCheckBox("排除易混字符  i l 1 L o 0 O")
        self.chk_exclude.setObjectName("typeChk")
        self.chk_exclude.toggled.connect(self.regenerate)
        v.addWidget(self.chk_exclude)

        self.config_layout.addWidget(self.random_config)

    def _build_passphrase_config(self):
        self.passphrase_config = QWidget()
        v = QVBoxLayout(self.passphrase_config)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(8)

        words_row = QHBoxLayout()
        words_row.setContentsMargins(0, 0, 0, 0)
        wlbl = QLabel("词数")
        wlbl.setObjectName("cfgLabel")
        self.words_value = QLabel("4")
        self.words_value.setObjectName("lenValue")
        words_row.addWidget(wlbl)
        words_row.addStretch()
        words_row.addWidget(self.words_value)
        v.addLayout(words_row)

        self.words_slider = QSlider(Qt.Horizontal)
        self.words_slider.setRange(3, 8)
        self.words_slider.setValue(4)
        self.words_slider.setObjectName("lenSlider")
        self.words_slider.valueChanged.connect(self._on_words_changed)
        v.addWidget(self.words_slider)

        sep_row = QHBoxLayout()
        sep_row.setContentsMargins(0, 0, 0, 0)
        sep_row.setSpacing(6)
        sep_lbl = QLabel("分隔符")
        sep_lbl.setObjectName("cfgLabel")
        sep_row.addWidget(sep_lbl)
        self.sep_group = QButtonGroup(self)
        self.sep_group.setExclusive(True)
        for sep in ["-", "_", "#", "."]:
            b = QPushButton(sep)
            b.setObjectName("sepBtn")
            b.setCheckable(True)
            b.setChecked(sep == "-")
            b.clicked.connect(lambda checked, s=sep: self._on_sep_changed(s))
            self.sep_group.addButton(b)
            sep_row.addWidget(b)
        sep_row.addStretch()
        v.addLayout(sep_row)

        opt_row = QHBoxLayout()
        opt_row.setContentsMargins(0, 0, 0, 0)
        opt_row.setSpacing(10)
        self.chk_cap = QCheckBox("首字母大写")
        self.chk_cap.setChecked(True)
        self.chk_cap.toggled.connect(self.regenerate)
        self.chk_num = QCheckBox("附加数字")
        self.chk_num.setChecked(True)
        self.chk_num.toggled.connect(self.regenerate)
        opt_row.addWidget(self.chk_cap)
        opt_row.addWidget(self.chk_num)
        opt_row.addStretch()
        v.addLayout(opt_row)

        self.config_layout.addWidget(self.passphrase_config)

    def _build_presets(self):
        h = QHBoxLayout()
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(5)
        lbl = QLabel("预设")
        lbl.setObjectName("cfgLabel")
        h.addWidget(lbl)
        for name in ["PIN", "WiFi", "标准", "高强", "极高"]:
            b = QPushButton(name)
            b.setObjectName("presetBtn")
            b.setCursor(Qt.PointingHandCursor)
            b.clicked.connect(lambda _=False, n=name: self._apply_preset(n))
            h.addWidget(b)
        h.addStretch()
        return h

    def _build_history(self):
        block = QWidget()
        v = QVBoxLayout(block)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(4)
        head = QHBoxLayout()
        head.setContentsMargins(0, 0, 0, 0)
        h_lbl = QLabel("历史")
        h_lbl.setObjectName("cfgLabel")
        head.addWidget(h_lbl)
        head.addStretch()
        clr = QPushButton("清空")
        clr.setObjectName("linkBtn")
        clr.setCursor(Qt.PointingHandCursor)
        clr.clicked.connect(self.clear_history)
        head.addWidget(clr)
        v.addLayout(head)

        self.history_list = QVBoxLayout()
        self.history_list.setContentsMargins(0, 0, 0, 0)
        self.history_list.setSpacing(6)
        v.addLayout(self.history_list, 1)
        self._refresh_history()
        return block

    # ----- 行为 -----
    def _apply_settings(self):
        s = self.settings
        if "length" in s:
            self.len_slider.setValue(int(s["length"]))
        self.chk_upper.setChecked(s.get("upper", True))
        self.chk_lower.setChecked(s.get("lower", True))
        self.chk_digits.setChecked(s.get("digits", True))
        self.chk_symbols.setChecked(s.get("symbols", True))
        self.chk_exclude.setChecked(s.get("exclude_ambiguous", False))
        if "mode" in s and s["mode"] == "passphrase":
            self.btn_pass.setChecked(True)
            self._switch_mode("passphrase")
        if "words" in s:
            self.words_slider.setValue(int(s["words"]))
        if "separator" in s:
            for b in self.sep_group.buttons():
                b.setChecked(b.text() == s["separator"])
        self.chk_cap.setChecked(s.get("capitalize", True))
        self.chk_num.setChecked(s.get("include_number", True))

    def _save_settings(self):
        self.settings = {
            "length": self.len_slider.value(),
            "upper": self.chk_upper.isChecked(),
            "lower": self.chk_lower.isChecked(),
            "digits": self.chk_digits.isChecked(),
            "symbols": self.chk_symbols.isChecked(),
            "exclude_ambiguous": self.chk_exclude.isChecked(),
            "mode": "passphrase" if self.btn_pass.isChecked() else "random",
            "words": self.words_slider.value(),
            "separator": self._current_separator(),
            "capitalize": self.chk_cap.isChecked(),
            "include_number": self.chk_num.isChecked(),
        }
        store.save_settings(self.settings)

    def _current_separator(self) -> str:
        for b in self.sep_group.buttons():
            if b.isChecked():
                return b.text()
        return "-"

    def _switch_mode(self, mode: str):
        is_pass = mode == "passphrase"
        self.random_config.setVisible(not is_pass)
        self.passphrase_config.setVisible(is_pass)
        self.regenerate()

    def _on_len_changed(self, v):
        self.len_value.setText(str(v))
        self.regenerate()

    def _on_words_changed(self, v):
        self.words_value.setText(str(v))
        self.regenerate()

    def _on_sep_changed(self, _sep):
        self.regenerate()

    def _apply_preset(self, name):
        cfg = pg_core.PRESETS.get(name)
        if not cfg:
            return
        self.btn_random.setChecked(True)
        self._switch_mode("random")
        self.len_slider.setValue(cfg["length"])
        self.chk_lower.setChecked(cfg["lower"])
        self.chk_upper.setChecked(cfg["upper"])
        self.chk_digits.setChecked(cfg["digits"])
        self.chk_symbols.setChecked(cfg["symbols"])
        self.chk_exclude.setChecked(cfg["exclude_ambiguous"])
        self.regenerate()

    def _collect_random_opts(self):
        return {
            "length": self.len_slider.value(),
            "lower": self.chk_lower.isChecked(),
            "upper": self.chk_upper.isChecked(),
            "digits": self.chk_digits.isChecked(),
            "symbols": self.chk_symbols.isChecked(),
            "exclude_ambiguous": self.chk_exclude.isChecked(),
        }

    def _collect_passphrase_opts(self):
        return {
            "words": self.words_slider.value(),
            "separator": self._current_separator(),
            "capitalize": self.chk_cap.isChecked(),
            "include_number": self.chk_num.isChecked(),
        }

    def regenerate(self):
        if self.btn_pass.isChecked():
            pwd = pg_core.generate_passphrase(self._collect_passphrase_opts())
            kind = "passphrase"
        else:
            opts = self._collect_random_opts()
            pwd = pg_core.generate_password(opts)
            kind = "random"
            if not pwd:
                self.pwd_label.setText('<span style="color:#8e8e93">请至少选择一种字符类型</span>')
                self.meta_label.setText("")
                self.strength_bar.set_score(0, 0.0)
                self.strength_label.setText("—")
                return
        self.current_password = pwd
        self.current_kind = kind
        self.pwd_label.setText(colored_password_html(pwd))
        # 字符池与元信息
        if kind == "random":
            pool = 0
            if self.chk_lower.isChecked():
                pool += 26
            if self.chk_upper.isChecked():
                pool += 26
            if self.chk_digits.isChecked():
                pool += 10
            if self.chk_symbols.isChecked():
                pool += 29
            info = pg_core.evaluate_strength(pwd)
            crack = pg_core.estimate_crack_time(info["entropy"])
            self.meta_label.setText(f'{len(pwd)} 位 · 池 {pool} · 熵 {info["entropy"]} · 破解 {crack}')
            self.strength_bar.set_score(info["score"], info["entropy"] / 128.0)
            self.strength_label.setText(info["label"])
            self.strength_label.setStyleSheet(f"color:{STRENGTH_COLORS[info['score']]};font-weight:600;")
        else:
            info = pg_core.evaluate_strength(pwd)
            crack = pg_core.estimate_crack_time(info["entropy"])
            self.meta_label.setText(f'{len(pwd)} 字符 · 熵 {info["entropy"]} · 破解 {crack}')
            self.strength_bar.set_score(info["score"], info["entropy"] / 128.0)
            self.strength_label.setText(info["label"])
            self.strength_label.setStyleSheet(f"color:{STRENGTH_COLORS[info['score']]};font-weight:600;")

    def copy_current(self):
        if getattr(self, "current_password", ""):
            QGuiApplication.clipboard().setText(self.current_password)
            self._add_to_history(self.current_password, getattr(self, "current_kind", "random"))
            self._flash_copy_btn()

    def _flash_copy_btn(self):
        for b in self.pwd_card.findChildren(QPushButton):
            if b.objectName() == "copyBtn":
                orig = b.text()
                b.setText("✓ 已复制")
                QTimer.singleShot(900, lambda: b.setText(orig))
                break

    def _add_to_history(self, pwd, kind):
        self.history = store.add_history(self.history, pwd, kind)
        store.save_history(self.history)
        self._refresh_history()

    def clear_history(self):
        self.history = []
        store.clear_history()
        self._refresh_history()

    def _refresh_history(self):
        # 清空
        while self.history_list.count():
            it = self.history_list.takeAt(0)
            w = it.widget()
            if w:
                w.deleteLater()
        if not self.history:
            empty = QLabel("clipboard\n暂无历史记录\n复制后在此快速回取")
            empty.setObjectName("emptyHistory")
            empty.setAlignment(Qt.AlignCenter)
            self.history_list.addWidget(empty)
            self.history_list.addStretch()
            return
        now = time.time()
        for item in self.history[:8]:
            row = self._make_history_row(item, now)
            self.history_list.addWidget(row)
        self.history_list.addStretch()

    def _make_history_row(self, item, now):
        w = QFrame()
        w.setObjectName("historyRow")
        h = QHBoxLayout(w)
        h.setContentsMargins(8, 4, 8, 4)
        h.setSpacing(8)
        pwd = item.get("password", "")
        display = pwd if len(pwd) <= 30 else pwd[:29] + "…"
        lbl = QLabel(display)
        lbl.setObjectName("historyPwd")
        lbl.setTextFormat(Qt.RichText)
        lbl.setText(colored_password_html(display))
        lbl.setCursor(Qt.PointingHandCursor)
        lbl.setToolTip("点击复制")
        ts = item.get("ts", now)
        ago = self._format_ago(now - ts)
        tag = "口令" if item.get("kind") == "passphrase" else "随机"
        meta = QLabel(f"{tag} · {ago}")
        meta.setObjectName("historyMeta"
                          )
        h.addWidget(lbl, 1)
        h.addWidget(meta)
        # 点击复制
        def _copy(_e, p=pwd):
            QGuiApplication.clipboard().setText(p)
            self._flash_status(f"已复制 · {p[:12]}…")
        w.mousePressEvent = _copy
        lbl.mousePressEvent = _copy
        return w

    def _flash_status(self, _msg):
        # 简单反馈：略调标题（避免引入额外控件）
        pass

    @staticmethod
    def _format_ago(secs):
        if secs < 60:
            return "刚刚"
        if secs < 3600:
            return f"{int(secs // 60)} 分钟前"
        if secs < 86400:
            return f"{int(secs // 3600)} 小时前"
        return f"{int(secs // 86400)} 天前"

    # ----- 窗口控制 -----
    def hide_window(self):
        if self.screenshot_mode:
            return
        self._save_settings()
        self.hide()

    def show_near_cursor(self):
        """在鼠标附近显示（输入法式行为）。"""
        cursor = QGuiApplication.primaryScreen()  # placeholder
        pos = self._cursor_pos()
        screen = QGuiApplication.screenAt(pos) or QGuiApplication.primaryScreen()
        geo = screen.availableGeometry()
        x = pos.x() + 16
        y = pos.y() + 16
        # 边界回弹
        if x + self.width() > geo.right():
            x = pos.x() - self.width() - 16
        if y + self.height() > geo.bottom():
            y = geo.bottom() - self.height() - 8
        if x < geo.left():
            x = geo.left() + 4
        if y < geo.top():
            y = geo.top() + 4
        self.move(x, y)  # 卡片有 4px 阴影边距，窗口即定位点
        self.show()
        self.raise_()
        self.activateWindow()

    def _cursor_pos(self):
        import ctypes

        pt = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        return QPoint(pt.x, pt.y)

    def _center_on_screen(self):
        screen = QGuiApplication.primaryScreen()
        geo = screen.availableGeometry()
        x = geo.center().x() - self.width() // 2
        y = geo.center().y() - self.height() // 2
        self.move(x, y)
        self.show()
        self.raise_()

    def capture_self(self, output_path: str) -> bool:
        """渲染本窗口为 PNG。

        优先尝试 PrintWindow（PW_RENDERFULLCONTENT）后台截取本进程窗口；
        若环境/Qt6 组合下 PrintWindow 返回空位图，则回退到 QWidget.grab()
        自渲染（仅本应用控件，不读屏幕像素、不抓其他窗口、不抢前台，
        契合"后台截图绝不打扰用户、禁止 CopyFromScreen"的约束精神）。
        """
        import ctypes as _ctypes

        hwnd = int(self.winId())
        used_printwindow = False
        try:
            PW_RENDERFULLCONTENT = 2
            user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
            user32.PrintWindow.restype = wintypes.BOOL
            r = wintypes.RECT()
            user32.GetWindowRect(hwnd, _ctypes.byref(r))
            w = r.right - r.left
            h = r.bottom - r.top
            if w > 0 and h > 0:
                hdc_mem = gdi32.CreateCompatibleDC(None)
                hbmp = gdi32.CreateCompatibleBitmap(hdc_mem, w, h)
                gdi32.SelectObject(hdc_mem, hbmp)
                ok = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)
                if not ok:
                    ok = user32.PrintWindow(hwnd, hdc_mem, 0)

                class _BINF(_ctypes.Structure):
                    _fields_ = [
                        ("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG),
                        ("biHeight", wintypes.LONG), ("biPlanes", wintypes.WORD),
                        ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
                        ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG),
                        ("biYPelsPerMeter", wintypes.LONG), ("biClrUsed", wintypes.DWORD),
                        ("biClrImportant", wintypes.DWORD),
                    ]

                bi = _BINF()
                bi.biSize = _ctypes.sizeof(_BINF)
                bi.biWidth = w
                bi.biHeight = -h
                bi.biPlanes = 1
                bi.biBitCount = 32
                buf = _ctypes.create_string_buffer(w * h * 4)
                gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, _ctypes.c_uint, _ctypes.c_uint, _ctypes.c_void_p, _ctypes.c_void_p, _ctypes.c_uint]
                gdi32.GetDIBits.restype = _ctypes.c_int
                gdi32.GetDIBits(hdc_mem, hbmp, 0, h, buf, _ctypes.byref(bi), 0)
                # 检测是否有非透明像素
                non_trans = sum(1 for i in range(0, len(buf.raw), 4) if buf.raw[i + 3] != 0)
                gdi32.DeleteObject(hbmp)
                gdi32.DeleteDC(hdc_mem)
                used_printwindow = True
                if ok and non_trans > w * h * 0.05:
                    from PIL import Image as _PILImage

                    img = _PILImage.frombytes("RGBA", (w, h), buf.raw)
                    bg = _PILImage.new("RGBA", (w, h), (245, 245, 247, 255))
                    _PILImage.alpha_composite(bg, img).convert("RGB").save(output_path, "PNG")
                    return True
        except Exception:
            pass

        # 回退：QWidget.grab() 自渲染（可靠，仅本应用控件）
        pix = self.grab()
        if pix and not pix.isNull():
            pix.save(output_path, "PNG")
            return True
        return False

    # 失焦检测
    def changeEvent(self, event):
        super().changeEvent(event)
        if event.type() == QEvent.ActivationChange and not self.screenshot_mode:
            if not self.isActiveWindow():
                self._focus_timer.start()
            else:
                self._focus_timer.stop()

    def _on_focus_check(self):
        if not self.screenshot_mode and not self.isActiveWindow():
            self.hide_window()

    # 拖动
    def mousePressEvent(self, event: QMouseEvent):
        if event.button() == Qt.LeftButton:
            # 仅在容器非交互区拖动
            self._drag_offset = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event: QMouseEvent):
        if self._drag_offset is not None and event.buttons() & Qt.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_offset)
            event.accept()

    def mouseReleaseEvent(self, event: QMouseEvent):
        self._drag_offset = None
        event.accept()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.hide_window()
            return
        if event.key() == Qt.Key_Return or event.key() == Qt.Key_Enter:
            self.regenerate()
            return
        if event.key() == Qt.Key_C and event.modifiers() & Qt.ControlModifier:
            self.copy_current()
            return
        super().keyPressEvent(event)


# ============ QSS 苹果白样式 ============
QSS = f"""
* {{
    font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif;
    font-size: 13px;
    color: {C_TEXT};
}}
#container {{
    background: {C_SURFACE};
    border-radius: 14px;
    border: 1px solid {C_BORDER_SOFT};
}}
QLabel {{
    background: transparent;
}}
#brandIcon {{
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #007aff, stop:1 #00c6ff);
    color: #ffffff;
    border-radius: 8px;
    font-size: 15px;
}}
#title {{
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
}}
#subtitle {{
    font-size: 10px;
    color: {C_TEXT_3};
    letter-spacing: 0.06em;
    padding: 1px 6px;
    background: {C_ACCENT_SOFT};
    border-radius: 5px;
}}
#closeBtn {{
    background: transparent;
    border: none;
    color: {C_TEXT_3};
    font-size: 18px;
    font-weight: 300;
    border-radius: 11px;
}}
#closeBtn:hover {{
    background: rgba(255,59,48,0.10);
    color: {C_DANGER};
}}
#pwdCard {{
    background: {C_SURFACE};
    border: 1px solid rgba(0,0,0,0.10);
    border-radius: 12px;
}}
#pwdLabel {{
    font-family: "Cascadia Code", "JetBrains Mono", "Consolas", "Courier New", monospace;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.03em;
    background: transparent;
}}
#meta {{
    font-size: 11px;
    color: {C_TEXT_3};
    background: transparent;
}}
#copyBtn {{
    background: {C_ACCENT};
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
}}
#copyBtn:hover {{
    background: {C_ACCENT_HOVER};
}}
#copyBtn:pressed {{
    background: #0058b0;
}}
#strengthLabel {{
    font-size: 13px;
    font-weight: 700;
    background: transparent;
    padding: 2px 8px;
    border-radius: 5px;
}}
#modeBtn {{
    background: {C_SURFACE};
    border: 1px solid {C_BORDER};
    border-radius: 8px;
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 500;
    color: {C_TEXT_2};
}}
#modeBtn:hover {{
    background: {C_SURFACE_2};
}}
#modeBtn:checked {{
    background: {C_ACCENT};
    color: #ffffff;
    border-color: {C_ACCENT};
}}
#cfgLabel {{
    font-size: 12px;
    color: {C_TEXT_2};
    font-weight: 500;
    background: transparent;
}}
#lenValue {{
    font-size: 12px;
    color: {C_ACCENT};
    font-weight: 600;
    background: transparent;
}}
#lenSlider::groove:horizontal {{
    height: 4px;
    background: #e6e6eb;
    border-radius: 2px;
}}
#lenSlider::sub-page:horizontal {{
    background: {C_ACCENT};
    border-radius: 2px;
}}
#lenSlider::handle:horizontal {{
    background: {C_SURFACE};
    width: 16px;
    height: 16px;
    margin: -7px 0;
    border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.08);
}}
#lenSlider::handle:horizontal:hover {{
    background: {C_ACCENT_SOFT};
    border: 1px solid {C_ACCENT};
}}
QCheckBox {{
    spacing: 6px;
    font-size: 12px;
    color: {C_TEXT_2};
    background: transparent;
}}
QCheckBox::indicator {{
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid #c7c7cc;
    background: {C_SURFACE};
}}
QCheckBox::indicator:hover {{
    border-color: {C_ACCENT};
}}
QCheckBox::indicator:checked {{
    background: {C_ACCENT};
    border-color: {C_ACCENT};
    image: none;
}}
#sepBtn {{
    background: {C_SURFACE};
    border: 1px solid {C_BORDER};
    border-radius: 6px;
    padding: 4px 10px;
    font-family: "Consolas", monospace;
    font-size: 13px;
    color: {C_TEXT_2};
    min-width: 26px;
}}
#sepBtn:hover {{
    background: {C_SURFACE_2};
}}
#sepBtn:checked {{
    background: {C_ACCENT};
    color: #ffffff;
    border-color: {C_ACCENT};
}}
#presetBtn {{
    background: {C_SURFACE};
    border: 1px solid {C_BORDER};
    border-radius: 8px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    color: {C_TEXT_2};
}}
#presetBtn:hover {{
    background: {C_ACCENT_SOFT};
    color: {C_ACCENT};
    border-color: {C_ACCENT};
}}
#presetBtn:pressed {{
    background: {C_ACCENT};
    color: #ffffff;
    border-color: {C_ACCENT};
}}
#linkBtn {{
    background: transparent;
    border: none;
    color: {C_TEXT_3};
    font-size: 11px;
    padding: 2px 4px;
}}
#linkBtn:hover {{
    color: {C_DANGER};
}}
#historyRow {{
    background: {C_SURFACE};
    border: 1px solid {C_BORDER_SOFT};
    border-radius: 7px;
}}
#historyRow:hover {{
    background: {C_ACCENT_SOFT};
    border-color: rgba(0,122,255,0.18);
}}
#historyPwd {{
    font-family: "Consolas", "Cascadia Code", monospace;
    font-size: 12px;
    background: transparent;
}}
#historyMeta {{
    font-size: 10px;
    color: {C_TEXT_3};
    background: transparent;
}}
#emptyHistory {{
    color: {C_TEXT_3};
    font-size: 12px;
    padding: 18px 8px;
    background: {C_SURFACE_2};
    border: 1px dashed {C_BORDER};
    border-radius: 8px;
    min-height: 56px;
}}
#footer {{
    color: {C_TEXT_2};
    font-size: 11px;
    font-weight: 500;
    background: {C_SURFACE_2};
    border: 1px solid {C_BORDER_SOFT};
    border-radius: 8px;
    padding: 6px 10px;
    letter-spacing: 0.01em;
}}
"""


def _parse_screenshot_out():
    """从命令行解析 --out <路径>，用于截图模式输出。"""
    for i, a in enumerate(sys.argv):
        if a == "--out" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        if a.startswith("--out="):
            return a.split("=", 1)[1]
    return ""


def run():
    screenshot_mode = "--screenshot" in sys.argv
    screenshot_out = _parse_screenshot_out() if screenshot_mode else ""

    app = QApplication(sys.argv)
    app.setApplicationName("PasswordGeneratorPortable")
    # 托盘常驻：隐藏窗口不退出；截图模式由 capture_self 后主动退出
    app.setQuitOnLastWindowClosed(False)

    # 生成图标
    resources.ensure_icon()
    app_icon = resources.app_qicon()
    app.setWindowIcon(app_icon)

    # 创建主窗口
    window = MainWindow(screenshot_mode=screenshot_mode)
    window.setStyleSheet(QSS)
    window.setWindowIcon(app_icon)

    # 扪盘（非截图模式）
    tray = None
    hotkey_mgr = None
    if not screenshot_mode:
        tray = _create_tray(app, window, app_icon)
        # 全局热键 Ctrl+Shift+P
        hotkey_mgr = HotkeyManager()
        ok, err = hotkey_mgr.register(1, MOD_CONTROL | MOD_SHIFT, VK_P, window.show_near_cursor)
        if not ok:
            # 回退到 F8
            hotkey_mgr.register(1, 0, VK_F8, window.show_near_cursor)
        hotkey_mgr.install(app)

        # 启动时隐藏，等待热键唤起（输入法式行为）
        QTimer.singleShot(50, window.hide)
    else:
        # 截图模式：居中显示 → 等待渲染稳定 → 自渲染截图 → 退出
        window._center_on_screen()

        def _do_capture():
            # 多帧处理确保布局/样式/字体完全就绪
            for _ in range(8):
                app.processEvents()
                time.sleep(0.05)
            if screenshot_out:
                ok = window.capture_self(screenshot_out)
                if ok:
                    print(f"OK {screenshot_out}", flush=True)
                else:
                    print(f"FAIL capture", flush=True)
            if hotkey_mgr:
                hotkey_mgr.unregister_all()
            app.quit()

        QTimer.singleShot(220, _do_capture)

    exit_code = app.exec()

    if hotkey_mgr:
        hotkey_mgr.unregister_all()
    return exit_code


def _create_tray(app, window, icon):
    tray = QSystemTrayIcon(icon, parent=app)
    tray.setToolTip("密码生成器便携版 · Ctrl+Shift+P 唤起")

    menu = QMenu()
    menu.setStyleSheet(f"""
        QMenu {{
            background: {C_SURFACE};
            border: 1px solid {C_BORDER_SOFT};
            border-radius: 8px;
            padding: 4px;
        }}
        QMenu::item {{
            padding: 6px 18px;
            border-radius: 5px;
            font-size: 13px;
            color: {C_TEXT};
        }}
        QMenu::item:selected {{
            background: {C_ACCENT_SOFT};
            color: {C_ACCENT};
        }}
        QMenu::separator {{
            height: 1px;
            background: {C_BORDER_SOFT};
            margin: 4px 8px;
        }}
    """)
    act_show = QAction("显示 / 唤起 (Ctrl+Shift+P)", menu)
    act_show.triggered.connect(window.show_near_cursor)
    menu.addAction(act_show)
    act_gen = QAction("生成新密码", menu)
    act_gen.triggered.connect(lambda: (window.show_near_cursor(), window.regenerate()))
    menu.addAction(act_gen)
    menu.addSeparator()
    act_quit = QAction("退出", menu)
    act_quit.triggered.connect(app.quit)
    menu.addAction(act_quit)

    tray.setContextMenu(menu)
    tray.activated.connect(lambda reason: window.show_near_cursor() if reason == QSystemTrayIcon.Trigger else None)
    tray.show()
    return tray


if __name__ == "__main__":
    sys.exit(run())
