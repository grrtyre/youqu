# -*- coding: utf-8 -*-
"""生成计算器便携版图标 - 苹果白风格蓝色计算器"""
import os
from PIL import Image, ImageDraw, ImageFont


def make_icon(size: int = 512) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 圆角背景 - 苹果蓝
    pad = int(size * 0.06)
    radius = int(size * 0.22)
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=radius, fill=(0, 122, 255, 255))
    # 顶部显示屏区域 - 白色半透明
    scr_pad_x = int(size * 0.16)
    scr_top = int(size * 0.16)
    scr_h = int(size * 0.20)
    d.rounded_rectangle(
        [scr_pad_x, scr_top, size - scr_pad_x, scr_top + scr_h],
        radius=int(size * 0.04),
        fill=(255, 255, 255, 235),
    )
    # 显示屏里的数字
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", int(size * 0.11))
    except Exception:
        font = ImageFont.load_default()
    text = "1024"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        (size - scr_pad_x - int(size * 0.03) - tw, scr_top + (scr_h - th) // 2 - bbox[1]),
        text, font=font, fill=(0, 122, 255, 255),
    )
    # 底部按键 - 4x3 圆点矩阵
    btn_top = int(size * 0.44)
    btn_area_h = size - pad - btn_top - int(size * 0.04)
    rows, cols = 4, 3
    gap = int(size * 0.03)
    btn_w = (size - 2 * scr_pad_x - gap * (cols - 1)) / cols
    btn_h = (btn_area_h - gap * (rows - 1)) / rows
    for r in range(rows):
        for c in range(cols):
            x = scr_pad_x + c * (btn_w + gap)
            y = btn_top + r * (btn_h + gap)
            # 最后一行第一列用强调橙色，其余白色
            if r == rows - 1 and c == 0:
                fill = (255, 149, 0, 255)
            else:
                fill = (255, 255, 255, 220)
            d.rounded_rectangle([x, y, x + btn_w, y + btn_h], radius=int(btn_h * 0.3), fill=fill)
    return img


if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
    os.makedirs(out_dir, exist_ok=True)
    img = make_icon(512)
    img.save(os.path.join(out_dir, 'icon.png'))
    # 保存 ico 多尺寸
    img.convert('RGBA').save(
        os.path.join(out_dir, 'icon.ico'),
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print('icon saved to', out_dir)
