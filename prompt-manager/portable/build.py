# -*- coding: utf-8 -*-
"""PyInstaller 打包脚本 —— 单 EXE 便携分发"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--noconsole",
    "--name", "提示词速唤便携版",
    "--icon", "icon.ico",
    # 包含数据文件
    "--add-data", "icon.ico;.",
    # PySide6 隐式导入
    "--hidden-import", "PySide6.QtCore",
    "--hidden-import", "PySide6.QtGui",
    "--hidden-import", "PySide6.QtWidgets",
    # 控制台编码
    "--noupx",
    # 清理上次构建
    "--clean",
    "-y",
    "main.py",
]
print("=== Running PyInstaller ===")
print(" ".join(cmd))
print()
result = subprocess.run(cmd, cwd=HERE)
if result.returncode != 0:
    print(f"FAILED with code {result.returncode}")
    sys.exit(1)
print()
print("=== Build complete ===")
dist_path = os.path.join(HERE, "dist")
if os.path.exists(dist_path):
    for f in os.listdir(dist_path):
        full = os.path.join(dist_path, f)
        if os.path.isfile(full):
            size_mb = os.path.getsize(full) / 1024 / 1024
            print(f"  {f}  ({size_mb:.1f} MB)")
