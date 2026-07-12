# -*- coding: utf-8 -*-
# 启动项管家 - 图标生成（PIL 绘制，无需外部图片）
from PIL import Image, ImageDraw, ImageFilter
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(OUT_DIR, 'icon-source.png')
ICO = os.path.join(OUT_DIR, 'icon.ico')

SIZE = 512

def main():
    # 画布
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    # 圆角矩形背景：蓝色渐变
    bg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bg)
    radius = 112
    bd.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, fill=(0, 122, 255, 255))
    # 渐变叠层：从左上浅蓝到右下深蓝
    grad = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for i in range(SIZE):
        t = i / SIZE
        r = int(10 + (0 - 10) * t)
        g = int(132 + (100 - 132) * t)
        b = 255
        gd.line([(0, i), (SIZE, i)], fill=(r, g, b, 255))
    # 圆角裁剪渐变
    mask = Image.new('L', (SIZE, SIZE), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    # 画一个简化的“火箭/启动”图形：向上的箭头 + 底部圆弧
    d = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, SIZE // 2 + 10

    # 主体：向上的箭头（三角形）
    arrow_color = (255, 255, 255, 250)
    # 箭杆
    d.rounded_rectangle([cx-28, cy-110, cx+28, cy+70], radius=24, fill=arrow_color)
    # 箭头三角
    d.polygon([
        (cx, cy-150),
        (cx-78, cy-40),
        (cx-32, cy-40),
        (cx-32, cy-30),
        (cx+32, cy-30),
        (cx+32, cy-40),
        (cx+78, cy-40),
    ], fill=arrow_color)
    # 箭头三角平滑：用椭圆覆盖顶部
    d.ellipse([cx-30, cy-170, cx+30, cy-110], fill=arrow_color)

    # 底部装饰：半圆弧（启动基座）
    d.arc([cx-95, cy+30, cx+95, cy+220], start=180, end=360, fill=(255,255,255,180), width=18)

    # 细高光
    hi = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hd.ellipse([60, 40, SIZE-180, 160], fill=(255, 255, 255, 60))
    hi = hi.filter(ImageFilter.GaussianBlur(40))
    img = Image.alpha_composite(img, hi)

    # 阴影边
    edge = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    ed.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, outline=(0, 80, 200, 90), width=3)
    img = Image.alpha_composite(img, edge)

    img.save(SRC, 'PNG')

    # 生成 ico
    ico_img = img.convert('RGBA')
    ico_img.save(ICO, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    print('icon ->', ICO)

if __name__ == '__main__':
    main()
