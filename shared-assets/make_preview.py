# -*- coding: utf-8 -*-
"""把本批 10 个资源拼到 1600×1000 预览图（分区域展示），交 mimo 评分"""
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
        FONT_TITLE = ImageFont.truetype(fp, 34)
        FONT_SECTION = ImageFont.truetype(fp, 22)
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
GENERICS = [
    ("settings", "设置", "frame+齿轮"),
    ("search", "搜索", "frame+放大镜"),
    ("close", "关闭", "frame+X"),
    ("minimize", "最小化", "frame+横线"),
    ("add", "添加", "frame+加号"),
]

BG = (245, 245, 247)
CARD = (255, 255, 255)
BORDER = (229, 229, 234)
TITLE = (29, 29, 31)
SUB = (110, 110, 115)
BLUE = (0, 122, 255)
DIVIDER = (229, 229, 234)

W, H = 1600, 1000
CARD_W, CARD_H = 270, 320
ICON_SIZE = 240
GAP = 22
START_X = (W - 5 * CARD_W - 4 * GAP) // 2


def text_center(d, text, font, cx, y, fill):
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    d.text((cx - tw // 2, y), text, fill=fill, font=font)


def draw_card(d, x, y, icon_path):
    d.rounded_rectangle([x, y, x + CARD_W, y + CARD_H], radius=14,
                        fill=CARD, outline=BORDER, width=1)
    if os.path.isfile(icon_path):
        ic = Image.open(icon_path).convert("RGBA").resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
        return ic, (x + (CARD_W - ICON_SIZE) // 2, y + 18)
    return None, None


def draw_section(d, title, y_top, items, src_fn):
    """画一个分区：标题 + 5 个卡片"""
    # 分区标题（左侧带蓝色短竖条）
    d.rectangle([START_X, y_top, START_X + 4, y_top + 26], fill=BLUE)
    d.text((START_X + 14, y_top - 2), title, fill=TITLE, font=FONT_SECTION)
    overlays = []
    y = y_top + 44
    for i, (key, name_cn, desc) in enumerate(items):
        x = START_X + i * (CARD_W + GAP)
        ic, pos = draw_card(d, x, y, src_fn(key))
        if ic:
            overlays.append((ic, pos))
        cx = x + CARD_W // 2
        text_center(d, name_cn, FONT_NAME, cx, y + 268, TITLE)
        text_center(d, desc, FONT_DESC, cx, y + 294, SUB)
    return overlays


def build():
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    # 主标题
    t = "youqu 共享资源预览 · 苹果白高端风格"
    text_center(d, t, FONT_TITLE, W // 2, 22, TITLE)
    sub = "源 1024×1024 · 多尺寸 16/32/64/128/256/512 · ICO 6 档 · 背景 #FFFFFF · 主色 #007AFF · 统一 frame 外框"
    text_center(d, sub, FONT_DESC, W // 2, 64, SUB)

    overlays = []
    # 分区 1：项目应用图标
    ov1 = draw_section(d, "① 项目应用图标（应用级，含语义主体）", 96, PROJECTS,
                       lambda k: os.path.join(SHARED, "icons", "projects", k, "icon-source.png"))
    overlays.extend(ov1)

    # 分隔线
    d.line([(START_X, 470), (W - START_X, 470)], fill=DIVIDER, width=1)

    # 分区 2：通用功能图标
    ov2 = draw_section(d, "② 通用功能图标（符号级，跨项目复用）", 486, GENERICS,
                       lambda k: os.path.join(SHARED, "icons", k + "-source.png"))
    overlays.extend(ov2)

    # 底部规范
    foot = "统一规范：纯线性描边 · 无填充 · 线宽 16px · 圆角 22% · 居中留白 8% · 蓝占比 5-7%"
    text_center(d, foot, FONT_DESC, W // 2, H - 26, SUB)

    canvas = canvas.convert("RGBA")
    for ic, pos in overlays:
        canvas.alpha_composite(ic, pos)
    out = os.path.join(SHOTS, "assets-preview-20260714.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"[OK] 预览图 -> {out}")
    return out


if __name__ == "__main__":
    build()
