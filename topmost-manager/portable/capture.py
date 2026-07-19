# -*- coding: utf-8 -*-
"""capture.py —— 后台截图脚本。

约束：
- 使用 PrintWindow（flag 2 = PW_RENDERFULLCONTENT）后台截取
- 严禁 CopyFromScreen
- 按 PID 定位窗口（EnumWindows + GetWindowThreadProcessId）
- 截完立即停掉自己启动的进程

用法：
  python capture.py
  会启动 main.py（TM_DEMO=1），等窗口出现后截图保存到
  D:\\Ai\\mimo\\screenshots\\topmost-manager-portable.png，然后停掉进程。
"""
from __future__ import annotations

import ctypes
import os
import subprocess
import sys
import time
from ctypes import wintypes
from pathlib import Path

# ---- Win32 常量 ----
PW_RENDERFULLCONTENT = 2
SRCCOPY = 0x00CC0020
DIB_RGB_COLORS = 0
BI_RGB = 0
CAPTUREBLT = 0x40000000

user32 = ctypes.WinDLL("user32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
user32.EnumWindows.restype = wintypes.BOOL

user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND,
                                             ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD

user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = wintypes.BOOL

user32.GetWindowRect.argtypes = [wintypes.HWND,
                                  ctypes.POINTER(wintypes.RECT)]
user32.GetWindowRect.restype = wintypes.BOOL

user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int

user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
user32.PrintWindow.restype = wintypes.BOOL

user32.GetWindowDC.argtypes = [wintypes.HWND]
user32.GetWindowDC.restype = wintypes.HDC

user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.ReleaseDC.restype = ctypes.c_int

gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC

gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int,
                                          ctypes.c_int]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP

gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.SelectObject.restype = wintypes.HGDIOBJ

gdi32.BitBlt.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int,
                          ctypes.c_int, ctypes.c_int, wintypes.HDC,
                          ctypes.c_int, ctypes.c_int, wintypes.DWORD]
gdi32.BitBlt.restype = wintypes.BOOL

gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteDC.restype = wintypes.BOOL

gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.DeleteObject.restype = wintypes.BOOL

gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, ctypes.c_uint,
                             ctypes.c_uint, ctypes.c_void_p,
                             ctypes.c_void_p, ctypes.c_uint]
gdi32.GetDIBits.restype = ctypes.c_int


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER),
                 ("bmiColors", wintypes.DWORD * 3)]


def find_window_by_pid(pid: int):
    """枚举顶层窗口，返回属于指定 PID 且可见、有标题的第一个窗口句柄。"""
    found = []

    def _cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if int(p.value) != pid:
            return True
        # 取标题用于调试
        buf = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, buf, 256)
        if buf.value:
            found.append((int(hwnd), buf.value))
        return True

    user32.EnumWindows(WNDENUMPROC(_cb), 0)
    return found[0] if found else (None, None)


def capture_window(hwnd: int, save_path: str) -> bool:
    """用 PrintWindow 后台截取窗口，保存为 PNG。"""
    rect = wintypes.RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return False
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w <= 0 or h <= 0:
        return False

    # 加点边距以防边框
    w = max(w, 100)
    h = max(h, 100)

    hdc_screen = user32.GetWindowDC(hwnd)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    old = gdi32.SelectObject(hdc_mem, hbmp)

    # PrintWindow with PW_RENDERFULLCONTENT (2) —— 后台捕获完整内容
    ok = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)
    if not ok:
        # 退回 flag 0（不带 FULLCONTENT，部分窗口仍可）
        ok = user32.PrintWindow(hwnd, hdc_mem, 0)

    if not ok:
        gdi32.SelectObject(hdc_mem, old)
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(hwnd, hdc_screen)
        return False

    # 读出位图数据
    bi = BITMAPINFO()
    bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.bmiHeader.biWidth = w
    bi.bmiHeader.biHeight = -h  # 负值：自上而下
    bi.bmiHeader.biPlanes = 1
    bi.bmiHeader.biBitCount = 32
    bi.bmiHeader.biCompression = BI_RGB

    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(hdc_mem, hbmp, 0, h, buf, ctypes.byref(bi),
                     DIB_RGB_COLORS)

    gdi32.SelectObject(hdc_mem, old)
    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(hwnd, hdc_screen)

    # 用 PIL 转 PNG
    from PIL import Image
    img = Image.frombuffer("RGBA", (w, h), buf.raw, "raw", "BGRA", 0, 1)
    # 加白色背景（避免透明区域显示为黑）
    bg = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    bg.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
    bg.convert("RGB").save(save_path, "PNG")
    return True


def main():
    here = Path(__file__).resolve().parent
    main_py = here / "main.py"

    # 截图输出目录
    out_dir = Path(r"D:\Ai\mimo\screenshots")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = str(out_dir / "topmost-manager-portable.png")

    # 启动子进程（TM_DEMO=1，CREATE_NO_WINDOW 隐藏控制台）
    env = os.environ.copy()
    env["TM_DEMO"] = "1"
    CREATE_NO_WINDOW = 0x08000000
    print(f"[capture] 启动 main.py（TM_DEMO=1）...")
    proc = subprocess.Popen(
        [sys.executable, str(main_py)],
        cwd=str(here),
        env=env,
        creationflags=CREATE_NO_WINDOW,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        pid = proc.pid
        print(f"[capture] 子进程 PID = {pid}")

        # 等窗口出现（最多 8 秒）
        hwnd = None
        title = None
        for i in range(40):
            time.sleep(0.2)
            hwnd, title = find_window_by_pid(pid)
            if hwnd:
                print(f"[capture] 找到窗口 hwnd={hwnd} title={title!r}")
                break
        if not hwnd:
            print("[capture] 未找到窗口")
            return False

        # 再等一下让 UI 完全渲染（customtkinter 需要时间布局）
        time.sleep(1.5)

        ok = capture_window(hwnd, out_path)
        if ok:
            size_kb = os.path.getsize(out_path) / 1024
            print(f"[capture] 截图保存: {out_path} ({size_kb:.1f} KB)")
            return True
        else:
            print("[capture] PrintWindow 失败")
            return False
    finally:
        # 立即停掉自己启动的进程（按 PID）
        try:
            proc.terminate()
            proc.wait(timeout=3)
            print(f"[capture] 已停止子进程 PID={pid}")
        except Exception as e:
            try:
                proc.kill()
            except Exception:
                pass
            print(f"[capture] 停止子进程异常: {e}")


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
