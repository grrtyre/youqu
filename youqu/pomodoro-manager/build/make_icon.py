import os

IMG_PATH = os.path.join(os.path.dirname(__file__), 'icon-source.png')
ICO_PATH = os.path.join(os.path.dirname(__file__), 'icon.ico')

from PIL import Image, ImageDraw, ImageFilter

size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角背景 - 苹果白渐变
for y in range(size):
    t = y / size
    r = int(245 + (255 - 245) * t)
    g = int(245 + (255 - 245) * t)
    b = int(247 + (255 - 247) * t)
    draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

# 遮罩成圆角矩形
mask = Image.new('L', (size, size), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, size-1, size-1], radius=110, fill=255)
img.putalpha(mask)

# 外圈圆环（番茄红）
cx, cy = size // 2, size // 2
ring_r = 170
ring_w = 26
draw.ellipse([cx-ring_r, cy-ring_r, cx+ring_r, cy+ring_r],
             outline=(255, 99, 71, 255), width=ring_w)

# 进度弧（从顶部开始约 75%）
import math
arc_box = [cx-ring_r, cy-ring_r, cx+ring_r, cy+ring_r]
draw.arc(arc_box, start=-90, end=-90+270, fill=(0, 122, 255, 255), width=ring_w)

# 中心番茄图标（简化）
# 画一个红色圆形番茄
tomato_r = 95
draw.ellipse([cx-tomato_r, cy-tomato_r+10, cx+tomato_r, cy+tomato_r+10],
             fill=(255, 89, 71, 255))
# 番茄高光
draw.ellipse([cx-tomato_r+20, cy-tomato_r+20, cx-tomato_r+60, cy-tomato_r+50],
             fill=(255, 160, 140, 200))
# 番茄叶子（绿色）
leaf = [
    (cx-40, cy-tomato_r+5),
    (cx-15, cy-tomato_r-15),
    (cx, cy-tomato_r+5),
    (cx+15, cy-tomato_r-15),
    (cx+40, cy-tomato_r+5),
]
draw.polygon([(cx-45, cy-tomato_r+8), (cx, cy-tomato_r-25), (cx+45, cy-tomato_r+8)],
             fill=(76, 217, 100, 255))

# 保存 PNG 源图
img.save(IMG_PATH, 'PNG')

# 转 ICO
ico = img.convert('RGBA')
ico.save(ICO_PATH, format='ICO',
         sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('icon.ico 生成完成')
