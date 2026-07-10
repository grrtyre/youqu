# -*- coding: utf-8 -*-
"""生成时间管家图标"""
from PIL import Image, ImageDraw

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角背景
margin = 60
radius = 110
draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=radius, fill=(0, 122, 255, 255))

# 时钟圆环
cx, cy = size // 2, size // 2
cr = 140
draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline=(255, 255, 255, 255), width=18)

# 时钟指针
import math
# 12点方向（上）
draw.line([cx, cy, cx, cy - 95], fill=(255, 255, 255, 255), width=16)
# 3点方向（右）
draw.line([cx, cy, cx + 80, cy + 20], fill=(255, 255, 255, 255), width=16)
# 中心点
draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(255, 255, 255, 255))

img.convert('RGBA').save('icon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
img.save('icon-source.png')
print('icon generated')
