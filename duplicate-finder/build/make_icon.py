"""生成清重管家应用图标：蓝色渐变圆角方块 + 两个重叠白色文档（代表重复文件）"""
from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 256
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 蓝色渐变背景（从 #5ac8fa 到 #007aff，对角线渐变）
# 先画一个圆角方块底，再用渐变覆盖
radius = 56
# 渐变：逐行填充
top_color = (90, 200, 250)   # #5ac8fa
bot_color = (0, 122, 255)    # #007aff
gradient = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
gd = ImageDraw.Draw(gradient)
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = int(top_color[0] + (bot_color[0] - top_color[0]) * t)
    g = int(top_color[1] + (bot_color[1] - top_color[1]) * t)
    b = int(top_color[2] + (bot_color[2] - top_color[2]) * t)
    gd.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

# 用圆角方块 mask
mask = Image.new('L', (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, fill=255)
img.paste(gradient, (0, 0), mask)

# 画两个重叠的白色文档形状（一个偏左上，一个偏右下，错开代表"重复"）
white = (255, 255, 255, 255)
white_dim = (255, 255, 255, 180)  # 后面那个稍透明，做出层次

doc_w, doc_h = 92, 116
doc_r = 14

# 文档 1（左上，靠后，稍透明）
cx1, cy1 = SIZE//2 - 26, SIZE//2 - 18
d.rounded_rectangle([cx1 - doc_w//2, cy1 - doc_h//2, cx1 + doc_w//2, cy1 + doc_h//2],
                    radius=doc_r, fill=white_dim)
# 文档 1 的折角（右上角）
fold = 18
fx1 = cx1 + doc_w//2 - fold
fy1 = cy1 - doc_h//2
d.polygon([(fx1, fy1), (cx1 + doc_w//2, fy1), (cx1 + doc_w//2, fy1 + fold)],
          fill=(255, 255, 255, 130))
# 文档 1 内部线条（内容线）
line_color = (0, 122, 255, 90)
for i, off in enumerate([-30, -10, 10]):
    ly = cy1 + off
    d.rounded_rectangle([cx1 - 28, ly - 3, cx1 + 22, ly + 3], radius=3, fill=line_color)

# 文档 2（右下，靠前，不透明）
cx2, cy2 = SIZE//2 + 26, SIZE//2 + 18
d.rounded_rectangle([cx2 - doc_w//2, cy2 - doc_h//2, cx2 + doc_w//2, cy2 + doc_h//2],
                    radius=doc_r, fill=white)
# 文档 2 的折角
fx2 = cx2 + doc_w//2 - fold
fy2 = cy2 - doc_h//2
d.polygon([(fx2, fy2), (cx2 + doc_w//2, fy2), (cx2 + doc_w//2, fy2 + fold)],
          fill=(220, 230, 245, 255))
# 文档 2 内部线条
line_color2 = (0, 122, 255, 120)
for i, off in enumerate([-30, -10, 10]):
    ly = cy2 + off
    d.rounded_rectangle([cx2 - 28, ly - 3, cx2 + 22, ly + 3], radius=3, fill=line_color2)

# 加一点轻微的投影感（让两个文档有立体）
# 用模糊副本偏移叠加
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle([cx2 - doc_w//2 + 3, cy2 - doc_h//2 + 4,
                       cx2 + doc_w//2 + 3, cy2 + doc_h//2 + 4],
                      radius=doc_r, fill=(0, 0, 0, 50))
shadow = shadow.filter(ImageFilter.GaussianBlur(radius=6))
# 把 shadow 放到 img 下面（重画一遍）
final = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
fd = ImageDraw.Draw(final)
fd.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=radius, fill=(0, 122, 255, 255))
final.paste(gradient, (0, 0), mask)
final.alpha_composite(shadow)
final.alpha_composite(img)

# 保存 PNG
png_path = r"d:\Ai\mimo\youqu\duplicate-finder\build\icon-source.png"
final.save(png_path, 'PNG')

# 转 ICO（多尺寸）
ico_path = r"d:\Ai\mimo\youqu\duplicate-finder\build\icon.ico"
final.convert('RGBA').save(ico_path, format='ICO',
                          sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])

print(f"PNG: {png_path}")
print(f"ICO: {ico_path}")
print("OK")
