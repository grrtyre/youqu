# -*- coding: utf-8 -*-
"""build.py —— PyInstaller 打包脚本，构建单文件 EXE 便携版。

用法：python build.py
输出：dist/置顶管家-便携版.exe
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent.resolve()
APP_NAME = "置顶管家-便携版"
ENTRY = "main.py"
DIST = HERE / "dist"
BUILD = HERE / "build"
ICON_FILE = HERE / "assets" / "icon.ico"


def ensure_icon():
    """打包前生成 .ico 文件。"""
    assets = HERE / "assets"
    assets.mkdir(exist_ok=True)
    if not ICON_FILE.exists():
        import icon
        icon.make_icon_file(str(ICON_FILE))
        print(f"已生成图标: {ICON_FILE}")


def main():
    # 清理旧构建
    for d in [DIST, BUILD, HERE / "__pycache__"]:
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)

    ensure_icon()

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--noconsole",
        "--name", APP_NAME,
        "--icon", str(ICON_FILE),
        # 隐式导入（customtkinter 经常需要）
        "--hidden-import", "customtkinter",
        "--hidden-import", "PIL",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "PIL.ImageDraw",
        "--hidden-import", "pystray",
        "--hidden-import", "keyboard",
        "--hidden-import", "win32_api",
        "--hidden-import", "store",
        "--hidden-import", "icon",
        "--hidden-import", "ui",
        "--hidden-import", "tray",
        "--hidden-import", "hotkey",
        "--hidden-import", "toast",
        # 收集 customtkinter 资源
        "--collect-data", "customtkinter",
        # 清理
        "--noconfirm",
        "--clean",
        # 工作目录
        "--distpath", str(DIST),
        "--workpath", str(BUILD),
        "--specpath", str(HERE),
        # 入口
        str(ENTRY),
    ]

    print("执行 PyInstaller 打包...")
    print(" ".join(cmd))
    print()

    result = subprocess.run(cmd, cwd=str(HERE))
    if result.returncode != 0:
        print("✗ PyInstaller 打包失败")
        sys.exit(1)

    exe_path = DIST / f"{APP_NAME}.exe"
    if exe_path.exists():
        size_mb = exe_path.stat().st_size / 1024 / 1024
        print(f"\n✓ 打包成功: {exe_path}")
        print(f"  文件大小: {size_mb:.2f} MB")
    else:
        print(f"✗ 输出 EXE 不存在: {exe_path}")
        sys.exit(1)


if __name__ == "__main__":
    main()
