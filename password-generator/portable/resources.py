# -*- coding: utf-8 -*-
"""resources.py - 应用图标资源

使用 PIL 自主生成苹果白风格图标：圆角方形 + 蓝色渐变 + 锁形剪影。
遵循项目约定（苹果白、#007aff 主色、圆角、扁平）。
打包时由 PyInstaller 作为 data 文件打包，运行时优先从 _MEIPASS 加载。
"""

from __future__ import annotations

import os
import sys

ICON_NAME = "icon.ico"
PNG_NAME = "icon.png"

_ICON_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def _resource_dir() -> str:
    """资源目录：PyInstaller 打包后为 _MEIPASS，开发时为本文件所在目录/build。"""
    if hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")


def icon_path() -> str:
    return os.path.join(_resource_dir(), ICON_NAME)


def png_path() -> str:
    return os.path.join(_resource_dir(), PNG_NAME)


def _draw_icon(size: int):
    """绘制单个尺寸的图标。返回 PIL.Image（RGBA）。"""
    from PIL import Image, ImageDraw, ImageFilter

    # 2x 超采样以获得更平滑边缘
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方形背景（约占 86%，留出边距）
    pad = int(s * 0.07)
    radius = int(s * 0.22)
    box = (pad, pad, s - pad, s - pad)

    # 蓝色渐变背景（#007aff → #00c6ff，对齐原版 brand-icon）
    base = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    base_draw = ImageDraw.Draw(base)
    # 用圆角蒙版
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    # 垂直渐变
    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    grad_top = (0, 122, 255, 255)
    grad_bottom = (0, 198, 255, 255)
    grad_px = grad.load()
    for y in range(s):
        t = y / (s - 1)
        r = int(grad_top[0] * (1 - t) + grad_bottom[0] * t)
        g = int(grad_top[1] * (1 - t) + grad_bottom[1] * t)
        b = int(grad_top[2] * (1 - t) + grad_bottom[2] * t)
        for x in range(s):
            grad_px[x, y] = (r, g, b, 255)
    img.paste(grad, (0, 0), mask)

    # 顶部高光（细腻内高光，Apple 质感）
    highlight = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    hl_draw = ImageDraw.Draw(highlight)
    hl_draw.rounded_rectangle(
        (pad + int(s * 0.04), pad + int(s * 0.04), s - pad - int(s * 0.04), pad + int(s * 0.32)),
        radius=int(radius * 0.7),
        fill=(255, 255, 255, 60),
    )
    img.alpha_composite(highlight)

    # 锁形剪影（白色，居中）
    draw = ImageDraw.Draw(img)
    cx = s / 2
    # 锁体（圆角矩形）
    bw = int(s * 0.42)
    bh = int(s * 0.30)
    bx1 = int(cx - bw / 2)
    by1 = int(s * 0.50)
    bx2 = bx1 + bw
    by2 = by1 + bh
    draw.rounded_rectangle((bx1, by1, bx2, by2), radius=int(s * 0.06), fill=(255, 255, 255, 255))
    # 锁环（弧形）
    rw = int(s * 0.26)
    rh = int(s * 0.22)
    rx1 = int(cx - rw / 2)
    ry1 = by1 - rh + int(s * 0.02)
    rx2 = rx1 + rw
    ry2 = ry1 + rh
    # 用环形：画粗弧
    arc_box = (rx1, ry1, rx2, ry2 + int(s * 0.04))
    draw.arc(arc_box, start=180, end=360, fill=(255, 255, 255, 255), width=int(s * 0.055))
    # 钥匙孔（小圆点）
    kw = int(s * 0.05)
    kx = int(cx - kw / 2)
    ky = int(by1 + bh * 0.35)
    draw.ellipse((kx, ky, kx + kw, ky + kw), fill=(0, 122, 255, 255))
    # 钥匙孔下方短槽
    draw.rounded_rectangle(
        (int(cx - s * 0.015), ky + kw, int(cx + s * 0.015), int(by1 + bh * 0.72)),
        radius=int(s * 0.01),
        fill=(0, 122, 255, 255),
    )

    # 缩放到目标尺寸（LANCZOS 高质量）
    return img.resize((size, size), Image.LANCZOS)


def ensure_icon() -> str:
    """确保图标存在，缺失则用 PIL 生成。返回 ico 路径。"""
    path = icon_path()
    if os.path.exists(path):
        return path
    try:
        from PIL import Image
    except ImportError:
        return ""

    os.makedirs(os.path.dirname(path), exist_ok=True)
    # 生成一张 256 大图作为源，PIL 会自动缩放到 sizes 列表中的每个尺寸
    source = _draw_icon(256)
    source.save(path, format="ICO", sizes=[(s, s) for s, _ in _ICON_SIZES])
    # 同时保存 PNG 预览（256）
    source.save(png_path(), format="PNG")
    return path


def app_qicon():
    """返回应用 QIcon，失败返回空 QIcon。"""
    from PySide6.QtGui import QIcon

    path = ensure_icon()
    icon = QIcon(path) if path else QIcon()
    return icon
