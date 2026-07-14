# -*- coding: utf-8 -*-
"""验证本批 10 个源的蓝占比/白底占比/尺寸"""
import os
from PIL import Image

ROOT = r"d:\Ai\mimo\youqu\shared-assets\icons"
T = (0, 122, 255)
WT = (255, 255, 255)

paths = [
    os.path.join(ROOT, "projects", p, "icon-source.png")
    for p in ["anniversary-manager", "checksum-manager", "hosts-manager",
              "image-converter", "pdf-toolbox"]
] + [
    os.path.join(ROOT, n + "-source.png")
    for n in ["settings", "search", "close", "minimize", "add"]
]

print(f"{'name':<32}{'size':>14}{'blue%':>9}{'white%':>9}")
print("-" * 64)
for p in paths:
    if not os.path.isfile(p):
        print(f"{os.path.basename(p):<32}  MISSING")
        continue
    im = Image.open(p).convert("RGB")
    sz = im.size
    im2 = im.resize((64, 64))
    px = im2.load()
    blue = sum(1 for y in range(64) for x in range(64)
               if sum((a-b)**2 for a, b in zip(px[x, y], T))**0.5 < 90) / 4096
    white = sum(1 for y in range(64) for x in range(64)
                if sum((a-b)**2 for a, b in zip(px[x, y], WT))**0.5 < 8) / 4096
    print(f"{os.path.basename(p):<32}{str(sz):>14}{blue*100:>8.1f}%{white*100:>8.1f}%")
