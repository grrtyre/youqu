# -*- coding: utf-8 -*-
"""PyInstaller 打包脚本 —— 构建单文件 EXE 便携版。
用法：python build.py
输出：dist/快速翻译器-便携版.exe
"""
import os
import subprocess
import sys
import shutil
from pathlib import Path

HERE = Path(__file__).parent.resolve()
APP_NAME = "快速翻译器-便携版"
ENTRY = "main.py"
ICON = HERE / "assets" / "icon.ico"
DIST = HERE / "dist"
BUILD = HERE / "build"


def main():
    # 清理旧构建
    for d in [DIST, BUILD, HERE / "__pycache__"]:
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)

    # PyInstaller 命令
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--noconsole",
        "--name", APP_NAME,
        "--icon", str(ICON),
        # 包含资源文件
        "--add-data", f"assets{os.pathsep}assets",
        # 隐式导入
        "--hidden-import", "PySide6.QtCore",
        "--hidden-import", "PySide6.QtGui",
        "--hidden-import", "PySide6.QtWidgets",
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
