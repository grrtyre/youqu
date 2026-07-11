# -*- coding: utf-8 -*-
# make_icon.py - 程序化生成置顶管家图标（苹果白风格图钉）
# 4x 超采样后 LANCZOS 降采样，获得平滑抗锯齿边缘
import os
import math

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    raise SystemExit("缺少 Pillow，请先 pip install Pillow")

S = 1024  # 超采样尺寸
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

BLUE = (0, 122, 255, 255)
BLUE_DARK = (0, 98, 204, 255)
WHITE = (255, 255, 255, 255)
BORDER = (0, 0, 0, 14)      # 边框 rgba(0,0,0,0.055)
HILITE = (255, 255, 255, 90)


def round_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def main():
    # 透明画布
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 背景圆角白底
    pad = 24
    round_rect(d, [pad, pad, S - pad, S - pad], radius=232, fill=WHITE)
    # 细边框（用一个稍大的圆角描边模拟）
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=232, outline=BORDER, width=4)

    # ---- 图钉 ----
    cx = S // 2

    # 针（三角形，从头部底部收窄到一点）
    head_cy = 470
    head_r = 215
    needle_top_w = 120
    needle_tip_y = 870
    needle = [
        (cx - needle_top_w, head_cy + head_r - 30),
        (cx + needle_top_w, head_cy + head_r - 30),
        (cx, needle_tip_y),
    ]
    d.polygon(needle, fill=BLUE_DARK)

    # 针与头连接处的小过渡圆
    d.ellipse([cx - needle_top_w, head_cy + head_r - 70,
               cx + needle_top_w, head_cy + head_r + 10], fill=BLUE_DARK)

    # 头部主圆（带轻微渐变：先画稍暗底，再画亮色上半）
    d.ellipse([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r], fill=BLUE)

    # 头部下沿暗边（增强立体感）
    d.arc([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
          start=20, end=160, fill=BLUE_DARK, width=10)

    # 头部高光（左上椭圆）
    hl_rx, hl_ry = 95, 70
    hl_cx, hl_cy = cx - 70, head_cy - 80
    hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.ellipse([hl_cx - hl_rx, hl_cy - hl_ry, hl_cx + hl_rx, hl_cy + hl_ry], fill=HILITE)
    hl = hl.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, hl)
    d = ImageDraw.Draw(img)

    # 中心小圆点（图钉顶面）
    dot_r = 34
    d.ellipse([cx - dot_r, head_cy - dot_r - 6, cx + dot_r, head_cy + dot_r - 6], fill=BLUE_DARK)

    # 降采样到目标尺寸
    out256 = img.resize((256, 256), Image.LANCZOS)
    out256.save(os.path.join(OUT_DIR, "icon-source.png"), format="PNG")

    # 生成 ico（多尺寸，用 256 源图确保包含 256x256）
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    out256.save(os.path.join(OUT_DIR, "icon.ico"), format="ICO", sizes=ico_sizes)

    print("OK: icon-source.png + icon.ico generated in", OUT_DIR)


if __name__ == "__main__":
    main()
