"""
记账管家图标生成脚本
使用 AI 生图 API 生成图标素材，然后用 PIL 转 .ico
"""
import urllib.request
import urllib.parse
import os
import sys

try:
    from PIL import Image
except ImportError:
    print("PIL not installed, run: pip install Pillow")
    sys.exit(1)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PNG = os.path.join(OUT_DIR, "icon-source.png")
ICON_ICO = os.path.join(OUT_DIR, "icon.ico")


def generate_icon_png():
    """调用 AI 生图 API 生成 1024x1024 的图标源图"""
    prompt = (
        "App icon for an accounting/finance manager desktop app, "
        "minimalist flat design, white background, "
        "blue gradient wallet with a checkmark and a coin, "
        "rounded square shape, iOS/macOS style, "
        "clean, professional, modern, high quality, no text"
    )
    encoded = urllib.parse.quote(prompt)
    url = f"https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={encoded}&image_size=square_hd"
    print(f"[icon] requesting: {url[:120]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    print(f"[icon] received {len(data)} bytes")
    with open(SOURCE_PNG, "wb") as f:
        f.write(data)
    return SOURCE_PNG


def make_ico(source_png):
    """将 PNG 转为多尺寸 .ico"""
    img = Image.open(source_png).convert("RGBA")
    # 居中裁剪为正方形
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img.save(
        ICON_ICO,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"[icon] saved: {ICON_ICO}")


if __name__ == "__main__":
    if not os.path.exists(SOURCE_PNG) or "--regen" in sys.argv:
        generate_icon_png()
    make_ico(SOURCE_PNG)
