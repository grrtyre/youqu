"""生成拾色管家应用图标：蓝色圆角方块 + 白色吸管符号"""
from PIL import Image, ImageDraw

SIZE = 256
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 圆角方块背景 #007AFF
radius = 56
d.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, fill=(0, 122, 255, 255))

# 白色吸管（pipette）形状
# 简化：白色圆角长条 + 顶部小圆 + 底部尖头
white = (255, 255, 255, 255)
cx, cy = SIZE // 2, SIZE // 2

# 吸管主体（斜向）
# 用一条粗的圆角线从右上到左下
import math
angle = math.radians(45)
length = 130
x1 = cx + math.cos(angle) * length / 2
y1 = cy - math.sin(angle) * length / 2
x2 = cx - math.cos(angle) * length / 2
y2 = cy + math.sin(angle) * length / 2

# 画粗线（圆头）
line_width = 16
d.line([(x1, y1), (x2, y2)], fill=white, width=line_width)
# 圆头
d.ellipse([x1 - line_width/2, y1 - line_width/2, x1 + line_width/2, y1 + line_width/2], fill=white)
d.ellipse([x2 - line_width/2, y2 - line_width/2, x2 + line_width/2, y2 + line_width/2], fill=white)

# 顶部橡胶球（右上端）：稍大的圆
ball_r = 22
d.ellipse([x1 - ball_r, y1 - ball_r, x1 + ball_r, y1 + ball_r], fill=white)

# 底部尖头（左下端）：三角形
tip_size = 14
# 沿着延伸方向画三角
ex = math.cos(angle)
ey = math.sin(angle)
# 尖端
tip_x = x2 - ex * 18
tip_y = y2 + ey * 18
# 垂直方向
px = -ey
py = ex
base1 = (x2 + px * tip_size, y2 + py * tip_size)
base2 = (x2 - px * tip_size, y2 - py * tip_size)
d.polygon([(tip_x, tip_y), base1, base2], fill=white)

# 保存 PNG
png_path = r"d:\Ai\mimo\youqu\color-picker\build\icon-source.png"
img.save(png_path, 'PNG')

# 转 ICO（多尺寸）
ico_path = r"d:\Ai\mimo\youqu\color-picker\build\icon.ico"
img.convert('RGBA').save(ico_path, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])

print(f"PNG: {png_path}")
print(f"ICO: {ico_path}")
print("OK")
