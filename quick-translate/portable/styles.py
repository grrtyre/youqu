# -*- coding: utf-8 -*-
"""苹果白高端风格 QSS 样式表（v2 优化版）。
- 浅灰背景 #f5f5f7 · 白色卡片 #ffffff
- 蓝色强调 #007aff · 圆角 8/10/14 三级
- 系统字体 · 细腻阴影 · 增强视觉层次
"""

APPLE_QSS = """
* {
    font-family: 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #1d1d1f;
    outline: none;
}

QWidget#Root {
    background: #f5f5f7;
    border-radius: 10px;
}

/* ====== 顶部标题栏 ====== */
QFrame#TitleBar {
    background: #ffffff;
    border: none;
    border-bottom: 1px solid #e8e8ed;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
}

QLabel#AppTitle {
    color: #1d1d1f;
    font-size: 13px;
    font-weight: 600;
}

QLabel#AppSubtitle {
    color: #8e8e93;
    font-size: 11px;
}

QLabel#AccentDot {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #007aff, stop:1 #5ac8fa);
    color: #ffffff;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
}

/* ====== 关闭按钮 ====== */
QPushButton#BtnClose {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 4px;
    color: #8e8e93;
    font-size: 16px;
    font-weight: 500;
}
QPushButton#BtnClose:hover {
    background: #ff3b30;
    color: #ffffff;
}
QPushButton#BtnClose:pressed {
    background: #d70015;
}

/* ====== 工具栏 ====== */
QFrame#Toolbar {
    background: #f5f5f7;
    border: none;
}

/* 语言选择下拉框 */
QComboBox {
    background: #ffffff;
    border: 1px solid #e0e0e6;
    border-radius: 8px;
    padding: 6px 10px 6px 10px;
    min-height: 22px;
    color: #1d1d1f;
    font-weight: 500;
}
QComboBox:hover {
    border-color: #007aff;
    background: #fafbfc;
}
QComboBox:focus {
    border-color: #007aff;
    background: #ffffff;
}
QComboBox:on {
    border-color: #007aff;
    background: #ffffff;
}
QComboBox::drop-down {
    border: none;
    width: 18px;
}
QComboBox::down-arrow {
    image: url(assets/arrow-down.svg);
    width: 10px;
    height: 10px;
    margin-right: 6px;
}
QComboBox QAbstractItemView {
    background: #ffffff;
    border: 1px solid #e0e0e6;
    border-radius: 6px;
    padding: 4px;
    selection-background-color: #007aff;
    selection-color: #ffffff;
    outline: none;
}

/* 交换按钮 */
QPushButton#BtnSwap {
    background: #ffffff;
    border: 1px solid #e0e0e6;
    border-radius: 8px;
    padding: 6px;
    color: #007aff;
    font-size: 14px;
    font-weight: 600;
}
QPushButton#BtnSwap:hover {
    background: #007aff;
    border-color: #007aff;
    color: #ffffff;
}
QPushButton#BtnSwap:pressed {
    background: #0066d6;
    border-color: #0066d6;
}

/* ====== 翻译区 ====== */
QFrame#TranslateArea {
    background: #ffffff;
    border: 1px solid #e8e8ed;
    border-radius: 10px;
}

QFrame#TranslateSourcePane {
    background: #fafbfc;
    border: none;
    border-radius: 6px;
}

QFrame#TranslateTargetPane {
    background: #f0f7ff;
    border: none;
    border-radius: 6px;
}

QLabel#PaneTag {
    color: #8e8e93;
    font-size: 11px;
    font-weight: 600;
    padding: 0 4px;
}

QLabel#PaneTagAccent {
    color: #007aff;
    font-size: 11px;
    font-weight: 600;
    padding: 0 4px;
}

QPlainTextEdit#SourceText {
    background: transparent;
    border: none;
    color: #1d1d1f;
    font-size: 14px;
    padding: 4px 8px;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}
QPlainTextEdit#SourceText:focus {
    border: none;
}

QTextEdit#TargetText {
    background: transparent;
    border: none;
    color: #1d1d1f;
    font-size: 14px;
    padding: 4px 8px;
    selection-background-color: #007aff;
    selection-color: #ffffff;
}

QLabel#Meta {
    color: #8e8e93;
    font-size: 11px;
}

/* 文本按钮（清空） */
QPushButton#BtnGhost {
    background: transparent;
    border: none;
    color: #8e8e93;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
}
QPushButton#BtnGhost:hover {
    background: #e8e8ed;
    color: #1d1d1f;
}
QPushButton#BtnGhost:pressed {
    background: #d1d1d6;
}

/* 复制按钮（主要 CTA） */
QPushButton#BtnCopy {
    background: #007aff;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
}
QPushButton#BtnCopy:hover {
    background: #0066d6;
}
QPushButton#BtnCopy:pressed {
    background: #0055b3;
}
QPushButton#BtnCopy:disabled {
    background: #b8d4f3;
    color: #ffffff;
}

/* ====== 加载指示 ====== */
QLabel#StatusPill {
    background: rgba(0, 122, 255, 0.1);
    color: #007aff;
    border-radius: 10px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
}

/* ====== 历史记录 ====== */
QFrame#HistorySection {
    background: #ffffff;
    border: 1px solid #e8e8ed;
    border-radius: 10px;
}

QPushButton#HistoryToggle {
    background: transparent;
    border: none;
    color: #1d1d1f;
    text-align: left;
    padding: 8px 10px;
    font-weight: 600;
    font-size: 12px;
}
QPushButton#HistoryToggle:hover {
    background: #f5f5f7;
    color: #007aff;
}

QLabel#HistoryCount {
    color: #007aff;
    font-size: 11px;
    background: #eaf3ff;
    border-radius: 8px;
    padding: 2px 8px;
    font-weight: 600;
}

QListWidget#HistoryList {
    background: transparent;
    border: none;
    outline: none;
    padding: 0 6px 6px 6px;
}
QListWidget#HistoryList::item {
    background: #f5f5f7;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    margin: 2px 0;
    color: #1d1d1f;
}
QListWidget#HistoryList::item:hover {
    background: #eaf3ff;
    color: #007aff;
}
QListWidget#HistoryList::item:selected {
    background: #007aff;
    color: #ffffff;
}

/* ====== 滚动条 ====== */
QScrollBar:vertical {
    background: transparent;
    width: 6px;
    margin: 0;
    border: none;
}
QScrollBar::handle:vertical {
    background: #c8c8d0;
    border-radius: 3px;
    min-height: 30px;
}
QScrollBar::handle:vertical:hover {
    background: #007aff;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
    background: transparent;
}

QScrollBar:horizontal {
    height: 0;
    border: none;
}

/* ====== 底部快捷键提示 ====== */
QFrame#Footer {
    background: #ffffff;
    border-top: 1px solid #e8e8ed;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
}
QLabel#FootLabel {
    color: #8e8e93;
    font-size: 11px;
}
QLabel#KbdHint {
    color: #6e6e73;
    font-size: 11px;
    font-weight: 500;
}
QLabel#KbdKey {
    color: #007aff;
    font-size: 11px;
    background: #eaf3ff;
    border: none;
    border-radius: 4px;
    padding: 2px 7px;
    font-weight: 600;
}
QLabel#FootBrand {
    color: #6e6e73;
    font-size: 11px;
    font-weight: 500;
}
"""
