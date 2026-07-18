# -*- coding: utf-8 -*-
"""build_exe.py — PyInstaller 单 exe 构建脚本

构建护眼管家便携版单文件 exe：
- onefile：单 exe 分发
- noconsole：无控制台窗口
- 包含 customtkinter 数据文件
- 图标：assets/icon.ico
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))        # build/
PORTABLE = os.path.dirname(HERE)                          # portable/
SRC = os.path.join(PORTABLE, "src")
DIST = os.path.join(PORTABLE, "dist")
ICON = os.path.join(PORTABLE, "assets", "icon.ico")

# 确保 dist 目录
os.makedirs(DIST, exist_ok=True)

# customtkinter 数据
import customtkinter
ctk_path = os.path.dirname(customtkinter.__file__)

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--noconsole",
    "--name", "EyeRestPortable",
    "--distpath", DIST,
    "--workpath", os.path.join(HERE, "pyinstaller_work"),
    "--specpath", HERE,
    "--add-data", f"{ctk_path}{os.pathsep}customtkinter",
    "--collect-submodules", "customtkinter",
    "--hidden-import", "PIL._tkinter_finder",
    # Win32 资源
    "--hidden-import", "ctypes",
    "--hidden-import", "ctypes.wintypes",
]
if os.path.exists(ICON):
    cmd += ["--icon", ICON]

cmd += [os.path.join(SRC, "main.py")]

print("执行构建命令:")
print(" ".join(cmd))
print()
result = subprocess.run(cmd)
if result.returncode == 0:
    exe = os.path.join(DIST, "EyeRestPortable.exe")
    size_mb = os.path.getsize(exe) / 1024 / 1024
    print(f"\n构建成功: {exe}")
    print(f"体积: {size_mb:.1f} MB")
else:
    print("\n构建失败")
    sys.exit(1)
