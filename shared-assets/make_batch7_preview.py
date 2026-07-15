# -*- coding: utf-8 -*-
"""第六批 6 个项目图标预览合成（交 mimo 评分）
布局：3 列 × 2 行卡片，每卡展示 1024 源图缩放 + 中文名 + 语义描述 + 文件名
苹果白风格：浅灰底 #F5F5F7 + 白卡 #FFFFFF + 1px 浅边 + 圆角 14 + 蓝色分区条
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets")
SHOTS = r"d:\Ai\mimo\screenshots"
os.makedirs(SHOTS, exist_ok=True)

FONT_TITLE = FONT_SECTION = FONT_NAME = FONT_DESC = None
for fp in [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc"]:
    if os.path.isfile(fp):
        FONT_TITLE = ImageFont.truetype(fp, 36)
        FONT_SECTION = ImageFont.truetype(fp, 24)
        FONT_NAME = ImageFont.truetype(fp, 20)
        FONT_DESC = ImageFont.truetype(fp, 14)
        break
if FONT_TITLE is None:
    FONT_TITLE = FONT_SECTION = FONT_NAME = FONT_DESC = ImageFont.load_default()

PROJECTS = [
    ("alarm-manager", "闹钟管家", "frame+表盘+铃耳+腿+10:10指针"),
    ("world-clock", "世界时钟", "frame+地球仪+赤道经纬+时针"),
    ("pomodoro-manager", "番茄管家", "frame+番茄身+叶茎+番茄钟指针"),
    ("emoji-manager", "表情管家", "frame+圆脸+双眼+微笑弧"),
    ("unit-converter", "单位转换", "frame+上下半圆箭头(交换)"),
    ("mind-map-manager", "思维导图", "frame+中心节点+三分支"),
]

BG = (245, 245, 247)
CARD = (255, 255, 255)
BORDER = (229, 229, 234)
TITLE = (29, 29, 31)
SUB = (110, 110, 115)
BLUE = (0, 122, 255)
DIVIDER = (229, 229, 234)

COLS = 3
CARD_W, CARD_H = 320, 360
ICON_SIZE = 260
GAP = 30
MARGIN_X = 50
W = MARGIN_X * 2 + COLS * CARD_W + (COLS - 1) * GAP
# 标题区 96 + 分区标题 44 + 2 行卡片 (360+30+360) + 底部 50
H = 96 + 44 + 2 * CARD_H + GAP + 50


def text_center(d, text, font, cx, y, fill):
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    d.text((cx - tw // 2, y), text, fill=fill, font=font)


def build():
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    # 主标题
    text_center(d, "youqu 第六批项目图标 · 苹果白高端风格", FONT_TITLE, W // 2, 22, TITLE)
    sub = "源 1024×1024 · 多尺寸 16/32/64/128/256/512 · ICO 6 档 · 背景 #FFFFFF · 主色 #007AFF · 统一 frame 外框 + 线宽 16px"
    text_center(d, sub, FONT_DESC, W // 2, 66, SUB)

    y = 110
    # 分区标题
    d.rectangle([MARGIN_X, y, MARGIN_X + 4, y + 28], fill=BLUE)
    d.text((MARGIN_X + 14, y - 2), "① 本批新增 6 个项目应用图标（应用级，含语义主体）", fill=TITLE, font=FONT_SECTION)
    y += 44

    overlays = []
    for i, (key, name_cn, desc) in enumerate(PROJECTS):
        r, c = divmod(i, COLS)
        x = MARGIN_X + c * (CARD_W + GAP)
        cy = y + r * (CARD_H + GAP)
        d.rounded_rectangle([x, cy, x + CARD_W, cy + CARD_H], radius=14,
                            fill=CARD, outline=BORDER, width=1)
        src = os.path.join(SHARED, "icons", "projects", key, "icon-source.png")
        if os.path.isfile(src):
            ic = Image.open(src).convert("RGBA").resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
            overlays.append((ic, (x + (CARD_W - ICON_SIZE) // 2, cy + 18)))
        cx = x + CARD_W // 2
        text_center(d, name_cn, FONT_NAME, cx, cy + 300, TITLE)
        text_center(d, desc, FONT_DESC, cx, cy + 326, SUB)

    y_foot = y + 2 * CARD_H + GAP + 10
    d.line([(MARGIN_X, y_foot), (W - MARGIN_X, y_foot)], fill=DIVIDER, width=1)
    foot = "统一规范：纯线性描边 · 无填充 · 线宽 16px · 圆角 22% · 居中留白 8% · 圆角端点 · 蓝占比 5-7%"
    text_center(d, foot, FONT_DESC, W // 2, y_foot + 14, SUB)

    canvas = canvas.convert("RGBA")
    for ic, pos in overlays:
        canvas.alpha_composite(ic, pos)
    out = os.path.join(SHOTS, "batch7-icons-preview-20260715.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"[OK] 预览图 -> {out} ({W}x{H})")
    return out


if __name__ == "__main__":
    build()
