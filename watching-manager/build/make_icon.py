# -*- coding: utf-8 -*-
# build/make_icon.py — 生成剧集管家图标（苹果白风格）
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_ICO = os.path.join(OUT_DIR, 'icon.ico')
OUT_PNG = os.path.join(OUT_DIR, 'icon-source.png')

SIZE = 512
# 苹果白高端风格：白底 + 蓝色播放三角 + 阴影圆角
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角白底卡片
radius = 110
margin = 24
card_box = (margin, margin, SIZE - margin, SIZE - margin)
# 阴影（柔和投影）
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((margin + 8, margin + 16, SIZE - margin + 8, SIZE - margin + 16),
                     radius=radius, fill=(0, 0, 0, 38))
# 模糊阴影
shadow = shadow.filter(ImageFilter.GaussianBlur(12))
img.alpha_composite(shadow)

# 主白卡
draw.rounded_rectangle(card_box, radius=radius, fill=(255, 255, 255, 255))

# 内描边
draw.rounded_rectangle(card_box, radius=radius, outline=(229, 229, 234, 255), width=2)

# 蓝色播放圆按钮（中心）
cx, cy = SIZE // 2, SIZE // 2 - 18
r = 118
draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 122, 255, 255))

# 播放三角（指向右）
import math
# 等腰三角形指向右侧
tri_w = 56  # 半宽
tri_h = 70  # 半高
offset = 12  # 视觉补偿
p1 = (cx - tri_w * 0.6 + offset, cy - tri_h)
p2 = (cx - tri_w * 0.6 + offset, cy + tri_h)
p3 = (cx + tri_w + offset, cy)
draw.polygon([p1, p2, p3], fill=(255, 255, 255, 255))

# 底部文字「剧集」
try:
    font = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 56)
except Exception:
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 56)
    except Exception:
        font = ImageFont.load_default()
text = '剧集'
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
draw.text(((SIZE - tw) // 2 - bbox[0], SIZE - margin - 84 - th + bbox[1] + 6),
          text, fill=(29, 29, 31, 255), font=font)

img.save(OUT_PNG, 'PNG')
img.convert('RGBA').save(OUT_ICO, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f'OK: {OUT_ICO}')
print(f'OK: {OUT_PNG}')
