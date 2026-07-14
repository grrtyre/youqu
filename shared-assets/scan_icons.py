# -*- coding: utf-8 -*-
"""扫描 youqu 下所有项目图标源，统计尺寸/主色占比/蓝色占比，输出待优化清单"""
import os
from PIL import Image

ROOT = r"d:\Ai\mimo\youqu"
SHARED = os.path.join(ROOT, "shared-assets", "icons", "projects")
# 已在 shared-assets 统一过的项目
done = set(os.listdir(SHARED)) if os.path.isdir(SHARED) else set()

TARGET = (0x00, 0x7A, 0xFF)  # #007AFF

def color_distance(c1, c2):
    return sum((a-b)**2 for a, b in zip(c1, c2)) ** 0.5

def blue_ratio(img):
    """统计接近 #007AFF 的像素占比"""
    img = img.convert("RGB").resize((64, 64))
    px = img.load()
    cnt = 0
    total = 64 * 64
    for y in range(64):
        for x in range(64):
            if color_distance(px[x, y], TARGET) < 90:
                cnt += 1
    return cnt / total

rows = []
for proj in sorted(os.listdir(ROOT)):
    pdir = os.path.join(ROOT, proj)
    if not os.path.isdir(pdir):
        continue
    # 优先找 build/icon-source.png，其次 build/icon-256.png，再 build/icon.ico
    candidates = [
        os.path.join(pdir, "build", "icon-source.png"),
        os.path.join(pdir, "build", "icon-256.png"),
        os.path.join(pdir, "build", "icon-512.png"),
    ]
    src = None
    for c in candidates:
        if os.path.isfile(c):
            src = c
            break
    if not src:
        continue
    try:
        im = Image.open(src)
        w, h = im.size
        br = blue_ratio(im)
        in_shared = "✓已统一" if proj in done else "✗旧"
        rows.append((proj, w, h, f"{br*100:.0f}%", in_shared, src))
    except Exception as e:
        rows.append((proj, 0, 0, "ERR", str(e), src))

# 输出表格
print(f"{'项目':<28}{'宽':>6}{'高':>6}  {'蓝占比':>7}  状态")
print("-" * 70)
for r in rows:
    print(f"{r[0]:<28}{r[1]:>6}{r[2]:>6}  {r[3]:>7}  {r[4]}")

# 排序：未统一 + 蓝占比低的优先
print("\n=== 待优化优先级（未统一 + 蓝占比低）===")
todo = [r for r in rows if r[4] == "✗旧"]
todo.sort(key=lambda r: float(r[3].rstrip('%')))
for r in todo[:15]:
    print(f"  {r[0]:<28} 蓝{r[3]:>5}  尺寸{r[1]}x{r[2]}")
