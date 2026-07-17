# -*- coding: utf-8 -*-
"""
项目专属启动画面生成脚本（苹果白高端风格）
- PIL 绘制每个项目独特的几何装饰元素（点阵/同心圆/放射线/网格/线段等）
- PIL 合成启动画面：白渐变背景 + 几何装饰 + 项目图标 + 中文名 + 标语 + 底部 wordmark
注：AI 生图 API 经测试返回固定占位图（相同 hash），已弃用，改用纯 PIL 几何装饰
"""
import os, sys, json, math, time
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ============ 配置 ============
WORK = r"D:\Ai\mimo\youqu\shared-assets"
ICON_DIR = os.path.join(WORK, "icons", "projects_ref")
SPLASH_DIR = os.path.join(WORK, "splash", "projects")
PREVIEW_DIR = r"D:\Ai\mimo\screenshots"
os.makedirs(SPLASH_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# 苹果蓝（装饰可见度统一化，符合 mimo 反馈：8 张卡片装饰需一致可见）
BLUE = (0, 122, 255)
BLUE_SOFT = (0, 122, 255, 24)    # 淡蓝（装饰填充）
BLUE_MED = (0, 122, 255, 40)     # 中淡蓝（装饰轮廓）

# 字体（微软雅黑系列 + Segoe UI Light）
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_LIGHT = r"C:\Windows\Fonts\msyhl.ttc"
FONT_ENG_LIGHT = r"C:\Windows\Fonts\segoeuil.ttf"
FONT_ENG_REG = r"C:\Windows\Fonts\segoeui.ttf"

# 项目数据：(id, 中文名, 标语, AI 提示词)
PROJECTS = [
    ("calculator-manager", "计算器", "精准计算 · 触手可及",
     "minimalist abstract illustration of a modern calculator with rounded buttons and soft shadow, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("clipboard-manager", "剪贴板管家", "智能管理 · 复制历史",
     "minimalist abstract illustration of stacked clipboard cards floating, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("color-picker", "取色器", "一键捕捉 · 屏幕色彩",
     "minimalist abstract illustration of a magnifier lens picking a rainbow color droplet, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("cron-zh", "定时任务", "让时间 · 为你工作",
     "minimalist abstract illustration of an elegant clock fused with a gear and calendar page, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("diary-manager", "日记本", "记录生活 · 点滴温柔",
     "minimalist abstract illustration of an open diary book with a fountain pen, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("pomodoro-manager", "番茄钟", "专注当下 · 静水流深",
     "minimalist abstract illustration of a tomato silhouette integrated with a minimal clock face, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("qr-manager", "二维码工具", "扫码生码 · 一气呵成",
     "minimalist abstract illustration of a QR code pattern with a horizontal scan line, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
    ("screenshot-manager", "截图管家", "灵动捕捉 · 屏幕瞬间",
     "minimalist abstract illustration of a camera aperture with a crop selection frame, apple white aesthetic, pure white background, flat design, thin elegant lines, soft blue accent color #007aff, clean and premium, no text"),
]

# ============ 工具函数 ============
def white_gradient_bg(size):
    """白 -> 极浅冷灰 渐变背景"""
    w, h = size
    bg = Image.new("RGB", size, (255, 255, 255))
    top = (255, 255, 255)
    bot = (244, 245, 247)  # 苹果灰 #f4f5f7
    px = bg.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] + (bot[0] - top[0]) * t)
        g = int(top[1] + (bot[1] - top[1]) * t)
        b = int(top[2] + (bot[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return bg

def draw_geometric_accent(canvas, idx, W, H):
    """
    在画布上绘制每个项目独特的极简几何装饰（苹果白风格，#007aff 低透明度）
    idx: 项目索引 0-7，决定装饰类型
    装饰位于右上角与左下角，极淡，不抢主视觉
    """
    # 装饰层（透明 RGBA）
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx_r, cy_r = W - 220, 200       # 右上角中心
    cx_l, cy_l = 220, H - 180       # 左下角中心

    if idx == 0:
        # 计算器 - 规整点阵网格
        for r in range(5):
            for c in range(5):
                x = cx_r - 80 + c * 40
                y = cy_r - 80 + r * 40
                d.ellipse([x-4, y-4, x+4, y+4], fill=BLUE_SOFT)
    elif idx == 1:
        # 剪贴板 - 堆叠圆角矩形轮廓
        for i in range(4):
            off = i * 10
            d.rounded_rectangle([cx_r-60+off, cy_r-50+off, cx_r+60+off, cy_r+50+off],
                                 radius=12, outline=BLUE_MED, width=1)
    elif idx == 2:
        # 取色器 - 同心圆
        for i in range(1, 6):
            r = i * 22
            d.ellipse([cx_r-r, cy_r-r, cx_r+r, cy_r+r], outline=BLUE_MED, width=1)
    elif idx == 3:
        # 定时任务 - 放射线（时钟刻度）
        for i in range(12):
            ang = math.radians(i * 30)
            x1 = cx_r + math.cos(ang) * 50
            y1 = cy_r + math.sin(ang) * 50
            x2 = cx_r + math.cos(ang) * 85
            y2 = cy_r + math.sin(ang) * 85
            d.line([x1, y1, x2, y2], fill=BLUE_MED, width=2)
    elif idx == 4:
        # 日记 - 横线段（文本行）
        for i in range(5):
            y = cy_r - 50 + i * 25
            w = 120 if i % 2 == 0 else 90
            d.line([cx_r-60, y, cx_r-60+w, y], fill=BLUE_MED, width=2)
    elif idx == 5:
        # 番茄钟 - 分段圆环
        import math as m
        for i in range(8):
            a0 = m.radians(i * 45 - 90)
            a1 = m.radians(i * 45 - 90 + 30)
            d.arc([cx_r-80, cy_r-80, cx_r+80, cy_r+80], m.degrees(a0), m.degrees(a1),
                  fill=BLUE_MED, width=3)
    elif idx == 6:
        # 二维码 - 方格网格
        for r in range(5):
            for c in range(5):
                if (r + c) % 2 == 0 or r == c:
                    x = cx_r - 60 + c * 30
                    y = cy_r - 60 + r * 30
                    d.rectangle([x, y, x+22, y+22], fill=BLUE_SOFT)
    elif idx == 7:
        # 截图 - 角标括号
        s = 80
        for (ox, oy, dx, dy) in [(-1,-1,1,1),(1,-1,-1,1),(-1,1,1,-1),(1,1,-1,-1)]:
            x0 = cx_r + ox * s
            y0 = cy_r + oy * s
            d.line([x0, y0, x0 + dx*30, y0], fill=BLUE_MED, width=2)
            d.line([x0, y0, x0, y0 + dy*30], fill=BLUE_MED, width=2)

    # 左下角统一加一组极淡的三点装饰（节奏感）
    for i, off in enumerate([-24, 0, 24]):
        d.ellipse([cx_l+off-4, cy_l-4, cx_l+off+4, cy_l+4], fill=BLUE_SOFT)

    # 轻微模糊让边缘更柔和
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    canvas.alpha_composite(layer)
    return canvas

def icon_shadow(icon_img, blur=22, opacity=110, offset=(0, 14)):
    """为图标生成柔和投影（使用图标自身 alpha 作为形状）"""
    w, h = icon_img.size
    pad = blur * 3
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    # 用图标 alpha 作为形状，填充黑色
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, opacity))
    if icon_img.mode != "RGBA":
        icon_img = icon_img.convert("RGBA")
    shadow.putalpha(icon_img.split()[3].point(lambda p: int(p * opacity / 255)))
    canvas.paste(shadow, (pad, pad), shadow)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    return canvas, (pad + offset[0], pad + offset[1])

def compose_splash(idx, cn_name, tagline, icon_path, out_path):
    """合成一张 1600x900 启动画面"""
    W, H = 1600, 900
    bg = white_gradient_bg((W, H)).convert("RGBA")
    draw = ImageDraw.Draw(bg)

    # 1) 顶部极细装饰：居中 3 个小蓝点（替代满宽蓝条，更克制更苹果白）
    for i, off in enumerate([-14, 0, 14]):
        draw.ellipse([W//2 + off - 3, 40, W//2 + off + 3, 46], fill=(0, 122, 255, 120))

    # 2) 项目独特的几何装饰元素（右上角 + 左下角，极淡）
    bg = draw_geometric_accent(bg, idx, W, H)
    draw = ImageDraw.Draw(bg)

    # 3) 图标背后柔和光晕环（#007aff 极淡）
    icon_size = 256
    icon_x = (W - icon_size) // 2
    icon_y = int(H * 0.26)
    ring_cx, ring_cy = icon_x + icon_size // 2, icon_y + icon_size // 2
    ring = Image.new("RGBA", (icon_size + 220, icon_size + 220), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([0, 0, icon_size + 220, icon_size + 220],
               fill=(0, 122, 255, 18))
    ring = ring.filter(ImageFilter.GaussianBlur(55))
    bg.paste(ring, (ring_cx - (icon_size + 220) // 2, ring_cy - (icon_size + 220) // 2), ring)

    # 4) 项目图标 + 柔和投影（icon_shadow 返回的 canvas 内边距 pad = blur*3 = 66）
    icon = Image.open(icon_path).convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    shadow, _ = icon_shadow(icon, blur=22, opacity=85, offset=(0, 14))
    shadow_pad = 66  # = blur * 3
    bg.paste(shadow, (icon_x - shadow_pad, icon_y - shadow_pad + 14), shadow)
    bg.paste(icon, (icon_x, icon_y), icon)

    draw = ImageDraw.Draw(bg)

    # 5) 中文名（自适应字号：>=5 字用 56，否则 64；防止溢出）
    name_chars = len(cn_name)
    name_size = 56 if name_chars >= 5 else 64
    name_font = ImageFont.truetype(FONT_BOLD, name_size)
    name_bbox = draw.textbbox((0, 0), cn_name, font=name_font)
    name_w = name_bbox[2] - name_bbox[0]
    name_y = icon_y + icon_size + 60            # 固定标题 Y 位置
    name_x = (W - name_w) // 2 - name_bbox[0]
    draw.text((name_x, name_y), cn_name, fill=(29, 29, 31), font=name_font)

    # 6) 标语（固定 Y 位置，独立于标题高度，保证 8 张卡片层级一致）
    tag_font = ImageFont.truetype(FONT_LIGHT, 38)
    tag_bbox = draw.textbbox((0, 0), tagline, font=tag_font)
    tag_w = tag_bbox[2] - tag_bbox[0]
    tag_x = (W - tag_w) // 2 - tag_bbox[0]
    tag_y = name_y + 100                        # 固定标语 Y
    draw.text((tag_x, tag_y), tagline, fill=(110, 110, 120), font=tag_font)

    # 7) 底部 wordmark（加深对比度 + 增大字号，mimo 反馈过浅）
    wm_font = ImageFont.truetype(FONT_ENG_REG, 30)
    wordmark = "youqu  ·  ELEGANT TOOLKIT"
    wm_bbox = draw.textbbox((0, 0), wordmark, font=wm_font)
    wm_w = wm_bbox[2] - wm_bbox[0]
    wm_x = (W - wm_w) // 2 - wm_bbox[0]
    wm_y = H - 72
    draw.text((wm_x, wm_y), wordmark, fill=(90, 90, 100), font=wm_font)
    # 蓝点
    dot_y = wm_y + 13
    draw.ellipse([wm_x - 18, dot_y - 4, wm_x - 10, dot_y + 4], fill=(0, 122, 255))

    # 保存
    final = bg.convert("RGB")
    final.save(out_path, "PNG", optimize=True)
    # 缩略图
    thumb = final.resize((480, 270), Image.LANCZOS)
    thumb.save(out_path.replace(".png", "-thumb.png"), "PNG", optimize=True)
    return out_path

def make_preview(splash_list, out_path):
    """合成 2x4 网格预览图"""
    cols, rows = 2, 4
    cell_w, cell_h = 800, 450
    gap = 24
    pad = 40
    title_h = 70
    W = pad * 2 + cols * cell_w + (cols - 1) * gap
    H = pad * 2 + rows * (cell_h + title_h) + (rows - 1) * gap + 80  # +顶部标题
    canvas = Image.new("RGB", (W, H), (245, 246, 248))
    draw = ImageDraw.Draw(canvas)
    # 顶部标题
    title_font = ImageFont.truetype(FONT_BOLD, 38)
    sub_font = ImageFont.truetype(FONT_LIGHT, 20)
    title = "youqu 项目专属启动画面 · 苹果白风格"
    tb = draw.textbbox((0, 0), title, font=title_font)
    draw.text(((W - (tb[2]-tb[0]))//2 - tb[0], 30), title, fill=(29, 29, 31), font=title_font)
    sub = "Project Splash Screens  ·  Apple White Aesthetic  ·  8 items"
    sb = draw.textbbox((0, 0), sub, font=sub_font)
    draw.text(((W - (sb[2]-sb[0]))//2 - sb[0], 78), sub, fill=(134, 134, 139), font=sub_font)
    # 顶部居中 3 个小蓝点（与启动画面顶部装饰呼应，替代满宽蓝条）
    for i, off in enumerate([-16, 0, 16]):
        draw.ellipse([W//2 + off - 4, 12, W//2 + off + 4, 20], fill=(0, 122, 255, 180))

    label_font = ImageFont.truetype(FONT_BOLD, 26)
    for i, (pid, path) in enumerate(splash_list):
        col = i % cols
        row = i // cols
        x = pad + col * (cell_w + gap)
        y = pad + 80 + row * (cell_h + title_h + gap) + 30
        # 卡片白底 + 阴影感
        card = Image.new("RGB", (cell_w, cell_h), (255, 255, 255))
        try:
            splash = Image.open(path).convert("RGB")
            splash = splash.resize((cell_w, cell_h), Image.LANCZOS)
            card = splash
        except Exception as e:
            print(f"预览图加载失败 {pid}: {e}")
        # 圆角处理
        mask = Image.new("L", (cell_w, cell_h), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, cell_w, cell_h], radius=18, fill=255)
        canvas.paste(card, (x, y), mask)
        # 卡片下方标签
        label = pid
        lb = draw.textbbox((0, 0), label, font=label_font)
        draw.text((x, y + cell_h + 12), label, fill=(29, 29, 31), font=label_font)

    canvas.save(out_path, "PNG", optimize=True)
    return out_path

# ============ 主流程 ============
if __name__ == "__main__":
    print("=" * 60)
    print("项目专属启动画面生成 - 苹果白风格（纯 PIL 几何装饰）")
    print("=" * 60)

    # 第一步：PIL 合成启动画面
    print("\n[1/2] PIL 合成启动画面（每项目独特几何装饰）")
    generated = []
    for idx, (pid, cn, tag, prompt) in enumerate(PROJECTS):
        icon_path = os.path.join(ICON_DIR, f"{pid}.png")
        out_path = os.path.join(SPLASH_DIR, f"{pid}-splash.png")
        try:
            compose_splash(idx, cn, tag, icon_path, out_path)
            generated.append((pid, out_path))
            print(f"  OK: {pid}-splash.png ({os.path.getsize(out_path)} bytes)")
        except Exception as e:
            print(f"  ERROR {pid}: {e}")
            import traceback; traceback.print_exc()
    print(f"\n合成完成: {len(generated)} 个启动画面")

    # 第二步：合成预览图
    print("\n[2/2] 合成 mimo 评分预览图")
    if generated:
        preview_path = os.path.join(PREVIEW_DIR, "splash_batch_preview.png")
        make_preview(generated, preview_path)
        print(f"  OK: {preview_path} ({os.path.getsize(preview_path)} bytes)")
        print("\nPREVIEW_PATH:" + preview_path)
    print("\nGENERATED_JSON:" + json.dumps(generated))
    print("\n完成！")
