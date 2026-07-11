# make_icon.py - 生成应用图标
from PIL import Image, ImageDraw, ImageFont
import os

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角背景
margin = 40
radius = 120
draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=radius, fill=(0, 122, 255, 255))

# 绘制订阅卡片图标 - 白色信封/卡片
card_margin_x = 130
card_margin_y = 150
card_w = size - card_margin_x * 2
card_h = size - card_margin_y * 2

# 卡片背景
draw.rounded_rectangle([card_margin_x, card_margin_y, card_margin_x + card_w, card_margin_y + card_h], radius=30, fill=(255, 255, 255, 255))

# 卡片上的横线（代表订阅列表）
line_start_x = card_margin_x + 40
line_end_x = card_margin_x + card_w - 40
for i, y in enumerate([card_margin_y + 60, card_margin_y + 130, card_margin_y + 200]):
    if i == 0:
        draw.rounded_rectangle([line_start_x, y, line_start_x + 50, y + 10], radius=5, fill=(0, 122, 255, 255))
    draw.rounded_rectangle([line_start_x, y + 25, line_end_x - 80, y + 35], radius=5, fill=(200, 200, 210, 255))

# 保存
script_dir = os.path.dirname(os.path.abspath(__file__))
ico_path = os.path.join(script_dir, 'icon.ico')
png_path = os.path.join(script_dir, 'icon-source.png')

img.save(png_path)
img.convert('RGBA').save(ico_path, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('图标生成完成: ' + ico_path)
