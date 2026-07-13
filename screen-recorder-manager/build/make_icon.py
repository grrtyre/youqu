# -*- coding: utf-8 -*-
# 录屏管家 - 图标生成脚本
# 生成一个录制圆点风格的 256x256 图标，并转 ico
from PIL import Image, ImageDraw
import os

out_dir = os.path.dirname(os.path.abspath(__file__))
png_path = os.path.join(out_dir, 'icon-source.png')
ico_path = os.path.join(out_dir, 'icon.ico')

SIZE = 512

img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角背景（苹果蓝 #007aff）
margin = 64
radius = 110
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin], radius=radius, fill=(0, 122, 255, 255))

# 中心白色录制圆点（仿 macOS 录制按钮）
cx, cy = SIZE // 2, SIZE // 2
dot_r = 70
d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=(255, 255, 255, 255))

# 底部小横条（显示器底座感）
bar_w, bar_h = 140, 18
d.rounded_rectangle([cx - bar_w // 2, SIZE - margin - 50, cx + bar_w // 2, SIZE - margin - 50 + bar_h], radius=9, fill=(255, 255, 255, 220))

img.save(png_path, 'PNG')

# 转 ico（多尺寸）
img.convert('RGBA').save(ico_path, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('图标已生成:', ico_path)
