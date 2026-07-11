# -*- coding: utf-8 -*-
"""换算管家图标生成 - 苹果白风格的天平/换算图标"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

SIZE = 1024

def make_icon(path):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角背景（苹果白渐变感）
    margin = 80
    radius = 220
    # 外层柔和阴影底
    shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([margin+8, margin+16, SIZE-margin+8, SIZE-margin+16], radius=radius, fill=(0,0,0,40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)

    # 主背景：浅蓝白渐变
    bg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bg)
    bd.rounded_rectangle([margin, margin, SIZE-margin, SIZE-margin], radius=radius, fill=(255,255,255,255))
    # 顶部蓝色高光条
    bd.rounded_rectangle([margin, margin, SIZE-margin, margin+180], radius=radius, fill=(0,122,255,255))
    # 裁掉底部圆角让高光只在上半
    bd.rectangle([margin, margin+120, SIZE-margin, margin+180], fill=(0,122,255,255))
    img = Image.alpha_composite(img, bg)
    d = ImageDraw.Draw(img)

    # 天平图标（白色，居中）
    cx, cy = SIZE//2, SIZE//2 + 60
    # 立柱
    d.rectangle([cx-12, cy-140, cx+12, cy+120], fill=(60,60,67,255))
    # 顶部三角
    d.polygon([(cx, cy-180),(cx-30, cy-130),(cx+30, cy-130)], fill=(60,60,67,255))
    # 横梁
    d.rounded_rectangle([cx-200, cy-130, cx+200, cy-100], radius=12, fill=(60,60,67,255))
    # 左托盘（圆弧）
    d.arc([cx-260, cy-100, cx-140, cy+20], start=180, end=360, fill=(60,60,67,255), width=16)
    d.line([cx-200, cy-100, cx-200, cy-70], fill=(60,60,67,255), width=8)
    # 右托盘
    d.arc([cx+140, cy-100, cx+260, cy+20], start=180, end=360, fill=(60,60,67,255), width=16)
    d.line([cx+200, cy-100, cx+200, cy-70], fill=(60,60,67,255), width=8)
    # 底座
    d.rounded_rectangle([cx-80, cy+120, cx+80, cy+150], radius=10, fill=(60,60,67,255))

    # 左右箭头（表示换算）
    d.text((cx-310, cy-40), '⇄', fill=(0,122,255,255), font=__import__('PIL').ImageFont.truetype('C:\\Windows\\Fonts\\arialbd.ttf', 90) if os.path.exists('C:\\Windows\\Fonts\\arialbd.ttf') else None)

    img = img.convert('RGBA')
    img.save(path, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    # 同时存 png 源
    png_path = os.path.splitext(path)[0] + '-source.png'
    img.save(png_path)
    print('图标已生成:', path)

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), 'icon.ico')
    make_icon(out)
