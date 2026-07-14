# -*- coding: utf-8 -*-
"""
youqu 共享资源生成器（苹果白高端风格 · 纯 PIL 矢量手绘）
- 用 PIL 几何绘制图标，保证 100% 精确 #007AFF、纯白背景、线条粗细统一
- 输出 1024×1024 icon-source.png + 多尺寸 PNG + ICO
- 风格参考 iOS 系统图标：极简线条、扁平、居中、留白充足
"""
import os
import math
from PIL import Image, ImageDraw, ImageChops

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets")
SHARED_ICONS = os.path.join(SHARED, "icons")
PROJECT_ICONS_DIR = os.path.join(SHARED_ICONS, "projects")
GENERIC_ICONS_DIR = SHARED_ICONS

SRC_SIZE = 1024
SIZES = [16, 32, 64, 128, 256, 512]
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# #007AFF 苹果系统蓝
BLUE = (0, 122, 255)
WHITE = (255, 255, 255)
LINE_W = 16  # 主线宽 @1024 尺度（约 1.56% 视觉权重，iOS 风格）

# 统一视觉容器（iOS 应用图标规范：22% 圆角，四周留白 8%）
FRAME_BOX = [80, 80, 944, 944]   # 864×864 框
FRAME_RADIUS = 190               # ≈ 22% 圆角


def new_canvas():
    """新建 1024×1024 纯白画布"""
    im = Image.new("RGB", (SRC_SIZE, SRC_SIZE), WHITE)
    d = ImageDraw.Draw(im)
    d.line_width = LINE_W
    return im, d


def draw_frame(d):
    """画统一的圆角方形外框（所有图标共用，保证视觉容器一致）"""
    d.rounded_rectangle(FRAME_BOX, radius=FRAME_RADIUS, outline=BLUE, width=LINE_W)


def line_round(d, points, fill=BLUE, width=LINE_W, joint="curve"):
    """画线 + 圆角端点（stroke-linecap:round 等价）
    在每条线段两端画填充圆（半径=width/2），消除直角切割"""
    if len(points) < 2:
        return
    d.line(points, fill=fill, width=width, joint=joint)
    r = width // 2
    # 端点画圆（首尾）
    for pt in (points[0], points[-1]):
        x, y = pt
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def rounded_rect(draw, box, radius, outline=BLUE, width=LINE_W):
    """画圆角矩形外框（描边）"""
    draw.rounded_rectangle(box, radius=radius, outline=outline, width=width)


def save_source(im, out_path):
    im.save(out_path, "PNG", optimize=True)
    print(f"  [OK] 源 -> {out_path} ({SRC_SIZE}×{SRC_SIZE})")


def make_icon_variants(source_png, out_dir, prefix="icon"):
    os.makedirs(out_dir, exist_ok=True)
    im = Image.open(source_png).convert("RGBA")
    for s in SIZES:
        im.resize((s, s), Image.LANCZOS).save(
            os.path.join(out_dir, f"{prefix}-{s}.png"), "PNG", optimize=True
        )
    im.save(os.path.join(out_dir, f"{prefix}.ico"), format="ICO", sizes=ICO_SIZES)
    print(f"  [OK] 多尺寸+ICO -> {out_dir}")


# ============ 项目图标（5 个）· 统一 frame 外框 + 内部主体 ============
def draw_anniversary(im, d):
    """纪念日：frame + 顶部挂耳 + 中心心形"""
    draw_frame(d)
    # 顶部两个挂耳（穿出 frame 顶部一点，模拟日历装订环）
    d.line([(360, 200), (360, 110)], fill=BLUE, width=LINE_W, joint="curve")
    d.line([(664, 200), (664, 110)], fill=BLUE, width=LINE_W, joint="curve")
    # 中心心形
    cx, cy = 512, 560
    heart = [
        (cx, cy + 110), (cx - 140, cy - 10), (cx - 140, cy - 90),
        (cx - 75, cy - 120), (cx - 20, cy - 95), (cx, cy - 50),
        (cx + 20, cy - 95), (cx + 75, cy - 120), (cx + 140, cy - 90),
        (cx + 140, cy - 10), (cx, cy + 110),
    ]
    d.line(heart, fill=BLUE, width=LINE_W, joint="curve")


def draw_checksum(im, d):
    """校验和：frame + 盾牌 + 勾"""
    draw_frame(d)
    shield = [
        (512, 260), (720, 340), (720, 560),
        (512, 780), (304, 560), (304, 340), (512, 260),
    ]
    d.line(shield, fill=BLUE, width=LINE_W, joint="curve")
    d.line([(400, 540), (480, 620), (650, 430)], fill=BLUE, width=LINE_W + 4, joint="curve")


def draw_hosts(im, d):
    """hosts：frame + 两台服务器（横条）"""
    draw_frame(d)
    # 上层服务器（小圆角矩形）
    rounded_rect(d, [240, 300, 784, 470], radius=32)
    d.ellipse([290, 370, 340, 420], outline=BLUE, width=LINE_W)
    d.line([(420, 395), (720, 395)], fill=BLUE, width=LINE_W // 2)
    # 下层服务器
    rounded_rect(d, [240, 540, 784, 710], radius=32)
    d.ellipse([290, 610, 340, 660], outline=BLUE, width=LINE_W)
    d.line([(420, 635), (720, 635)], fill=BLUE, width=LINE_W // 2)
    # 连接线
    d.line([(512, 470), (512, 540)], fill=BLUE, width=LINE_W)


def draw_image_converter(im, d):
    """图片转换：frame + 两张重叠图片（无方向性，统一视觉重量）"""
    draw_frame(d)
    # 后图（左上）
    rounded_rect(d, [200, 300, 600, 700], radius=32)
    d.line([(250, 620), (380, 500), (470, 590), (560, 480)], fill=BLUE, width=LINE_W, joint="curve")
    # 前图（右下，错位）
    rounded_rect(d, [440, 360, 840, 760], radius=32)
    d.line([(490, 690), (600, 580), (700, 660), (790, 540)], fill=BLUE, width=LINE_W, joint="curve")


def draw_pdf_toolbox(im, d):
    """PDF 工具箱：frame + 文档（折角）+ 扳手"""
    draw_frame(d)
    doc = [
        (320, 260), (640, 260), (760, 380), (760, 780),
        (320, 780), (320, 260),
    ]
    d.line(doc, fill=BLUE, width=LINE_W, joint="curve")
    # 折角
    d.line([(640, 260), (640, 380), (760, 380)], fill=BLUE, width=LINE_W, joint="curve")
    # 文档内两条文字线
    for y in [470, 540]:
        d.line([(400, y), (680, y)], fill=BLUE, width=LINE_W // 2)
    # 扳手（右下角，斜放）
    cx, cy = 600, 660
    d.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], outline=BLUE, width=LINE_W)
    d.line([(cx + 32, cy + 32), (700, 760)], fill=BLUE, width=LINE_W, joint="curve")


# ============ 通用功能图标（5 个）· 统一 frame + 加大中心符号 ============
def draw_settings(im, d):
    """设置：frame + 齿轮（极简，只留外环 + 8 齿 + 中心描边圆）"""
    draw_frame(d)
    cx, cy = 512, 512
    R_out = 260
    n_teeth = 8
    tooth_len = 50
    for i in range(n_teeth):
        ang = i * (2 * math.pi / n_teeth)
        x1 = cx + (R_out - tooth_len // 2) * math.cos(ang)
        y1 = cy + (R_out - tooth_len // 2) * math.sin(ang)
        x2 = cx + (R_out + tooth_len // 2) * math.cos(ang)
        y2 = cy + (R_out + tooth_len // 2) * math.sin(ang)
        d.line([(x1, y1), (x2, y2)], fill=BLUE, width=LINE_W)  # 齿线宽归一
    # 外环（描边）
    d.ellipse([cx - R_out, cy - R_out, cx + R_out, cy + R_out], outline=BLUE, width=LINE_W)
    # 中心描边小圆（不填充，与其他图标统一纯线性风格）
    d.ellipse([cx - 90, cy - 90, cx + 90, cy + 90], outline=BLUE, width=LINE_W)


def draw_search(im, d):
    """搜索：frame + 放大镜（环最大化填满 frame）"""
    draw_frame(d)
    cx, cy = 440, 440
    r = 260
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BLUE, width=LINE_W)
    # 手柄线宽归一 + 圆角端点
    line_round(d, [(cx + r * 0.72, cy + r * 0.72), (820, 820)], width=LINE_W)


def draw_close(im, d):
    """关闭：frame + X（线宽归一为 LINE_W，与其他图标完全统一）"""
    draw_frame(d)
    m = 260  # 接近 frame 内边（frame 80-944）
    line_round(d, [(m, m), (SRC_SIZE - m, SRC_SIZE - m)], width=LINE_W)
    line_round(d, [(SRC_SIZE - m, m), (m, SRC_SIZE - m)], width=LINE_W)


def draw_minimize(im, d):
    """最小化：frame + 双横线（间距 100，确保缩略图可辨；线宽归一 LINE_W）"""
    draw_frame(d)
    # 双横线，间距 100，上下对称居中（512±50），缩略图下清晰可辨
    line_round(d, [(220, 462), (804, 462)], width=LINE_W)
    line_round(d, [(220, 562), (804, 562)], width=LINE_W)


def draw_add(im, d):
    """添加：frame + 加号（线宽归一 + 圆角端点）"""
    draw_frame(d)
    line_round(d, [(512, 220), (512, 804)], width=LINE_W)
    line_round(d, [(220, 512), (804, 512)], width=LINE_W)


def draw_maximize(im, d):
    """最大化：frame + 外大方框 + 四角内 L 形角标（窗口最大化语义）
    全部线宽归一 LINE_W，端点大圆点统一"""
    draw_frame(d)
    # 外层大圆角方（描边）
    rounded_rect(d, [240, 240, 760, 760], radius=40)
    # 四角内 L 形角标（最大化窗口语义，4 个角各一个 L）
    L = 90  # 角标边长
    inset = 40  # 距外框边距（第 5 轮最佳配置）
    L_W = LINE_W  # L 标记线宽归一，与 frame 完全一致
    # 左上角 L
    d.line([(inset, inset), (inset + L, inset)], fill=BLUE, width=L_W, joint="curve")
    d.line([(inset, inset), (inset, inset + L)], fill=BLUE, width=L_W, joint="curve")
    # 右上角 L
    d.line([(SRC_SIZE - inset - L, inset), (SRC_SIZE - inset, inset)], fill=BLUE, width=L_W, joint="curve")
    d.line([(SRC_SIZE - inset, inset), (SRC_SIZE - inset, inset + L)], fill=BLUE, width=L_W, joint="curve")
    # 左下角 L
    d.line([(inset, SRC_SIZE - inset), (inset + L, SRC_SIZE - inset)], fill=BLUE, width=L_W, joint="curve")
    d.line([(inset, SRC_SIZE - inset - L), (inset, SRC_SIZE - inset)], fill=BLUE, width=L_W, joint="curve")
    # 右下角 L
    d.line([(SRC_SIZE - inset - L, SRC_SIZE - inset), (SRC_SIZE - inset, SRC_SIZE - inset)], fill=BLUE, width=L_W, joint="curve")
    d.line([(SRC_SIZE - inset, SRC_SIZE - inset - L), (SRC_SIZE - inset, SRC_SIZE - inset)], fill=BLUE, width=L_W, joint="curve")
    # 四角端点圆点（半径 14，与圆角端点统一，避免过重）
    r = 14
    corners = [(inset, inset), (SRC_SIZE - inset, inset),
               (inset, SRC_SIZE - inset), (SRC_SIZE - inset, SRC_SIZE - inset)]
    for (x, y) in corners:
        d.ellipse([x - r, y - r, x + r, y + r], fill=BLUE)


def draw_delete(im, d):
    """删除：frame + 垃圾桶（桶把+桶盖+桶身+2 条内线），桶身 256×380 第 5 轮最佳配置"""
    draw_frame(d)
    # 顶部桶把（U 形把手）
    line_round(d, [(420, 260), (420, 210), (604, 210), (604, 260)], width=LINE_W)
    # 桶盖（横条，略宽于桶身）
    rounded_rect(d, [340, 290, 684, 350], radius=14)
    # 桶身（宽 256，高 380，第 5 轮最佳比例）
    d.line([(384, 350), (384, 730)], fill=BLUE, width=LINE_W)
    d.line([(640, 350), (640, 730)], fill=BLUE, width=LINE_W)
    d.line([(384, 730), (640, 730)], fill=BLUE, width=LINE_W, joint="curve")
    # 底部圆角端点
    r = LINE_W // 2
    d.ellipse([384 - r, 730 - r, 384 + r, 730 + r], fill=BLUE)
    d.ellipse([640 - r, 730 - r, 640 + r, 730 + r], fill=BLUE)
    # 桶身内 2 条竖向分隔线（线宽 3/4 主线，作为次线层级）
    d.line([(470, 390), (470, 690)], fill=BLUE, width=LINE_W * 3 // 4)
    d.line([(554, 390), (554, 690)], fill=BLUE, width=LINE_W * 3 // 4)


def draw_edit(im, d):
    """编辑：frame + 铅笔（笔身+笔尖+橡皮+底部下划线），斜放 -60°（更竖，与 PDF 扳手 -45° 区分）"""
    draw_frame(d)
    # 铅笔主体（斜 -60° 方向，笔尖朝右上方略偏上，避免与 PDF 扳手姿态雷同）
    # 几何参数：铅笔沿轴线方向，整体长 480，宽 96
    import math
    cx, cy = 512, 512
    ang = -math.pi / 3  # -60°（更接近竖直，与 -45° 扳手明显区分）
    length = 480
    half_l = length / 2
    width = 96
    half_w = width / 2
    cos_a = math.cos(ang)
    sin_a = math.sin(ang)
    # 笔身四角（长方形旋转）
    def rot(dx, dy):
        return (cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a)
    # 笔身：从橡皮端到笔尖端
    p1 = rot(-half_l + 80, -half_w)   # 橡皮端上
    p2 = rot(half_l - 80, -half_w)    # 笔尖肩上
    p3 = rot(half_l - 80, half_w)     # 笔尖肩下
    p4 = rot(-half_l + 80, half_w)    # 橡皮端下
    d.line([p1, p2], fill=BLUE, width=LINE_W, joint="curve")
    d.line([p2, p3], fill=BLUE, width=LINE_W, joint="curve")
    d.line([p3, p4], fill=BLUE, width=LINE_W, joint="curve")
    d.line([p4, p1], fill=BLUE, width=LINE_W, joint="curve")
    # 橡皮端（短段，稍粗描边）
    eraser_top1 = rot(-half_l, -half_w)
    eraser_top2 = rot(-half_l, half_w)
    eraser_shoulder1 = rot(-half_l + 80, -half_w)
    eraser_shoulder2 = rot(-half_l + 80, half_w)
    d.line([eraser_top1, eraser_shoulder1], fill=BLUE, width=LINE_W, joint="curve")
    d.line([eraser_top2, eraser_shoulder2], fill=BLUE, width=LINE_W, joint="curve")
    d.line([eraser_top1, eraser_top2], fill=BLUE, width=LINE_W, joint="curve")
    # 橡皮/笔身分隔线（垂直笔身的短线）
    d.line([eraser_shoulder1, eraser_shoulder2], fill=BLUE, width=LINE_W, joint="curve")
    # 笔尖（三角形，从笔身肩部到尖端）
    tip = rot(half_l, 0)
    d.line([p2, tip], fill=BLUE, width=LINE_W, joint="curve")
    d.line([tip, p3], fill=BLUE, width=LINE_W, joint="curve")
    # 笔尖与笔身分隔线（金属箍）
    tip_shoulder1 = rot(half_l - 80, -half_w)
    tip_shoulder2 = rot(half_l - 80, half_w)
    d.line([tip_shoulder1, tip_shoulder2], fill=BLUE, width=LINE_W, joint="curve")
    # 底部下划线（编辑语义的"书写"提示）
    line_round(d, [(300, 820), (724, 820)], width=LINE_W)


# ============ 注册表 ============
PROJECT_ICONS = [
    ("anniversary-manager", draw_anniversary),
    ("checksum-manager", draw_checksum),
    ("hosts-manager", draw_hosts),
    ("image-converter", draw_image_converter),
    ("pdf-toolbox", draw_pdf_toolbox),
]
GENERIC_ICONS = [
    ("settings", draw_settings),
    ("search", draw_search),
    ("close", draw_close),
    ("minimize", draw_minimize),
    ("add", draw_add),
    ("maximize", draw_maximize),
    ("delete", draw_delete),
    ("edit", draw_edit),
]


def run():
    print("=== 批次 A：项目图标源（5个）===")
    for proj, fn in PROJECT_ICONS:
        print(f"[{proj}]")
        im, d = new_canvas()
        fn(im, d)
        out_dir = os.path.join(PROJECT_ICONS_DIR, proj)
        os.makedirs(out_dir, exist_ok=True)
        src = os.path.join(out_dir, "icon-source.png")
        save_source(im, src)
        make_icon_variants(src, out_dir, "icon")

    print("\n=== 批次 B：通用功能图标（5个）===")
    for name, fn in GENERIC_ICONS:
        print(f"[{name}]")
        im, d = new_canvas()
        fn(im, d)
        out_dir = GENERIC_ICONS_DIR
        os.makedirs(out_dir, exist_ok=True)
        src = os.path.join(out_dir, f"{name}-source.png")
        save_source(im, src)
        make_icon_variants(src, out_dir, name)


if __name__ == "__main__":
    run()
