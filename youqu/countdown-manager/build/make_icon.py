# -*- coding: utf-8 -*-
"""生成倒计时管家图标：从 AI 生图 API 下载源图，转 ICO。"""
import os
import sys
import urllib.request
import urllib.parse

try:
    from PIL import Image
except ImportError:
    print("PIL not installed, installing...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

# 图标源图 prompt：日历 + 倒计时，苹果白扁平风
prompt = "app icon, minimal flat design, calendar with countdown number, blue accent, white background, iOS style, centered, clean, no text"
encoded = urllib.parse.quote(prompt)
url = f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={encoded}&image_size=square_hd"

src_path = os.path.join(HERE, "icon-source.png")
print("Downloading icon from:", url)
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    with open(src_path, "wb") as f:
        f.write(data)
    print("Saved:", src_path, len(data), "bytes")
except Exception as e:
    print("Download failed:", e)
    # 生成纯色占位图标作为兜底
    img = Image.new("RGBA", (256, 256), (0, 122, 255, 255))
    img.save(src_path)
    print("Using fallback placeholder icon")

# 转 ICO
ico_path = os.path.join(HERE, "icon.ico")
img = Image.open(src_path).convert("RGBA")
# 居中裁剪为正方形
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))
img = img.resize((256, 256), Image.LANCZOS)
img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("Saved ICO:", ico_path)
