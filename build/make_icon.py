# 生成磁盘管家图标 - 苹果白风格磁盘柱状图
from PIL import Image, ImageDraw, ImageFilter
import os

SIZE = 512

def make_icon(out_path):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角背景（白色 + 细边）
    margin = 24
    bg_radius = 96
    # 阴影层
    shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([margin+6, margin+10, SIZE-margin+6, SIZE-margin+10], radius=bg_radius, fill=(0, 0, 0, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))
    img.alpha_composite(shadow)
    # 主体白底
    d.rounded_rectangle([margin, margin, SIZE-margin, SIZE-margin], radius=bg_radius, fill=(255, 255, 255, 255))
    # 细边
    d.rounded_rectangle([margin, margin, SIZE-margin, SIZE-margin], radius=bg_radius, outline=(230, 230, 235, 255), width=2)

    # 绘制磁盘柱状图（三根柱子，蓝色系，体现"空间分析"）
    bar_area_x = margin + 80
    bar_area_y = margin + 110
    bar_area_w = SIZE - 2 * margin - 160
    bar_area_h = SIZE - 2 * margin - 200

    # 基线
    base_y = bar_area_y + bar_area_h
    d.line([bar_area_x - 10, base_y, bar_area_x + bar_area_w + 10, base_y], fill=(220, 220, 225, 255), width=3)

    # 三根柱子
    bar_w = bar_area_w // 4
    gap = (bar_area_w - bar_w * 3) // 2
    bars = [
        (0.55, (0, 122, 255, 255)),    # 蓝
        (0.85, (90, 200, 250, 255)),   # 浅蓝
        (0.40, (52, 199, 89, 255)),    # 绿
    ]
    for i, (ratio, color) in enumerate(bars):
        bx = bar_area_x + i * (bar_w + gap)
        bh = int(bar_area_h * ratio)
        by = base_y - bh
        # 柱子（顶部圆角）
        r = min(bar_w // 2, 14)
        d.rounded_rectangle([bx, by, bx + bar_w, by + r * 2], radius=r, fill=color)
        d.rectangle([bx, by + r, bx + bar_w, base_y], fill=color)
        d.rectangle([bx, by + r, bx + bar_w, base_y], fill=color)
        # 重新画圆角顶 + 直角底
        d.rounded_rectangle([bx, by, bx + bar_w, base_y + 6], radius=r, fill=color)
        d.rectangle([bx, by + r, bx + bar_w, base_y], fill=color)

    # 顶部标题小点（仿 macOS 窗口红黄绿）—— 体现"管家"桌面应用感
    dot_y = margin + 40
    dot_r = 8
    dot_colors = [(255, 95, 86, 255), (255, 189, 46, 255), (39, 201, 63, 255)]
    for i, c in enumerate(dot_colors):
        dx = margin + 44 + i * 26
        d.ellipse([dx, dot_y, dx + dot_r * 2, dot_y + dot_r * 2], fill=c)

    img.save(out_path, 'PNG')
    print('saved', out_path, img.size)

def to_ico(src_png, ico_path):
    img = Image.open(src_png).convert('RGBA')
    img.save(ico_path, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    print('saved', ico_path)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    src = os.path.join(here, 'icon-source.png')
    ico = os.path.join(here, 'icon.ico')
    make_icon(src)
    to_ico(src, ico)
