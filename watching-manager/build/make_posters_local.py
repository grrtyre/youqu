# -*- coding: utf-8 -*-
# build/make_posters_local.py — 统一风格海报
# 所有海报使用相同构图：深色渐变背景 + 单个超大字符 + 装饰光圈 + 底部标题
# 配色统一为"深沉电影感"色调，避免糖果色和饱和度过高的颜色
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo-posters')
os.makedirs(OUT_DIR, exist_ok=True)

W, H = 600, 900  # 2:3 portrait

# 每剧：(id, 深色顶, 深色底, 标题, 类型, 单字)
# 所有颜色都偏深、饱和度低，保证白色文字可读
SHOWS = [
    ('demo1',  (16, 24, 38),  (36, 52, 76),  '漫长的季节',     '电视剧', '漫'),
    ('demo2',  (38, 16, 24),  (82, 36, 44),  '繁花',           '电视剧', '繁'),
    ('demo3',  (32, 26, 18),  (72, 56, 38),  '葬送的芙莉莲',   '动漫',   '葬'),
    ('demo4',  (28, 12, 8),   (76, 28, 18),  '进击的巨人',     '动漫',   '进'),
    ('demo5',  (8, 16, 36),   (22, 38, 76),  '流浪地球',       '电影',   '流'),
    ('demo6',  (32, 22, 30),  (62, 42, 58),  '苍兰诀',         '电视剧', '苍'),
    ('demo7',  (22, 18, 38),  (52, 42, 82),  '歌手 2026',      '综艺',   '歌'),
    ('demo8',  (6, 22, 38),   (16, 48, 72),  '蓝色星球',       '纪录片', '蓝'),
    ('demo9',  (16, 22, 28),  (36, 48, 58),  '狂飙',           '电视剧', '狂'),
    ('demo10', (28, 18, 8),   (76, 50, 22),  '奥本海默',       '电影',   '奥'),
]

def gradient(img, top, bottom):
    """垂直渐变"""
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

def load_font(size, bold=True):
    """加载中文字体"""
    paths = [
        'C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/msyh.ttc',
        'C:/Windows/Fonts/simhei.ttf',
    ]
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

def add_atmosphere(img, accent_color):
    """添加统一氛围：中心光晕 + 同心圆装饰 + 暗角"""
    # 中心柔光（提升中央字符的可见度）
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    cx, cy = W // 2, H // 2 - 60
    # 中心柔光
    for r, a in [(280, 28), (200, 18), (120, 10)]:
        od.ellipse((cx - r, cy - r, cx + r, cy + r), fill=accent_color + (a,))
    overlay = overlay.filter(ImageFilter.GaussianBlur(40))
    img.paste(overlay, (0, 0), overlay)

    # 同心圆装饰
    overlay2 = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    od2 = ImageDraw.Draw(overlay2)
    for r, alpha in [(280, 22), (220, 28), (160, 36), (100, 48)]:
        od2.ellipse((cx - r, cy - r, cx + r, cy + r),
                    outline=(255, 255, 255, alpha), width=1)
    overlay2 = overlay2.filter(ImageFilter.GaussianBlur(0.6))
    img.paste(overlay2, (0, 0), overlay2)

    # 四角暗角
    vignette = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    # 顶部渐暗
    for y in range(120):
        a = int(80 * (1 - y / 120))
        vd.line([(0, y), (W, y)], fill=(0, 0, 0, a))
    # 底部渐暗
    for y in range(200):
        a = int(120 * (y / 200))
        vd.line([(0, H - 200 + y), (W, H - 200 + y)], fill=(0, 0, 0, a))
    img.paste(vignette, (0, 0), vignette)

def add_title_layout(img, title, genre, big_char):
    """统一标题布局"""
    draw = ImageDraw.Draw(img, 'RGBA')

    # 顶部类型标签
    font_label = load_font(15, bold=False)
    bbox = draw.textbbox((0, 0), genre, font=font_label)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x, pad_y = 16, 7
    box_w = tw + pad_x * 2
    box_h = th + pad_y * 2
    bx = (W - box_w) // 2
    by = 56
    # 半透明背景 + 细边
    draw.rectangle((bx, by, bx + box_w, by + box_h),
                   fill=(255, 255, 255, 28),
                   outline=(255, 255, 255, 110), width=1)
    draw.text((bx + pad_x - bbox[0], by + pad_y - bbox[1]), genre,
              fill=(255, 255, 255, 240), font=font_label)

    # 中央超大字符（统一一个字）
    font_big = load_font(280, bold=True)
    bbox = draw.textbbox((0, 0), big_char, font=font_big)
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    cx = (W - bw) // 2 - bbox[0]
    cy = H // 2 - bh // 2 - bbox[1] - 40
    # 多重阴影增强对比
    for dx, dy, a in [(4, 4, 160), (2, 2, 200), (0, 0, 100)]:
        draw.text((cx + dx, cy + dy), big_char,
                  fill=(0, 0, 0, a), font=font_big)
    # 主文字
    draw.text((cx, cy), big_char, fill=(255, 255, 255, 245), font=font_big)

    # 底部装饰短线
    line_y = H - 150
    draw.line([(W // 2 - 36, line_y), (W // 2 + 36, line_y)],
              fill=(255, 255, 255, 200), width=2)

    # 底部完整标题
    font_title = load_font(36, bold=True)
    bbox = draw.textbbox((0, 0), title, font=font_title)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (W - tw) // 2 - bbox[0]
    ty = H - 110 - bbox[1]
    # 强阴影
    draw.text((tx + 3, ty + 3), title, fill=(0, 0, 0, 200), font=font_title)
    # 主文字
    draw.text((tx, ty), title, fill=(255, 255, 255, 255), font=font_title)

def make_poster(sid, top, bot, title, genre, big_char):
    img = Image.new('RGB', (W, H), top)
    gradient(img, top, bot)
    add_atmosphere(img, bot)
    add_title_layout(img, title, genre, big_char)
    img.save(os.path.join(OUT_DIR, sid + '.png'), 'PNG', optimize=True)

for sid, top, bot, title, genre, big_char in SHOWS:
    out = os.path.join(OUT_DIR, sid + '.png')
    make_poster(sid, top, bot, title, genre, big_char)
    print('OK %s %d bytes' % (sid, os.path.getsize(out)))

print('Done')
