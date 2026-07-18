# -*- coding: utf-8 -*-
"""生成苹果白风格的快速翻译器图标。
设计：圆角白底卡片 + 蓝色 #007aff 翻译图形（A → 文）。
输出：assets/icon.png（256×256）+ assets/icon.ico（多尺寸）。
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT_DIR, exist_ok=True)

ACCENT = (0, 122, 255, 255)        # #007aff
ACCENT_SOFT = (0, 122, 255, 38)    # 15% 透明
BG = (255, 255, 255, 255)
SHADOW = (0, 122, 255, 18)

SIZES = [16, 32, 48, 64, 128, 256]


def draw_icon(size: int) -> Image.Image:
    """在 size×size 画布上绘制图标。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角白底卡片（占满画布）
    radius = int(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    # 蓝色淡背景圆（呼吸感）
    pad = int(size * 0.18)
    d.ellipse([pad, pad, size - pad, size - pad], fill=ACCENT_SOFT)

    # 中央绘制 "A→文" 翻译主题
    # 使用系统字体
    font_size = int(size * 0.34)
    try:
        # Windows 系统字体
        font = ImageFont.truetype("C:\\Windows\\Fonts\\segoeuib.ttf", font_size)
        font_small = ImageFont.truetype("C:\\Windows\\Fonts\\segoeuib.ttf", int(size * 0.22))
    except Exception:
        font = ImageFont.load_default()
        font_small = font

    # 文字 "A" 居左
    text_a = "A"
    bbox_a = d.textbbox((0, 0), text_a, font=font)
    w_a = bbox_a[2] - bbox_a[0]
    h_a = bbox_a[3] - bbox_a[1]

    # 文字 "文" 居右
    text_b = "文"
    bbox_b = d.textbbox((0, 0), text_b, font=font)
    w_b = bbox_b[2] - bbox_b[0]
    h_b = bbox_b[3] - bbox_b[1]

    arrow_w = int(size * 0.12)
    gap = int(size * 0.04)
    total_w = w_a + arrow_w + w_b + gap * 2
    start_x = (size - total_w) // 2
    cy = size // 2

    # 绘制 A
    d.text((start_x, cy - h_a // 2 - bbox_a[1]), text_a, font=font, fill=ACCENT)

    # 绘制箭头
    ax0 = start_x + w_a + gap
    ax1 = ax0 + arrow_w
    ay = cy
    arrow_h = max(int(size * 0.04), 2)
    d.line([ax0, ay, ax1 - int(size * 0.03), ay], fill=ACCENT, width=arrow_h)
    # 箭头三角
    tri = int(size * 0.05)
    d.polygon([
        (ax1 - tri, ay - tri),
        (ax1, ay),
        (ax1 - tri, ay + tri),
    ], fill=ACCENT)

    # 绘制 文
    d.text((ax1 + gap, cy - h_b // 2 - bbox_b[1]), text_b, font=font, fill=ACCENT)

    return img


def main():
    # 生成 256 主图
    big = draw_icon(256)
    png_path = os.path.join(OUT_DIR, "icon.png")
    big.save(png_path, "PNG")
    print(f"✓ PNG: {png_path}")

    # 生成多尺寸 ICO
    ico_imgs = [draw_icon(s) for s in SIZES]
    ico_path = os.path.join(OUT_DIR, "icon.ico")
    ico_imgs[0].save(ico_path, format="ICO", sizes=[(s, s) for s in SIZES], append_images=ico_imgs[1:])
    print(f"✓ ICO: {ico_path}  尺寸={SIZES}")


if __name__ == "__main__":
    main()
