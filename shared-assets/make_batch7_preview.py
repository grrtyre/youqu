# -*- coding: utf-8 -*-
"""第七批图标预览图合成 (苹果白风格, 2行3列 + 标签)"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = r"D:\Ai\mimo\youqu\shared-assets\icons\projects"
PREVIEW = r"D:\Ai\mimo\screenshots\batch7_preview.png"

# 画布参数 (苹果白)
BG = (255, 255, 255)
CARD_BG = (255, 255, 255)
CARD_BORDER = (229, 229, 234)   # 极淡灰边框
TITLE = (28, 28, 30)
SUB = (108, 108, 118)
ACCENT = (0, 122, 255)

PADDING = 80
COLS, ROWS = 3, 2
CARD = 420                    # 卡片宽高
GAP = 56
ICON_INNER = 320             # 图标显示尺寸
HEADER_H = 90

W = PADDING*2 + COLS*CARD + (COLS-1)*GAP
H = PADDING*2 + HEADER_H + ROWS*CARD + (ROWS-1)*GAP + 80

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# 字体
def font(sz, bold=False):
    for p in [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
              r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\segoeui.ttf"]:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()

f_title = font(46, True)
f_sub = font(26, False)
f_name = font(30, True)
f_file = font(22, False)

# 顶部标题
d.text((PADDING, 56), "shared-assets · icons/projects", font=f_title, fill=TITLE)
d.text((PADDING, 56 + 60), "Batch 7 · 6 project icons · Apple-white · #007AFF · 16px stroke",
       font=f_sub, fill=SUB)
# 顶部强调线
d.rounded_rectangle([PADDING, 56 + 110, PADDING + 96, 56 + 116], radius=3, fill=ACCENT)

names = ["ocr-manager", "disk-manager", "keyboard-tester",
         "text-manager", "eye-rest-manager", "port-manager"]
cn_names = {
    "ocr-manager": "OCR 文字识别",
    "disk-manager": "磁盘管家",
    "keyboard-tester": "键盘测试",
    "text-manager": "文本管家",
    "eye-rest-manager": "护眼管家",
    "port-manager": "端口管家",
}

grid_y0 = PADDING + HEADER_H + 60
for idx, name in enumerate(names):
    r = idx // COLS
    c = idx % COLS
    cx = PADDING + c * (CARD + GAP)
    cy = grid_y0 + r * (CARD + GAP)
    # 卡片
    d.rounded_rectangle([cx, cy, cx + CARD, cy + CARD], radius=24,
                        fill=CARD_BG, outline=CARD_BORDER, width=2)
    # 图标
    src = os.path.join(OUT_DIR, name, "icon-256.png")
    ic = Image.open(src).convert("RGB").resize((ICON_INNER, ICON_INNER), Image.LANCZOS)
    img.paste(ic, (cx + (CARD - ICON_INNER)//2, cy + 44))
    # 名称
    d.text((cx + 24, cy + CARD - 96), name, font=f_name, fill=TITLE)
    d.text((cx + 24, cy + CARD - 56), cn_names.get(name, ""), font=f_file, fill=SUB)

img.save(PREVIEW, quality=95)
print("saved:", PREVIEW, "size", img.size)
