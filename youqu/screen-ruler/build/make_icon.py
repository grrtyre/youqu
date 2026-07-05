# 生成屏幕标尺管家图标
# 用 AI 生图 API 生成图标源图，再用 PIL 转 ico
import urllib.request
import urllib.parse
import os
from PIL import Image

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
os.makedirs(BUILD_DIR, exist_ok=True)

prompt = "A minimalist app icon for a screen ruler and protractor measurement tool, featuring a white ruler and a green angle protractor on a clean white background, Apple iOS style flat design, soft blue accent #007aff, rounded square, high-end aesthetic, centered composition, no text"
encoded = urllib.parse.quote(prompt)
url = f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={encoded}&image_size=square_hd"

source_path = os.path.join(BUILD_DIR, "icon-source.png")
ico_path = os.path.join(BUILD_DIR, "icon.ico")

print("正在生成图标源图...")
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    with open(source_path, "wb") as f:
        f.write(data)
    print(f"源图已保存: {source_path} ({len(data)} bytes)")
except Exception as e:
    print(f"生图失败: {e}")
    # 退化方案：用 PIL 生成纯色占位图标
    img = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
    img.save(source_path)
    print("使用占位图标")

print("正在转换为 ico...")
img = Image.open(source_path).convert("RGBA")
# 缩放到 256
img = img.resize((256, 256), Image.LANCZOS)
img.save(ico_path, format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(f"ICO 已保存: {ico_path}")
