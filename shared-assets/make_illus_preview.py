# -*- coding: utf-8 -*-
"""预览图 v4：修复 mimo v3 反馈
- 布局对称：纹理卡片加宽使两行等宽
- 纹理对比度 10x + 更深灰底
- 标题简化为两行
- success 插画已简化（去放射点）
- 纹理区加“2×2 平铺”角标
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets")
ILLUS_DIR = os.path.join(SHARED, "illustrations")
PATTERN_DIR = os.path.join(SHARED, "patterns")
SHOTS = r"d:\Ai\mimo\screenshots"
os.makedirs(SHOTS, exist_ok=True)

FONT_TITLE = FONT_SECTION = FONT_NAME = FONT_DESC = FONT_SUB = ImageFont.load_default()
for fp in [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc"]:
    if os.path.isfile(fp):
        FONT_TITLE = ImageFont.truetype(fp, 34)
        FONT_SECTION = ImageFont.truetype(fp, 22)
        FONT_NAME = ImageFont.truetype(fp, 20)
        FONT_DESC = ImageFont.truetype(fp, 14)
        FONT_SUB = ImageFont.truetype(fp, 12)
        break

BG = (245, 245, 247)
CARD = (255, 255, 255)
CARD_SHADOW = (228, 228, 233)
TEXTURE_BG = (232, 232, 236)        # 浅灰底（苹果白风格协调）
BORDER = (229, 229, 234)
TITLE_C = (29, 29, 31)
SUB = (110, 110, 115)
SUB_FAINT = (160, 160, 165)
BLUE = (0, 122, 255)
TAG_BG = (0, 122, 255)

ILLUS = [
    ("empty-list", "空列表", "纸箱+加号提示"),
    ("no-result", "无结果", "文档+放大镜"),
    ("error", "错误", "三角警告+感叹号"),
    ("success", "成功", "圆+勾"),
]
PATTERNS = [
    ("apple-white-gradient", "白渐变", "上白→下浅灰"),
    ("subtle-grid", "极淡网格", "64px 间距"),
    ("dotted", "点阵", "32px 间距"),
]

W = 1600
GAP = 28
# 插画卡片
I_CARD_W, I_CARD_H = 330, 350
I_ICON = 240
START_X = (W - 4 * I_CARD_W - 3 * GAP) // 2
# 纹理卡片：加宽使总宽 = 插画行总宽
I_ROW_W = 4 * I_CARD_W + 3 * GAP           # 1404
P_CARD_W = (I_ROW_W - 2 * GAP + 2) // 3      # 450，确保等宽
P_CARD_H = 390
P_ICON = 300
START_X_P = (W - 3 * P_CARD_W - 2 * GAP) // 2  # 等于 START_X

H = 100 + 42 + I_CARD_H + 40 + 42 + P_CARD_H + 60  # 加大底部留白


def text_center(d, text, font, cx, y, fill):
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    d.text((cx - tw // 2, y), text, fill=fill, font=font)


def draw_card_with_shadow(d, x, y, w, h, radius=14):
    d.rounded_rectangle([x + 2, y + 3, x + w + 2, y + h + 3], radius=radius, fill=CARD_SHADOW)
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=CARD, outline=BORDER, width=1)


def draw_section_title(d, title, subtitle, y_top, start_x):
    d.rectangle([start_x, y_top, start_x + 4, y_top + 26], fill=BLUE)
    d.text((start_x + 14, y_top - 2), title, fill=TITLE_C, font=FONT_SECTION)
    bbox = d.textbbox((0, 0), title, font=FONT_SECTION)
    tw = bbox[2] - bbox[0]
    d.text((start_x + 14 + tw + 10, y_top + 2), subtitle, fill=SUB_FAINT, font=FONT_SUB)


def fade_divider(d, y, x_start, x_end):
    steps = 50
    for i in range(steps):
        t = i / steps
        alpha_t = 1 - abs(t - 0.5) * 2
        gray = int(229 + (245 - 229) * (1 - alpha_t))
        x1 = x_start + int(t * (x_end - x_start))
        x2 = x_start + int((t + 1 / steps) * (x_end - x_start))
        d.line([(x1, y), (x2, y)], fill=(gray, gray, gray + 1), width=1)


def make_texture_showcase(path):
    """纹理展示：深灰底 + 对比度增强 10x + 2×2 平铺 + 圆角 + 角标"""
    tile = Image.open(path).convert("RGBA").resize((P_ICON // 2, P_ICON // 2), Image.LANCZOS)
    enhancer = ImageEnhance.Contrast(tile)
    tile = enhancer.enhance(6.0)  # 适中增强对比度
    showcase = Image.new("RGBA", (P_ICON, P_ICON), TEXTURE_BG)
    showcase.alpha_composite(tile, (0, 0))
    showcase.alpha_composite(tile, (P_ICON // 2, 0))
    showcase.alpha_composite(tile, (0, P_ICON // 2))
    showcase.alpha_composite(tile, (P_ICON // 2, P_ICON // 2))
    # 圆角
    mask = Image.new("L", (P_ICON, P_ICON), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, P_ICON, P_ICON], radius=10, fill=255)
    showcase.putalpha(mask)
    return showcase


def draw_tile_tag(d, x, y):
    """2×2 平铺角标"""
    tag = "2x2 tiled"
    bbox = d.textbbox((0, 0), tag, font=FONT_DESC)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad = 6
    d.rounded_rectangle([x, y, x + tw + pad * 2, y + th + pad * 2], radius=5, fill=TAG_BG)
    d.text((x + pad, y + pad - 2), tag, fill=(255, 255, 255), font=FONT_DESC)


def build():
    canvas = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(canvas)
    text_center(d, "youqu 共享资源 · illustrations + patterns", FONT_TITLE, W // 2, 18, TITLE_C)
    text_center(d, "苹果白高端风格 · #007AFF 纯线性描边", FONT_SUB, W // 2, 58, SUB_FAINT)

    y_cursor = 100
    overlays = []
    tag_positions = []  # 收集角标位置，最后画

    # 分区 1：空状态插画
    draw_section_title(d, "① 空状态插画 illustrations/",
                       "1024x1024 · 场景级 · 线宽 16px", y_cursor, START_X)
    y_cursor += 42
    for i, (key, name_cn, desc) in enumerate(ILLUS):
        x = START_X + i * (I_CARD_W + GAP)
        draw_card_with_shadow(d, x, y_cursor, I_CARD_W, I_CARD_H)
        path = os.path.join(ILLUS_DIR, f"{key}.png")
        if os.path.isfile(path):
            ic = Image.open(path).convert("RGBA").resize((I_ICON, I_ICON), Image.LANCZOS)
            overlays.append((ic, (x + (I_CARD_W - I_ICON) // 2, y_cursor + 18)))
        cx = x + I_CARD_W // 2
        text_center(d, name_cn, FONT_NAME, cx, y_cursor + 272, TITLE_C)
        text_center(d, desc, FONT_DESC, cx, y_cursor + 300, SUB)
        text_center(d, f"{key}.png", FONT_SUB, cx, y_cursor + 322, SUB_FAINT)
    y_cursor += I_CARD_H + 30

    fade_divider(d, y_cursor, 60, W - 60)
    y_cursor += 20

    # 分区 2：背景纹理
    draw_section_title(d, "② 背景纹理 patterns/",
                       "512x512 · 可平铺 · 预览对比度增强6x", y_cursor, START_X_P)
    y_cursor += 42
    for i, (key, name_cn, desc) in enumerate(PATTERNS):
        x = START_X_P + i * (P_CARD_W + GAP)
        draw_card_with_shadow(d, x, y_cursor, P_CARD_W, P_CARD_H)
        path = os.path.join(PATTERN_DIR, f"{key}.png")
        if os.path.isfile(path):
            showcase = make_texture_showcase(path)
            sx = x + (P_CARD_W - P_ICON) // 2
            sy = y_cursor + 16
            overlays.append((showcase, (sx, sy)))
            # 角标位置：卡片右上角（不遮挡纹理）
            tag_positions.append((x + P_CARD_W - 90, y_cursor + 8))
        cx = x + P_CARD_W // 2
        text_center(d, name_cn, FONT_NAME, cx, y_cursor + P_ICON + 24, TITLE_C)
        text_center(d, desc, FONT_DESC, cx, y_cursor + P_ICON + 52, SUB)
        text_center(d, f"{key}.png", FONT_SUB, cx, y_cursor + P_ICON + 74, SUB_FAINT)
    y_cursor += P_CARD_H + 20

    text_center(d, "illustrations/(empty-list · no-result · error · success) + patterns/(apple-white-gradient · subtle-grid · dotted)",
                FONT_DESC, W // 2, y_cursor + 8, SUB)

    # 先合成所有 overlay
    canvas = canvas.convert("RGBA")
    for ic, pos in overlays:
        canvas.alpha_composite(ic, pos)
    # 合成后再画角标（确保在最上层）
    d2 = ImageDraw.Draw(canvas)
    for (tx, ty) in tag_positions:
        draw_tile_tag(d2, tx, ty)
    out = os.path.join(SHOTS, "illus-patterns-preview-v4-20260714.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"[OK] preview v4 -> {out} ({W}x{H})")
    return out


if __name__ == "__main__":
    build()
