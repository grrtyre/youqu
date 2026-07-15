# -*- coding: utf-8 -*-
"""
第六批资源：6 个缺失项目图标（疯狂扣细节模式）
严格沿用既有 gen_resources.py / gen_batch6_icons.py 风格规范：
  - frame 外框 [80,80,944,944] + 22% 圆角(190) + #007AFF 描边 + LINE_W=16 + 圆角端点
  - 1024×1024 icon-source.png + 多尺寸 PNG(16/32/64/128/256/512) + ICO
新增项目：alarm-manager / world-clock / pomodoro-manager
          / emoji-manager / unit-converter / mind-map-manager
风格：苹果白高端（极简线条、扁平、居中、留白充足、纯线性描边）
"""
import os
import math
from PIL import Image, ImageDraw

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets")
SHARED_ICONS = os.path.join(SHARED, "icons")
PROJECT_ICONS_DIR = os.path.join(SHARED_ICONS, "projects")

SRC_SIZE = 1024
SIZES = [16, 32, 64, 128, 256, 512]
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

BLUE = (0, 122, 255)        # #007AFF
WHITE = (255, 255, 255)
LINE_W = 16                 # 主线宽 @1024，与既有图标完全统一

FRAME_BOX = [80, 80, 944, 944]
FRAME_RADIUS = 190


def new_canvas():
    im = Image.new("RGB", (SRC_SIZE, SRC_SIZE), WHITE)
    d = ImageDraw.Draw(im)
    d.line_width = LINE_W
    return im, d


def draw_frame(d):
    d.rounded_rectangle(FRAME_BOX, radius=FRAME_RADIUS, outline=BLUE, width=LINE_W)


def line_round(d, points, fill=BLUE, width=LINE_W, joint="curve"):
    """画线 + 圆角端点（stroke-linecap:round 等价）"""
    if len(points) < 2:
        return
    d.line(points, fill=fill, width=width, joint=joint)
    r = width // 2
    for pt in (points[0], points[-1]):
        x, y = pt
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def rounded_rect(d, box, radius, outline=BLUE, width=LINE_W):
    d.rounded_rectangle(box, radius=radius, outline=outline, width=width)


def circle(d, cx, cy, r, outline=BLUE, width=LINE_W):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=outline, width=width)


def dot(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLUE)


def arc_points(cx, cy, r, a0, a1, n=24):
    """生成圆弧点列（角度制，0=右，逆时针为正；屏幕坐标 y 向下）"""
    pts = []
    for i in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + r * math.cos(t), cy - r * math.sin(t)))
    return pts


def save_source(im, out_path):
    im.save(out_path, "PNG", optimize=True)


def make_icon_variants(source_png, out_dir, prefix="icon"):
    os.makedirs(out_dir, exist_ok=True)
    im = Image.open(source_png).convert("RGBA")
    for s in SIZES:
        im.resize((s, s), Image.LANCZOS).save(
            os.path.join(out_dir, f"{prefix}-{s}.png"), "PNG", optimize=True
        )
    im.save(os.path.join(out_dir, f"{prefix}.ico"), format="ICO", sizes=ICO_SIZES)


# ============ 6 个项目图标 ============

def draw_alarm_manager(im, d):
    """闹钟管家：frame + 圆形表盘 + 左右小铃耳 + 10:10 指针 + 中心轴（去腿，提升精致感）"""
    draw_frame(d)
    cx, cy, r = 512, 520, 250
    # 表盘
    circle(d, cx, cy, r)
    # 顶部铃铛耳（缩小、上移，弱化卡通感）
    circle(d, 352, 300, 38)
    circle(d, 672, 300, 38)
    # 指针 10:10 —— 时针指向 10，分针指向 2
    line_round(d, [(cx, cy), (430, 452)], width=LINE_W)   # 时针
    line_round(d, [(cx, cy), (616, 436)], width=LINE_W)   # 分针
    # 中心轴
    dot(d, cx, cy, 16)


def draw_world_clock(im, d):
    """世界时钟：frame + 地球仪（圆 + 赤道 + 收窄经线椭圆）+ 时针/分针"""
    draw_frame(d)
    cx, cy, r = 512, 512, 250
    # 地球外圆
    circle(d, cx, cy, r)
    # 赤道（水平中线）
    line_round(d, [(cx - r, cy), (cx + r, cy)], width=LINE_W)
    # 中央经线（收窄竖向椭圆，避免十字准星感）
    d.ellipse([cx - 82, cy - r, cx + 82, cy + r], outline=BLUE, width=LINE_W)
    # 时针（指向 12）+ 分针（指向 3），强化“时钟”语义
    line_round(d, [(cx, cy), (cx, cy - 140)], width=LINE_W)
    line_round(d, [(cx, cy), (cx + 100, cy)], width=LINE_W)
    dot(d, cx, cy, 16)


def draw_pomodoro_manager(im, d):
    """番茄管家：frame + 番茄身 + 顶部单片宽叶 + 茎 + 番茄钟指针"""
    draw_frame(d)
    cx, cy = 512, 556
    # 番茄身（扁椭圆）
    d.ellipse([cx - 220, cy - 200, cx + 220, cy + 210], outline=BLUE, width=LINE_W)
    # 茎（顶部短竖线）
    line_round(d, [(cx, 356), (cx, 312)], width=LINE_W)
    # 单片宽叶（三角形轮廓，小尺寸下更易辨识）
    line_round(d, [(cx - 82, 356), (cx, 286), (cx + 82, 356), (cx - 82, 356)], width=LINE_W, joint="curve")
    # 内部番茄钟指针：时针向上、分针向右
    line_round(d, [(cx, cy), (cx, cy - 130)], width=LINE_W)
    line_round(d, [(cx, cy), (cx + 120, cy)], width=LINE_W)
    dot(d, cx, cy, 16)


def draw_emoji_manager(im, d):
    """表情管家：frame + 圆脸 + 两眼（实心点）+ 微笑弧"""
    draw_frame(d)
    cx, cy, r = 512, 512, 320
    # 脸（放大，增强视觉重量）
    circle(d, cx, cy, r)
    # 双眼
    dot(d, 404, 444, 26)
    dot(d, 620, 444, 26)
    # 微笑弧（下半弧，开口向上）
    pts = arc_points(cx, cy + 6, 180, 205, 335, n=22)
    line_round(d, pts, width=LINE_W)


def draw_unit_converter(im, d):
    """单位转换：frame + 上下两条半圆箭头（垂直错位，箭头统一）"""
    draw_frame(d)
    cx = 512
    rt = 180  # 上弧半径
    rb = 180  # 下弧半径
    cyt = 488  # 上弧圆心（上移）
    cyb = 552  # 下弧圆心（下移）
    # 上弧：从左到右，过顶部
    top = arc_points(cx, cyt, rt, 180, 0, n=28)
    line_round(d, top, width=LINE_W)
    # 上弧右端箭头（指向右下，统一尺寸）
    ex, ey = top[-1]
    line_round(d, [(ex - 52, ey - 30), (ex, ey), (ex - 12, ey + 54)], width=LINE_W, joint="curve")
    # 下弧：从右到左，过底部
    bot = arc_points(cx, cyb, rb, 0, 180, n=28)
    line_round(d, bot, width=LINE_W)
    # 下弧左端箭头（指向左上，统一尺寸）
    sx, sy = bot[-1]
    line_round(d, [(sx + 52, sy + 30), (sx, sy), (sx + 12, sy - 54)], width=LINE_W, joint="curve")


def draw_mind_map_manager(im, d):
    """思维导图：frame + 中心大节点（主体）+ 三个小分支节点 + 连接线"""
    draw_frame(d)
    cx, cy = 512, 512
    # 三个分支节点位置（外移，给中心留主体空间）
    branches = [(288, 312), (736, 312), (512, 792)]
    # 连接线（先画，被节点圆覆盖端点更干净）
    for bx, by in branches:
        line_round(d, [(cx, cy), (bx, by)], width=LINE_W)
    # 分支节点（小，弱化）
    for bx, by in branches:
        circle(d, bx, by, 50)
    # 中心节点（大 + 实心圆，确立视觉主体层级）
    circle(d, cx, cy, 92)
    dot(d, cx, cy, 28)


PROJECT_ICONS = [
    ("alarm-manager", draw_alarm_manager, "闹钟管家"),
    ("world-clock", draw_world_clock, "世界时钟"),
    ("pomodoro-manager", draw_pomodoro_manager, "番茄管家"),
    ("emoji-manager", draw_emoji_manager, "表情管家"),
    ("unit-converter", draw_unit_converter, "单位转换"),
    ("mind-map-manager", draw_mind_map_manager, "思维导图"),
]


def run():
    print("=== 第六批：6 个项目图标源（苹果白风格）===")
    for proj, fn, label in PROJECT_ICONS:
        print(f"[{proj}] {label}")
        im, d = new_canvas()
        fn(im, d)
        out_dir = os.path.join(PROJECT_ICONS_DIR, proj)
        os.makedirs(out_dir, exist_ok=True)
        src = os.path.join(out_dir, "icon-source.png")
        save_source(im, src)
        make_icon_variants(src, out_dir, "icon")
        print(f"  -> {out_dir}")
    print("\n[完成] 6 个项目图标源 + 多尺寸 PNG + ICO 已生成")


if __name__ == "__main__":
    run()
