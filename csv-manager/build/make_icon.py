# -*- coding: utf-8 -*-
# 表格管家图标生成：蓝色圆角底 + 白色表格网格 + 顶部高亮表头
# 运行：python build/make_icon.py
# 依赖：Pillow
from PIL import Image, ImageDraw
import os

SIZE = 256
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(ROOT, 'build', 'icon-source.png')
OUT_ICO = os.path.join(ROOT, 'build', 'icon.ico')

def round_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)

def main():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 蓝色圆角底（Apple 系蓝 #007aff，带渐变感用两层）
    margin = 18
    round_rect(draw, [margin, margin, SIZE - margin, SIZE - margin], 48, (0, 102, 214, 255))

    # 顶部表头深色条
    top = margin + 6
    header_h = 44
    round_rect(draw, [margin + 6, top, SIZE - margin - 6, top + header_h], 16, (0, 122, 255, 255))

    # 主体浅色表格区
    body_top = top + header_h + 4
    round_rect(draw, [margin + 6, body_top, SIZE - margin - 6, SIZE - margin - 6], 16, (255, 255, 255, 255))

    # 表格网格线
    grid_left = margin + 30
    grid_right = SIZE - margin - 30
    line_color = (0, 122, 255, 70)
    # 竖线
    col_count = 3
    col_w = (grid_right - grid_left) / col_count
    for i in range(1, col_count):
        x = grid_left + int(col_w * i)
        draw.line([x, body_top + 12, x, SIZE - margin - 18], fill=line_color, width=3)
    # 横线
    row_top = body_top + 18
    row_bottom = SIZE - margin - 18
    rows = 4
    for i in range(1, rows):
        y = row_top + int((row_bottom - row_top) / rows * i)
        draw.line([grid_left, y, grid_right, y], fill=line_color, width=3)

    # 表头内的白色短条（模拟表头文字）
    head_bar_y = top + 16
    for i in range(col_count):
        x = grid_left + int(col_w * i) + 8
        draw.rounded_rectangle([x, head_bar_y, x + int(col_w * 0.55), head_bar_y + 8], 4, (255, 255, 255, 235))

    # 第一列单元格的蓝色数据点（强调）
    dot_x = grid_left + 12
    for i in range(rows):
        y = row_top + int((row_bottom - row_top) / rows * i) - 4
        draw.ellipse([dot_x, y, dot_x + 10, y + 10], fill=(0, 122, 255, 230))

    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    img.save(OUT_PNG, 'PNG')
    print('PNG saved:', OUT_PNG)

    # 转 ICO（多尺寸）
    img_rgba = img.convert('RGBA')
    img_rgba.save(OUT_ICO, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    print('ICO saved:', OUT_ICO)

if __name__ == '__main__':
    main()
