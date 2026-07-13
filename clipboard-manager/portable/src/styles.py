# -*- coding: utf-8 -*-
"""剪贴板管家·便携版 - 苹果白高端风格 QSS（深度优化版 v3）"""

APPLE_WHITE_QSS = """
/* ===== 主容器 ===== */
QWidget#contentWidget {
    background: #ffffff;
    border-radius: 16px;
}

/* ===== 顶部标题栏 ===== */
QFrame#headerBar {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #ffffff, stop:1 #fafafd);
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    border-bottom: 1px solid #ececee;
}
QLabel#appIcon {
    color: #ffffff;
    background: #007aff;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    padding: 0;
    min-width: 24px;
    min-height: 24px;
    max-width: 24px;
    max-height: 24px;
}
QLabel#appTitle {
    color: #1d1d1f;
    font-size: 15px;
    font-weight: 600;
    background: transparent;
    letter-spacing: 0.2px;
}
QLabel#appBadge {
    color: #ffffff;
    background: #007aff;
    border-radius: 10px;
    padding: 2px 9px;
    font-size: 11px;
    font-weight: 600;
    min-width: 16px;
}

/* ===== 搜索框 ===== */
QLineEdit#searchBox {
    background: #f5f5f7;
    border: 1.5px solid #e5e5ea;
    border-radius: 10px;
    padding: 9px 14px;
    font-size: 13px;
    color: #1d1d1f;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}
QLineEdit#searchBox:focus {
    border: 2px solid #007aff;
    background: #ffffff;
    padding: 8px 13px;
}
QLineEdit#searchBox::placeholder {
    color: #6e6e73;
}

/* ===== 筛选标签（pill 风格） ===== */
QPushButton#tab {
    background: #ffffff;
    border: 1px solid #e5e5ea;
    border-radius: 10px;
    padding: 5px 14px;
    font-size: 12px;
    color: #6e6e73;
    font-weight: 500;
    min-height: 22px;
}
QPushButton#tab:checked {
    background: #007aff;
    border: 1px solid #007aff;
    color: #ffffff;
    font-weight: 600;
}
QPushButton#tab:hover:!checked {
    background: #f0f0f5;
    border: 1px solid #d1d1d6;
    color: #1d1d1f;
}

/* ===== 列表条目卡片 ===== */
QFrame#itemCard {
    background: #ffffff;
    border: 1px solid #ececee;
    border-radius: 10px;
}
QFrame#itemCard:hover {
    background: #f8f9ff;
    border: 1px solid #d8e3ff;
}
QFrame#itemCard[selected="true"] {
    background: #eef5ff;
    border: 1.5px solid #007aff;
}

/* 左侧色条 */
QFrame#accentBar {
    background: #c7c7cc;
    border-top-left-radius: 10px;
    border-bottom-left-radius: 10px;
    max-width: 5px;
    min-width: 5px;
}
QFrame#accentBar[kind="code"] {
    background: #6f42c1;
}
QFrame#accentBar[kind="link"] {
    background: #007aff;
}
QFrame#accentBar[kind="email"] {
    background: #34c759;
}
QFrame#accentBar[kind="phone"] {
    background: #ff9500;
}
QFrame#accentBar[kind="text"] {
    background: #5a5a5e;
}

QLabel#itemPreview {
    color: #1d1d1f;
    font-size: 13px;
    background: transparent;
    font-weight: 400;
}
QLabel#itemTime {
    color: #aeaeb2;
    font-size: 11px;
    background: transparent;
}

/* 类型 pill 标签 */
QLabel#kindPill {
    font-size: 10px;
    color: #6e6e73;
    background: #f5f5f7;
    border-radius: 9px;
    padding: 2px 9px;
    font-weight: 500;
    min-width: 30px;
}
QLabel#kindPill[code] {
    color: #6f42c1;
    background: #f3eefb;
}
QLabel#kindPill[link] {
    color: #007aff;
    background: #eef4ff;
}
QLabel#kindPill[email] {
    color: #34c759;
    background: #eaf7ee;
}
QLabel#kindPill[phone] {
    color: #ff9500;
    background: #fff3e6;
}

/* 操作按钮 */
QPushButton#actionBtn {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    color: #aeaeb2;
    font-weight: 500;
    min-width: 30px;
}
QPushButton#actionBtn:hover {
    background: #e8e8ed;
    color: #1d1d1f;
}
QPushButton#actionBtn[active="true"] {
    color: #007aff;
    background: #eef4ff;
}
QPushButton#actionBtn[fav="true"] {
    color: #ff9500;
    background: #fff3e6;
}

/* ===== 滚动区域 ===== */
QScrollArea {
    background: #f5f5f7;
    border: none;
    border-top: 1px solid #f0f0f2;
}
QScrollBar:vertical {
    background: transparent;
    width: 6px;
    margin: 6px 2px;
}
QScrollBar::handle:vertical {
    background: #d1d1d6;
    border-radius: 3px;
    min-height: 30px;
}
QScrollBar::handle:vertical:hover {
    background: #a1a1a6;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
    background: transparent;
}

/* ===== 底部状态栏 ===== */
QFrame#statusBar {
    background: #ffffff;
    border-top: 1px solid #ececee;
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
}
QLabel#statusText {
    color: #3a3a3c;
    font-size: 11px;
    background: transparent;
    font-weight: 500;
}
QLabel#statusHint {
    color: #6e6e73;
    font-size: 11px;
    background: transparent;
}
QPushButton#clearBtn {
    color: #ff3b30;
    background: transparent;
    border: 1px solid #ffd6d4;
    font-size: 11px;
    padding: 4px 12px;
    border-radius: 10px;
    font-weight: 500;
}
QPushButton#clearBtn:hover {
    background: #fff0f0;
    border: 1px solid #ff3b30;
    color: #ff3b30;
}

/* ===== 空状态 ===== */
QLabel#emptyTitle {
    color: #8e8e93;
    font-size: 15px;
    font-weight: 600;
    background: transparent;
}
QLabel#emptyDesc {
    color: #aeaeb2;
    font-size: 12px;
    background: transparent;
}
"""
