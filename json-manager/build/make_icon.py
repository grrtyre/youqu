# -*- coding: utf-8 -*-
"""
JSON管家 图标生成脚本
生成 256x256 PNG 和多尺寸 ICO
设计：苹果白底 + 蓝色 { } 符号
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT_DIR, exist_ok=True)

SIZE = 256

def round_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.pieslice([x0, y0, x0 + 2 * radius, y0 + 2 * radius], 180, 270, fill=fill)
    draw.pieslice([x1 - 2 * radius, y0, x1, y0 + 2 * radius], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2 * radius, x0 + 2 * radius, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2 * radius, y1 - 2 * radius, x1, y1], 0, 90, fill=fill)

def find_font():
    candidates = [
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/seguisb.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def make_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # 圆角白底 + 细阴影边
    round_rect(draw, [8, 8, SIZE - 8, SIZE - 8], 56, (255, 255, 255, 255))
    # 细灰边
    draw.rounded_rectangle([8, 8, SIZE - 8, SIZE - 8], radius=56, outline=(0, 0, 0, 18), width=2)
    # 蓝色 { } 符号
    font_path = find_font()
    font_size = 140
    font = None
    if font_path:
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception:
            font = None
    if font is None:
        font = ImageFont.load_default()
    # 画 { }
    text = "{ }"
    color = (0, 122, 255, 255)  # #007aff
    # 居中
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (SIZE - tw) // 2 - bbox[0]
    y = (SIZE - th) // 2 - bbox[1] - 4
    draw.text((x, y), text, font=font, fill=color)
    # 顶部小圆点装饰（三色 mac 风格窗口控件）
    r = 6
    cy = 32
    draw.ellipse([28, cy - r, 28 + 2 * r, cy + r], fill=(255, 95, 86, 255))
    draw.ellipse([28 + 22, cy - r, 28 + 22 + 2 * r, cy + r], fill=(255, 189, 46, 255))
    draw.ellipse([28 + 44, cy - r, 28 + 44 + 2 * r, cy + r], fill=(39, 201, 63, 255))

    png_path = os.path.join(OUT_DIR, "icon-source.png")
    img.save(png_path, "PNG")
    print("Saved:", png_path)

    ico_path = os.path.join(OUT_DIR, "icon.ico")
    img.convert("RGBA").save(ico_path, format="ICO",
                             sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("Saved:", ico_path)

if __name__ == "__main__":
    make_icon()
