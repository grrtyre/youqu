# -*- coding: utf-8 -*-
"""
世界时钟·便携版 —— 苹果白高端风格 QSS 样式表
参考 macOS / iOS 原生设计，禁止赛博朋克霓虹、深色毛玻璃
"""

# 全局调色板
COLORS = {
    "bg":          "#f5f5f7",   # 浅灰背景
    "card":        "#ffffff",   # 白色卡片
    "card_hover":  "#fafafa",   # 卡片 hover
    "border":      "#e5e5ea",   # 分隔线
    "border_soft": "#ececf0",   # 软分隔线
    "text":        "#1d1d1f",   # 主文字
    "text_sub":    "#6e6e73",   # 次要文字
    "text_dim":    "#8e8e93",   # 弱化文字
    "accent":      "#007aff",   # 系统蓝
    "accent_soft": "#e8f1ff",   # 蓝色软底
    "warn":        "#ff9500",   # 橙
    "success":     "#34c759",   # 绿
    "shadow":      "rgba(0,0,0,0.04)",
    "shadow_blue": "rgba(0,122,255,0.06)",
    "night":       "#5e5ce6",   # 夜晚紫
    "day":         "#ff9500",   # 白天橙
}


APP_QSS = f"""
* {{
    font-family: -apple-system, "SF Pro Display", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif;
    color: {COLORS['text']};
    outline: none;
}}

QWidget#Root {{
    background: {COLORS['bg']};
}}

/* 顶部标题栏 */
QLabel#AppTitle {{
    font-size: 18px;
    font-weight: 700;
    color: {COLORS['text']};
    padding: 0;
    letter-spacing: 0.3px;
}}
QLabel#AppSubtitle {{
    font-size: 11px;
    color: {COLORS['text_dim']};
    padding: 0;
}}

/* 段控件（扁平风格，与卡片统一） */
QFrame#SegmentBar {{
    background: {COLORS['bg']};
    border-bottom: 1px solid {COLORS['border_soft']};
    padding: 0;
    margin: 0;
}}
QPushButton#SegmentBtn {{
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    color: {COLORS['text_sub']};
    font-size: 12px;
    font-weight: 500;
    padding: 6px 14px 8px 14px;
}}
QPushButton#SegmentBtn:checked {{
    background: transparent;
    color: {COLORS['text']};
    font-weight: 600;
    border-bottom: 2px solid {COLORS['text']};
}}
QPushButton#SegmentBtn:hover:!checked {{
    color: {COLORS['text']};
    border-bottom-color: {COLORS['border']};
}}

/* 主面板容器 */
QFrame#Panel {{
    background: {COLORS['card']};
    border-radius: 12px;
    border: 1px solid {COLORS['border_soft']};
}}

/* 时区卡片 */
QFrame#ZoneCard {{
    background: {COLORS['card']};
    border-radius: 10px;
    border: 1px solid {COLORS['border_soft']};
}}
QFrame#ZoneCard:hover {{
    background: {COLORS['card_hover']};
    border-color: {COLORS['border']};
}}
/* 本地卡片：完全统一样式（仅靠"本地"文字标签区分，避免颜色误判） */
QFrame#ZoneCard[isLocal="true"] {{
    border: 1px solid {COLORS['border_soft']};
    background: {COLORS['card']};
}}

QLabel#CityName {{
    font-size: 13px;
    font-weight: 600;
    color: {COLORS['text']};
}}
QLabel#CountryTag {{
    font-size: 10px;
    color: {COLORS['text_sub']};
    background: {COLORS['border_soft']};
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
}}
QLabel#Time {{
    font-size: 22px;
    font-weight: 700;
    color: {COLORS['text']};
    font-family: "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif;
    letter-spacing: 0.5px;
}}
QLabel#TimeSeconds {{
    font-size: 14px;
    color: {COLORS['text_dim']};
    font-weight: 500;
    padding-bottom: 1px;
}}
QLabel#MetaInfo {{
    font-size: 10px;
    color: {COLORS['text_sub']};
    background: {COLORS['border_soft']};
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 10px;
    font-weight: 500;
}}
QLabel#DateInfo {{
    font-size: 12px;
    color: {COLORS['text_dim']};
}}
QLabel#DiffBadge {{
    font-size: 10px;
    color: {COLORS['text_sub']};
    background: {COLORS['border_soft']};
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 10px;
    font-weight: 500;
}}
/* 本地标签：浅蓝底+蓝字（与其他标签统一 pill 样式，仅靠颜色区分语义） */
QLabel#DiffBadge[isLocal="true"] {{
    color: {COLORS['accent']};
    background: {COLORS['accent_soft']};
    border: 1px solid transparent;
    font-weight: 600;
}}
QLabel#DayNightBadge {{
    font-size: 10px;
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 10px;
    font-weight: 500;
}}
QLabel#DayNightBadge[mode="day"] {{
    color: #92400e;
    background: #fef3e8;
}}
QLabel#DayNightBadge[mode="night"] {{
    color: #4f46e5;
    background: #eef0ff;
}}

QPushButton#RemoveBtn {{
    background: transparent;
    border: none;
    color: {COLORS['text_dim']};
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
}}
QPushButton#RemoveBtn:hover {{
    background: #ffeaea;
    color: #ff3b30;
}}

/* 时间戳转换 */
QLineEdit#TsInput {{
    background: {COLORS['card']};
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: {COLORS['text']};
    selection-background-color: {COLORS['accent']};
    selection-color: white;
}}
QLineEdit#TsInput:focus {{
    border-color: {COLORS['accent']};
}}
QLabel#TsResult {{
    font-size: 12px;
    color: {COLORS['text']};
    background: {COLORS['card']};
    border-radius: 8px;
    border: 1px solid {COLORS['border_soft']};
    padding: 8px 12px;
}}
QLabel#TsHint {{
    font-size: 11px;
    color: {COLORS['text_dim']};
}}

/* 添加时区按钮（虚线卡片样式，强化视觉权重） */
QPushButton#AddZoneBtn {{
    background: {COLORS['card']};
    border: 1.5px dashed {COLORS['border']};
    border-radius: 10px;
    color: {COLORS['text_sub']};
    font-size: 12px;
    font-weight: 600;
    padding: 5px;
}}
QPushButton#AddZoneBtn:hover {{
    border-color: {COLORS['accent']};
    border-style: solid;
    color: {COLORS['accent']};
    background: {COLORS['accent_soft']};
}}

/* 添加时区弹层 */
QFrame#SearchPopup {{
    background: {COLORS['card']};
    border: 1px solid {COLORS['border']};
    border-radius: 12px;
}}
QLineEdit#SearchInput {{
    background: {COLORS['bg']};
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
}}
QLineEdit#SearchInput:focus {{
    border-color: {COLORS['accent']};
}}
QListWidget#CityList {{
    background: transparent;
    border: none;
    outline: none;
}}
QListWidget#CityList::item {{
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: {COLORS['text']};
}}
QListWidget#CityList::item:selected {{
    background: {COLORS['accent_soft']};
    color: {COLORS['accent']};
}}
QListWidget#CityList::item:hover {{
    background: {COLORS['bg']};
}}

/* 滚动区域 */
QScrollArea {{
    background: transparent;
    border: none;
}}
QScrollBar:vertical {{
    background: transparent;
    width: 8px;
    margin: 0;
}}
QScrollBar::handle:vertical {{
    background: {COLORS['border']};
    border-radius: 4px;
    min-height: 24px;
}}
QScrollBar::handle:vertical:hover {{
    background: {COLORS['text_dim']};
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

/* 底部状态栏（带顶部分隔线，强化层级与背景对比） */
QFrame#FooterFrame {{
    background: {COLORS['bg']};
    border-top: 1px solid {COLORS['border']};
    border-left: 1px solid {COLORS['border_soft']};
    border-right: 1px solid {COLORS['border_soft']};
    border-bottom: 1px solid {COLORS['border_soft']};
    border-radius: 0;
    padding: 6px 10px 5px 10px;
    margin-top: 6px;
    margin-left: -14px;
    margin-right: -14px;
    margin-bottom: -8px;
}}
QLabel#FooterLabel {{
    font-size: 10px;
    color: {COLORS['text_sub']};
    font-weight: 500;
}}
QLabel#HotkeyHint {{
    font-size: 10px;
    color: {COLORS['text_dim']};
    background: transparent;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    letter-spacing: 0.3px;
}}
QLabel#HotkeyHint > kbd {{
    color: {COLORS['accent']};
    font-weight: 600;
}}
"""
