# -*- coding: utf-8 -*-
"""markdown-preview PWA 图标生成器 · 苹果白风格"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")
OUT_DIR = os.path.normpath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

def lerp(a, b, t):
    return int(a + (b - a) * t)

def make_icon(size):
    """生成单个尺寸图标：蓝色渐变圆角方块 + 白色 M 字"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方块（iOS 风格圆角约 22.5%）
    radius = int(size * 0.22)
    # 蓝色渐变：从 #0a84ff 到 #0066d6
    for y in range(size):
        t = y / size
        r = lerp(10, 0, t)
        g = lerp(132, 102, t)
        b = lerp(255, 214, t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # 圆角遮罩
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.putalpha(mask)

    # 白色 M 字
    try:
        font = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", int(size * 0.55))
    except Exception:
        font = ImageFont.load_default()

    text = "M"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (size - tw) // 2 - bbox[0]
    ty = (size - th) // 2 - bbox[1] - int(size * 0.02)
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)

    return img

# 生成各尺寸
for s in [192, 256, 384, 512, 180]:
    icon = make_icon(s)
    icon.save(os.path.join(OUT_DIR, f"icon-{s}.png"))
    print(f"生成 icon-{s}.png")

# favicon (多尺寸 ico)
icon32 = make_icon(32)
icon32.save(os.path.join(OUT_DIR, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("生成 favicon.ico")
print("完成")
