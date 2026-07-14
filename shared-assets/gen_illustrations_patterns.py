# -*- coding: utf-8 -*-
"""
youqu 共享资源生成器 · illustrations + patterns（苹果白高端风格 · 纯 PIL 矢量手绘）
- illustrations/：空状态插画（empty-list / no-result / error / success），1024×1024
- patterns/：背景纹理（apple-white-gradient / subtle-grid / dotted），512×512 可平铺
- 风格延续 gen_resources.py：#007AFF 主色、纯白背景、纯线性描边、圆角端点
- 插画为场景级（无 frame 外框），纹理为极淡背景
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets")
ILLUS_DIR = os.path.join(SHARED, "illustrations")
PATTERN_DIR = os.path.join(SHARED, "patterns")

SRC_SIZE = 1024
BLUE = (0, 122, 255)
WHITE = (255, 255, 255)
LINE_W = 16           # 主线宽，与图标库统一
LINE_W_THIN = 8       # 次线宽（插画内部细节）

BG_LIGHT = (245, 245, 247)     # #F5F5F7 浅灰
GRAY_HINT = (232, 232, 237)    # 极淡灰（纹理用）
GRAY_GRID = (240, 240, 242)    # 网格线（比 hint 更淡）


def new_canvas(size=SRC_SIZE, bg=WHITE):
    """新建画布"""
    im = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(im)
    d.line_width = LINE_W
    return im, d


def line_round(d, points, fill=BLUE, width=LINE_W, joint="curve"):
    """画线 + 圆角端点（stroke-linecap:round 等价）"""
    if len(points) < 2:
        return
    d.line(points, fill=fill, width=width, joint=joint)
    r = width // 2
    for pt in (points[0], points[-1]):
        x, y = pt
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def dashed_line(d, p1, p2, fill=BLUE, width=LINE_W_THIN, dash=28, gap=20):
    """虚线（插画辅助元素用）"""
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    if length == 0:
        return
    ux, uy = dx / length, dy / length
    traveled = 0.0
    while traveled < length:
        seg_end = min(traveled + dash, length)
        sx, sy = x1 + ux * traveled, y1 + uy * traveled
        ex, ey = x1 + ux * seg_end, y1 + uy * seg_end
        d.line([(sx, sy), (ex, ey)], fill=fill, width=width)
        traveled = seg_end + gap


# ============ 插画：空状态（4 个）· 场景级，无 frame，留白充足 ============

def draw_empty_list(im, d):
    """空列表：打开的空纸箱（极简梯形）+ 顶部加号虚线圆，提示“添加内容”"""
    cx = 512
    # 顶部虚线圆（加号提示，半径 110）
    rcy = 270
    dashed_circle(d, (cx, rcy), 110, fill=BLUE, width=LINE_W_THIN, dash=24, gap=16)
    # 圆内加号（统一 LINE_W_THIN）
    line_round(d, [(cx, rcy - 44), (cx, rcy + 44)], width=LINE_W_THIN)
    line_round(d, [(cx - 44, rcy), (cx + 44, rcy)], width=LINE_W_THIN)

    # 纸箱主体（干净梯形，打开状态，去掉笨拙透视）
    box_top_y = 470
    box_bot_y = 790
    half_top = 170   # 顶部半宽（稍窄，透视感）
    half_bot = 220   # 底部半宽
    # 箱身（梯形）
    tl = (cx - half_top, box_top_y)
    tr = (cx + half_top, box_top_y)
    br = (cx + half_bot, box_bot_y)
    bl = (cx - half_bot, box_bot_y)
    d.line([tl, tr, br, bl, tl], fill=BLUE, width=LINE_W, joint="curve")
    # 左盖（向外翻开，简洁弧线）
    line_round(d, [tl, (tl[0] - 60, tl[1] - 60), (tl[0] + 40, tl[1] - 80), (cx, box_top_y - 70)], width=LINE_W)
    # 右盖（对称）
    line_round(d, [tr, (tr[0] + 60, tr[1] - 60), (tr[0] - 40, tr[1] - 80), (cx, box_top_y - 70)], width=LINE_W)
    # 底部虚线地面（次线，极简提示）
    dashed_line(d, (cx - half_bot - 40, box_bot_y + 30), (cx + half_bot + 40, box_bot_y + 30),
                fill=BLUE, width=5, dash=28, gap=20)


def dashed_circle(d, center, radius, fill=BLUE, width=8, dash=26, gap=18):
    """虚线圆"""
    cx, cy = center
    circumference = 2 * math.pi * radius
    n = int(circumference / (dash + gap) * 2)
    for i in range(n):
        a1 = i * (2 * math.pi / n)
        a2 = a1 + (dash / circumference) * 2 * math.pi
        if a2 - a1 > 0:
            x1 = cx + radius * math.cos(a1)
            y1 = cy + radius * math.sin(a1)
            x2 = cx + radius * math.cos(a2)
            y2 = cy + radius * math.sin(a2)
            d.line([(x1, y1), (x2, y2)], fill=fill, width=width)


def draw_no_result(im, d):
    """无结果：放大镜 + 空文档 + “—”符号"""
    # 空文档（圆角矩形，顶部折角）
    doc_left, doc_top = 300, 260
    doc_right, doc_bot = 660, 720
    fold = 80
    doc_pts = [
        (doc_left, doc_top), (doc_right - fold, doc_top),
        (doc_right, doc_top + fold), (doc_right, doc_bot),
        (doc_left, doc_bot), (doc_left, doc_top),
    ]
    d.line(doc_pts, fill=BLUE, width=LINE_W, joint="curve")
    # 折角线
    d.line([(doc_right - fold, doc_top), (doc_right - fold, doc_top + fold),
            (doc_right, doc_top + fold)], fill=BLUE, width=LINE_W, joint="curve")
    # 文档内“—”（表示空）
    line_round(d, [(doc_left + 90, 470), (doc_right - 90, 470)], width=LINE_W_THIN)
    # 文档内两条占位虚线（次线，极淡提示曾有内容但为空）
    dashed_line(d, (doc_left + 90, 540), (doc_right - 90, 540), fill=BLUE, width=5, dash=24, gap=18)
    dashed_line(d, (doc_left + 90, 600), (doc_right - 160, 600), fill=BLUE, width=5, dash=24, gap=18)

    # 放大镜（右下方，倾斜，覆盖文档右下角）
    lens_cx, lens_cy = 720, 760
    lens_r = 150
    d.ellipse([lens_cx - lens_r, lens_cy - lens_r, lens_cx + lens_r, lens_cy + lens_r],
              outline=BLUE, width=LINE_W)
    # 放大镜内“×”（无结果语义）
    m = 60
    line_round(d, [(lens_cx - m, lens_cy - m), (lens_cx + m, lens_cy + m)], width=LINE_W_THIN)
    line_round(d, [(lens_cx + m, lens_cy - m), (lens_cx - m, lens_cy + m)], width=LINE_W_THIN)
    # 手柄
    line_round(d, [(lens_cx + lens_r * 0.72, lens_cy + lens_r * 0.72),
                   (lens_cx + lens_r + 90, lens_cy + lens_r + 90)], width=LINE_W)
    # 底部虚线地面（统一装饰）
    dashed_line(d, (200, 820), (824, 820), fill=BLUE, width=6, dash=32, gap=24)


def draw_error(im, d):
    """错误状态：警告三角形 + 感叹号 + 底部虚线地面"""
    cx, cy = 512, 500
    R = 320
    angles = [-math.pi / 2, math.pi / 6, math.pi * 5 / 6]
    pts = [(cx + R * math.cos(a), cy + R * math.sin(a)) for a in angles]
    d.line([pts[0], pts[1], pts[2], pts[0]], fill=BLUE, width=LINE_W, joint="curve")
    # 端点圆角
    r = LINE_W // 2
    for p in pts:
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=BLUE)

    # 感叹号（竖线 + 圆点）
    line_round(d, [(cx, cy - 120), (cx, cy + 60)], width=LINE_W)
    d.ellipse([cx - 16, cy + 120 - 16, cx + 16, cy + 120 + 16], fill=BLUE)

    # 底部虚线地面（次线，提示“坠落/警示”场景）
    dashed_line(d, (200, 820), (824, 820), fill=BLUE, width=6, dash=32, gap=24)
    # 三角形底部到地面的连接短虚线
    dashed_line(d, (cx, 830), (cx, 870), fill=BLUE, width=5, dash=12, gap=10)


def draw_success(im, d):
    """成功状态：大圆 + 优雅勾线（转折圆润，比例更精致）"""
    cx, cy = 512, 512
    R = 300
    # 大圆（描边）
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=BLUE, width=LINE_W)
    # 勾（转折点更圆润，比例优化）
    check = [(cx - 140, cy + 20), (cx - 50, cy + 130), (cx + 170, cy - 140)]
    d.line(check, fill=BLUE, width=LINE_W, joint="curve")
    # 勾端点圆角
    r = LINE_W // 2
    for p in (check[0], check[-1]):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=BLUE)
    # 勾转折点圆角（joint=curve 已处理，额外加端点圆滑）
    d.ellipse([check[1][0] - r, check[1][1] - r, check[1][0] + r, check[1][1] + r], fill=BLUE)
    # 底部虚线地面（统一装饰）
    dashed_line(d, (200, 820), (824, 820), fill=BLUE, width=6, dash=32, gap=24)


# ============ 背景纹理（3 个）· 512×512 可平铺，极淡 ============

def make_gradient():
    """苹果白渐变：上 #FFFFFF → 下 #F5F5F7"""
    size = 512
    im = Image.new("RGB", (size, size), WHITE)
    px = im.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(255 + (245 - 255) * t)
        g = int(255 + (245 - 255) * t)
        b = int(255 + (247 - 255) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return im


def make_subtle_grid():
    """极淡网格：64px 间距，#F0F0F2 线"""
    size = 512
    im = Image.new("RGB", (size, size), WHITE)
    d = ImageDraw.Draw(im)
    grid = 64
    for x in range(0, size + 1, grid):
        d.line([(x, 0), (x, size)], fill=GRAY_GRID, width=1)
    for y in range(0, size + 1, grid):
        d.line([(0, y), (size, y)], fill=GRAY_GRID, width=1)
    return im


def make_dotted():
    """极淡点阵：32px 间距，#E8E8ED 小点"""
    size = 512
    im = Image.new("RGB", (size, size), WHITE)
    d = ImageDraw.Draw(im)
    spacing = 32
    dot_r = 2
    for y in range(spacing // 2, size, spacing):
        for x in range(spacing // 2, size, spacing):
            d.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=GRAY_HINT)
    return im


# ============ 注册表与执行 ============
ILLUSTRATIONS = [
    ("empty-list", draw_empty_list),
    ("no-result", draw_no_result),
    ("error", draw_error),
    ("success", draw_success),
]


def run():
    os.makedirs(ILLUS_DIR, exist_ok=True)
    os.makedirs(PATTERN_DIR, exist_ok=True)

    print("=== illustrations/ 空状态插画（4个）===")
    for name, fn in ILLUSTRATIONS:
        print(f"[{name}]")
        im, d = new_canvas()
        fn(im, d)
        out = os.path.join(ILLUS_DIR, f"{name}.png")
        im.save(out, "PNG", optimize=True)
        # 缩略图 256 供列表用
        im.resize((256, 256), Image.LANCZOS).save(
            os.path.join(ILLUS_DIR, f"{name}-thumb.png"), "PNG", optimize=True)
        print(f"  [OK] -> {out} (1024) + thumb (256)")

    print("\n=== patterns/ 背景纹理（3个）===")
    for name, fn in [("apple-white-gradient", make_gradient),
                     ("subtle-grid", make_subtle_grid),
                     ("dotted", make_dotted)]:
        print(f"[{name}]")
        im = fn()
        out = os.path.join(PATTERN_DIR, f"{name}.png")
        im.save(out, "PNG", optimize=True)
        print(f"  [OK] -> {out} (512×512 可平铺)")


if __name__ == "__main__":
    run()
