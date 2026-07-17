# -*- coding: utf-8 -*-
"""苹果白高端风格 QSS 样式 —— 浅灰背景 · 白色卡片 · 细腻阴影 · #007aff 蓝色强调"""

APPLE_QSS = """
* {
    font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 13px;
    color: #1d1d1f;
}

QWidget#root {
    background: #f5f5f7;
}

/* ===== 标题栏 ===== */
QLabel#brandTitle {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
    padding: 0;
}
QLabel#brandSubtitle {
    font-size: 11px;
    color: #86868b;
    padding: 0;
}

/* ===== 搜索框 ===== */
QLineEdit#searchInput {
    background: #ffffff;
    border: 1px solid #e3e3e8;
    border-radius: 10px;
    padding: 10px 12px 10px 34px;
    color: #1d1d1f;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}
QLineEdit#searchInput:focus {
    border: 1.5px solid #007aff;
    background: #ffffff;
}
QLineEdit#searchInput::placeholder {
    color: #86868b;
}

/* ===== 列表 ===== */
QFrame#cardItem {
    background: #ffffff;
    border: 1px solid #ececf0;
    border-radius: 10px;
    padding: 10px 12px;
}
QFrame#cardItem:hover {
    border: 1px solid #d4d4dc;
    background: #fafafd;
}
QFrame#cardItemSelected {
    background: #f0f7ff;
    border: 1.5px solid #007aff;
    border-radius: 10px;
    padding: 10px 12px;
}

QLabel#cardTitle {
    font-size: 13.5px;
    font-weight: 600;
    color: #1d1d1f;
}
QLabel#cardSnippet {
    font-size: 11.5px;
    color: #6e6e73;
}
QLabel#cardMeta {
    font-size: 10.5px;
    color: #aeaeb2;
}

QLabel#badgeFavorite {
    color: #ff9f0a;
    font-size: 12px;
}
QLabel#badgeVar {
    color: #007aff;
    font-size: 10.5px;
    background: #e8f1ff;
    border-radius: 5px;
    padding: 1px 6px;
}
QLabel#badgeCat {
    color: #6e6e73;
    font-size: 10.5px;
    background: #f0f0f5;
    border-radius: 5px;
    padding: 1px 6px;
}

/* ===== 底部提示条 ===== */
QFrame#hintBar {
    background: #ffffff;
    border-top: 1px solid #ececf0;
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 14px;
}
QLabel#hintText {
    color: #86868b;
    font-size: 11px;
}

/* ===== 按钮 ===== */
QPushButton {
    background: #ffffff;
    border: 1px solid #d4d4dc;
    border-radius: 8px;
    padding: 7px 14px;
    color: #1d1d1f;
}
QPushButton:hover {
    background: #f5f5f7;
    border: 1px solid #b8b8c0;
}
QPushButton:pressed {
    background: #ececf0;
}
QPushButton:disabled {
    color: #aeaeb2;
    background: #f5f5f7;
    border: 1px solid #ececf0;
}

QPushButton#primaryBtn {
    background: #007aff;
    border: 1px solid #007aff;
    color: #ffffff;
    font-weight: 500;
}
QPushButton#primaryBtn:hover {
    background: #006fe8;
    border: 1px solid #006fe8;
}
QPushButton#primaryBtn:pressed {
    background: #0062cc;
}
QPushButton#primaryBtn:disabled {
    background: #b8d8ff;
    border: 1px solid #b8d8ff;
    color: #ffffff;
}

QPushButton#dangerBtn {
    background: #ffffff;
    border: 1px solid #ffc8c8;
    color: #d32f2f;
}
QPushButton#dangerBtn:hover {
    background: #fff0f0;
}

QPushButton#iconBtn {
    background: transparent;
    border: none;
    padding: 4px;
}
QPushButton#iconBtn:hover {
    background: #ececf0;
    border-radius: 6px;
}

/* ===== 段落控件（segmented） ===== */
QFrame#segmented {
    background: #ececf0;
    border-radius: 8px;
    padding: 2px;
}
QPushButton#segBtn {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    color: #6e6e73;
}
QPushButton#segBtn:checked {
    background: #ffffff;
    color: #1d1d1f;
    font-weight: 500;
}

/* ===== 侧栏导航 ===== */
QPushButton#navItem {
    background: transparent;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    text-align: left;
    color: #1d1d1f;
}
QPushButton#navItem:hover {
    background: #ececf0;
}
QPushButton#navItem:checked {
    background: #ffffff;
    color: #007aff;
    font-weight: 500;
}

/* ===== 表单输入 ===== */
QLineEdit, QPlainTextEdit, QTextEdit, QComboBox, QSpinBox {
    background: #ffffff;
    border: 1px solid #d4d4dc;
    border-radius: 8px;
    padding: 7px 10px;
    color: #1d1d1f;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}
QLineEdit:focus, QPlainTextEdit:focus, QTextEdit:focus, QComboBox:focus {
    border: 1.5px solid #007aff;
}
QLineEdit:disabled, QPlainTextEdit:disabled {
    background: #f5f5f7;
    color: #aeaeb2;
}

QLabel#fieldLabel {
    color: #6e6e73;
    font-size: 11.5px;
}

QLabel#sectionTitle {
    font-size: 13px;
    font-weight: 600;
    color: #1d1d1f;
}

QLabel#varName {
    color: #007aff;
    background: #e8f1ff;
    border-radius: 5px;
    padding: 1px 6px;
    font-size: 11.5px;
}

/* ===== 滚动区 ===== */
QScrollBar:vertical {
    background: transparent;
    width: 8px;
    margin: 4px 2px;
}
QScrollBar::handle:vertical {
    background: #d4d4dc;
    border-radius: 4px;
    min-height: 30px;
}
QScrollBar::handle:vertical:hover {
    background: #b8b8c0;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
    background: transparent;
}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
    background: transparent;
}

QScrollBar:horizontal {
    background: transparent;
    height: 8px;
    margin: 2px 4px;
}
QScrollBar::handle:horizontal {
    background: #d4d4dc;
    border-radius: 4px;
    min-width: 30px;
}
QScrollBar::handle:horizontal:hover {
    background: #b8b8c0;
}

/* ===== 弹窗 ===== */
QDialog {
    background: #f5f5f7;
}

QFrame#cardSurface {
    background: #ffffff;
    border-radius: 12px;
}

/* ===== 工具栏标签 ===== */
QLabel#titleLabel {
    font-size: 16px;
    font-weight: 600;
    color: #1d1d1f;
}

QLabel#emptyHint {
    color: #aeaeb2;
    font-size: 12px;
}

/* ===== 列表项（管理窗口） ===== */
QFrame#managerCard {
    background: #ffffff;
    border: 1px solid #ececf0;
    border-radius: 10px;
}
QFrame#managerCard:hover {
    border: 1px solid #d4d4dc;
}

QLabel#favStar {
    color: #ff9f0a;
    font-size: 14px;
}
QLabel#favStarOff {
    color: #d4d4dc;
    font-size: 14px;
}
"""

# 常用颜色
COLOR_BG = "#f5f5f7"
COLOR_CARD = "#ffffff"
COLOR_ACCENT = "#007aff"
COLOR_TEXT_1 = "#1d1d1f"
COLOR_TEXT_2 = "#6e6e73"
COLOR_TEXT_3 = "#aeaeb2"
COLOR_BORDER = "#ececf0"
COLOR_BORDER_STRONG = "#d4d4dc"
