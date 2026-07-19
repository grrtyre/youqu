# -*- coding: utf-8 -*-
"""reading-list-manager 图标生成脚本（PIL 复现）
本文件由 batch10 资源生成任务自动写入。
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "icon-source.png")
SIZES = [16, 32, 48, 64, 128, 256]
ICO_SIZES = [(s, s) for s in SIZES]


def main():
    img = Image.open(SRC).convert("RGBA")
    for s in SIZES:
        img.resize((s, s), Image.LANCZOS).save(
            os.path.join(HERE, f"icon-{s}.png"), "PNG")
    img.save(os.path.join(HERE, "icon.ico"), format="ICO", sizes=ICO_SIZES)
    print("done")


if __name__ == "__main__":
    main()
