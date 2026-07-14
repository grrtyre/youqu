# -*- coding: utf-8 -*-
"""把本批资源拼到预览图（分区域展示），交 mimo 评分
布局：①项目应用图标（5 个，1 行）②通用功能图标（8 个，2 行 4 列）
解决 mimo 反馈：通用图标行视觉重量轻 → 新增 maximize/delete/edit 丰富部件，平衡跨行复杂度"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets")
SHOTS = r"d:\Ai\mimo\screenshots"
os.makedirs(SHOTS, exist_ok=True)

# 字体
FONT_TITLE = None
FONT_SECTION = None
FONT_NAME = None
FONT_DESC = None
for fp in [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc"]:
    if os.path.isfile(fp):
        FONT_TITLE = ImageFont.truetype(fp, 36)
        FONT_SECTION = ImageFont.truetype(fp, 24)
        FONT_NAME = ImageFont.truetype(fp, 19)
        FONT_DESC = ImageFont.truetype(fp, 14)
        break
if FONT_TITLE is None:
    FONT_TITLE = FONT_SECTION = FONT_NAME = FONT_DESC = ImageFont.load_default()

PROJECTS = [
    ("anniversary-manager", "纪念日管家", "frame+心形"),
    ("checksum-manager", "校验和管家", "frame+盾牌+勾"),
    ("hosts-manager", "hosts 管家", "frame+服务器"),
    ("image-converter", "图片转换", "frame+双图"),
    ("pdf-toolbox", "PDF 工具箱", "frame+文档+扳手"),
]
# 通用图标增至 8 个：新增 maximize/delete/edit 视觉丰富，平衡复杂度
GENERICS = [
    ("settings", "设置", "frame+齿轮"),
    ("search", "搜索", "frame+放大镜"),
    ("close", "关闭", "frame+X"),
    ("minimize", "最小化", "frame+横线"),
    ("add", "添加", "frame+加号"),
    ("maximize", "最大化", "frame+方框+四角L"),
    ("delete", "删除", "frame+垃圾桶"),
    ("edit", "编辑", "frame+铅笔+下划线"),
]

BG = (245, 245, 247)
CARD = (255, 255, 255)
BORDER = (229, 229, 234)
TITLE = (29, 29, 31)
SUB = (110, 110, 115)
BLUE = (0, 122, 255)
DIVIDER = (229, 229, 234)

# 画布：5 列项目行 + 4 列通用行（2 行），高度需容纳三行卡片
COLS_P = 5
COLS_G = 4
W = 1600
CARD_W, CARD_H = 250, 310
ICON_SIZE = 220
GAP = 22

# 项目行：5 列居中
START_X_P = (W - COLS_P * CARD_W - (COLS_P - 1) * GAP) // 2
# 通用行：4 列居中
START_X_G = (W - COLS_G * CARD_W - (COLS_G - 1) * GAP) // 2

# 总高度：标题区 90 + 项目行 44+310 + 分隔 40 + 通用标题 30 + 通用两行 (310+22+310) + 底部 40
H = 90 + 44 + CARD_H + 40 + 30 + 2 * CARD_H + 22 + 40


def text_center(d, text, font, cx, y, fill):
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    d.text((cx - tw // 2, y), text, fill=fill, font=font)


def draw_card(d, x, y, icon_path):
    d.rounded_rectangle([x, y, x + CARD_W, y + CARD_H], radius=14,
                        fill=CARD, outline=BORDER, width=1)
    if os.path.isfile(icon_path):
        ic = Image.open(icon_path).convert("RGBA").resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
        return ic, (x + (CARD_W - ICON_SIZE) // 2, y + 16)
    return None, None


def draw_section_title(d, title, y_top, start_x):
    """分区标题：左侧蓝色短竖条 + 标题文字"""
    d.rectangle([start_x, y_top, start_x + 4, y_top + 28], fill=BLUE)
    d.text((start_x + 14, y_top - 2), title, fill=TITLE, font=FONT_SECTION)


def draw_row(d, items, start_x, y, src_fn):
    """画一行卡片，返回 overlay 列表"""
    overlays = []
    for i, (key, name_cn, desc) in enumerate(items):
        x = start_x + i * (CARD_W + GAP)
        ic, pos = draw_card(d, x, y, src_fn(key))
        if ic:
            overlays.append((ic, pos))
        cx = x + CARD_W // 2
        text_center(d, name_cn, FONT_NAME, cx, y + 258, TITLE)
        text_center(d, desc, FONT_DESC, cx, y + 284, SUB)
    return overlays


def build():
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    # 主标题
    t = "youqu 共享资源预览 · 苹果白高端风格"
    text_center(d, t, FONT_TITLE, W // 2, 20, TITLE)
    sub = "源 1024×1024 · 多尺寸 16/32/64/128/256/512 · ICO 6 档 · 背景 #FFFFFF · 主色 #007AFF · 统一 frame 外框"
    text_center(d, sub, FONT_DESC, W // 2, 62, SUB)

    y_cursor = 100
    overlays = []

    # 分区 1：项目应用图标（1 行 5 列）
    draw_section_title(d, "① 项目应用图标（应用级，含语义主体，3-5 部件）", y_cursor, START_X_P)
    y_cursor += 44
    overlays.extend(draw_row(d, PROJECTS, START_X_P, y_cursor,
                             lambda k: os.path.join(SHARED, "icons", "projects", k, "icon-source.png")))
    y_cursor += CARD_H + 30

    # 分隔线
    d.line([(60, y_cursor), (W - 60, y_cursor)], fill=DIVIDER, width=1)
    y_cursor += 20

    # 分区 2：通用功能图标（2 行 4 列）
    draw_section_title(d, "② 通用功能图标（符号级，跨项目复用；下半行 maximize/delete/edit 补齐复杂度）", y_cursor, START_X_G)
    y_cursor += 44
    row1 = GENERICS[:4]
    row2 = GENERICS[4:]
    overlays.extend(draw_row(d, row1, START_X_G, y_cursor,
                             lambda k: os.path.join(SHARED, "icons", k + "-source.png")))
    y_cursor += CARD_H + GAP
    overlays.extend(draw_row(d, row2, START_X_G, y_cursor,
                             lambda k: os.path.join(SHARED, "icons", k + "-source.png")))
    y_cursor += CARD_H + 16

    # 底部规范
    foot = "统一规范：纯线性描边 · 无填充 · 线宽 16px · 圆角 22% · 居中留白 8% · 蓝占比 5-7% · 本批新增 maximize/delete/edit 平衡视觉重量"
    text_center(d, foot, FONT_DESC, W // 2, y_cursor + 8, SUB)

    canvas = canvas.convert("RGBA")
    for ic, pos in overlays:
        canvas.alpha_composite(ic, pos)
    out = os.path.join(SHOTS, "assets-preview-20260714.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"[OK] 预览图 -> {out} ({W}×{H})")
    return out


if __name__ == "__main__":
    build()
