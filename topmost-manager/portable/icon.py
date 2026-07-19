# -*- coding: utf-8 -*-
"""icon.py —— 用 PIL 生成托盘图标（苹果白风格图钉）。

不读取外部图片文件，纯代码生成，便于打包成单 EXE。
"""
from __future__ import annotations

import math
from PIL import Image, ImageDraw


def make_tray_icon(size: int = 64, color: tuple = (0, 122, 255, 255)) -> Image.Image:
    """生成托盘图标：白底圆角矩形 + 蓝色图钉。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 白色圆角背景（适配深色任务栏）
    radius = size // 5
    d.rounded_rectangle(
        [(0, 0), (size - 1, size - 1)],
        radius=radius,
        fill=(255, 255, 255, 245),
    )

    cx, cy = size / 2, size / 2

    # 图钉的针（顶部短线）
    pin_top = int(cy - size * 0.32)
    pin_bot = int(cy - size * 0.05)
    pin_w = max(2, size // 22)
    d.line(
        [(cx, pin_top), (cx, pin_bot)],
        fill=(120, 120, 128, 255),
        width=pin_w,
    )

    # 图钉的头部（圆形）
    head_r = int(size * 0.22)
    d.ellipse(
        [(cx - head_r, cy - size * 0.05 - head_r),
         (cx + head_r, cy - size * 0.05 + head_r)],
        fill=color,
    )
    # 头部高光
    hl_r = max(2, head_r // 3)
    d.ellipse(
        [(cx - head_r + hl_r, cy - size * 0.05 - head_r + hl_r),
         (cx - head_r + hl_r * 2, cy - size * 0.05 - head_r + hl_r * 2)],
        fill=(255, 255, 255, 90),
    )

    # 底部底座（梯形）
    base_top = int(cy + size * 0.18)
    base_bot = int(cy + size * 0.34)
    base_w = int(size * 0.18)
    base_w2 = int(size * 0.08)
    d.polygon(
        [(cx - base_w, base_top),
         (cx + base_w, base_top),
         (cx + base_w2, base_bot),
         (cx - base_w2, base_bot)],
        fill=(90, 90, 98, 255),
    )

    return img


def make_app_icon(size: int = 256) -> Image.Image:
    """生成应用图标（更大尺寸，用于窗口图标）。"""
    return make_tray_icon(size)


def make_icon_file(path: str, sizes=(16, 32, 48, 64, 128, 256)) -> None:
    """生成多尺寸 .ico 文件。

    PIL 的 ICO 格式：传入一张大图 + sizes 列表，PIL 自动缩放生成多尺寸。
    """
    big = make_tray_icon(256)
    big.save(path, format="ICO",
             sizes=[(s, s) for s in sizes])
