# -*- coding: utf-8 -*-
"""
二维码便携版 - qr-manager portable
原生 PySide6 实现，像输入法一样贴系统的小组件
全局热键 Ctrl+Alt+Q 唤起 / 失焦自动隐藏 / 系统托盘常驻
苹果白高端风格
"""
import sys
import os
import json
import io
from datetime import datetime

from PySide6.QtCore import (
    Qt, QTimer, QSize, QPoint, QRect, QEvent, QObject
)
from PySide6.QtGui import (
    QPixmap, QImage, QAction, QIcon, QColor, QFont, QCursor,
    QGuiApplication, QPainter, QPen, QBrush
)
from PySide6.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, QTextEdit, QLineEdit,
    QVBoxLayout, QHBoxLayout, QStackedWidget, QSystemTrayIcon, QMenu,
    QFileDialog, QMessageBox, QFrame, QGraphicsDropShadowEffect, QToolButton,
    QButtonGroup, QSizePolicy, QSpacerItem
)

# 二维码生成
import qrcode
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H

# 二维码识别
try:
    from pyzbar.pyzbar import decode as zbar_decode
    HAS_PYZBAR = True
except Exception:
    HAS_PYZBAR = False

# 全局热键
try:
    import keyboard
    HAS_KEYBOARD = True
except Exception:
    HAS_KEYBOARD = False


# ============== 苹果白风格配色 ==============
COLOR_BG = "#f5f5f7"          # 主背景 浅灰
COLOR_CARD = "#ffffff"        # 卡片白色
COLOR_ACCENT = "#007aff"      # Apple 蓝
COLOR_ACCENT_HOVER = "#0066d6"
COLOR_TEXT = "#1d1d1f"        # 主文字
COLOR_TEXT_SEC = "#6e6e73"    # 次文字
COLOR_BORDER = "#d2d2d7"      # 边框
COLOR_SHADOW = "#3a3a3c"      # 阴影
COLOR_SUCCESS = "#34c759"     # 绿色


APP_NAME = "二维码便携版"
APP_VERSION = "1.0.0"
HOTKEY = "ctrl+alt+q"

# 配置存储路径（用户目录）
CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".qr-manager-portable")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
HISTORY_FILE = os.path.join(CONFIG_DIR, "history.json")
ICON_CACHE = os.path.join(CONFIG_DIR, "icon.png")

# 全局样式表（苹果白高端风格）
QSS = f"""
QWidget#Root {{
    background: {COLOR_BG};
}}
QFrame#Card {{
    background: {COLOR_CARD};
    border-radius: 12px;
    border: 1px solid #ececef;
}}
QLabel#Title {{
    color: {COLOR_TEXT};
    font-size: 14px;
    font-weight: 600;
    background: transparent;
}}
QLabel#Subtitle {{
    color: {COLOR_TEXT_SEC};
    font-size: 11px;
    background: transparent;
    font-weight: 500;
}}
QLabel#HintText {{
    color: {COLOR_TEXT_SEC};
    font-size: 10px;
    background: transparent;
}}
QLabel#StatusLabel {{
    color: {COLOR_TEXT_SEC};
    font-size: 10px;
    background: transparent;
    font-weight: 400;
}}
QLabel#StatusSuccess {{
    color: {COLOR_SUCCESS};
    font-size: 10px;
    background: transparent;
    font-weight: 500;
}}
QToolButton#TypeTab {{
    color: {COLOR_TEXT_SEC};
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 8px 14px 6px 14px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 6px;
}}
QToolButton#TypeTab:checked {{
    color: {COLOR_ACCENT};
    background: rgba(0, 122, 255, 0.08);
    border-bottom: 2px solid {COLOR_ACCENT};
    font-weight: 600;
}}
QToolButton#TypeTab:hover:!checked {{
    color: {COLOR_TEXT};
    background: rgba(0, 0, 0, 0.03);
}}
QTextEdit#Input, QLineEdit#Input {{
    background: {COLOR_CARD};
    color: {COLOR_TEXT};
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
    selection-background-color: rgba(0, 122, 255, 0.2);
    selection-color: {COLOR_TEXT};
}}
QTextEdit#Input:focus, QLineEdit#Input:focus {{
    border: 1px solid {COLOR_ACCENT};
    background: white;
}}
QComboBox#InputCombo {{
    background: {COLOR_CARD};
    color: {COLOR_TEXT};
    border: 1px solid #e5e5ea;
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
}}
QComboBox#InputCombo:focus {{
    border: 1px solid {COLOR_ACCENT};
}}
QComboBox#InputCombo::drop-down {{
    border: none;
    width: 20px;
}}
QComboBox#InputCombo QAbstractItemView {{
    background: white;
    color: {COLOR_TEXT};
    selection-background-color: rgba(0, 122, 255, 0.12);
    selection-color: {COLOR_ACCENT};
    border: 1px solid {COLOR_BORDER};
    outline: none;
}}
QPushButton#Primary {{
    color: white;
    background: {COLOR_ACCENT};
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 12px;
    font-weight: 500;
}}
QPushButton#Primary:hover {{
    background: {COLOR_ACCENT_HOVER};
}}
QPushButton#Primary:pressed {{
    background: #0055b3;
}}
QPushButton#Secondary {{
    color: {COLOR_TEXT};
    background: {COLOR_CARD};
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 500;
}}
QPushButton#Secondary:hover {{
    background: #fafafa;
    border: 1px solid #c7c7cc;
}}
QPushButton#Secondary:pressed {{
    background: #f0f0f2;
}}
QPushButton#ActionBtn {{
    color: {COLOR_TEXT};
    background: {COLOR_CARD};
    border: 1px solid #e5e5ea;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 12px;
    font-weight: 500;
    text-align: center;
}}
QPushButton#ActionBtn:hover {{
    background: {COLOR_ACCENT};
    border: 1px solid {COLOR_ACCENT};
    color: white;
}}
QPushButton#ActionBtn:pressed {{
    background: {COLOR_ACCENT_HOVER};
    border: 1px solid {COLOR_ACCENT_HOVER};
    color: white;
}}
QLabel#HistoryItem {{
    color: {COLOR_TEXT};
    background: transparent;
    border: none;
    padding: 6px 8px;
    font-size: 11px;
    border-radius: 6px;
}}
QLabel#HistoryItem:hover {{
    background: rgba(0, 122, 255, 0.08);
    color: {COLOR_ACCENT};
}}
QPushButton#CloseBtn, QPushButton#MinBtn {{
    background: transparent;
    border: none;
    color: {COLOR_TEXT_SEC};
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 6px;
}}
QPushButton#CloseBtn:hover {{
    background: #ff5f57;
    color: white;
}}
QPushButton#MinBtn:hover {{
    background: rgba(0, 0, 0, 0.06);
    color: {COLOR_TEXT};
}}
QLabel#StatusBadge {{
    color: {COLOR_ACCENT};
    background: rgba(0, 122, 255, 0.08);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 9px;
    font-weight: 500;
}}
QFrame#QrBox {{
    background: {COLOR_CARD};
    border: 1px solid #d2d2d7;
    border-radius: 12px;
}}
QFrame#Divider {{
    background: #ececef;
    border: none;
}}
"""


def make_app_icon():
    """生成内置应用图标（蓝色 QR 风格 PNG）"""
    from PIL import Image, ImageDraw
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 圆角白色背景
    margin = 16
    radius = 48
    d.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius, fill=(255, 255, 255, 255)
    )
    # 蓝色 QR 模拟方块
    cell = 18
    grid_n = 8
    start_x = (size - cell * grid_n) // 2
    start_y = (size - cell * grid_n) // 2
    pattern = [
        [1, 1, 1, 0, 0, 1, 1, 1],
        [1, 0, 1, 0, 1, 1, 0, 1],
        [1, 0, 1, 1, 0, 0, 1, 1],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 1, 0, 0, 1, 1, 1, 0],
        [1, 1, 1, 0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1, 0, 1, 1],
        [1, 1, 1, 0, 1, 1, 1, 1],
    ]
    blue = (0, 122, 255, 255)
    for r in range(grid_n):
        for c in range(grid_n):
            if pattern[r][c]:
                x = start_x + c * cell
                y = start_y + r * cell
                d.rounded_rectangle([x, y, x + cell - 2, y + cell - 2], radius=3, fill=blue)
    # 三个定位角（深色实心）
    def corner(cx, cy):
        d.rounded_rectangle([cx, cy, cx + cell * 2 - 2, cy + cell * 2 - 2], radius=4, fill=blue)
    return img


def get_app_icon_pixmap():
    """获取应用图标 QPixmap"""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(ICON_CACHE):
        img = make_app_icon()
        img.save(ICON_CACHE, "PNG")
    return QPixmap(ICON_CACHE)


def make_tray_icon_pixmap():
    """生成托盘图标（16x16 蓝色 QR）"""
    from PIL import Image, ImageDraw
    size = 32
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 圆角白色背景
    d.rounded_rectangle([2, 2, size - 2, size - 2], radius=7, fill=(255, 255, 255, 255))
    # 三个定位角
    blue = (0, 122, 255, 255)
    cell = 5
    # 左上
    d.rounded_rectangle([6, 6, 6 + cell * 2, 6 + cell * 2], radius=2, fill=blue)
    d.rounded_rectangle([7, 7, 6 + cell * 2 - 1, 6 + cell * 2 - 1], radius=1, fill=(255, 255, 255, 255))
    d.rounded_rectangle([8, 8, 8 + cell - 1, 8 + cell - 1], radius=1, fill=blue)
    # 右上
    d.rounded_rectangle([size - 6 - cell * 2, 6, size - 6, 6 + cell * 2], radius=2, fill=blue)
    d.rounded_rectangle([size - 6 - cell * 2 + 1, 7, size - 7, 6 + cell * 2 - 1], radius=1, fill=(255, 255, 255, 255))
    d.rounded_rectangle([size - 6 - cell + 1, 8, size - 7, 8 + cell - 1], radius=1, fill=blue)
    # 左下
    d.rounded_rectangle([6, size - 6 - cell * 2, 6 + cell * 2, size - 6], radius=2, fill=blue)
    d.rounded_rectangle([7, size - 6 - cell * 2 + 1, 6 + cell * 2 - 1, size - 7], radius=1, fill=(255, 255, 255, 255))
    d.rounded_rectangle([8, size - 6 - cell + 1, 8 + cell - 1, size - 7], radius=1, fill=blue)
    # 中间散点
    d.rounded_rectangle([16, 16, 16 + cell, 16 + cell], radius=1, fill=blue)
    d.rounded_rectangle([22, 18, 22 + cell - 1, 18 + cell - 1], radius=1, fill=blue)
    d.rounded_rectangle([18, 22, 18 + cell - 1, 22 + cell - 1], radius=1, fill=blue)

    tray_path = os.path.join(CONFIG_DIR, "tray_icon.ico")
    # 保存为 ico（包含多尺寸）
    img_save = img.convert("RGBA")
    img_save.save(tray_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48)])
    return QIcon(tray_path)


# ============== 二维码核心逻辑（可独立测试） ==============

def build_qr_text(qr_type, data):
    """根据类型构建二维码内容
    qr_type: 'text' | 'url' | 'wifi' | 'email' | 'tel' | 'sms'
    data: dict
    """
    if qr_type == "text":
        return str(data.get("text", "")).strip()
    elif qr_type == "url":
        url = str(data.get("url", "")).strip()
        if url and not (url.startswith("http://") or url.startswith("https://") or url.startswith("ftp://")):
            url = "https://" + url
        return url
    elif qr_type == "wifi":
        ssid = str(data.get("ssid", "")).strip()
        password = str(data.get("password", "")).strip()
        auth = data.get("auth", "WPA")  # WPA / WEP / nopass
        hidden = "true" if data.get("hidden", False) else "false"
        # 转义特殊字符
        def esc(s):
            return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace(":", "\\:")
        return f"WIFI:T:{auth};S:{esc(ssid)};P:{esc(password)};H:{hidden};;"
    elif qr_type == "email":
        email = str(data.get("email", "")).strip()
        subject = str(data.get("subject", "")).strip()
        body = str(data.get("body", "")).strip()
        result = f"mailto:{email}"
        params = []
        if subject:
            params.append(f"subject={subject}")
        if body:
            params.append(f"body={body}")
        if params:
            result += "?" + "&".join(params)
        return result
    elif qr_type == "tel":
        return "tel:" + str(data.get("tel", "")).strip()
    elif qr_type == "sms":
        number = str(data.get("number", "")).strip()
        body = str(data.get("body", "")).strip()
        if body:
            return f"SMSTO:{number}:{body}"
        return f"sms:{number}"
    return ""


def generate_qr_pixmap(text, size=240, error_level="M",
                       fg_color="#1d1d1f", bg_color="#ffffff",
                       border_modules=2):
    """生成二维码 QPixmap，失败返回 None"""
    if not text:
        return None
    err_map = {
        "L": ERROR_CORRECT_L,
        "M": ERROR_CORRECT_M,
        "Q": ERROR_CORRECT_Q,
        "H": ERROR_CORRECT_H,
    }
    try:
        qr = qrcode.QRCode(
            version=None,
            error_correction=err_map.get(error_level, ERROR_CORRECT_M),
            box_size=10,
            border=border_modules,
        )
        qr.add_data(text)
        qr.make(fit=True)
        # 解析颜色
        def hex_to_rgb(h):
            h = h.lstrip("#")
            return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        fg = hex_to_rgb(fg_color)
        bg = hex_to_rgb(bg_color)
        img = qr.make_image(fill_color=fg, back_color=bg).convert("RGBA")
        # 缩放到目标尺寸（保持像素清晰）
        from PIL import Image
        if img.size[0] != size:
            img = img.resize((size, size), Image.NEAREST)
        # 转 QPixmap
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        qimg = QImage()
        qimg.loadFromData(buf.getvalue(), "PNG")
        return QPixmap.fromImage(qimg)
    except Exception as e:
        print(f"QR generate error: {e}", file=sys.stderr)
        return None


def recognize_qr_from_image(image_path):
    """识别图片中的二维码，返回 list[str]"""
    if not HAS_PYZBAR:
        return []
    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        results = zbar_decode(img)
        return [r.data.decode("utf-8", errors="replace") for r in results if r.data]
    except Exception as e:
        print(f"QR recognize error: {e}", file=sys.stderr)
        return []


# ============== 历史记录管理 ==============

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_history(history):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    # 仅保留最近 20 条
    history = history[:20]
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def add_history(qr_type, text, preview=""):
    hist = load_history()
    # 去重（相同内容）
    hist = [h for h in hist if h.get("text") != text]
    hist.insert(0, {
        "type": qr_type,
        "text": text,
        "preview": preview[:60],
        "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
    })
    save_history(hist)


# ============== 主窗口 ==============

class QRWidgetWindow(QWidget):
    """便携版主窗口 - 无边框、贴顶、失焦隐藏"""

    WINDOW_W = 380
    WINDOW_H = 500

    def __init__(self, app):
        super().__init__()
        self.app_ref = app
        self._drag_pos = None
        self._hide_timer = QTimer(self)
        self._hide_timer.setSingleShot(True)
        self._hide_timer.timeout.connect(self._on_hide_timeout)

        self.current_type = "text"
        self.history = load_history()

        self.setWindowTitle(APP_NAME)
        self.setWindowFlags(
            Qt.FramelessWindowHint | Qt.Tool | Qt.WindowStaysOnTopHint
        )
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        self.setObjectName("Root")
        self.setFixedWidth(self.WINDOW_W)
        self.setFixedHeight(self.WINDOW_H)

        self._build_ui()
        self.setStyleSheet(QSS)

        # 加载应用图标
        self._app_icon = get_app_icon_pixmap()
        self.setWindowIcon(QIcon(self._app_icon))

        # 居中显示在主屏上方
        self._center_top()

        # 失焦隐藏（绑定全局 focus 变化）
        QApplication.instance().focusObjectChanged.connect(self._on_focus_changed)

    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(12, 12, 12, 12)
        root.setSpacing(0)

        # ===== 卡片容器 =====
        card = QFrame()
        card.setObjectName("Card")
        card.setFixedHeight(self.WINDOW_H - 24)
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(0, 0, 0, 0)
        card_layout.setSpacing(0)

        # 阴影
        shadow = QGraphicsDropShadowEffect(card)
        shadow.setBlurRadius(28)
        shadow.setColor(QColor(0, 0, 0, 50))
        shadow.setOffset(0, 4)
        card.setGraphicsEffect(shadow)

        # ===== 顶栏 =====
        top_bar = QWidget()
        top_bar.setFixedHeight(40)
        top_bar_layout = QHBoxLayout(top_bar)
        top_bar_layout.setContentsMargins(14, 6, 6, 6)
        top_bar_layout.setSpacing(8)

        title_label = QLabel("📱")
        title_label.setStyleSheet("background:transparent; font-size:14px;")
        title_label.setFixedWidth(20)
        top_bar_layout.addWidget(title_label)

        name_label = QLabel(APP_NAME)
        name_label.setObjectName("Title")
        top_bar_layout.addWidget(name_label)

        badge = QLabel(f"v{APP_VERSION}")
        badge.setObjectName("StatusBadge")
        top_bar_layout.addWidget(badge)

        top_bar_layout.addStretch()

        min_btn = QPushButton("─")
        min_btn.setObjectName("MinBtn")
        min_btn.setFixedSize(32, 24)
        min_btn.setCursor(Qt.PointingHandCursor)
        min_btn.clicked.connect(self.hide)
        top_bar_layout.addWidget(min_btn)

        close_btn = QPushButton("×")
        close_btn.setObjectName("CloseBtn")
        close_btn.setFixedSize(32, 24)
        close_btn.setCursor(Qt.PointingHandCursor)
        close_btn.clicked.connect(self._on_close)
        top_bar_layout.addWidget(close_btn)

        card_layout.addWidget(top_bar)

        # 分隔线
        sep = QFrame()
        sep.setObjectName("Divider")
        sep.setFixedHeight(1)
        card_layout.addWidget(sep)

        # ===== 类型 Tab =====
        tab_wrap = QWidget()
        tab_wrap.setFixedHeight(40)
        tab_layout = QHBoxLayout(tab_wrap)
        tab_layout.setContentsMargins(10, 4, 10, 4)
        tab_layout.setSpacing(2)

        self.tab_group = QButtonGroup(self)
        self.tab_group.setExclusive(True)
        self.tabs = {}
        for key, label in [("text", "文本"), ("url", "网址"), ("wifi", "WiFi"),
                           ("email", "邮箱"), ("tel", "电话")]:
            btn = QToolButton()
            btn.setObjectName("TypeTab")
            btn.setText(label)
            btn.setCheckable(True)
            btn.setCursor(Qt.PointingHandCursor)
            btn.clicked.connect(lambda checked=False, k=key: self._switch_type(k))
            self.tab_group.addButton(btn)
            tab_layout.addWidget(btn)
            self.tabs[key] = btn
        tab_layout.addStretch()
        self.tabs["text"].setChecked(True)
        card_layout.addWidget(tab_wrap)

        # ===== 内容区（堆栈） =====
        self.stack = QStackedWidget()
        self.stack.setObjectName("Stack")

        # 各类型输入界面
        self._build_text_page()
        self._build_url_page()
        self._build_wifi_page()
        self._build_email_page()
        self._build_tel_page()

        card_layout.addWidget(self.stack, stretch=1)

        # ===== QR 预览区 =====
        preview_wrap = QWidget()
        preview_layout = QHBoxLayout(preview_wrap)
        preview_layout.setContentsMargins(16, 8, 16, 8)
        preview_layout.setSpacing(12)
        preview_layout.setAlignment(Qt.AlignVCenter)

        # 左：QR 图
        qr_box = QFrame()
        qr_box.setObjectName("QrBox")
        qr_box.setFixedSize(140, 140)
        # 给 QR 框加细微阴影
        qr_shadow = QGraphicsDropShadowEffect(qr_box)
        qr_shadow.setBlurRadius(16)
        qr_shadow.setColor(QColor(0, 0, 0, 30))
        qr_shadow.setOffset(0, 2)
        qr_box.setGraphicsEffect(qr_shadow)
        qr_box_layout = QVBoxLayout(qr_box)
        qr_box_layout.setContentsMargins(8, 8, 8, 8)
        qr_box_layout.setSpacing(0)
        self.qr_label = QLabel()
        self.qr_label.setAlignment(Qt.AlignCenter)
        self.qr_label.setText("QR")
        self.qr_label.setStyleSheet(
            f"color:{COLOR_TEXT_SEC}; font-size:11px; background:transparent; border:none;"
        )
        qr_box_layout.addWidget(self.qr_label)
        preview_layout.addWidget(qr_box)
        self.qr_box = qr_box

        # 右：操作按钮（统一全宽文字按钮，无 emoji）
        right_box = QVBoxLayout()
        right_box.setSpacing(6)
        right_box.setAlignment(Qt.AlignVCenter)

        self.copy_btn = QPushButton("复制图片")
        self.copy_btn.setObjectName("ActionBtn")
        self.copy_btn.setCursor(Qt.PointingHandCursor)
        self.copy_btn.clicked.connect(self._copy_qr)
        right_box.addWidget(self.copy_btn)

        self.save_btn = QPushButton("保存 PNG")
        self.save_btn.setObjectName("ActionBtn")
        self.save_btn.setCursor(Qt.PointingHandCursor)
        self.save_btn.clicked.connect(self._save_png)
        right_box.addWidget(self.save_btn)

        self.recog_btn = QPushButton("识别图片")
        self.recog_btn.setObjectName("ActionBtn")
        self.recog_btn.setCursor(Qt.PointingHandCursor)
        self.recog_btn.clicked.connect(self._recognize)
        right_box.addWidget(self.recog_btn)

        right_box.addStretch()
        preview_layout.addLayout(right_box, stretch=1)

        card_layout.addWidget(preview_wrap)

        # 细分隔线
        divider = QFrame()
        divider.setObjectName("Divider")
        divider.setFixedHeight(1)
        card_layout.addWidget(divider)

        # ===== 历史 + 状态条 =====
        hist_wrap = QWidget()
        hist_layout = QVBoxLayout(hist_wrap)
        hist_layout.setContentsMargins(16, 4, 16, 8)
        hist_layout.setSpacing(3)

        hist_header = QHBoxLayout()
        hist_header.setSpacing(8)
        hist_title = QLabel("最近生成")
        hist_title.setObjectName("Subtitle")
        hist_header.addWidget(hist_title)
        hist_header.addStretch()
        clear_btn = QPushButton("清空")
        clear_btn.setObjectName("Secondary")
        clear_btn.setFixedHeight(20)
        clear_btn.setStyleSheet(
            f"color:{COLOR_TEXT_SEC}; background:transparent; border:none; "
            f"font-size:10px; padding:1px 4px;"
        )
        clear_btn.setCursor(Qt.PointingHandCursor)
        clear_btn.clicked.connect(self._clear_history)
        hist_header.addWidget(clear_btn)
        hist_layout.addLayout(hist_header)

        self.hist_container = QWidget()
        self.hist_layout_inner = QVBoxLayout(self.hist_container)
        self.hist_layout_inner.setContentsMargins(0, 0, 0, 0)
        self.hist_layout_inner.setSpacing(1)
        hist_layout.addWidget(self.hist_container)

        self.status_label = QLabel("就绪 · 按 Ctrl+Alt+Q 唤起/隐藏")
        self.status_label.setObjectName("StatusLabel")
        self.status_label.setAlignment(Qt.AlignCenter)
        hist_layout.addWidget(self.status_label)

        card_layout.addWidget(hist_wrap)

        root.addWidget(card)

        # 初始化生成一次
        QTimer.singleShot(80, self._refresh_qr)
        self._refresh_history()

    def _build_text_page(self):
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(16, 8, 16, 4)
        lay.setSpacing(6)
        hint = QLabel("输入任意文本，实时生成二维码")
        hint.setObjectName("HintText")
        lay.addWidget(hint)
        self.text_input = QTextEdit()
        self.text_input.setObjectName("Input")
        self.text_input.setPlaceholderText("例如：你好，世界！")
        self.text_input.textChanged.connect(self._refresh_qr)
        lay.addWidget(self.text_input)
        # 预填示例文本，便于首屏即看到效果
        self.text_input.setPlainText("https://github.com/grrtyre/youqu")
        self.stack.addWidget(page)

    def _build_url_page(self):
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(16, 8, 16, 4)
        lay.setSpacing(6)
        hint = QLabel("输入网址，自动补全 https://")
        hint.setObjectName("HintText")
        lay.addWidget(hint)
        self.url_input = QLineEdit()
        self.url_input.setObjectName("Input")
        self.url_input.setPlaceholderText("example.com")
        self.url_input.textChanged.connect(self._refresh_qr)
        lay.addWidget(self.url_input)
        lay.addStretch()
        self.stack.addWidget(page)

    def _build_wifi_page(self):
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(16, 8, 16, 4)
        lay.setSpacing(6)
        hint = QLabel("手机扫码即可连接 WiFi")
        hint.setObjectName("HintText")
        lay.addWidget(hint)

        ssid_lay = QHBoxLayout()
        ssid_lay.setSpacing(8)
        ssid_label = QLabel("名称")
        ssid_label.setObjectName("HintText")
        ssid_label.setFixedWidth(38)
        ssid_lay.addWidget(ssid_label)
        self.wifi_ssid = QLineEdit()
        self.wifi_ssid.setObjectName("Input")
        self.wifi_ssid.setPlaceholderText("WiFi 名称")
        self.wifi_ssid.textChanged.connect(self._refresh_qr)
        ssid_lay.addWidget(self.wifi_ssid)
        lay.addLayout(ssid_lay)

        pwd_lay = QHBoxLayout()
        pwd_lay.setSpacing(8)
        pwd_label = QLabel("密码")
        pwd_label.setObjectName("HintText")
        pwd_label.setFixedWidth(38)
        pwd_lay.addWidget(pwd_label)
        self.wifi_pwd = QLineEdit()
        self.wifi_pwd.setObjectName("Input")
        self.wifi_pwd.setPlaceholderText("WiFi 密码")
        self.wifi_pwd.setEchoMode(QLineEdit.Normal)
        self.wifi_pwd.textChanged.connect(self._refresh_qr)
        pwd_lay.addWidget(self.wifi_pwd)
        lay.addLayout(pwd_lay)

        auth_lay = QHBoxLayout()
        auth_lay.setSpacing(8)
        auth_label = QLabel("加密")
        auth_label.setObjectName("HintText")
        auth_label.setFixedWidth(38)
        auth_lay.addWidget(auth_label)
        from PySide6.QtWidgets import QComboBox
        self.wifi_auth = QComboBox()
        self.wifi_auth.setObjectName("InputCombo")
        self.wifi_auth.addItem("WPA/WPA2", "WPA")
        self.wifi_auth.addItem("WEP", "WEP")
        self.wifi_auth.addItem("无密码", "nopass")
        self.wifi_auth.currentIndexChanged.connect(self._refresh_qr)
        auth_lay.addWidget(self.wifi_auth)
        auth_lay.addStretch()
        lay.addLayout(auth_lay)
        lay.addStretch()
        self.stack.addWidget(page)

    def _build_email_page(self):
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(16, 8, 16, 4)
        lay.setSpacing(6)
        hint = QLabel("生成 mailto 邮箱二维码")
        hint.setObjectName("HintText")
        lay.addWidget(hint)

        self.email_addr = QLineEdit()
        self.email_addr.setObjectName("Input")
        self.email_addr.setPlaceholderText("邮箱地址 user@example.com")
        self.email_addr.textChanged.connect(self._refresh_qr)
        lay.addWidget(self.email_addr)

        self.email_subject = QLineEdit()
        self.email_subject.setObjectName("Input")
        self.email_subject.setPlaceholderText("主题（可选）")
        self.email_subject.textChanged.connect(self._refresh_qr)
        lay.addWidget(self.email_subject)

        self.email_body = QTextEdit()
        self.email_body.setObjectName("Input")
        self.email_body.setPlaceholderText("正文（可选）")
        self.email_body.textChanged.connect(self._refresh_qr)
        lay.addWidget(self.email_body)
        self.stack.addWidget(page)

    def _build_tel_page(self):
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(16, 8, 16, 4)
        lay.setSpacing(6)
        hint = QLabel("生成 tel: 电话拨号二维码")
        hint.setObjectName("HintText")
        lay.addWidget(hint)
        self.tel_input = QLineEdit()
        self.tel_input.setObjectName("Input")
        self.tel_input.setPlaceholderText("电话号码 +86138...")
        self.tel_input.textChanged.connect(self._refresh_qr)
        lay.addWidget(self.tel_input)
        lay.addStretch()
        self.stack.addWidget(page)

    # ============== 窗口行为 ==============

    def _center_top(self):
        screen = QGuiApplication.primaryScreen()
        if screen:
            geo = screen.availableGeometry()
            x = geo.x() + (geo.width() - self.WINDOW_W) // 2
            y = geo.y() + 60
            self.move(x, y)

    def _on_focus_changed(self, _obj):
        """失焦自动隐藏（200ms 延迟，避免切换控件时误触）"""
        if not self.isVisible():
            return
        # 检查活动窗口是否是自己
        active = QApplication.activeWindow()
        if active is not self and active is not None:
            # 不是自己且存在其他活动窗口 → 启动隐藏计时
            self._hide_timer.start(250)
        elif active is None:
            # 焦点丢失到桌面
            self._hide_timer.start(250)
        else:
            self._hide_timer.stop()

    def _on_hide_timeout(self):
        active = QApplication.activeWindow()
        if active is not self:
            self.hide()
            if self.app_ref:
                self.app_ref._update_tray_text()

    def _on_close(self):
        """关闭按钮 → 退出应用"""
        QApplication.quit()

    # 鼠标拖动窗口
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            # 仅顶栏区域可拖动（y < 60）
            if event.position().y() < 60:
                self._drag_pos = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
                event.accept()

    def mouseMoveEvent(self, event):
        if event.buttons() & Qt.LeftButton and self._drag_pos is not None:
            self.move(event.globalPosition().toPoint() - self._drag_pos)
            event.accept()

    def mouseReleaseEvent(self, event):
        self._drag_pos = None

    # ============== 类型切换 ==============

    def _switch_type(self, key):
        self.current_type = key
        idx_map = {"text": 0, "url": 1, "wifi": 2, "email": 3, "tel": 4}
        self.stack.setCurrentIndex(idx_map[key])
        self._refresh_qr()

    # ============== QR 生成 ==============

    def _collect_data(self):
        t = self.current_type
        if t == "text":
            return t, {"text": self.text_input.toPlainText()}
        elif t == "url":
            return t, {"url": self.url_input.text()}
        elif t == "wifi":
            return t, {
                "ssid": self.wifi_ssid.text(),
                "password": self.wifi_pwd.text(),
                "auth": self.wifi_auth.currentData(),
            }
        elif t == "email":
            return t, {
                "email": self.email_addr.text(),
                "subject": self.email_subject.text(),
                "body": self.email_body.toPlainText(),
            }
        elif t == "tel":
            return t, {"tel": self.tel_input.text()}
        return t, {}

    def _refresh_qr(self):
        qr_type, data = self._collect_data()
        text = build_qr_text(qr_type, data)
        if not text:
            self.qr_label.setText("QR")
            self.qr_label.setPixmap(QPixmap())
            self._current_text = ""
            self._current_pixmap = None
            self.status_label.setText("等待输入")
            self.status_label.setStyleSheet("")
            return
        pm = generate_qr_pixmap(text, size=124, error_level="M")
        if pm is None or pm.isNull():
            self.qr_label.setText("生成失败")
            self.qr_label.setPixmap(QPixmap())
            self._current_text = text
            self._current_pixmap = None
            self._set_status("生成失败", "error")
            return
        self.qr_label.setPixmap(pm)
        self.qr_label.setText("")
        self._current_text = text
        self._current_pixmap = generate_qr_pixmap(text, size=512, error_level="M")

        # 加入历史（防抖：仅在内容稳定后加入）
        QTimer.singleShot(500, lambda: self._maybe_add_history(qr_type, text))
        self._set_status(f"已生成 · {len(text)} 字符", "success")

    def _maybe_add_history(self, qr_type, text):
        # 仅当当前内容仍然一致时才加入历史
        cur_type, cur_data = self._collect_data()
        if build_qr_text(cur_type, cur_data) == text and text:
            add_history(qr_type, text, text)
            self.history = load_history()
            self._refresh_history()

    # ============== 操作 ==============

    def _set_status(self, text, kind="info"):
        """统一设置状态文本：info=灰 / success=绿 / error=红"""
        color_map = {
            "info": COLOR_TEXT_SEC,
            "success": COLOR_SUCCESS,
            "error": "#ff3b30",
        }
        c = color_map.get(kind, COLOR_TEXT_SEC)
        weight = "500" if kind != "info" else "400"
        self.status_label.setText(text)
        self.status_label.setStyleSheet(
            f"color:{c}; font-size:10px; background:transparent; font-weight:{weight};"
        )

    def _copy_qr(self):
        if self._current_pixmap is None or self._current_pixmap.isNull():
            self._set_status("暂无二维码", "error")
            return
        clipboard = QApplication.clipboard()
        clipboard.setPixmap(self._current_pixmap)
        self._set_status("已复制图片到剪贴板", "success")

    def _save_png(self):
        if self._current_pixmap is None or self._current_pixmap.isNull():
            self._set_status("暂无二维码", "error")
            return
        default_name = f"qr_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        path, _ = QFileDialog.getSaveFileName(
            self, "保存二维码", default_name, "PNG 图片 (*.png)"
        )
        if path:
            if not path.lower().endswith(".png"):
                path += ".png"
            self._current_pixmap.save(path, "PNG")
            self._set_status(f"已保存 {os.path.basename(path)}", "success")

    def _recognize(self):
        if not HAS_PYZBAR:
            self._set_status("识别模块未就绪", "error")
            QMessageBox.warning(self, "无法识别", "pyzbar 模块未安装或缺少 ZBar DLL。")
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "选择图片", "", "图片 (*.png *.jpg *.jpeg *.bmp *.gif)"
        )
        if not path:
            return
        results = recognize_qr_from_image(path)
        if not results:
            self._set_status("未识别到二维码", "error")
            QMessageBox.information(self, "识别结果", "未在图片中识别到二维码。")
            return
        text = results[0]
        # 把识别结果填入文本框并切换到文本类型
        self.tabs["text"].setChecked(True)
        self._switch_type("text")
        self.text_input.setPlainText(text)
        clipboard = QApplication.clipboard()
        clipboard.setText(text)
        self._set_status("识别成功 · 已复制到剪贴板", "success")
        if len(results) > 1:
            QMessageBox.information(
                self, "识别结果",
                f"识别到 {len(results)} 个二维码，已填入第一个：\n\n{text}\n\n其余结果已输出到控制台。"
            )
            for r in results[1:]:
                print(f"[QR] {r}", file=sys.stderr)
        else:
            QMessageBox.information(self, "识别结果", f"识别成功：\n\n{text}\n\n已复制到剪贴板。")

    def _clear_history(self):
        self.history = []
        save_history([])
        self._refresh_history()
        self._set_status("已清空历史", "success")

    def _refresh_history(self):
        # 清空
        while self.hist_layout_inner.count():
            it = self.hist_layout_inner.takeAt(0)
            w = it.widget()
            if w:
                w.deleteLater()
        # 添加最多 5 条
        type_labels = {
            "text": "文本", "url": "网址", "wifi": "WiFi",
            "email": "邮箱", "tel": "电话", "sms": "短信",
        }
        for h in self.history[:5]:
            type_label = type_labels.get(h.get("type", "text"), "文本")
            preview = h.get("preview", "")[:36]
            item = QPushButton(f"{type_label}  ·  {preview}")
            item.setObjectName("HistoryItem")
            item.setCursor(Qt.PointingHandCursor)
            item.setFlat(True)
            item.setStyleSheet(
                f"QPushButton {{ color:{COLOR_TEXT_SEC}; background:transparent; border:none; "
                f"text-align:left; padding:5px 10px; font-size:11px; border-radius:6px; "
                f"font-weight:400; }}"
                f"QPushButton:hover {{ background:rgba(0,122,255,0.08); color:{COLOR_ACCENT}; "
                f"font-weight:500; }}"
            )
            text = h.get("text", "")
            item.clicked.connect(lambda checked=False, t=text: self._use_history(t))
            self.hist_layout_inner.addWidget(item)
        if not self.history:
            empty = QLabel("暂无历史记录")
            empty.setObjectName("HintText")
            empty.setAlignment(Qt.AlignCenter)
            self.hist_layout_inner.addWidget(empty)

    def _use_history(self, text):
        self.tabs["text"].setChecked(True)
        self._switch_type("text")
        self.text_input.setPlainText(text)

    # ============== 显示/隐藏 ==============

    def toggle_visibility(self):
        if self.isVisible():
            self.hide()
        else:
            self._show_near_cursor()
        if self.app_ref:
            self.app_ref._update_tray_text()

    def _show_near_cursor(self):
        """在鼠标附近显示"""
        cursor_pos = QCursor.pos()
        screen = QGuiApplication.screenAt(cursor_pos)
        if screen is None:
            screen = QGuiApplication.primaryScreen()
        if screen is None:
            self.show()
            return
        geo = screen.availableGeometry()
        x = cursor_pos.x() - self.WINDOW_W // 2
        y = cursor_pos.y() + 16
        # 边界检查
        x = max(geo.x() + 8, min(x, geo.x() + geo.width() - self.WINDOW_W - 8))
        y = max(geo.y() + 8, min(y, geo.y() + geo.height() - self.WINDOW_H - 8))
        self.move(x, y)
        self.show()
        self.raise_()
        self.activateWindow()
        # 焦点给到当前输入框
        if self.current_type == "text":
            self.text_input.setFocus()
        elif self.current_type == "url":
            self.url_input.setFocus()
        elif self.current_type == "wifi":
            self.wifi_ssid.setFocus()
        elif self.current_type == "email":
            self.email_addr.setFocus()
        elif self.current_type == "tel":
            self.tel_input.setFocus()


# ============== 应用主类 ==============

class QRApp(QObject):
    def __init__(self):
        super().__init__()
        self._hotkey_registered = False

    def run(self):
        # 必须在创建 QWidget 前创建 QApplication
        app = QApplication.instance() or QApplication(sys.argv)
        app.setApplicationName(APP_NAME)
        app.setApplicationDisplayName(APP_NAME)
        app.setQuitOnLastWindowClosed(False)  # 关闭窗口不退出（托盘常驻）

        # 应用图标
        app_icon = QIcon(get_app_icon_pixmap())
        app.setWindowIcon(app_icon)

        # 主窗口
        self.window = QRWidgetWindow(self)

        # 系统托盘
        self._setup_tray(app_icon)

        # 注册全局热键
        self._setup_hotkey()

        # 首次启动显示
        self.window.show()
        self.window.raise_()
        self.window.activateWindow()

        sys.exit(app.exec())

    def _setup_tray(self, app_icon):
        self.tray = QSystemTrayIcon(app_icon, parent=self)
        self.tray.setToolTip(f"{APP_NAME} v{APP_VERSION}\n按 {HOTKEY.upper()} 唤起")
        menu = QMenu()
        menu.setStyleSheet(
            f"QMenu {{ background:{COLOR_CARD}; color:{COLOR_TEXT}; "
            f"border:1px solid {COLOR_BORDER}; border-radius:8px; padding:6px; font-size:12px; }}"
            f"QMenu::item {{ padding:6px 18px; border-radius:6px; }}"
            f"QMenu::item:selected {{ background:rgba(0,122,255,0.10); color:{COLOR_ACCENT}; }}"
            f"QMenu::separator {{ height:1px; background:{COLOR_BORDER}; margin:4px 8px; }}"
        )

        show_action = QAction("显示 / 隐藏", menu)
        show_action.triggered.connect(self.window.toggle_visibility)
        menu.addAction(show_action)

        gen_clip_action = QAction("📋 用剪贴板内容生成", menu)
        gen_clip_action.triggered.connect(self._generate_from_clipboard)
        menu.addAction(gen_clip_action)

        menu.addSeparator()

        about_action = QAction(f"关于 v{APP_VERSION}", menu)
        about_action.triggered.connect(self._show_about)
        menu.addAction(about_action)

        quit_action = QAction("退出", menu)
        quit_action.triggered.connect(QApplication.quit)
        menu.addAction(quit_action)

        self.tray.setContextMenu(menu)
        self.tray.activated.connect(self._on_tray_activated)
        self.tray.show()

    def _on_tray_activated(self, reason):
        if reason == QSystemTrayIcon.Trigger:  # 单击
            self.window.toggle_visibility()

    def _update_tray_text(self):
        if self.window.isVisible():
            self.tray.setToolTip(f"{APP_NAME} v{APP_VERSION} · 显示中\n按 {HOTKEY.upper()} 隐藏")
        else:
            self.tray.setToolTip(f"{APP_NAME} v{APP_VERSION}\n按 {HOTKEY.upper()} 唤起")

    def _setup_hotkey(self):
        if not HAS_KEYBOARD:
            print("[WARN] keyboard 模块未安装，全局热键不可用", file=sys.stderr)
            return
        try:
            keyboard.add_hotkey(HOTKEY, lambda: self._hotkey_triggered(), suppress=False)
            self._hotkey_registered = True
            print(f"[INFO] 全局热键已注册: {HOTKEY}")
        except Exception as e:
            print(f"[WARN] 注册全局热键失败: {e}", file=sys.stderr)

    def _hotkey_triggered(self):
        # 在主线程执行（keyboard 回调在子线程）
        QTimer.singleShot(0, self.window.toggle_visibility)

    def _generate_from_clipboard(self):
        """从剪贴板读取文本并生成"""
        clipboard = QApplication.clipboard()
        text = clipboard.text()
        if not text:
            self.tray.showMessage(APP_NAME, "剪贴板为空", app_icon, 1500)
            return
        self.window.tabs["text"].setChecked(True)
        self.window._switch_type("text")
        self.window.text_input.setPlainText(text)
        if not self.window.isVisible():
            self.window._show_near_cursor()
        self.tray.showMessage(APP_NAME, "已用剪贴板内容生成", QIcon(get_app_icon_pixmap()), 1500)

    def _show_about(self):
        QMessageBox.about(
            self.window,
            f"关于 {APP_NAME}",
            f"<div style='font-family:system-ui;'>"
            f"<h3 style='color:#007aff;'>📱 {APP_NAME}</h3>"
            f"<p>版本：v{APP_VERSION}</p>"
            f"<p style='color:#6e6e73;'>原生 PySide6 实现，像输入法一样贴系统的小组件</p>"
            f"<p style='color:#6e6e73;'>全局热键：<b>{HOTKEY.upper()}</b> 唤起 / 隐藏</p>"
            f"<p style='color:#6e6e73;'>失焦自动隐藏 · 系统托盘常驻 · 苹果白高端风格</p>"
            f"<hr style='border:none;border-top:1px solid #d2d2d7;'>"
            f"<p style='color:#6e6e73;font-size:11px;'>属于 youqu 工具集 · qr-manager 便携版</p>"
            f"</div>"
        )


def main():
    app = QRApp()
    app.run()


if __name__ == "__main__":
    main()
