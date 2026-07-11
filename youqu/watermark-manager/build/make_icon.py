# -*- coding: utf-8 -*-
"""
水印管家 - 图标生成脚本
用 Python PIL 将 PNG 转换为多尺寸 ICO
"""
import os
from PIL import Image, ImageDraw, ImageFont

def create_icon():
    """生成水印管家图标：水滴 + 文字水印效果"""
    size = 256
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 绘制圆角背景（苹果白风格渐变蓝）
    margin = 20
    radius = 56
    # 渐变背景
    for y in range(margin, size - margin):
        ratio = (y - margin) / (size - 2 * margin)
        r = int(232 - ratio * 20)
        g = int(240 - ratio * 16)
        b = int(252 - ratio * 8)
        for x in range(margin, size - margin):
            # 圆角检测
            dx = min(x - margin - radius, 0) or max(x - (size - margin - radius), 0)
            dy = min(y - margin - radius, 0) or max(y - (size - margin - radius), 0)
            if dx * dx + dy * dy <= radius * radius or (dx == 0 and dy == 0):
                img.putpixel((x, y), (r, g, b, 255))

    # 绘制水滴形状（中心）
    cx, cy = size // 2, size // 2 - 10
    # 水滴主体
    draw.ellipse([cx - 40, cy - 20, cx + 40, cy + 60], fill=(0, 122, 255, 255))
    # 水滴尖部
    draw.polygon([(cx, cy - 50), (cx - 25, cy + 10), (cx + 25, cy + 10)], fill=(0, 122, 255, 255))

    # 绘制水印文字效果（半透明条纹）
    try:
        font = ImageFont.truetype("C:\\Windows\\Fonts\\msyh.ttc", 18)
    except Exception:
        font = ImageFont.load_default()

    # 绘制几条倾斜的水印文字模拟
    import math
    text = "水印"
    for i in range(3):
        y_pos = 60 + i * 50
        draw.text((size // 2 - 20, y_pos), text, fill=(255, 255, 255, 80), font=font)

    return img

def save_ico(img, path):
    """保存为多尺寸 ICO"""
    img.convert('RGBA').save(path, format='ICO', sizes=[
        (16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)
    ])
    print(f"图标已保存: {path}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icon_path = os.path.join(script_dir, 'icon.ico')

    img = create_icon()
    save_ico(img, icon_path)

    # 同时保存一份 PNG 源文件
    png_path = os.path.join(script_dir, 'icon-source.png')
    img.save(png_path)
    print(f"PNG 源文件已保存: {png_path}")
