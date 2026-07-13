"""
图标生成脚本：纪念日管家 - 用 AI 生成的源图，裁剪+缩放后转 ICO
依赖：Pillow
"""
import os
import sys
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(BASE)
SRC_PNG = os.path.join(BASE, "icon-source.png")
ICO_PATH = os.path.join(BASE, "icon.ico")

PROMPT = (
    "A minimal app icon for an anniversary and birthday reminder app, "
    "single rounded square tile, soft Apple-style gradient background "
    "from #ff6b8a to #ff9500 (warm pink to orange), "
    "a clean white envelope with a small heart seal in the center, "
    "subtle drop shadow, modern iOS design aesthetic, "
    "high detail, centered composition, no text"
)


def fetch_source():
    if os.path.exists(SRC_PNG) and os.path.getsize(SRC_PNG) > 5000:
        print(f"[skip] source exists: {SRC_PNG}")
        return
    url = (
        "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image"
        "?prompt=" + urllib.parse.quote(PROMPT) +
        "&image_size=square_hd"
    )
    print(f"[fetch] downloading AI icon source ...")
    req = urllib.request.Request(url, headers={"User-Agent": "anniversary-manager/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    with open(SRC_PNG, "wb") as f:
        f.write(data)
    print(f"[ok] saved source: {SRC_PNG} ({len(data)} bytes)")


def make_ico():
    if not os.path.exists(SRC_PNG):
        print(f"[err] source missing: {SRC_PNG}", file=sys.stderr)
        sys.exit(1)
    img = Image.open(SRC_PNG).convert("RGBA")

    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((512, 512), Image.LANCZOS)

    mask = Image.new("L", (512, 512), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, 512, 512), radius=112, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    rounded = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask)
    img = rounded

    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ICO_PATH, format="ICO", sizes=sizes)
    print(f"[ok] generated ICO: {ICO_PATH}")


if __name__ == "__main__":
    fetch_source()
    make_ico()
