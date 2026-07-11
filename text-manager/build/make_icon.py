"""文本管家图标生成脚本
运行: python build/make_icon.py
生成: build/icon-source.png + build/icon.ico
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SIZE = 512

def rounded_rect(draw, xy, radius, fill):
    draw.rounded_rectangle(xy, radius=radius, fill=fill)

def main():
    # 高分辨率画布
    S = SIZE
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 外层柔和阴影
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([20, 28, S - 20, S - 12], radius=110, fill=(0, 122, 255, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # 主背景圆角方块（苹果蓝渐变感，用纯色 + 高光）
    margin = 24
    rounded_rect(draw, [margin, margin, S - margin, S - margin], radius=104, fill=(0, 122, 255, 255))

    # 顶部高光（淡白色半透明圆角条）
    hi = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hi)
    hd.rounded_rectangle([margin + 18, margin + 18, S - margin - 18, margin + 130], radius=80, fill=(255, 255, 255, 45))
    img = Image.alpha_composite(img, hi)
    draw = ImageDraw.Draw(img)

    # 三条白色文本行
    line_color = (255, 255, 255, 255)
    left = margin + 70
    right = S - margin - 70
    # 第 1 行（短）
    draw.rounded_rectangle([left, 168, left + 240, 200], radius=14, fill=line_color)
    # 第 2 行（长）
    draw.rounded_rectangle([left, 232, right, 264], radius=14, fill=line_color)
    # 第 3 行（中）
    draw.rounded_rectangle([left, 296, left + 320, 328], radius=14, fill=line_color)
    # 第 4 行（最短，表示段落末尾）
    draw.rounded_rectangle([left, 360, left + 160, 392], radius=14, fill=(255, 255, 255, 220))

    # 保存 PNG 源文件
    src_path = os.path.join(OUT_DIR, 'icon-source.png')
    img.save(src_path, 'PNG')
    print('saved:', src_path)

    # 转 ICO（多尺寸）
    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    img.save(ico_path, format='ICO',
             sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('saved:', ico_path)

if __name__ == '__main__':
    main()
