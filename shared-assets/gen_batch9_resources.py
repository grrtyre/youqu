# -*- coding: utf-8 -*-
"""
批次9 v2：纯 PIL 绘制图标 + 合成启动画面（AI 生图 API 已失效，改用程序化绘制）
执行 AI 自主编写。苹果白高端风格。
- 图标：PIL 矢量绘制 -> icon.png(512) + 多尺寸 PNG + icon.ico
- 启动画面：PIL 合成 16:9 -> splash.png + splash-thumb.png
- 预览图：2 行 x 6 列网格，供 mimo 评分
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ============== 配置 ==============
BASE = r"D:\Ai\mimo\youqu\shared-assets"
ICONS_DIR = os.path.join(BASE, "icons", "projects")
SPLASH_DIR = os.path.join(BASE, "splash", "projects")
PREVIEW_DIR = r"D:\Ai\mimo\screenshots"

ACCENT = (0, 122, 255)        # #007aff 主色
ACCENT_LIGHT = (0, 122, 255, 40)
ACCENT_SOFT = (0, 122, 255, 70)
WHITE = (255, 255, 255)
LIGHT_GRAY = (245, 247, 250)
MID_GRAY = (200, 205, 212)
TEXT_DARK = (28, 28, 30)
TEXT_SUB = (142, 142, 147)
CARD_BG = (248, 249, 252)

SOURCE_SIZE = 512
PNG_SIZES = [16, 32, 48, 64, 128, 256, 512]
SPLASH_W, SPLASH_H = 1200, 675
THUMB_W, THUMB_H = 400, 225

PROJECTS = [
    {"name": "ambient-sound",       "cn": "环境音"},
    {"name": "anniversary-manager", "cn": "纪念日"},
    {"name": "ocr-manager",         "cn": "文字识别"},
    {"name": "unit-converter",      "cn": "单位转换"},
    {"name": "watermark-manager",   "cn": "水印"},
    {"name": "wheel-manager",       "cn": "转盘"},
]


def find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


# ============== 圆角矩形辅助 ==============
def rounded_rect(draw, box, radius, **kw):
    draw.rounded_rectangle(box, radius=radius, **kw)


# ============== 6 个项目图标绘制 ==============
def draw_ambient_sound(d, s):
    """环境音：同心声波弧 + 中心点 + 底部声波柱（增加视觉重量）"""
    cx, cy = s // 2, s // 2 - 20
    # 背景浅蓝圆（增加层次感）
    d.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], fill=(235, 243, 255))
    # 三层同心弧（开口向下，模拟声波传播）
    for i, r in enumerate([100, 150, 200]):
        bbox = [cx - r, cy - r, cx + r, cy + r]
        d.arc(bbox, start=150, end=30, fill=ACCENT, width=16 - i * 3)
    # 中心圆点（加大，带内白点）
    d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=ACCENT)
    d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=WHITE)
    # 底部声波柱（5 根，高低错落，增加视觉重量）
    bar_y = cy + 180
    bar_w = 18
    bar_heights = [40, 70, 100, 70, 40]
    bar_gap = 14
    total_w = 5 * bar_w + 4 * bar_gap
    start_x = cx - total_w // 2
    for i, h in enumerate(bar_heights):
        x = start_x + i * (bar_w + bar_gap)
        d.rounded_rectangle([x, bar_y - h, x + bar_w, bar_y], radius=bar_w // 2, fill=ACCENT)


def draw_anniversary(d, s):
    """纪念日：心形 + 日历小格（心形加大加粗）"""
    cx, cy = s // 2, s // 2 - 40
    # 心形（两圆 + 三角，加大）
    r = 82
    d.ellipse([cx - r - 8, cy - r, cx + 4, cy + r], fill=ACCENT)
    d.ellipse([cx - 4, cy - r, cx + r + 8, cy + r], fill=ACCENT)
    d.polygon([(cx - r - 8, cy + 18), (cx + r + 8, cy + 18), (cx, cy + r + 65)], fill=ACCENT)
    # 下方日历小卡片
    card_y = cy + 130
    rounded_rect(d, [cx - 80, card_y, cx + 80, card_y + 88], radius=14, fill=WHITE, outline=ACCENT, width=7)
    # 日历顶部横条
    d.line([(cx - 80, card_y + 24), (cx + 80, card_y + 24)], fill=ACCENT, width=7)
    # 三个日期点
    for i, dx in enumerate([-40, 0, 40]):
        d.ellipse([cx + dx - 7, card_y + 44, cx + dx + 7, card_y + 58], fill=ACCENT)


def draw_ocr(d, s):
    """文字识别：文档 + 扫描线 + 文字行 + 背层纵深"""
    cx, cy = s // 2, s // 2
    # 背层（偏移，浅蓝，增加纵深）
    offset = 22
    rounded_rect(d, [cx - 130 + offset, cy - 150 + offset, cx + 130 + offset, cy + 150 + offset], radius=20, fill=(220, 235, 255), outline=ACCENT, width=4)
    # 前层文档外框（圆角矩形）
    rounded_rect(d, [cx - 130, cy - 150, cx + 130, cy + 150], radius=20, fill=WHITE, outline=ACCENT, width=10)
    # 顶部标题条
    rounded_rect(d, [cx - 100, cy - 120, cx + 100, cy - 80], radius=8, fill=ACCENT)
    # 文字行（4 条）
    for i, y in enumerate([cy - 50, cy - 15, cy + 20, cy + 55]):
        w_line = 200 if i % 2 == 0 else 160
        rounded_rect(d, [cx - w_line // 2, y, cx + w_line // 2, y + 12], radius=6, fill=MID_GRAY)
    # 扫描线
    scan_y = cy + 95
    d.line([(cx - 125, scan_y), (cx + 125, scan_y)], fill=ACCENT, width=8)
    # 扫描线两端圆点
    d.ellipse([cx - 132, scan_y - 8, cx - 118, scan_y + 8], fill=ACCENT)
    d.ellipse([cx + 118, scan_y - 8, cx + 132, scan_y + 8], fill=ACCENT)


def draw_unit_converter(d, s):
    """单位转换：双向箭头 + kg/lb 单位标签（简洁版，去除刻度尺降密度）"""
    cx, cy = s // 2, s // 2
    # 上箭头（向右）
    y1 = cy - 70
    d.line([(cx - 140, y1), (cx + 120, y1)], fill=ACCENT, width=18)
    d.polygon([(cx + 145, y1), (cx + 110, y1 - 24), (cx + 110, y1 + 24)], fill=ACCENT)
    # 下箭头（向左）
    y2 = cy + 70
    d.line([(cx + 140, y2), (cx - 120, y2)], fill=ACCENT, width=18)
    d.polygon([(cx - 145, y2), (cx - 110, y2 - 24), (cx - 110, y2 + 24)], fill=ACCENT)
    # 标签圆（加大，左 kg / 右 lb）
    d.ellipse([cx - 195, cy - 42, cx - 105, cy + 42], fill=ACCENT)
    d.ellipse([cx + 105, cy - 42, cx + 195, cy + 42], fill=ACCENT)
    # 标签文字 kg / lb（加大字号）
    try:
        f = find_font(32, bold=True)
        d.text((cx - 182, cy - 20), "kg", fill=WHITE, font=f)
        d.text((cx + 118, cy - 20), "lb", fill=WHITE, font=f)
    except Exception:
        pass


def draw_watermark(d, s):
    """水印：两层叠加圆角方形 + 大号 W（简洁，无斜线）"""
    cx, cy = s // 2, s // 2
    # 后层（偏移，浅蓝半透明感）
    rounded_rect(d, [cx - 110 + 38, cy - 110 + 38, cx + 110 + 38, cy + 110 + 38], radius=28, fill=(200, 225, 255), outline=ACCENT, width=6)
    # 前层（白底深蓝边）
    rounded_rect(d, [cx - 110, cy - 110, cx + 110, cy + 110], radius=28, fill=WHITE, outline=ACCENT, width=12)
    # 前层中心大号 W（加大、加粗）
    try:
        f = find_font(96, bold=True)
        bbox = d.textbbox((0, 0), "W", font=f)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((cx - tw // 2 - bbox[0], cy - th // 2 - bbox[1] - 8), "W", fill=ACCENT, font=f)
    except Exception:
        d.line([(cx - 40, cy - 40), (cx + 40, cy + 40)], fill=ACCENT, width=12)


def draw_wheel(d, s):
    """转盘：圆形分段 + 中心指针"""
    cx, cy = s // 2, s // 2
    R = 170
    # 外圆
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=ACCENT, width=14)
    # 6 段分隔线（减细，统一线条粗细）
    n = 6
    for i in range(n):
        ang = math.radians(90 + i * 360 / n)
        x2 = cx + (R - 7) * math.cos(ang)
        y2 = cy - (R - 7) * math.sin(ang)
        d.line([(cx, cy), (x2, y2)], fill=ACCENT, width=6)
    # 交替段填充（浅蓝）
    for i in range(n):
        a0 = math.radians(90 + i * 360 / n)
        a1 = math.radians(90 + (i + 1) * 360 / n)
        # 用扇形 polygon 近似填充
        pts = [(cx, cy)]
        steps = 12
        for k in range(steps + 1):
            a = a0 + (a1 - a0) * k / steps
            pts.append((cx + (R - 10) * math.cos(a), cy - (R - 10) * math.sin(a)))
        if i % 2 == 0:
            d.polygon(pts, fill=(220, 235, 255))
    # 重画外圆和分隔线（覆盖在填充之上）
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=ACCENT, width=14)
    for i in range(n):
        ang = math.radians(90 + i * 360 / n)
        x2 = cx + (R - 7) * math.cos(ang)
        y2 = cy - (R - 7) * math.sin(ang)
        d.line([(cx, cy), (x2, y2)], fill=ACCENT, width=6)
    # 中心圆（适中大小，带内白环，平衡对比与比例）
    d.ellipse([cx - 44, cy - 44, cx + 44, cy + 44], fill=ACCENT)
    d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], outline=WHITE, width=6)
    d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=WHITE)
    # 顶部指针（三角形，加大）
    d.polygon([(cx, cy - R - 36), (cx - 26, cy - R + 6), (cx + 26, cy - R + 6)], fill=ACCENT)


DRAW_FUNCS = {
    "ambient-sound": draw_ambient_sound,
    "anniversary-manager": draw_anniversary,
    "ocr-manager": draw_ocr,
    "unit-converter": draw_unit_converter,
    "watermark-manager": draw_watermark,
    "wheel-manager": draw_wheel,
}


def make_icon(proj_name: str) -> Image.Image:
    """纯 PIL 绘制图标：白底圆角卡 + 居中矢量图形"""
    img = Image.new("RGB", (SOURCE_SIZE, SOURCE_SIZE), WHITE)
    d = ImageDraw.Draw(img)
    # 浅灰圆角背景卡（轻微层次感）
    margin = 40
    rounded_rect(d, [margin, margin, SOURCE_SIZE - margin, SOURCE_SIZE - margin], radius=72, fill=CARD_BG)
    # 内层白色卡
    inner = margin + 16
    rounded_rect(d, [inner, inner, SOURCE_SIZE - inner, SOURCE_SIZE - inner], radius=60, fill=WHITE)
    # 绘制项目专属图形
    func = DRAW_FUNCS[proj_name]
    func(d, SOURCE_SIZE)
    return img


def save_icon_files(source: Image.Image, proj_name: str) -> dict:
    out_dir = os.path.join(ICONS_DIR, proj_name)
    os.makedirs(out_dir, exist_ok=True)
    files = {}
    source.save(os.path.join(out_dir, "icon.png"), "PNG")
    files["icon.png"] = source
    for sz in PNG_SIZES:
        im = source.resize((sz, sz), Image.LANCZOS)
        im.save(os.path.join(out_dir, f"icon-{sz}.png"), "PNG")
        files[f"icon-{sz}.png"] = im
    source.save(os.path.join(out_dir, "icon-512.png"), "PNG")
    # ICO
    ico_imgs = [source.resize((s, s), Image.LANCZOS) for s in [16, 32, 48, 64, 128, 256]]
    ico_imgs[0].save(
        os.path.join(out_dir, "icon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    files["icon.ico"] = "ico"
    return files


def make_radial_gradient(w, h, inner=(255, 255, 255), outer=(238, 244, 255)):
    """生成径向渐变背景：中心 inner 色，四角 outer 色（极微妙，提升高端感）
    用小图放大 + LANCZOS，避免逐像素计算的性能问题。带缓存保证 6 张启动画面完全一致。"""
    key = (w, h, inner, outer)
    if key in make_radial_gradient._cache:
        return make_radial_gradient._cache[key].copy()
    small_w, small_h = max(8, w // 40), max(8, h // 40)
    img = Image.new("RGB", (small_w, small_h), inner)
    px = img.load()
    cx, cy = small_w / 2, small_h / 2
    max_d = math.hypot(cx, cy)
    for y in range(small_h):
        for x in range(small_w):
            d = math.hypot(x - cx, y - cy) / max_d
            t = d ** 1.8
            r = int(inner[0] + (outer[0] - inner[0]) * t)
            g = int(inner[1] + (outer[1] - inner[1]) * t)
            b = int(inner[2] + (outer[2] - inner[2]) * t)
            px[x, y] = (r, g, b)
    full = img.resize((w, h), Image.LANCZOS)
    make_radial_gradient._cache[key] = full.copy()
    return full

make_radial_gradient._cache = {}


def make_splash(icon_img: Image.Image, proj_name: str, cn_name: str) -> Image.Image:
    """合成 16:9 启动画面：左图标卡 + 右文字 + 底部加载条 + 微妙径向渐变背景"""
    # 径向渐变背景（白中心 -> 极浅蓝四角，提升高端感）
    canvas = make_radial_gradient(SPLASH_W, SPLASH_H, inner=(255, 255, 255), outer=(238, 244, 255))
    draw = ImageDraw.Draw(canvas)

    # 左侧图标：缩放 440，圆角，柔阴影
    icon_size = 440
    icon = icon_img.resize((icon_size, icon_size), Image.LANCZOS)
    radius = 64
    mask = Image.new("L", (icon_size, icon_size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, icon_size - 1, icon_size - 1], radius=radius, fill=255)
    # 阴影
    shadow = Image.new("RGBA", (icon_size + 40, icon_size + 40), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([20, 20, icon_size + 19, icon_size + 19], radius=radius, fill=(0, 0, 0, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))

    ix = 90
    iy = (SPLASH_H - icon_size) // 2 - 10
    canvas.paste(shadow, (ix - 20, iy - 20), shadow)
    canvas.paste(icon, (ix, iy), mask)

    # 右侧文字（增加行距，呼吸感）
    tx = 600
    f_en = find_font(30, bold=False)
    f_cn = find_font(72, bold=True)
    f_tag = find_font(24, bold=False)
    f_small = find_font(18, bold=False)

    draw.text((tx, 175), proj_name, fill=TEXT_SUB, font=f_en)
    draw.text((tx, 225), cn_name, fill=TEXT_DARK, font=f_cn)

    # 蓝色标签
    tag_text = "Apple White Edition"
    bbox = draw.textbbox((0, 0), tag_text, font=f_tag)
    tag_w = bbox[2] - bbox[0] + 36
    tag_h = bbox[3] - bbox[1] + 20
    tag_y = 360
    draw.rounded_rectangle([tx, tag_y, tx + tag_w, tag_y + tag_h], radius=tag_h // 2, fill=ACCENT)
    draw.text((tx + 18, tag_y + 10), tag_text, fill=WHITE, font=f_tag)

    # 底部加载条（恢复可读性：高度 6，主题蓝 #007aff）
    bar_x, bar_y, bar_w, bar_h = 90, SPLASH_H - 55, SPLASH_W - 180, 6
    draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], radius=bar_h // 2, fill=(228, 233, 240))
    draw.rounded_rectangle([bar_x, bar_y, bar_x + int(bar_w * 0.62), bar_y + bar_h], radius=bar_h // 2, fill=ACCENT)

    draw.text((bar_x, bar_y - 26), "loading...", fill=TEXT_SUB, font=f_small)
    draw.text((bar_x + bar_w - 56, bar_y - 26), "62%", fill=ACCENT, font=f_small)

    # 保存
    splash_path = os.path.join(SPLASH_DIR, f"{proj_name}-splash.png")
    thumb_path = os.path.join(SPLASH_DIR, f"{proj_name}-splash-thumb.png")
    canvas.save(splash_path, "PNG")
    canvas.resize((THUMB_W, THUMB_H), Image.LANCZOS).save(thumb_path, "PNG")
    return canvas


def make_preview(items: list) -> str:
    cols = 6
    cell_w = 260
    icon_cell_h = 320
    splash_cell_h = 250
    title_h = 100
    footer_h = 70
    margin = 30
    W = margin * 2 + cols * cell_w
    H = title_h + icon_cell_h + splash_cell_h + footer_h + margin * 2

    canvas = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(canvas)

    f_title = find_font(36, bold=True)
    f_sub = find_font(20, bold=False)
    f_name = find_font(20, bold=True)
    f_en = find_font(16, bold=False)
    f_foot = find_font(18, bold=False)

    draw.text((margin, 30), "资源生成批次9 · 苹果白高端风格", fill=TEXT_DARK, font=f_title)
    draw.text((margin, 72), "Apple White Edition · Icons & Splash Screens · 6 Projects", fill=TEXT_SUB, font=f_sub)
    draw.line([(margin, title_h + 5), (W - margin, title_h + 5)], fill=(230, 232, 236), width=1)

    y_icons = title_h + margin
    y_splash = y_icons + icon_cell_h + 10

    # 图标行
    for i, it in enumerate(items):
        x = margin + i * cell_w
        # 卡片背景 + 细边框
        draw.rounded_rectangle([x + 8, y_icons + 8, x + cell_w - 8, y_icons + 278], radius=18, fill=CARD_BG, outline=(230, 232, 236), width=1)
        ic = it["icon"].resize((224, 224), Image.LANCZOS)
        canvas.paste(ic, (x + 18, y_icons + 22))
        # 项目名
        bbox = draw.textbbox((0, 0), it["cn"], font=f_name)
        tw = bbox[2] - bbox[0]
        draw.text((x + (cell_w - tw) // 2, y_icons + 286), it["cn"], fill=TEXT_DARK, font=f_name)

    draw.line([(margin, y_splash - 5), (W - margin, y_splash - 5)], fill=(230, 232, 236), width=1)

    # 启动画面行
    for i, it in enumerate(items):
        x = margin + i * cell_w
        sp = it["splash"].resize((244, 137), Image.LANCZOS)
        draw.rounded_rectangle([x + 8, y_splash + 8, x + cell_w - 8, y_splash + 168], radius=14, fill=CARD_BG, outline=(230, 232, 236), width=1)
        # 圆角裁剪贴入
        sp_mask = Image.new("L", sp.size, 0)
        ImageDraw.Draw(sp_mask).rounded_rectangle([0, 0, sp.size[0] - 1, sp.size[1] - 1], radius=8, fill=255)
        canvas.paste(sp, (x + 18, y_splash + 22), sp_mask)
        bbox = draw.textbbox((0, 0), it["name"], font=f_en)
        tw = bbox[2] - bbox[0]
        draw.text((x + (cell_w - tw) // 2, y_splash + 175), it["name"], fill=TEXT_SUB, font=f_en)

    draw.text((margin, H - 42), "风格：极简线条 · #007aff 主色 · 白底 · 圆润 · 扁平化 · 纯 PIL 矢量绘制", fill=TEXT_SUB, font=f_foot)

    out = os.path.join(PREVIEW_DIR, "batch9_preview.png")
    canvas.save(out, "PNG")
    print(f"预览图：{out}")
    return out


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    os.makedirs(SPLASH_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)

    items = []
    for i, p in enumerate(PROJECTS, 1):
        print(f"[{i}/{len(PROJECTS)}] {p['name']} ({p['cn']})")
        icon = make_icon(p["name"])
        save_icon_files(icon, p["name"])
        splash = make_splash(icon, p["name"], p["cn"])
        items.append({"name": p["name"], "cn": p["cn"], "icon": icon, "splash": splash})
        print(f"  -> 完成")

    preview = make_preview(items)
    print(f"\n全部完成。预览图：{preview}")
    return preview


if __name__ == "__main__":
    main()
