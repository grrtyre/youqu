"""生成 API管家 图标：苹果白风格 + 蓝色 API 标识"""
from PIL import Image, ImageDraw, ImageFilter
import os

out_dir = r"d:\Ai\mimo\youqu\api-manager\build"
os.makedirs(out_dir, exist_ok=True)

size = 512

# 圆角方形底（苹果蓝渐变感）
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 外圈柔光
glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.rounded_rectangle([20, 20, size - 20, size - 20], radius=120, fill=(0, 122, 255, 255))
glow = glow.filter(ImageFilter.GaussianBlur(18))
img = Image.alpha_composite(img, glow)

# 主体圆角方块
draw = ImageDraw.Draw(img)
draw.rounded_rectangle([40, 40, size - 40, size - 40], radius=110, fill=(0, 122, 255, 255))

# 顶部高光
highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
hd = ImageDraw.Draw(highlight)
hd.rounded_rectangle([40, 40, size - 40, size // 2], radius=110, fill=(255, 255, 255, 60))
img = Image.alpha_composite(img, highlight)

# 白色 API 字样 + 请求勾
draw = ImageDraw.Draw(img)
# 简洁的 "API" 用几何线条表达：左大括号样式 + 箭头
# 绘制一个白色圆角"连接"图形 + 箭头，象征请求
cx, cy = size // 2, size // 2
# 三条横线模拟请求/响应
lw = 18
# 第一条（短）
draw.rounded_rectangle([cx - 130, cy - 90, cx + 60, cy - 90 + lw], radius=9, fill=(255, 255, 255, 255))
# 第二条（长）
draw.rounded_rectangle([cx - 130, cy - lw // 2, cx + 130, cy + lw // 2], radius=9, fill=(255, 255, 255, 255))
# 第三条（中）
draw.rounded_rectangle([cx - 130, cy + 90 - lw, cx + 20, cy + 90], radius=9, fill=(255, 255, 255, 255))
# 右侧箭头（发送意象）
arrow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
ad = ImageDraw.Draw(arrow)
ad.polygon([(cx + 90, cy - 40), (cx + 160, cy), (cx + 90, cy + 40)], fill=(255, 255, 255, 255))
ad.rounded_rectangle([cx + 60, cy - 9, cx + 130, cy + 9], radius=8, fill=(255, 255, 255, 255))
img = Image.alpha_composite(img, arrow)

# 保存源图与 ico
src = os.path.join(out_dir, "icon-source.png")
img.convert("RGBA").save(src, "PNG")
ico = os.path.join(out_dir, "icon.ico")
img.convert("RGBA").save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("OK", src, ico)
