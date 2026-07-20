# -*- coding: utf-8 -*-
"""便签管家便携版 - QSS 样式表
苹果白高端风格：白色/浅灰背景、细腻阴影、系统字体、蓝色 #007aff 强调
"""

APPLE_WHITE = "#ffffff"
APPLE_BG = "#f5f5f7"
APPLE_BG_DEEP = "#ebebf0"
APPLE_TEXT = "#1d1d1f"
APPLE_TEXT_SECONDARY = "#86868b"
APPLE_TEXT_TERTIARY = "#aeaeb2"
APPLE_BORDER = "#e5e5ea"
APPLE_DIVIDER = "#f0f0f4"
APPLE_BLUE = "#007aff"
APPLE_BLUE_HOVER = "#0066d6"
APPLE_BLUE_PRESSED = "#0058b8"
APPLE_GREEN = "#34c759"
APPLE_RED = "#ff3b30"
APPLE_SHADOW = "rgba(0, 0, 0, 25)"


# 通用 QSS - 应用于所有窗口
GLOBAL_QSS = f"""
* {{
    font-family: "Microsoft YaHei UI", "PingFang SC", "Segoe UI", "SF Pro Text", sans-serif;
    font-size: 13px;
    color: {APPLE_TEXT};
    outline: none;
}}

QWidget {{
    background: {APPLE_WHITE};
}}

QFrame#rootFrame {{
    background: {APPLE_WHITE};
    border-radius: 12px;
}}

/* === 输入控件 === */
QLineEdit, QPlainTextEdit, QTextEdit {{
    background: {APPLE_BG};
    border: 1px solid {APPLE_BORDER};
    border-radius: 8px;
    padding: 8px 10px;
    selection-background-color: {APPLE_BLUE};
    selection-color: white;
}}
QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus {{
    border: 1px solid {APPLE_BLUE};
    background: {APPLE_WHITE};
}}
QLineEdit::placeholder, QPlainTextEdit::placeholder {{
    color: {APPLE_TEXT_TERTIARY};
}}

/* === 按钮 === */
QPushButton {{
    background: {APPLE_BG};
    border: 1px solid {APPLE_BORDER};
    border-radius: 8px;
    padding: 7px 14px;
    color: {APPLE_TEXT};
}}
QPushButton:hover {{
    background: {APPLE_BG_DEEP};
}}
QPushButton:pressed {{
    background: {APPLE_BORDER};
}}
QPushButton:disabled {{
    color: {APPLE_TEXT_TERTIARY};
    background: {APPLE_BG};
}}

QPushButton#primaryBtn {{
    background: {APPLE_BLUE};
    border: 1px solid {APPLE_BLUE};
    color: white;
    font-weight: 500;
}}
QPushButton#primaryBtn:hover {{
    background: {APPLE_BLUE_HOVER};
}}
QPushButton#primaryBtn:pressed {{
    background: {APPLE_BLUE_PRESSED};
}}
QPushButton#primaryBtn:disabled {{
    background: #b8d4ff;
    border-color: #b8d4ff;
    color: white;
}}

QPushButton#dangerBtn {{
    background: {APPLE_WHITE};
    border: 1px solid {APPLE_BORDER};
    color: {APPLE_RED};
}}
QPushButton#dangerBtn:hover {{
    background: #fff0f0;
    border-color: #ffb3b3;
}}

QPushButton#ghostBtn {{
    background: transparent;
    border: none;
    padding: 4px 8px;
    color: {APPLE_TEXT_SECONDARY};
}}
QPushButton#ghostBtn:hover {{
    color: {APPLE_BLUE};
}}

/* === 下拉框 === */
QComboBox {{
    background: {APPLE_BG};
    border: 1px solid {APPLE_BORDER};
    border-radius: 8px;
    padding: 6px 10px;
    min-height: 18px;
}}
QComboBox:hover {{
    border: 1px solid #c7c7cc;
}}
QComboBox::drop-down {{
    border: none;
    width: 22px;
}}
QComboBox::down-arrow {{
    image: none;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid {APPLE_TEXT_SECONDARY};
    margin-right: 8px;
}}
QComboBox QAbstractItemView {{
    background: {APPLE_WHITE};
    border: 1px solid {APPLE_BORDER};
    border-radius: 8px;
    padding: 4px;
    selection-background-color: {APPLE_BLUE};
    selection-color: white;
    outline: none;
}}

/* === 滚动条 === */
QScrollBar:vertical {{
    background: transparent;
    width: 8px;
    margin: 4px 2px 4px 0;
}}
QScrollBar::handle:vertical {{
    background: #c7c7cc;
    border-radius: 4px;
    min-height: 30px;
}}
QScrollBar::handle:vertical:hover {{
    background: #a1a1a6;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{
    background: transparent;
}}
QScrollBar:horizontal {{
    background: transparent;
    height: 8px;
    margin: 0 2px 4px 2px;
}}
QScrollBar::handle:horizontal {{
    background: #c7c7cc;
    border-radius: 4px;
    min-width: 30px;
}}
QScrollBar::handle:horizontal:hover {{
    background: #a1a1a6;
}}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0;
}}
QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {{
    background: transparent;
}}

/* === 标签 === */
QLabel#titleLabel {{
    font-size: 14px;
    font-weight: 600;
    color: {APPLE_TEXT};
}}
QLabel#hintLabel {{
    color: {APPLE_TEXT_TERTIARY};
    font-size: 11px;
}}
QLabel#sectionLabel {{
    font-size: 11px;
    font-weight: 600;
    color: {APPLE_TEXT_SECONDARY};
    letter-spacing: 0.5px;
}}
QLabel#counterLabel {{
    color: {APPLE_TEXT_TERTIARY};
    font-size: 11px;
}}

/* === 颜色圆点按钮 === */
QPushButton#colorDot {{
    background: transparent;
    border: 2px solid transparent;
    border-radius: 11px;
    padding: 0;
    min-width: 22px;
    min-height: 22px;
    max-width: 22px;
    max-height: 22px;
}}
QPushButton#colorDot:checked {{
    border: 2px solid {APPLE_TEXT};
}}

/* === 便签卡片 === */
QFrame#noteCard {{
    background: {APPLE_WHITE};
    border: 1px solid {APPLE_BORDER};
    border-radius: 10px;
}}
QFrame#noteCard:hover {{
    border: 1px solid #c7c7cc;
    background: #fafafc;
}}
QFrame#noteCardPinned {{
    background: #fffdf5;
    border: 1px solid #ffe694;
    border-radius: 10px;
}}

QLabel#noteTitle {{
    font-size: 13px;
    font-weight: 600;
    color: {APPLE_TEXT};
}}
QLabel#noteContent {{
    font-size: 12px;
    color: {APPLE_TEXT_SECONDARY};
}}
QLabel#noteMeta {{
    font-size: 11px;
    color: {APPLE_TEXT_TERTIARY};
}}
QLabel#noteCategoryTag {{
    font-size: 10px;
    color: {APPLE_BLUE};
    background: #e3f0ff;
    border-radius: 4px;
    padding: 1px 6px;
}}

/* === 工具按钮（小图标按钮）=== */
QPushButton#toolBtn {{
    background: transparent;
    border: none;
    padding: 4px;
    border-radius: 6px;
    color: {APPLE_TEXT_SECONDARY};
    font-size: 12px;
}}
QPushButton#toolBtn:hover {{
    background: {APPLE_BG};
    color: {APPLE_TEXT};
}}
QPushButton#toolBtn:checked {{
    background: #e3f0ff;
    color: {APPLE_BLUE};
}}

/* === 分隔线 === */
QFrame#divider {{
    background: {APPLE_DIVIDER};
    max-height: 1px;
    min-height: 1px;
    border: none;
}}

/* === 搜索框 === */
QLineEdit#searchBox {{
    background: {APPLE_BG};
    border: 1px solid {APPLE_BORDER};
    border-radius: 16px;
    padding: 6px 12px 6px 30px;
    font-size: 12px;
}}
QLineEdit#searchBox:focus {{
    border: 1px solid {APPLE_BLUE};
    background: {APPLE_WHITE};
}}

/* === 空状态 === */
QLabel#emptyIcon {{
    font-size: 36px;
    color: {APPLE_TEXT_TERTIARY};
}}
QLabel#emptyTitle {{
    font-size: 13px;
    color: {APPLE_TEXT_SECONDARY};
    font-weight: 500;
}}
QLabel#emptyHint {{
    font-size: 11px;
    color: {APPLE_TEXT_TERTIARY};
}}
"""

# 无边框圆角窗口的阴影边框样式（外层）
FRAME_SHADOW_QSS = f"""
QFrame#shadowFrame {{
    background: {APPLE_WHITE};
    border-radius: 12px;
    border: 1px solid {APPLE_BORDER};
}}
"""
