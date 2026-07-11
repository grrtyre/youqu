# Python PIL - 便签管家图标生成脚本
# 生成 256x256 应用图标，转换为 .ico 多尺寸

from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(output_path):
    size = 256
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角背景（苹果白风格）
    margin = 20
    radius = 48
    # 浅蓝渐变底色
    for y in range(margin, size - margin):
        ratio = (y - margin) / (size - 2 * margin)
        r = int(255 - ratio * 10)
        g = int(250 - ratio * 5)
        b = int(255)
        draw.line([(margin, y), (size - margin - 1, y)], fill=(r, g, b, 255))

    # 圆角裁剪
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=radius, fill=255)
    img.putalpha(mask)

    # 便签图标 - 蓝色描边
    blue = (0, 122, 255, 255)
    light_blue = (0, 122, 255, 60)
    white = (255, 255, 255, 255)

    # 便签主体
    note_x1, note_y1 = 56, 70
    note_x2, note_y2 = 200, 210
    note_radius = 16

    # 阴影
    shadow_offset = 4
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        [note_x1 + shadow_offset, note_y1 + shadow_offset, note_x2 + shadow_offset, note_y2 + shadow_offset],
        radius=note_radius, fill=(0, 0, 0, 30)
    )
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    # 主便签（白色）
    draw.rounded_rectangle([note_x1, note_y1, note_x2, note_y2], radius=note_radius, fill=white)

    # 第二张便签（轻微偏移，层叠效果）
    offset = 8
    draw.rounded_rectangle(
        [note_x1 - offset, note_y1 - offset + 4, note_x2 - offset, note_y2 - offset + 4],
        radius=note_radius, fill=(227, 240, 255, 255)
    )
    # 重新画白色主便签在上面
    draw.rounded_rectangle([note_x1, note_y1, note_x2, note_y2], radius=note_radius, fill=white)

    # 顶部夹子装饰
    clip_x = size // 2
    clip_y = note_y1 - 2
    draw.rounded_rectangle([clip_x - 14, clip_y - 18, clip_x + 14, clip_y + 8], radius=6, fill=blue)

    # 便签上的横线（模拟文字）
    line_color = (0, 122, 255, 180)
    line_start_x = note_x1 + 20
    line_end_x = note_x2 - 20
    line_y = note_y1 + 40
    for i in range(4):
        y = line_y + i * 22
        end_x = line_end_x if i < 2 else line_end_x - 30  # 最后一行短一些
        draw.line([(line_start_x, y), (end_x, y)], fill=line_color, width=4)

    # 蓝色加号（新建按钮暗示）
    plus_size = 28
    plus_x = note_x2 - 24
    plus_y = note_y2 - 24
    draw.ellipse([plus_x - plus_size//2, plus_y - plus_size//2, plus_x + plus_size//2, plus_y + plus_size//2], fill=blue)
    draw.line([(plus_x - 8, plus_y), (plus_x + 8, plus_y)], fill=white, width=3)
    draw.line([(plus_x, plus_y - 8), (plus_x, plus_y + 8)], fill=white, width=3)

    # 边框
    draw.rounded_rectangle([note_x1, note_y1, note_x2, note_y2], radius=note_radius, outline=blue, width=2)

    # 保存为 ICO（多尺寸）
    img_converted = img.convert('RGBA')
    ico_sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
    img_converted.save(output_path, format='ICO', sizes=ico_sizes)
    print(f'图标已保存: {output_path}')

    # 同时保存 PNG 预览
    png_path = output_path.replace('.ico', '-source.png')
    img_converted.save(png_path, format='PNG')
    print(f'PNG 预览: {png_path}')

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output = os.path.join(script_dir, 'icon.ico')
    make_icon(output)
