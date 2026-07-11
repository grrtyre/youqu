# -*- coding: utf-8 -*-
"""
正则管家 - 图标生成脚本
生成苹果白风格的蓝色圆角方形图标，含 .* 正则符号
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size=512):
    """生成图标"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方形背景 - 苹果蓝
    margin = int(size * 0.04)
    radius = int(size * 0.22)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=(0, 122, 255, 255)
    )

    # 添加细微的高光效果（顶部稍亮）
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    h_draw = ImageDraw.Draw(highlight)
    h_radius = int(size * 0.22)
    h_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=h_radius,
        fill=(255, 255, 255, 30)
    )
    # 只保留上半部分高光
    mask = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    m_draw = ImageDraw.Draw(mask)
    m_draw.rectangle([0, 0, size, size // 2], fill=(255, 255, 255, 255))
    highlight = Image.composite(highlight, Image.new('RGBA', (size, size), (0, 0, 0, 0)), mask)
    img = Image.alpha_composite(img, highlight)

    draw = ImageDraw.Draw(img)

    # 绘制 .* 文字
    text = ".*"
    font_size = int(size * 0.48)

    # 尝试加载字体
    font = None
    font_paths = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue

    if font is None:
        font = ImageFont.load_default()

    # 计算文字位置（居中）
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1] - int(size * 0.03)

    # 绘制白色文字
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    return img


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # 生成大尺寸图标
    icon = create_icon(512)

    # 保存 PNG 源文件
    png_path = os.path.join(script_dir, "icon-source.png")
    icon.save(png_path)
    print(f"已保存 PNG: {png_path}")

    # 保存为 ICO（多尺寸）
    ico_path = os.path.join(script_dir, "icon.ico")
    icon_converted = icon.convert('RGBA')
    icon_converted.save(
        ico_path,
        format='ICO',
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print(f"已保存 ICO: {ico_path}")

    # 验证
    if os.path.exists(ico_path):
        size = os.path.getsize(ico_path)
        print(f"ICO 文件大小: {size} 字节")
    if os.path.exists(png_path):
        size = os.path.getsize(png_path)
        print(f"PNG 文件大小: {size} 字节")


if __name__ == '__main__':
    main()
