"""把 icon-source.png 转为多尺寸 icon.ico"""
from PIL import Image
import os

src = r"D:\Ai\mimo\youqu\pdf-toolbox\build\icon-source.png"
dst = r"D:\Ai\mimo\youqu\pdf-toolbox\build\icon.ico"

img = Image.open(src).convert("RGBA")
# 中心裁剪为正方形
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))
# 缩放到 256
img = img.resize((256, 256), Image.LANCZOS)

sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(dst, format="ICO", sizes=sizes)
print(f"OK: {dst} ({os.path.getsize(dst)} bytes)")
