# -*- coding: utf-8 -*-
"""拾色管家·便携版 - 苹果白高端风格 QSS 样式表

设计语言：
- 浅色背景（白 / 浅灰）
- 细腻多层阴影（QGraphicsDropShadowEffect 配合）
- 系统字体 Segoe UI / PingFang SC / Microsoft YaHei UI
- 蓝色强调 #007AFF（iOS 系统蓝）
- pill 描边按钮、卡片轻浮、零干扰
"""

APPLE_WHITE_QSS = """
/* ============================================================
   全局
   ============================================================ */
QWidget {
    color: #1d1d1f;
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', 'Helvetica Neue', sans-serif;
    font-size: 13px;
}

/* ============================================================
   主面板容器
   ============================================================ */
#contentWidget {
    background: #ffffff;
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.04);
}

/* ============================================================
   标题栏
   ============================================================ */
#headerBar {
    background: #ffffff;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    border-bottom: 1px solid #f0f0f2;
}

#appIcon {
    background: #007aff;
    color: #ffffff;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    padding: 2px;
}

#appTitle {
    color: #1d1d1f;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.2px;
}

#appBadge {
    background: #f0f0f2;
    color: #6e6e73;
    border-radius: 10px;
    padding: 0 8px;
    font-size: 11px;
    font-weight: 500;
    min-width: 14px;
}

/* ============================================================
   当前颜色大色块
   ============================================================ */
#currentSwatch {
    border-radius: 14px;
    border: 1px solid rgba(0, 0, 0, 0.06);
}

#currentHex {
    font-size: 20px;
    font-weight: 700;
    color: #1d1d1f;
    letter-spacing: 1px;
}

#currentRgb {
    font-size: 12px;
    color: #6e6e73;
    letter-spacing: 0.3px;
}

/* ============================================================
   格式按钮（pill 描边）
   ============================================================ */
#formatBtn {
    background: #ffffff;
    border: 1px solid #e3e3e8;
    border-radius: 16px;
    padding: 8px 18px;
    color: #1d1d1f;
    font-size: 13px;
    font-weight: 500;
    min-width: 56px;
}
#formatBtn:hover {
    border-color: #c7c7cc;
    background: #fafafa;
}
#formatBtn:pressed {
    background: #f0f0f2;
}
#formatBtn[active="true"] {
    background: #007aff;
    border-color: #007aff;
    color: #ffffff;
}

/* ============================================================
   主操作按钮（实心蓝）
   ============================================================ */
#primaryBtn {
    background: #007aff;
    color: #ffffff;
    border: none;
    border-radius: 9px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
}
#primaryBtn:hover {
    background: #006edb;
}
#primaryBtn:pressed {
    background: #0060c7;
}

/* ============================================================
   次要按钮（描边）
   ============================================================ */
#secondaryBtn {
    background: #ffffff;
    border: 1px solid #d1d1d6;
    border-radius: 8px;
    padding: 6px 12px;
    color: #1d1d1f;
    font-size: 12px;
    font-weight: 500;
}
#secondaryBtn:hover {
    border-color: #007aff;
    color: #007aff;
    background: #f5f9ff;
}
#secondaryBtn:pressed {
    background: #e8f1ff;
}

/* ============================================================
   小图标按钮
   ============================================================ */
#iconBtn {
    background: transparent;
    border: none;
    color: #6e6e73;
    padding: 4px 6px;
    font-size: 12px;
    border-radius: 6px;
}
#iconBtn:hover {
    background: #f0f0f2;
    color: #1d1d1f;
}

/* ============================================================
   区段标题
   ============================================================ */
#sectionTitle {
    color: #6e6e73;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.2px;
}

/* ============================================================
   颜色卡片（历史 / 调色板网格）
   ============================================================ */
#colorCell {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 10px;
    padding: 0;
}
#colorCell:hover {
    border-color: #007aff;
}

#colorSwatch {
    border-top-left-radius: 9px;
    border-top-right-radius: 9px;
}

#colorLabel {
    color: #1d1d1f;
    font-size: 10px;
    font-weight: 500;
    padding: 3px 4px;
    background: transparent;
}

/* ============================================================
   滚动区域
   ============================================================ */
QScrollArea {
    background: transparent;
    border: none;
}
QScrollBar:vertical {
    background: transparent;
    width: 6px;
    margin: 4px 0;
}
QScrollBar::handle:vertical {
    background: #d1d1d6;
    border-radius: 3px;
    min-height: 24px;
}
QScrollBar::handle:vertical:hover {
    background: #b0b0b5;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0;
}
QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
    background: transparent;
}

/* ============================================================
   标签页
   ============================================================ */
#tab {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 4px 10px;
    color: #6e6e73;
    font-size: 11px;
    font-weight: 500;
}
#tab:hover {
    background: #f0f0f2;
    color: #1d1d1f;
}
#tab:checked {
    background: #ffffff;
    border-color: #e3e3e8;
    color: #1d1d1f;
}

/* ============================================================
   底部状态栏
   ============================================================ */
#statusBar {
    background: #fafafa;
    border-top: 1px solid #f0f0f2;
    border-bottom-left-radius: 16px;
    border-bottom-right-radius: 16px;
}
#statusText {
    color: #6e6e73;
    font-size: 12px;
}
#statusHint {
    color: #aeaeb2;
    font-size: 12px;
}
#clearBtn {
    background: transparent;
    border: none;
    color: #ff3b30;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
}
#clearBtn:hover {
    background: rgba(255, 59, 48, 0.08);
}

/* ============================================================
   取色覆盖层
   ============================================================ */
#pickerRoot {
    background: transparent;
}
#lensWidget {
    background: #1d1d1f;
    border-radius: 14px;
    border: 2px solid #ffffff;
}
#lensCrossH, #lensCrossV {
    background: #ff3b30;
}
#lensCenterBox {
    border: 2px solid #ffffff;
    background: transparent;
}
#pickerInfoCard {
    background: rgba(255, 255, 255, 0.96);
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.06);
}
#pickerHexLabel {
    color: #1d1d1f;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1px;
}
#pickerRgbLabel, #pickerHslLabel {
    color: #6e6e73;
    font-size: 11px;
}
#pickerHint {
    background: rgba(29, 29, 31, 0.78);
    color: #ffffff;
    border-radius: 10px;
    padding: 4px 10px;
    font-size: 11px;
}
"""

# 苹果系统色（用于默认调色板之外的展示参考）
APPLE_SYSTEM_COLORS = [
    ('#007AFF', '系统蓝'),
    ('#34C759', '系统绿'),
    ('#FF3B30', '系统红'),
    ('#FF9500', '系统橙'),
    ('#AF52DE', '系统紫'),
    ('#5AC8FA', '系统青'),
    ('#FFD60A', '系统黄'),
    ('#8E8E93', '系统灰'),
]
