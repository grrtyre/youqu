# -*- coding: utf-8 -*-
"""styles.py — 苹果白高端风格主题配色

设计原则：白色/浅灰背景、细腻弥散阴影、系统字体、#007aff 蓝色强调 + #34c759 护眼绿辅色，
禁止赛博朋克霓虹与深色毛玻璃。参考 macOS 菜单栏小组件与输入法候选框。
"""
from __future__ import annotations

# 主色板（苹果白）
BG_APP = "#f5f5f7"          # 应用背景（浅灰）
BG_CARD = "#ffffff"         # 卡片背景（纯白）
BG_HOVER = "#e9e9ee"        # 悬停浅灰
BG_INNER = "#fafafa"        # 内嵌区块背景
BORDER = "#e3e3e8"          # 细边框
BORDER_SOFT = "#ececf0"     # 更柔的边框

# 文字
TEXT_PRIMARY = "#1d1d1f"    # 主文字（近黑）
TEXT_SECONDARY = "#6e6e73"  # 次要文字（中灰，比之前更深）
TEXT_TERTIARY = "#aeaeb2"   # 三级文字（浅灰）

# 强调色（双色体系：蓝主色 + 绿辅色，体现护眼主题的温暖健康）
ACCENT = "#007aff"          # 蓝色主强调（交互）
ACCENT_HOVER = "#0066d6"    # 蓝色悬停
ACCENT_SOFT = "#e8f1ff"     # 蓝色浅底
ACCENT_WARM = "#34c759"     # 护眼品牌绿（健康/完成）
ACCENT_WARM_SOFT = "#e8f9ed"# 护眼绿浅底
SUCCESS = "#34c759"         # 绿色（完成）
WARNING = "#ff9500"         # 橙色（预警/严格模式）
WARNING_SOFT = "#fff4e6"    # 橙色浅底
DANGER = "#ff3b30"          # 红色（危险/跳过）

# 圆环倒计时配色
RING_TRACK = "#ededf2"      # 圆环底色（灰，稍亮）
RING_PROGRESS = "#007aff"   # 圆环进度（蓝）
RING_PROGRESS_WARM = "#34c759"  # 待命态圆环（护眼绿，体现品牌色）
RING_WARNING = "#ff9500"    # 预警态圆环（橙）
RING_BREAK = "#28c948"      # 休息态圆环（鲜亮柔和的苹果系统绿，饱和度降低）
RING_STRICT = "#ff9500"     # 严格模式圆环（橙色压迫感）

# 阴影
SHADOW = (0, 4, 16, 0.08)   # (dx, dy, blur, alpha) 卡片阴影
SHADOW_POPUP = (0, 8, 32, 0.12)  # 弹出层阴影（更明显）

# 字体（系统字体栈）
FONT_FAMILY = "Microsoft YaHei UI"  # Windows 系统中文字体
FONT_TITLE = (FONT_FAMILY, 17, "bold")
FONT_H1 = (FONT_FAMILY, 22, "bold")
FONT_H2 = (FONT_FAMILY, 15, "bold")
FONT_BODY = (FONT_FAMILY, 13)
FONT_BODY_BOLD = (FONT_FAMILY, 13, "bold")
FONT_SMALL = (FONT_FAMILY, 11)
FONT_CAPTION = (FONT_FAMILY, 10)
FONT_TIMER = (FONT_FAMILY, 34, "bold")      # 主面板倒计时大字（缩小匹配圆环）
FONT_TIMER_OVERLAY = (FONT_FAMILY, 64, "bold")  # 全屏覆盖层倒计时（缩小留呼吸感）

# 尺寸
PANEL_W, PANEL_H = 380, 500          # 主面板尺寸（≤400×500，用满高度）
RADIUS = 14                           # 卡片圆角
RADIUS_SM = 8                         # 小圆角
RING_SIZE = 168                       # 主面板圆环直径（稍大匹配字号）
RING_OVERLAY_SIZE = 320               # 覆盖层圆环直径（稍小更精致）

# 遮罩色（暖色偏移，避免与绿色圆环冷暖冲突）
MASK_COLOR = "#1f1c1a"               # 暖色偏移遮罩（替代纯冷灰）

# 休息类型标签
BREAK_LABELS = {
    "micro": ("微休息", "#34c759"),
    "short": ("短休息", "#007aff"),
    "long": ("长休息", "#5856d6"),
}
