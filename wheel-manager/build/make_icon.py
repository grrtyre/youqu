# -*- coding: utf-8 -*-
# 生成抽签转盘管家图标 icon.ico
# 苹果白风格：圆形转盘 + 多彩扇区 + 顶部指针
import math
import os
from PIL import Image, ImageDraw, ImageFont

PALETTE = [
    (0, 122, 255),    # 蓝
    (255, 149, 0),    # 橙
    (52, 199, 89),    # 绿
    (255, 45, 85),    # 粉
    (88, 86, 214),    # 靛
    (175, 82, 222),   # 紫
    (90, 200, 250),   # 青
    (255, 204, 0),    # 黄
]

def draw_icon(size: int) -> Image.Image:
    # 透明背景，圆角方形画布
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size / 2.0
    # 外圈背景圆（白色 + 细描边）
    r_outer = size * 0.46
    pad = max(2, int(size * 0.02))
    # 背景白圆 + 阴影感（用渐变环模拟）
    for i in range(8, 0, -1):
        alpha = 12
        d.ellipse(
            [cx - r_outer - i, cy - r_outer - i, cx + r_outer + i, cy + r_outer + i],
            fill=(0, 0, 0, alpha),
        )
    d.ellipse(
        [cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
        fill=(255, 255, 255, 255),
        outline=(0, 0, 0, 30),
        width=max(1, int(size * 0.008)),
    )
    # 转盘扇区
    r_wheel = r_outer * 0.86
    n = len(PALETTE)
    start = -90.0  # 从顶部开始
    for i, color in enumerate(PALETTE):
        a0 = start + i * (360.0 / n)
        a1 = start + (i + 1) * (360.0 / n)
        d.pieslice(
            [cx - r_wheel, cy - r_wheel, cx + r_wheel, cy + r_wheel],
            a0, a1,
            fill=color + (255,),
            outline=(255, 255, 255, 180),
            width=max(1, int(size * 0.006)),
        )
    # 中心白色圆
    r_center = r_wheel * 0.26
    d.ellipse(
        [cx - r_center, cy - r_center, cx + r_center, cy + r_center],
        fill=(255, 255, 255, 255),
        outline=(0, 0, 0, 25),
        width=max(1, int(size * 0.005)),
    )
    # 中心蓝色小点（呼应 accent）
    r_dot = r_center * 0.42
    d.ellipse(
        [cx - r_dot, cy - r_dot, cx + r_dot, cy + r_dot],
        fill=(0, 122, 255, 255),
    )
    # 顶部指针（三角）
    pw = r_outer * 0.16
    ph = r_outer * 0.30
    tip_y = cy - r_outer - ph * 0.15
    base_y = cy - r_outer + ph * 0.15
    d.polygon(
        [(cx, tip_y), (cx - pw, base_y), (cx + pw, base_y)],
        fill=(255, 255, 255, 255),
        outline=(0, 0, 0, 40),
    )
    return img


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_ico = os.path.join(here, "icon.ico")
    out_png = os.path.join(here, "icon-source.png")
    sizes = [256, 128, 64, 48, 32, 16]
    images = [draw_icon(s) for s in sizes]
    # 保存源 PNG（256）
    images[0].save(out_png, "PNG")
    # 保存 ico（多尺寸）
    images[0].save(
        out_ico,
        format="ICO",
        sizes=[(s, s) for s in sizes],
    )
    print("OK icon.ico ->", out_ico)


if __name__ == "__main__":
    main()
