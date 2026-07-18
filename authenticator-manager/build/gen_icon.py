"""生成 authenticator-manager 应用图标
苹果白风格：#007aff 蓝色盾牌 + 白色对勾，透明背景
输出：build/icon.png (256) + build/icon.ico (16/32/48/64/128/256)
"""
import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'build')
OUT_DIR = os.path.normpath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)

ACCENT = (0, 122, 255, 255)
ACCENT_DARK = (0, 100, 220, 255)
WHITE = (255, 255, 255, 255)
SIZES = [16, 32, 48, 64, 128, 256]


def draw_shield(size):
    """绘制给定尺寸的盾牌图标"""
    # 2x 超采样获得更平滑的边缘
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 盾牌路径：上平下尖
    margin = S * 0.10
    top = margin
    bottom = S - margin
    left = margin
    right = S - margin
    cx = S / 2
    # 盾牌点：左上 -> 右上 -> 右中 -> 底部尖 -> 左中 -> 左上
    shoulder_y = top + (bottom - top) * 0.12
    side_y = top + (bottom - top) * 0.55
    tip_y = bottom
    pts = [
        (left, top),
        (right, top),
        (right, shoulder_y + (bottom - top) * 0.10),
        (cx + (right - left) * 0.18, side_y),
        (cx, tip_y),
        (cx - (right - left) * 0.18, side_y),
        (left, shoulder_y + (bottom - top) * 0.10),
    ]
    # 圆角盾牌：用 rounded_polygon 风格，先画一个稍大的填色再裁
    # PIL 没有 rounded polygon，用 polygon + 外发光模拟
    # 先画阴影
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.polygon(pts, fill=(0, 50, 120, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.025))
    img.alpha_composite(shadow, (0, int(S * 0.02)))

    # 主体填色（带渐变感的两层）
    d.polygon(pts, fill=ACCENT)
    # 顶部高光：在盾牌上半部分叠一层更亮的蓝
    highlight = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    hd.polygon([
        (left, top),
        (right, top),
        (right, shoulder_y + (bottom - top) * 0.06),
        (cx + (right - left) * 0.10, side_y * 0.75),
        (cx - (right - left) * 0.10, side_y * 0.75),
        (left, shoulder_y + (bottom - top) * 0.06),
    ], fill=(60, 160, 255, 90))
    img.alpha_composite(highlight)

    # 对勾（白色，居中偏上）
    cw = S * 0.10  # 线宽
    p1 = (cx - S * 0.18, side_y * 0.78)
    p2 = (cx - S * 0.04, side_y * 0.95)
    p3 = (cx + S * 0.22, side_y * 0.55)
    d.line([p1, p2], fill=WHITE, width=int(cw), joint='curve')
    d.line([p2, p3], fill=WHITE, width=int(cw), joint='curve')
    # 对勾端点圆头
    r = int(cw / 2)
    for p in (p1, p2, p3):
        d.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], fill=WHITE)

    # 缩小回目标尺寸
    return img.resize((size, size), Image.LANCZOS)


def main():
    images = []
    for s in SIZES:
        im = draw_shield(s)
        images.append(im)
        if s == 256:
            png_path = os.path.join(OUT_DIR, 'icon.png')
            im.save(png_path)
            print(f'  saved {png_path}')

    ico_path = os.path.join(OUT_DIR, 'icon.ico')
    # ico 第一个图为最大尺寸，PIL 会自动嵌入所有尺寸
    images[0].save(ico_path, format='ICO', sizes=[(s, s) for s in SIZES], append_images=images[1:])
    # 重新保存确保多尺寸
    images[-1].save(ico_path, format='ICO', sizes=[(s, s) for s in SIZES])
    print(f'  saved {ico_path} sizes={SIZES}')
    print('OK')


if __name__ == '__main__':
    main()
