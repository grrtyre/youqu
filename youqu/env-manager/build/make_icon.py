# make_icon.py - 生成环境变量管家图标（苹果白风格，程序化绘制）
# 运行：python make_icon.py
from PIL import Image, ImageDraw, ImageFilter
import os

SIZE = 512
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角方形背景（苹果蓝渐变）
RADIUS = 112
# 主体填充：从亮蓝到深蓝的对角渐变
for y in range(SIZE):
    for x in range(SIZE):
        # 圆角裁剪：到圆角中心的距离
        # 四个角的圆心
        cx = min(x, SIZE - 1 - x)
        cy = min(y, SIZE - 1 - y)
        if cx < RADIUS and cy < RADIUS:
            # 在角落区域，计算到圆角圆心的距离
            dx = RADIUS - cx
            dy = RADIUS - cy
            if dx * dx + dy * dy > RADIUS * RADIUS:
                continue  # 圆角外，透明
        # 渐变：左上亮蓝 -> 右下深蓝
        t = (x + y) / (2 * SIZE)
        r = int(0 + (0 - 0) * t)
        g = int(122 + (90 - 122) * t)
        b = int(255 + (210 - 255) * t)
        img.putpixel((x, y), (r, g, b, 255))

draw = ImageDraw.Draw(img)

# 绘制三行"变量"线条（白色，圆角）
def rounded_hline(d, x1, x2, y, h, color, r):
    d.rounded_rectangle([x1, y, x2, y + h], radius=r, fill=color)

# 第一行：变量名短条 + 值长条
rounded_hline(draw, 110, 170, 150, 16, (255, 255, 255, 255), 8)
rounded_hline(draw, 195, 402, 154, 10, (255, 255, 255, 200), 5)

# 第二行：变量名短条 + 值长条
rounded_hline(draw, 110, 170, 215, 16, (255, 255, 255, 255), 8)
rounded_hline(draw, 195, 360, 219, 10, (255, 255, 255, 200), 5)

# 第三行：变量名短条 + 值短条
rounded_hline(draw, 110, 170, 280, 16, (255, 255, 255, 255), 8)
rounded_hline(draw, 195, 300, 284, 10, (255, 255, 255, 200), 5)

# 底部一个小齿轮/勾选标记（圆形 + 勾）
# 用一个白色圆形 + 蓝色勾，表示"管理"
cx, cy, rr = 360, 360, 52
draw.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(255, 255, 255, 255))
# 蓝色勾
draw.line([(cx - 22, cy + 2), (cx - 6, cy + 20), (cx + 26, cy - 18)], fill=(0, 122, 255, 255), width=14, joint='curve')
draw.line([(cx - 22, cy + 2), (cx - 6, cy + 20)], fill=(0, 122, 255, 255), width=14)
draw.line([(cx - 6, cy + 20), (cx + 26, cy - 18)], fill=(0, 122, 255, 255), width=14)

# 轻微高光（顶部）
highlight = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
hd = ImageDraw.Draw(highlight)
hd.rounded_rectangle([40, 40, SIZE - 40, 160], radius=60, fill=(255, 255, 255, 40))
highlight = highlight.filter(ImageFilter.GaussianBlur(20))
img = Image.alpha_composite(img, highlight)

# 保存源 PNG
out_dir = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(out_dir, 'icon-source.png')
img.save(src_path, 'PNG')

# 转 ICO（多尺寸）
ico_path = os.path.join(out_dir, 'icon.ico')
img_rgba = img.convert('RGBA')
img_rgba.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print('OK icon-source.png ->', os.path.getsize(src_path), 'bytes')
print('OK icon.ico ->', os.path.getsize(ico_path), 'bytes')
