# -*- coding: utf-8 -*-
"""苹果白高端风格主题：颜色、字体、尺寸、阴影。
参考 macOS/iOS 原生设计：白底浅灰、细腻阴影、#007aff 蓝色强调。"""

# 颜色（hex）
BG_APP = '#f5f5f7'          # 应用背景（浅灰）
BG_CARD = '#ffffff'         # 卡片背景（纯白）
BG_HOVER = '#fafafa'        # 悬停态
BG_PRESSED = '#f0f0f2'      # 按下态
BG_INPUT = '#ffffff'        # 输入框

ACCENT = '#007aff'          # 主蓝（苹果蓝）
ACCENT_HOVER = '#0066d6'    # 主蓝悬停
ACCENT_PRESSED = '#0055b3'  # 主蓝按下
ACCENT_LIGHT = '#e8f1ff'    # 主蓝浅（选中背景）

TEXT_PRIMARY = '#1d1d1f'    # 主文字
TEXT_SECONDARY = '#86868b'  # 次文字
TEXT_TERTIARY = '#aeaeb2'   # 三级文字
TEXT_ON_ACCENT = '#ffffff'  # 蓝色按钮上的白字

BORDER = '#e5e5ea'          # 边框
BORDER_FOCUS = '#007aff'    # 焦点边框

STATE_OK = '#34c759'        # 绿色（正常倒计时）
STATE_WARN = '#ff9500'      # 黄色（≤10s）
STATE_URGENT = '#ff3b30'    # 红色（≤5s）

# 字体（系统字体栈）
FONT_FAMILY = '"Segoe UI", "PingFang SC", "Microsoft YaHei UI", system-ui, -apple-system, sans-serif'
FONT_FAMILY_MONO = '"Cascadia Code", "Consolas", "SF Mono", "Menlo", monospace'

# 字号
FONT_SIZE_TITLE = 16
FONT_SIZE_H1 = 14
FONT_SIZE_BODY = 13
FONT_SIZE_SMALL = 11
FONT_SIZE_TINY = 10
FONT_SIZE_CODE = 22      # 验证码大号
FONT_SIZE_CODE_BIG = 26  # 验证码超大号

# 字重
FONT_WEIGHT_NORMAL = 'normal'
FONT_WEIGHT_MEDIUM = 'medium'
FONT_WEIGHT_BOLD = 'bold'

# 尺寸
WINDOW_WIDTH = 380
WINDOW_HEIGHT = 500
WINDOW_MIN_WIDTH = 340
WINDOW_MIN_HEIGHT = 420
WINDOW_MAX_WIDTH = 460
WINDOW_MAX_HEIGHT = 700

CORNER_RADIUS_SM = 6
CORNER_RADIUS_MD = 10
CORNER_RADIUS_LG = 14
CORNER_RADIUS_XL = 18

PAD_XS = 4
PAD_SM = 8
PAD_MD = 12
PAD_LG = 16
PAD_XL = 20
PAD_XXL = 24

# 阴影（CSS-like tuple: (dx, dy, blur, color)）
SHADOW_CARD = (0, 1, 3, 'rgba(0,0,0,0.04)')
SHADOW_HOVER = (0, 2, 8, 'rgba(0,0,0,0.06)')
SHADOW_POPUP = (0, 4, 16, 'rgba(0,0,0,0.10)')

# 间距
LIST_GAP = 8

# 动画时长（ms）
ANIM_FAST = 120
ANIM_NORMAL = 200
ANIM_SLOW = 320


def tk_font(size: int = FONT_SIZE_BODY, weight: str = FONT_WEIGHT_NORMAL):
    """返回 tkinter Font 元组。"""
    return ('Segoe UI', size, weight)


def tk_font_mono(size: int = FONT_SIZE_CODE, weight: str = FONT_WEIGHT_BOLD):
    """等宽字体（验证码用）。"""
    return ('Cascadia Code', size, weight)
