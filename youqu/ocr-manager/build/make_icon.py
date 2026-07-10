# build/make_icon.py - 识字管家图标：文档 + 放大镜（OCR 主题），苹果白风格
# Usage: python build/make_icon.py
from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PNG = os.path.join(OUT_DIR, "icon-source.png")
ICON_ICO = os.path.join(OUT_DIR, "icon.ico")

SIZE = 512

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 苹果白圆角方形背景
margin = 36
radius = 116
bg = (255, 255, 255, 255)
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin],
                    radius=radius, fill=bg, outline=(0, 0, 0, 28), width=2)
# 细内描边
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin],
                    radius=radius, outline=(222, 222, 226, 255), width=3)

blue = (0, 122, 255, 255)
blue_soft = (224, 239, 255, 255)
gray = (208, 209, 214, 255)
gray2 = (228, 229, 233, 255)

# 文档（白底卡片，左上偏）
doc_x1, doc_y1 = 120, 120
doc_x2, doc_y2 = 372, 372
d.rounded_rectangle([doc_x1, doc_y1, doc_x2, doc_y2],
                    radius=18, fill=(255, 255, 255, 255),
                    outline=gray, width=3)
# 文档折角
fold = 22
d.polygon([(doc_x2 - fold, doc_y1),
           (doc_x2, doc_y1 + fold),
           (doc_x2 - fold, doc_y1 + fold)], fill=(242, 243, 246, 255))
d.line([(doc_x2 - fold, doc_y1), (doc_x2 - fold, doc_y1 + fold),
        (doc_x2, doc_y1 + fold)], fill=gray, width=3)

# 文档上的文字行
line_y = doc_y1 + 70
for i in range(4):
    lx1 = doc_x1 + 36
    lx2 = doc_x2 - 36 - (20 if i == 3 else 0)
    d.rounded_rectangle([lx1, line_y, lx2, line_y + 14],
                        radius=7, fill=(gray2 if i % 2 else gray))
    line_y += 52

# 放大镜（右下角覆盖文档）
cx, cy = 360, 350
r = 78
# 镜片底（淡蓝高亮）
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=blue_soft, outline=blue, width=10)
# 镜片内反光
d.ellipse([cx - r + 16, cy - r + 16, cx - r + 44, cy - r + 44], fill=(255, 255, 255, 160))
# 把手
import math
hx1 = cx + int(r * 0.7)
hy1 = cy + int(r * 0.7)
hx2 = hx1 + 56
hy2 = hy1 + 56
d.line([(hx1, hy1), (hx2, hy2)], fill=blue, width=20)

img.save(SOURCE_PNG, format="PNG")

img_rgba = img.convert("RGBA")
img_rgba.save(ICON_ICO, format="ICO",
              sizes=[(16, 16), (32, 32), (48, 48),
                     (64, 64), (128, 128), (256, 256)])

print(f"Generated: {SOURCE_PNG}")
print(f"Generated: {ICON_ICO}")
