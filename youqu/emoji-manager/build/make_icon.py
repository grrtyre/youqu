# build/make_icon.py — 用 PIL 绘制苹果白风格表情管家图标并转 ico
# 用法：python build/make_icon.py
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DST_ICO = os.path.join(HERE, 'icon.ico')
DST_PNG = os.path.join(HERE, 'icon-256.png')

def draw_icon(size=512):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 圆角白色背景（苹果白风格）
    pad = int(size * 0.04)
    radius = int(size * 0.22)
    bg_box = (pad, pad, size - pad, size - pad)
    # 细腻阴影：先画一个偏移的浅灰
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((pad, pad + int(size*0.015), size - pad, size - pad + int(size*0.015)),
                         radius=radius, fill=(0, 0, 0, 36))
    from PIL import ImageFilter
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(size*0.012)))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)
    # 主白色卡片
    d.rounded_rectangle(bg_box, radius=radius, fill=(255, 255, 255, 255))
    # 浅灰边
    d.rounded_rectangle(bg_box, radius=radius, outline=(229, 229, 234, 255), width=2)

    # 笑脸 emoji 字符（依赖系统字体）
    emoji = '😀'
    font = None
    font_paths = [
        'C:/Windows/Fonts/seguiemj.ttf',  # Segoe UI Emoji
        'C:/Windows/Fonts/seguisym.ttf',
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, int(size * 0.62))
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    # 计算文本居中
    try:
        bbox = d.textbbox((0, 0), emoji, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (size - tw) // 2 - bbox[0]
        ty = (size - th) // 2 - bbox[1] - int(size * 0.02)
    except Exception:
        tx = size // 4
        ty = size // 5
    d.text((tx, ty), emoji, font=font, fill=(255, 255, 255, 255))

    return img


def main():
    img = draw_icon(512)
    img = img.resize((256, 256), Image.LANCZOS)
    img.save(DST_PNG, 'PNG')
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(DST_ICO, format='ICO', sizes=sizes)
    print('OK ->', DST_ICO)
    print('OK ->', DST_PNG)


if __name__ == '__main__':
    main()
