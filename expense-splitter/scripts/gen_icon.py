# -*- coding: utf-8 -*-
"""生成分账助手应用图标 - 苹果白风格（PIL绘制）"""
from PIL import Image, ImageDraw

SIZE = 512
SCALE = 4
s = SIZE * SCALE

img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 外层圆角方块 - 蓝色背景
radius = int(s * 0.22)
d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=(0, 122, 255, 255))

# 内部白色卡片
pad = int(s * 0.18)
card_r = int(s * 0.10)
d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=card_r, fill=(255, 255, 255, 255))

# 中央"分账"符号：两个相对的箭头，中间一条竖线
cx, cy = s // 2, s // 2
bar_w = int(s * 0.035)
# 中间竖线
d.rounded_rectangle([cx - bar_w // 2, int(s * 0.30), cx + bar_w // 2, int(s * 0.70)],
                    radius=bar_w // 2, fill=(0, 122, 255, 255))

# 左箭头（向左）
arrow_h = int(s * 0.085)
arrow_l = int(s * 0.13)
ay = cy
# 左侧横线
d.rounded_rectangle([cx - int(s * 0.34), ay - bar_w // 2, cx - int(s * 0.12), ay + bar_w // 2],
                    radius=bar_w // 2, fill=(0, 122, 255, 255))
# 左箭头三角
d.polygon([
    (cx - int(s * 0.34), ay),
    (cx - int(s * 0.22), ay - arrow_h),
    (cx - int(s * 0.22), ay + arrow_h),
], fill=(0, 122, 255, 255))

# 右箭头（向右）
d.rounded_rectangle([cx + int(s * 0.12), ay - bar_w // 2, cx + int(s * 0.34), ay + bar_w // 2],
                    radius=bar_w // 2, fill=(0, 122, 255, 255))
d.polygon([
    (cx + int(s * 0.34), ay),
    (cx + int(s * 0.22), ay - arrow_h),
    (cx + int(s * 0.22), ay + arrow_h),
], fill=(0, 122, 255, 255))

# 缩放到目标尺寸（抗锯齿）
img = img.resize((SIZE, SIZE), Image.LANCZOS)

out = r"D:\Ai\mimo\youqu\expense-splitter\assets\icon.png"
img.save(out, "PNG")
print("图标已生成:", out, img.size)

# 同时生成 ICO（多尺寸）
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(r"D:\Ai\mimo\youqu\expense-splitter\assets\icon.ico", format="ICO", sizes=ico_sizes)
print("ICO 已生成")
