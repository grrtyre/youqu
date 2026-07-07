"""
图标生成脚本：用 AI 生成的源图，裁剪+缩放后转 ICO
依赖：Pillow
"""
import os
import sys
import urllib.request
from PIL import Image, ImageDraw, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(BASE)
SRC_PNG = os.path.join(BASE, "icon-source.png")
ICO_PATH = os.path.join(BASE, "icon.ico")

PROMPT = (
    "A minimal app icon for a habit tracker, single rounded square tile, "
    "soft Apple-style gradient background from #007aff to #00c6ff, "
    "a clean white check mark in the center, "
    "subtle drop shadow, modern iOS design aesthetic, "
    "high detail, centered composition, no text"
)


def fetch_source():
    """从 AI 生图接口下载源图"""
    if os.path.exists(SRC_PNG) and os.path.getsize(SRC_PNG) > 5000:
        print(f"[skip] 源图已存在: {SRC_PNG}")
        return
    import urllib.parse
    url = (
        "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image"
        "?prompt=" + urllib.parse.quote(PROMPT) +
        "&image_size=square_hd"
    )
    print(f"[fetch] 下载 AI 图标源图 ...")
    req = urllib.request.Request(url, headers={"User-Agent": "habit-keeper/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    with open(SRC_PNG, "wb") as f:
        f.write(data)
    print(f"[ok] 已保存源图: {SRC_PNG} ({len(data)} bytes)")


def make_ico():
    """将源图处理并生成多尺寸 ICO"""
    if not os.path.exists(SRC_PNG):
        print(f"[err] 源图不存在: {SRC_PNG}", file=sys.stderr)
        sys.exit(1)
    img = Image.open(SRC_PNG).convert("RGBA")

    # 居中正方形裁剪
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))

    # 缩放到 512x512
    img = img.resize((512, 512), Image.LANCZOS)

    # 加圆角蒙版（iOS 风格 squircle 圆角矩形）
    mask = Image.new("L", (512, 512), 0)
    draw = ImageDraw.Draw(mask)
    radius = 112
    draw.rounded_rectangle((0, 0, 512, 512), radius=radius, fill=255)
    # 轻微羽化
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    rounded = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    rounded.paste(img, (0, 0), mask)
    img = rounded

    # 保存 ICO（多尺寸）
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ICO_PATH, format="ICO", sizes=sizes)
    print(f"[ok] 已生成 ICO: {ICO_PATH}")


if __name__ == "__main__":
    fetch_source()
    make_ico()
