# Python: 生成端口管家图标
from PIL import Image, ImageDraw, ImageFilter
import os

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角背景（蓝色渐变模拟）
margin = 48
radius = 120
# 底色
for y in range(margin, size - margin):
    ratio = (y - margin) / (size - 2 * margin)
    r = int(0 + (90 - 0) * ratio)
    g = int(122 + (200 - 122) * ratio)
    b = int(255 + (250 - 255) * ratio)
    d.line([(margin, y), (size - margin - 1, y)], fill=(r, g, b, 255))

# 圆角遮罩
mask = Image.new('L', (size, size), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([margin, margin, size - margin, size - margin], radius=radius, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(0.5))

bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
bg.paste(img, (0, 0), mask)
img = bg

# 绘制端口/连接符号：圆点 + 连接线
cx, cy = size // 2, size // 2 - 10
# 中心节点
d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=(255, 255, 255, 255))
# 周围4个小节点 + 连线
nodes = [
    (cx - 110, cy - 70),
    (cx + 110, cy - 70),
    (cx - 110, cy + 90),
    (cx + 110, cy + 90),
]
for nx, ny in nodes:
    d.line([(cx, cy), (nx, ny)], fill=(255, 255, 255, 220), width=8)
for nx, ny in nodes:
    d.ellipse([nx - 20, ny - 20, nx + 20, ny + 20], fill=(255, 255, 255, 255))

# 中心蓝色圆
d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(0, 122, 255, 255))

out_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(out_dir, 'icon-source.png')
img.save(src_path, 'PNG')

# 保存 ico
ico = img.convert('RGBA')
ico_path = os.path.join(out_dir, 'icon.ico')
ico.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print('icon saved:', ico_path)
print('source saved:', src_path)
