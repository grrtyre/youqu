# -*- coding: utf-8 -*-
"""生成日志管家图标：文档+日志行+蓝色强调，苹果白风格"""
import os
from PIL import Image, ImageDraw, ImageFilter

def make_icon(out_png, out_ico):
    size = 256
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角背景（浅蓝渐变感）
    bg_color = (255, 255, 255, 255)
    radius = 56
    d.rounded_rectangle([8, 8, size-8, size-8], radius=radius, fill=bg_color)

    # 细微阴影边框
    d.rounded_rectangle([8, 8, size-8, size-8], radius=radius, outline=(229, 229, 234, 255), width=2)

    # 顶部蓝色装饰条
    accent = (0, 122, 255, 255)
    d.rounded_rectangle([40, 44, 216, 56], radius=6, fill=accent)

    # 日志行（圆角矩形条）
    rows = [
        (52, 84, 200, 12),
        (52, 110, 170, 12),
        (52, 136, 210, 12),
        (52, 162, 150, 12),
        (52, 188, 180, 12),
    ]
    gray = (180, 184, 193, 220)
    for (x, y, w, h) in rows:
        d.rounded_rectangle([x, y, x+w, y+h], radius=h//2, fill=gray)

    # 行首级别圆点（彩色，模拟日志级别）
    dots = [
        (40, 84, 12, (0, 122, 255, 255)),    # INFO 蓝
        (40, 110, 12, (88, 86, 214, 255)),   # DEBUG 紫
        (40, 136, 12, (255, 149, 0, 255)),   # WARN 橙
        (40, 162, 12, (255, 59, 48, 255)),   # ERROR 红
        (40, 188, 12, (175, 82, 222, 255)),  # FATAL 紫
    ]
    for (x, y, r, c) in dots:
        d.ellipse([x, y, x+r, y+r], fill=c)

    # 底部曲线（流动感，表示实时跟踪）
    d.arc([40, 200, 216, 232], start=0, end=180, fill=accent, width=4)

    img.save(out_png, 'PNG')
    # 转 ICO
    sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
    img.save(out_ico, format='ICO', sizes=sizes)
    print('Generated:', out_png, out_ico)

if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    make_icon(os.path.join(base, 'icon-source.png'), os.path.join(base, 'icon.ico'))
