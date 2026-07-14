# -*- coding: utf-8 -*-
"""把 shared-assets/icons/projects/<proj>/ 的图标产物同步到 <proj>/build/
只复制图标文件，不触碰 build/ 内的脚本和日志。"""
import os
import shutil

ROOT = r"d:\Ai\mimo\youqu"
SHARED_PROJ = os.path.join(ROOT, "shared-assets", "icons", "projects")

PROJECTS = [
    "anniversary-manager",
    "checksum-manager",
    "hosts-manager",
    "image-converter",
    "pdf-toolbox",
]

# 要复制的图标文件名模式
ICON_FILES = [
    "icon-source.png",
    "icon.ico",
    "icon-16.png",
    "icon-32.png",
    "icon-64.png",
    "icon-128.png",
    "icon-256.png",
    "icon-512.png",
]


def sync():
    for proj in PROJECTS:
        src_dir = os.path.join(SHARED_PROJ, proj)
        dst_dir = os.path.join(ROOT, proj, "build")
        if not os.path.isdir(src_dir):
            print(f"[SKIP] {proj}: 源不存在 {src_dir}")
            continue
        os.makedirs(dst_dir, exist_ok=True)
        copied = []
        for fn in ICON_FILES:
            src = os.path.join(src_dir, fn)
            if not os.path.isfile(src):
                continue
            dst = os.path.join(dst_dir, fn)
            shutil.copy2(src, dst)
            copied.append(fn)
        print(f"[OK] {proj}: 同步 {len(copied)} 个文件 -> {dst_dir}")
        for fn in copied:
            print(f"     - {fn}")


if __name__ == "__main__":
    sync()
