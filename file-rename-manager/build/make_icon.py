"""生成重命名管家应用图标 - 苹果白高端风格
256x256 主图，导出多尺寸 ICO
"""
from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 256
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角方形背景 - 苹果蓝
bg_color = (0, 122, 255, 255)
radius = 56
draw.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, fill=bg_color)

# 内部高光（顶部微亮，模拟苹果质感）
highlight = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
hd = ImageDraw.Draw(highlight)
hd.rounded_rectangle([0, 0, SIZE-1, SIZE//2], radius=radius, fill=(255, 255, 255, 28))
img = Image.alpha_composite(img, highlight)
draw = ImageDraw.Draw(img)

# 绘制"文件"图标（白色，半透明）
# 文件主体
fx0, fy0, fx1, fy1 = 78, 70, 178, 200
file_radius = 12
# 文件折角
corner_size = 28
points = [
    (fx0, fy0),
    (fx1 - corner_size, fy0),
    (fx1, fy0 + corner_size),
    (fx1, fy1),
    (fx0, fy1),
]
draw.polygon(points, fill=(255, 255, 255, 245))
# 折角线
draw.line([(fx1 - corner_size, fy0), (fx1 - corner_size, fy0 + corner_size), (fx1, fy0 + corner_size)],
          fill=(0, 122, 255, 180), width=3)

# 文件上的"横线"代表文本（3条，从上到下变短）
line_color = (0, 122, 255, 220)
line_y_start = fy0 + corner_size + 22
line_x0 = fx0 + 20
line_x1 = fx1 - 20
for i, ratio in enumerate([1.0, 0.85, 0.6]):
    y = line_y_start + i * 24
    x_end = int(line_x0 + (line_x1 - line_x0) * ratio)
    draw.rounded_rectangle([line_x0, y, x_end, y + 7], radius=3, fill=line_color)

# 绘制"重命名"箭头（底部右下，表示转换）
# 一个圆形背景 + 双向箭头
ax, ay = 150, 165
ar = 34
draw.ellipse([ax - ar, ay - ar, ax + ar, ay + ar], fill=(255, 159, 0, 255))
# 双向箭头（水平）
arrow_color = (255, 255, 255, 255)
# 左箭头
draw.polygon([
    (ax - 16, ay),
    (ax - 6, ay - 8),
    (ax - 6, ay + 8)
], fill=arrow_color)
# 右箭头
draw.polygon([
    (ax + 16, ay),
    (ax + 6, ay - 8),
    (ax + 6, ay + 8)
], fill=arrow_color)
# 中间横线
draw.rectangle([ax - 6, ay - 3, ax + 6, ay + 3], fill=arrow_color)

# 保存源图
out_dir = os.path.join(os.path.dirname(__file__))
src_path = os.path.join(out_dir, 'icon-source.png')
img.save(src_path, 'PNG')

# 导出多尺寸 ICO
ico_path = os.path.join(out_dir, 'icon.ico')
img.save(ico_path, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(f'生成完成: {src_path}')
print(f'ICO: {ico_path}')
print(f'尺寸: 16,32,48,64,128,256')
