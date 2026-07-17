# -*- coding: utf-8 -*-
"""
第八批项目专属启动画面生成脚本（苹果白高端风格 · 疯狂扣细节模式）
- 6 个新项目：alarm-manager / password-generator / sticky-notes-manager / world-clock / pdf-toolbox / habit-keeper
- 完全沿用 gen_splash_batch.py 设计系统：1600x900 白渐变 + 256px 图标 + 光晕 + 投影 + 中文名 + 标语 + wordmark
- 每个项目独特的极简几何装饰（右上角 + 左下角三点），#007aff 低透明度
- 输出 1600x900 splash + 480x270 thumb + 3x2 网格预览图
注：AI 生图 API 经多轮测试返回固定占位图，已弃用，改用纯 PIL 几何装饰
"""
import os, sys, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ============ 配置 ============
WORK = r"D:\Ai\mimo\youqu\shared-assets"
ICON_DIR = os.path.join(WORK, "icons_ref")           # 已下载的 6 个项目 icon-512.png
SPLASH_DIR = os.path.join(WORK, "splash", "projects") # 输出目录
PREVIEW_DIR = r"D:\Ai\mimo\screenshots"
os.makedirs(SPLASH_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# 苹果蓝 + 透明度梯度（mimo 第1轮反馈：装饰太淡不可见，提升对比度）
BLUE = (0, 122, 255)
BLUE_SOFT = (0, 122, 255, 48)    # 淡蓝（装饰填充）—— 24→48
BLUE_MED = (0, 122, 255, 78)     # 中淡蓝（装饰轮廓）—— 40→78
BLUE_STRONG = (0, 122, 255, 180) # 标题下划线用（新增强档）

# 字体（与原脚本完全一致）
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_LIGHT = r"C:\Windows\Fonts\msyhl.ttc"
FONT_ENG_LIGHT = r"C:\Windows\Fonts\segoeuil.ttf"
FONT_ENG_REG = r"C:\Windows\Fonts\segoeui.ttf"

# 6 个项目数据：(id, 中文名, 标语, icon 文件名)
PROJECTS = [
    ("alarm-manager",        "闹钟",     "准时提醒 · 不负时光", "alarm-manager.png"),
    ("password-generator",   "密码生成", "强密守护 · 安全无忧", "password-generator.png"),
    ("sticky-notes-manager", "便签",     "随手记下 · 想法不丢", "sticky-notes-manager.png"),
    ("world-clock",          "世界时钟", "时区在掌 · 全球同步", "world-clock.png"),
    ("pdf-toolbox",          "PDF 工具箱", "PDF 利器 · 文档无忧", "pdf-toolbox.png"),
    ("habit-keeper",         "习惯管家", "每日坚持 · 聚沙成塔", "habit-keeper.png"),
]

# ============ 工具函数 ============
def white_gradient_bg(size):
    """白 -> 极浅冷蓝灰 渐变背景（mimo 第7轮反馈：蓝度偏淡，底部加微蓝增强立体感）"""
    w, h = size
    bg = Image.new("RGB", size, (255, 255, 255))
    top = (255, 255, 255)
    bot = (238, 242, 248)  # 244,245,247 → 238,242,248 略增蓝调
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
    每个项目独特的极简几何装饰（右上角 + 左下角统一三点）
    装饰极淡，不抢主视觉，与图标库语言统一
    """
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx_r, cy_r = W - 220, 200       # 右上角中心
    cx_l, cy_l = 220, H - 180       # 左下角中心

    if idx == 0:
        # 闹钟 - 声波同心弧（从一点向外辐射的铃声波纹）
        for i in range(1, 6):
            r = i * 20
            # 上半弧（铃声向上扩散）
            d.arc([cx_r - r, cy_r - r, cx_r + r, cy_r + r],
                  start=200, end=340, fill=BLUE_MED, width=2)
    elif idx == 1:
        # 密码生成 - 钥匙齿纹（水平虚线 + 端点圆点，象征密钥齿）
        # 主体虚线
        y_main = cy_r
        x_start = cx_r - 70
        seg, gap = 14, 8
        x = x_start
        while x < cx_r + 70:
            d.line([x, y_main, min(x + seg, cx_r + 70), y_main],
                   fill=BLUE_MED, width=2)
            x += seg + gap
        # 端点圆点（钥匙头）
        d.ellipse([cx_r + 60, cy_r - 8, cx_r + 76, cy_r + 8], outline=BLUE_MED, width=2)
        # 下方三个安全点
        for i, off in enumerate([-24, 0, 24]):
            d.ellipse([cx_r + off - 4, cy_r + 32 - 4, cx_r + off + 4, cy_r + 32 + 4],
                      fill=BLUE_SOFT)
    elif idx == 2:
        # 便签 - 堆叠便签轮廓（4 个错位圆角矩形，mimo 反馈：辨识度偏低，加量加重）
        for i in range(4):
            off = i * 10
            d.rounded_rectangle([cx_r - 64 + off, cy_r - 54 + off,
                                 cx_r + 54 + off, cy_r + 54 + off],
                                radius=10, outline=BLUE_MED, width=2)
    elif idx == 3:
        # 世界时钟 - 经纬弧线（mimo 反馈：装饰偏弱，加密同心圆 3→4 层 + 双竖经线）
        for i in range(1, 5):
            r = i * 20
            d.ellipse([cx_r - r, cy_r - r, cx_r + r, cy_r + r],
                      outline=BLUE_MED, width=1)
        # 两条竖向经线（椭圆压扁，左右各一）
        d.ellipse([cx_r - 36, cy_r - 72, cx_r - 8, cy_r + 72],
                  outline=BLUE_MED, width=1)
        d.ellipse([cx_r + 8, cy_r - 72, cx_r + 36, cy_r + 72],
                  outline=BLUE_MED, width=1)
        # 横向赤道线
        d.line([cx_r - 80, cy_r, cx_r + 80, cy_r], fill=BLUE_MED, width=2)
    elif idx == 4:
        # PDF 工具箱 - 文档折角 + 文本行 + 装订边（mimo 第4轮反馈：层次偏平，加装订竖线）
        # 文档外框（右上角折角）
        doc_l, doc_t = cx_r - 60, cy_r - 70
        doc_r, doc_b = cx_r + 60, cy_r + 70
        fold = 20
        d.line([doc_l, doc_t, doc_r - fold, doc_t], fill=BLUE_MED, width=3)
        d.line([doc_r - fold, doc_t, doc_r, doc_t + fold], fill=BLUE_MED, width=3)
        d.line([doc_r, doc_t + fold, doc_r, doc_b], fill=BLUE_MED, width=3)
        d.line([doc_r, doc_b, doc_l, doc_b], fill=BLUE_MED, width=3)
        d.line([doc_l, doc_b, doc_l, doc_t], fill=BLUE_MED, width=3)
        # 折角内线
        d.line([doc_r - fold, doc_t, doc_r - fold, doc_t + fold], fill=BLUE_MED, width=2)
        d.line([doc_r - fold, doc_t + fold, doc_r, doc_t + fold], fill=BLUE_MED, width=2)
        # 装订边竖线（左侧装饰，增加层次）
        d.line([doc_l + 8, doc_t + 12, doc_l + 8, doc_b - 12], fill=BLUE_MED, width=2)
        # 文本行（4 行，mimo 反馈：加量）
        for i, w in enumerate([76, 60, 72, 48]):
            y = doc_t + 32 + i * 20
            d.line([doc_l + 18, y, doc_l + 18 + w, y], fill=BLUE_MED, width=3)
    elif idx == 5:
        # 习惯管家 - 进度环分段（8 段弧，mimo 反馈：辨识度偏低，加粗）
        for i in range(8):
            a0 = i * 45 - 90
            a1 = a0 + 32
            d.arc([cx_r - 70, cy_r - 70, cx_r + 70, cy_r + 70],
                  start=a0, end=a1, fill=BLUE_MED, width=4)
        # 中心勾（极简描边勾，加粗）
        d.line([cx_r - 14, cy_r + 2, cx_r - 4, cy_r + 12], fill=BLUE_MED, width=3)
        d.line([cx_r - 4, cy_r + 12, cx_r + 16, cy_r - 12], fill=BLUE_MED, width=3)
        # mimo 第4轮反馈：24 段虚线过密产生摩尔纹，改为 12 段稀疏短弧
        outer_r = 94
        for i in range(12):
            a0 = i * 30
            a1 = a0 + 12  # 段长 12°，间隔 18°，稀疏清晰
            d.arc([cx_r - outer_r, cy_r - outer_r, cx_r + outer_r, cy_r + outer_r],
                  start=a0, end=a1, fill=BLUE_MED, width=2)

    # 左下角统一三点装饰（节奏感，与原脚本一致）
    for i, off in enumerate([-24, 0, 24]):
        d.ellipse([cx_l + off - 4, cy_l - 4, cx_l + off + 4, cy_l + 4],
                  fill=BLUE_SOFT)

    # 轻微模糊让边缘更柔和
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    canvas.alpha_composite(layer)
    return canvas

def icon_shadow(icon_img, blur=22, opacity=110, offset=(0, 14)):
    """为图标生成柔和投影（使用图标自身 alpha 作为形状）"""
    w, h = icon_img.size
    pad = blur * 3
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, opacity))
    if icon_img.mode != "RGBA":
        icon_img = icon_img.convert("RGBA")
    shadow.putalpha(icon_img.split()[3].point(lambda p: int(p * opacity / 255)))
    canvas.paste(shadow, (pad, pad), shadow)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    return canvas, (pad + offset[0], pad + offset[1])

def compose_splash(idx, cn_name, tagline, icon_path, out_path):
    """合成一张 1600x900 启动画面（与原脚本设计系统一致）"""
    W, H = 1600, 900
    bg = white_gradient_bg((W, H)).convert("RGBA")
    draw = ImageDraw.Draw(bg)

    # 1) 顶部极细装饰：居中 3 个小蓝点（mimo 第5轮反馈：仍偏含蓄，alpha 200→235）
    for i, off in enumerate([-16, 0, 16]):
        draw.ellipse([W // 2 + off - 4, 46, W // 2 + off + 4, 54],
                     fill=(0, 122, 255, 235))

    # 2) 项目独特几何装饰
    bg = draw_geometric_accent(bg, idx, W, H)
    draw = ImageDraw.Draw(bg)

    # 3) 图标背后柔和光晕环（mimo 反馈：缺视觉亮点，光晕加强 18→28）
    icon_size = 288  # mimo 第2轮反馈：图标偏小，256→288 放大 12.5%
    icon_x = (W - icon_size) // 2
    icon_y = int(H * 0.24)  # 随图标放大微调上移，保持视觉中心
    ring_cx, ring_cy = icon_x + icon_size // 2, icon_y + icon_size // 2
    ring = Image.new("RGBA", (icon_size + 240, icon_size + 240), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.ellipse([0, 0, icon_size + 240, icon_size + 240],
               fill=(0, 122, 255, 28))
    ring = ring.filter(ImageFilter.GaussianBlur(58))
    bg.paste(ring, (ring_cx - (icon_size + 240) // 2,
                    ring_cy - (icon_size + 240) // 2), ring)

    # 4) 项目图标 + 柔和投影
    icon = Image.open(icon_path).convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    shadow, _ = icon_shadow(icon, blur=22, opacity=85, offset=(0, 14))
    shadow_pad = 66  # = blur * 3
    bg.paste(shadow, (icon_x - shadow_pad, icon_y - shadow_pad + 14), shadow)
    bg.paste(icon, (icon_x, icon_y), icon)

    draw = ImageDraw.Draw(bg)

    # 5) 中文名（mimo 第5轮反馈：字体层级可强化，字号 +4：64→68 / 56→60）
    name_chars = len(cn_name)
    name_size = 60 if name_chars >= 5 else 68
    name_font = ImageFont.truetype(FONT_BOLD, name_size)
    name_bbox = draw.textbbox((0, 0), cn_name, font=name_font)
    name_w = name_bbox[2] - name_bbox[0]
    name_y = icon_y + icon_size + 60
    name_x = (W - name_w) // 2 - name_bbox[0]
    draw.text((name_x, name_y), cn_name, fill=(29, 29, 31), font=name_font)

    # 5.5) 标题下方极简蓝色下划线（mimo 第2轮反馈：64x3 偏弱，放大到 96x4 + 加深）
    ul_w = 96
    ul_h = 4
    ul_x = (W - ul_w) // 2
    ul_y = name_y + name_size + 18
    draw.rounded_rectangle([ul_x, ul_y, ul_x + ul_w, ul_y + ul_h],
                           radius=2, fill=(0, 122, 255, 230))

    # 6) 标语（mimo 第6轮反馈：与标题字重对比仍可拉大，色再加深 70→60）
    tag_font = ImageFont.truetype(FONT_REG, 42)
    tag_bbox = draw.textbbox((0, 0), tagline, font=tag_font)
    tag_w = tag_bbox[2] - tag_bbox[0]
    tag_x = (W - tag_w) // 2 - tag_bbox[0]
    tag_y = ul_y + 24
    draw.text((tag_x, tag_y), tagline, fill=(60, 60, 72), font=tag_font)

    # 7) 底部 wordmark（mimo 第6轮反馈：仍偏淡，再加深 75→62）
    wm_font = ImageFont.truetype(FONT_ENG_REG, 30)
    wordmark = "youqu  ·  ELEGANT TOOLKIT"
    wm_bbox = draw.textbbox((0, 0), wordmark, font=wm_font)
    wm_w = wm_bbox[2] - wm_bbox[0]
    wm_x = (W - wm_w) // 2 - wm_bbox[0]
    wm_y = H - 64
    draw.text((wm_x, wm_y), wordmark, fill=(62, 62, 72), font=wm_font)
    dot_y = wm_y + 13
    draw.ellipse([wm_x - 18, dot_y - 4, wm_x - 10, dot_y + 4], fill=(0, 122, 255))

    final = bg.convert("RGB")
    final.save(out_path, "PNG", optimize=True)
    thumb = final.resize((480, 270), Image.LANCZOS)
    thumb.save(out_path.replace(".png", "-thumb.png"), "PNG", optimize=True)
    return out_path

def make_preview(splash_list, out_path):
    """合成 3x2 网格预览图（6 项，3 列 2 行，横向更均衡）"""
    cols, rows = 3, 2
    cell_w, cell_h = 800, 450
    gap = 24
    pad = 40
    title_h = 70
    top_banner = 110  # 顶部标题区
    W = pad * 2 + cols * cell_w + (cols - 1) * gap
    H = pad * 2 + top_banner + rows * (cell_h + title_h) + (rows - 1) * gap
    canvas = Image.new("RGB", (W, H), (245, 246, 248))
    draw = ImageDraw.Draw(canvas)

    # 顶部标题
    title_font = ImageFont.truetype(FONT_BOLD, 38)
    sub_font = ImageFont.truetype(FONT_LIGHT, 20)
    title = "youqu 项目专属启动画面 · 第八批（苹果白风格）"
    tb = draw.textbbox((0, 0), title, font=title_font)
    draw.text(((W - (tb[2] - tb[0])) // 2 - tb[0], 30), title,
              fill=(29, 29, 31), font=title_font)
    sub = "Project Splash Screens Batch 8  ·  Apple White Aesthetic  ·  6 items"
    sb = draw.textbbox((0, 0), sub, font=sub_font)
    draw.text(((W - (sb[2] - sb[0])) // 2 - sb[0], 78), sub,
              fill=(134, 134, 139), font=sub_font)
    # 顶部居中 3 个小蓝点
    for i, off in enumerate([-16, 0, 16]):
        draw.ellipse([W // 2 + off - 4, 12, W // 2 + off + 4, 20],
                     fill=(0, 122, 255, 180))

    label_font = ImageFont.truetype(FONT_BOLD, 26)
    for i, (pid, path) in enumerate(splash_list):
        col = i % cols
        row = i // cols
        x = pad + col * (cell_w + gap)
        y = pad + top_banner + row * (cell_h + title_h + gap)
        card = Image.new("RGB", (cell_w, cell_h), (255, 255, 255))
        try:
            splash = Image.open(path).convert("RGB")
            splash = splash.resize((cell_w, cell_h), Image.LANCZOS)
            card = splash
        except Exception as e:
            print(f"预览图加载失败 {pid}: {e}")
        # 圆角
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
    print("第八批项目专属启动画面生成 - 苹果白风格（纯 PIL 几何装饰）")
    print("=" * 60)

    print("\n[1/2] PIL 合成启动画面（每项目独特几何装饰）")
    generated = []
    for idx, (pid, cn, tag, icon_name) in enumerate(PROJECTS):
        icon_path = os.path.join(ICON_DIR, icon_name)
        out_path = os.path.join(SPLASH_DIR, f"{pid}-splash.png")
        try:
            compose_splash(idx, cn, tag, icon_path, out_path)
            generated.append((pid, out_path))
            print(f"  OK: {pid}-splash.png ({os.path.getsize(out_path)} bytes)")
        except Exception as e:
            print(f"  ERROR {pid}: {e}")
            import traceback; traceback.print_exc()
    print(f"\n合成完成: {len(generated)} 个启动画面")

    print("\n[2/2] 合成 mimo 评分预览图")
    if generated:
        preview_path = os.path.join(PREVIEW_DIR, "splash_batch8_preview.png")
        make_preview(generated, preview_path)
        print(f"  OK: {preview_path} ({os.path.getsize(preview_path)} bytes)")
        print("\nPREVIEW_PATH:" + preview_path)
    print("\nGENERATED_JSON:" + json.dumps(generated))
    print("\n完成！")
