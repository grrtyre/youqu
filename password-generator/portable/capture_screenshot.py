# -*- coding: utf-8 -*-
"""capture_screenshot.py - 后台截图脚本

通过 PID 定位窗口（EnumWindows + GetWindowThreadProcessId），
使用 PrintWindow + PW_RENDERFULLCONTENT(2) 后台渲染到内存 DC，
不抢焦点、不打扰用户前台工作，禁止 CopyFromScreen。

用法：python capture_screenshot.py --pid <PID> --output <PNG路径> [--timeout 20]
"""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import sys
import time

from PIL import Image

PW_RENDERFULLCONTENT = 2  # DWM 重新渲染窗口内容，即使被遮挡

user32 = ctypes.WinDLL("user32", use_last_error=True)
gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

# 类型定义
WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
user32.EnumWindows.restype = wintypes.BOOL
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = wintypes.BOOL
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetWindowRect.restype = wintypes.BOOL
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
user32.PrintWindow.restype = wintypes.BOOL
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowTextLengthW.restype = ctypes.c_int
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetClassNameW.restype = ctypes.c_int

gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.SelectObject.restype = wintypes.HGDIOBJ
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.DeleteObject.restype = wintypes.BOOL
gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteDC.restype = wintypes.BOOL
gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, ctypes.c_uint, ctypes.c_uint,
                             ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint]
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
    _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", wintypes.DWORD * 3)]


def find_windows_for_pid(pid: int):
    """返回属于指定 PID 的所有可见顶级窗口 HWND 列表。"""
    found = []

    def _cb(hwnd, _lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        wpid = wintypes.DWORD(0)
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
        if wpid.value == pid:
            found.append(hwnd)
        return True

    user32.EnumWindows(WNDENUMPROC(_cb), 0)
    return found


def choose_best_window(hwnds):
    """选择面积最大的窗口（主界面）。"""
    best = None
    best_area = 0
    for hwnd in hwnds:
        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            continue
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        area = w * h
        if area > best_area and w > 50 and h > 50:
            best_area = area
            best = hwnd
    return best


def capture_window(hwnd, output_path: str) -> bool:
    rect = wintypes.RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        print(f"GetWindowRect 失败", file=sys.stderr)
        return False
    width = rect.right - rect.left
    height = rect.bottom - rect.top
    if width <= 0 or height <= 0:
        print(f"窗口尺寸异常 {width}x{height}", file=sys.stderr)
        return False

    hdc_mem = gdi32.CreateCompatibleDC(None)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_mem, width, height)
    gdi32.SelectObject(hdc_mem, hbmp)

    # 多次重试：Qt 窗口可能首次渲染未完成
    ok = False
    for attempt in range(3):
        ok = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)
        if ok:
            break
        time.sleep(0.4)

    if not ok:
        # 回退到无 flag 的 PrintWindow
        ok = user32.PrintWindow(hwnd, hdc_mem, 0)

    if not ok:
        print(f"PrintWindow 失败 (尝试 {attempt + 1})", file=sys.stderr)
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_mem)
        return False

    # 读取像素到 PIL
    bi = BITMAPINFO()
    bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.bmiHeader.biWidth = width
    bi.bmiHeader.biHeight = -height  # top-down
    bi.bmiHeader.biPlanes = 1
    bi.bmiHeader.biBitCount = 32
    bi.bmiHeader.biCompression = 0  # BI_RGB

    buf = ctypes.create_string_buffer(width * height * 4)
    got = gdi32.GetDIBits(hdc_mem, hbmp, 0, height, buf, ctypes.byref(bi), 0)
    if not got:
        print("GetDIBits 失败", file=sys.stderr)
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_mem)
        return False

    img = Image.frombytes("RGBA", (width, height), buf.raw)
    # 去除可能的纯透明背景：合成到白底
    bg = Image.new("RGBA", (width, height), (245, 245, 247, 255))
    composed = Image.alpha_composite(bg, img)
    composed.convert("RGB").save(output_path, "PNG")

    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc_mem)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pid", type=int, required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--timeout", type=int, default=25, help="等待窗口就绪最大秒数")
    args = ap.parse_args()

    deadline = time.time() + args.timeout
    hwnd = None
    while time.time() < deadline:
        hwnds = find_windows_for_pid(args.pid)
        if hwnds:
            hwnd = choose_best_window(hwnds)
            if hwnd:
                break
        time.sleep(0.5)

    if not hwnd:
        print(f"未找到 PID={args.pid} 的窗口", file=sys.stderr)
        sys.exit(2)

    # 等待窗口渲染稳定
    time.sleep(1.2)
    ok = capture_window(hwnd, args.output)
    if ok:
        print(f"OK {args.output}")
        sys.exit(0)
    else:
        sys.exit(3)


if __name__ == "__main__":
    main()
