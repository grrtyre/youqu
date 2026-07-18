# -*- coding: utf-8 -*-
"""make_icon.py — 生成应用图标 icon.ico

苹果白风格护眼图标：绿色圆角背景 + 白色眼睛 + 蓝色瞳孔。
包含多尺寸 (16,32,48,64,128,256)，供 exe 图标与托盘使用。
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "assets", "icon.ico")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def draw_eye(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = max(2, size // 16)
    # 绿色圆角背景
    d.rounded_rectangle([pad, pad, size - pad, size - pad],
                        radius=max(3, size // 5), fill=(48, 209, 88, 255))
    # 眼睛白色椭圆
    ex1, ey1 = size * 0.22, size * 0.34
    ex2, ey2 = size * 0.78, size * 0.66
    d.ellipse([ex1, ey1, ex2, ey2], fill=(255, 255, 255, 255))
    # 蓝色瞳孔
    pr = size * 0.12
    cx, cy = size * 0.5, size * 0.5
    d.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=(0, 122, 255, 255))
    # 高光
    hr = pr * 0.4
    d.ellipse([cx - hr - pr * 0.3, cy - hr - pr * 0.3,
               cx - hr - pr * 0.3 + hr * 2, cy - hr - pr * 0.3 + hr * 2],
              fill=(255, 255, 255, 230))
    return img


def main():
    imgs = [draw_eye(s[0]) for s in SIZES]
    # ico 文件：第一个为最大尺寸
    imgs[0].save(OUT, format="ICO", sizes=SIZES, append_images=imgs[1:])
    # 同时保存 png 预览
    png_path = os.path.join(os.path.dirname(OUT), "icon-256.png")
    draw_eye(256).save(png_path, "PNG")
    print(f"图标已生成: {OUT}")
    print(f"PNG 预览: {png_path}")


if __name__ == "__main__":
    main()
