# -*- coding: utf-8 -*-
"""快速自检：每个图标的蓝色占比 + 内容包围框 + 居中度，发现异常先修"""
import os
from PIL import Image

SHARED = r"d:\Ai\mimo\youqu\shared-assets"
PROJS = ["alarm-manager", "world-clock", "pomodoro-manager",
         "emoji-manager", "unit-converter", "mind-map-manager"]
BLUE = (0, 122, 255)
TOL = 40  # 颜色容差

def is_blue(p):
    return abs(p[0]-BLUE[0])<TOL and abs(p[1]-BLUE[1])<TOL and abs(p[2]-BLUE[2])<TOL

for p in PROJS:
    src = os.path.join(SHARED, "icons", "projects", p, "icon-source.png")
    im = Image.open(src).convert("RGB")
    px = im.load()
    W, H = im.size
    blue = 0
    minx, miny, maxx, maxy = W, H, 0, 0
    for y in range(H):
        for x in range(W):
            if is_blue(px[x, y]):
                blue += 1
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    ratio = blue / (W*H) * 100
    cx = (minx+maxx)/2
    cy = (miny+maxy)/2
    bw = maxx-minx
    bh = maxy-miny
    print(f"{p:20s} blue={ratio:5.2f}%  bbox=({minx},{miny})-({maxx},{maxy})  center=({cx:.0f},{cy:.0f})  size={bw}x{bh}  offcenter=({cx-512:.0f},{cy-512:.0f})")
