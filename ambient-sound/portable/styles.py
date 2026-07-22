# -*- coding: utf-8 -*-
"""styles.py - 苹果白高端风格 QSS 样式表

白色/浅灰背景、细腻阴影、系统字体、蓝色强调 #007aff。
禁止赛博朋克霓虹、深色毛玻璃。
"""

# 全局 QSS
APPLE_WHITE_QSS = """
* {
    font-family: -apple-system, "SF Pro Display", "Segoe UI", "Microsoft YaHei UI", "PingFang SC";
    color: #1d1d1f;
}

QFrame#root {
    background: #f5f5f7;
    border-radius: 16px;
    border: 1px solid #e8e8ed;
}

/* 底部控制区 */
QFrame#footer {
    background: #fbfbfd;
    border-top: 1px solid #e8e8ed;
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
}

/* 标题栏 */
QLabel#titleLabel {
    font-size: 15px;
    font-weight: 600;
    color: #1d1d1f;
    padding-left: 4px;
}

/* 标题栏容器 */
QFrame#titleBar {
    background: #fbfbfd;
    border-bottom: 1px solid #f0f0f2;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
}

QPushButton#closeBtn {
    background: #ffffff;
    border: none;
    border-radius: 14px;
    min-width: 28px;
    max-width: 28px;
    min-height: 28px;
    max-height: 28px;
    font-size: 14px;
    color: #86868b;
    font-weight: 500;
}
QPushButton#closeBtn:hover {
    background: #ff3b30;
    color: #ffffff;
}

/* 声音卡片 */
QFrame#soundCard {
    background: #ffffff;
    border: 1px solid #ededf0;
    border-radius: 14px;
}
QFrame#soundCardActive {
    background: #ffffff;
    border: 1px solid #007aff;
    border-radius: 14px;
}

QLabel#soundName {
    font-size: 12px;
    font-weight: 600;
    color: #1d1d1f;
}
QLabel#soundDesc {
    font-size: 10px;
    color: #86868b;
}

QLabel#soundIcon {
    background: #eef4ff;
    border-radius: 18px;
    min-width: 36px;
    max-width: 36px;
    min-height: 36px;
    max-height: 36px;
}
QLabel#soundIconActive {
    background: #007aff;
    border-radius: 18px;
    min-width: 36px;
    max-width: 36px;
    min-height: 36px;
    max-height: 36px;
}

/* 音量滑块 */
QSlider::groove:horizontal {
    height: 4px;
    background: #e5e5ea;
    border-radius: 2px;
}
QSlider::sub-page:horizontal {
    background: #007aff;
    border-radius: 2px;
}
QSlider::handle:horizontal {
    background: #ffffff;
    border: 1px solid #d1d1d6;
    border-radius: 8px;
    width: 14px;
    height: 14px;
    margin: -6px 0;
}
QSlider::handle:horizontal:hover {
    border-color: #007aff;
}

/* 预设按钮 */
QPushButton#presetBtn {
    background: #ffffff;
    border: 1px solid #e5e5ea;
    border-radius: 12px;
    padding: 4px 8px;
    font-size: 10px;
    color: #1d1d1f;
}
QPushButton#presetBtn:hover {
    border-color: #007aff;
    color: #007aff;
}
QPushButton#presetBtnChecked {
    background: #007aff;
    border: 1px solid #007aff;
    border-radius: 12px;
    padding: 4px 8px;
    font-size: 10px;
    color: #ffffff;
}

/* 定时器按钮 */
QPushButton#timerBtn {
    background: #ffffff;
    border: 1px solid #d1d1d6;
    border-radius: 12px;
    padding: 4px 10px;
    font-size: 11px;
    color: #86868b;
}
QPushButton#timerBtn:hover {
    border-color: #007aff;
    color: #007aff;
}
QPushButton#timerBtnChecked {
    background: #007aff;
    border: 1px solid #007aff;
    border-radius: 12px;
    padding: 4px 10px;
    font-size: 11px;
    color: #ffffff;
}

/* 状态栏 */
QLabel#statusLabel {
    font-size: 11px;
    color: #86868b;
}
QLabel#statusPlaying {
    font-size: 11px;
    color: #007aff;
    font-weight: 500;
}

/* 主音量标签 */
QLabel#masterLabel {
    font-size: 11px;
    color: #86868b;
}

/* 频谱条 */
QLabel#spectrumBar {
    background: #007aff;
    border-radius: 1px;
}

/* 问候语 */
QLabel#greetingLabel {
    font-size: 11px;
    color: #86868b;
}

/* 工具提示 */
QToolTip {
    background: #ffffff;
    color: #1d1d1f;
    border: 1px solid #d1d1d6;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
}
"""
