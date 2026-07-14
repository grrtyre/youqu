# -*- coding: utf-8 -*-
# 按窗口标题查找并后台截图（解决 PyInstaller onefile 父子进程问题）
# 用法: python shot_by_title.py <exe> <out_png> <title_substring>
import sys
import os
import time
import subprocess
import ctypes
from ctypes import wintypes, c_void_p, c_int, c_uint, c_bool, c_long, POINTER, CFUNCTYPE

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32


class RECT(ctypes.Structure):
    _fields_ = [("left", c_long), ("top", c_long), ("right", c_long), ("bottom", c_long)]


WNDENUMPROC = CFUNCTYPE(c_bool, wintypes.HWND, wintypes.LPARAM)

user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
user32.EnumWindows.restype = c_bool
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = c_bool
user32.GetWindowRect.argtypes = [wintypes.HWND, POINTER(RECT)]
user32.GetWindowRect.restype = c_bool
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, c_uint]
user32.PrintWindow.restype = c_bool
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, c_int]
user32.GetWindowTextW.restype = c_int
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, c_int]
user32.GetClassNameW.restype = c_int
user32.FillRect.argtypes = [wintypes.HDC, POINTER(RECT), wintypes.HBRUSH]
user32.FillRect.restype = c_int
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.ReleaseDC.restype = c_int
user32.GetDC.argtypes = [wintypes.HWND]
user32.GetDC.restype = wintypes.HDC

gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, c_int, c_int]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.SelectObject.restype = wintypes.HGDIOBJ
gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.CreateSolidBrush.argtypes = [wintypes.COLORREF]
gdi32.CreateSolidBrush.restype = wintypes.HBRUSH
gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, c_uint, c_uint, c_void_p, c_void_p, c_uint]
gdi32.GetDIBits.restype = c_int

from PIL import Image


def find_window_by_title(title_sub: str):
    """通过窗口标题包含子串查找可见窗口"""
    found = []

    def cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        buf = ctypes.create_unicode_buffer(512)
        user32.GetWindowTextW(hwnd, buf, 512)
        title = buf.value
        if title_sub in title:
            cls_buf = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cls_buf, 256)
            r = RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            w = r.right - r.left
            h = r.bottom - r.top
            if w > 50 and h > 50:
                found.append((hwnd, cls_buf.value, title, w, h))
        return True

    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return found


def capture_window(hwnd, w, h, out_path):
    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    bmp = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    old = gdi32.SelectObject(hdc_mem, bmp)
    brush = gdi32.CreateSolidBrush(0x00FFFFFF)
    gdi32.SelectObject(hdc_mem, brush)
    from ctypes import byref
    r = RECT(0, 0, w, h)
    user32.FillRect(hdc_mem, byref(r), brush)
    ok = user32.PrintWindow(hwnd, hdc_mem, 2)
    gdi32.SelectObject(hdc_mem, old)
    bmi = ctypes.create_string_buffer(40 + 4 * 8)
    ctypes.memmove(bmi, ctypes.byref(ctypes.c_uint32(40)), 4)
    ctypes.memmove(ctypes.addressof(bmi) + 4, ctypes.byref(ctypes.c_int32(w)), 4)
    ctypes.memmove(ctypes.addressof(bmi) + 8, ctypes.byref(ctypes.c_int32(-h)), 4)
    ctypes.memmove(ctypes.addressof(bmi) + 12, ctypes.byref(ctypes.c_uint16(1)), 2)
    ctypes.memmove(ctypes.addressof(bmi) + 14, ctypes.byref(ctypes.c_uint16(32)), 2)
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(hdc_mem, bmp, 0, h, buf, bmi, 0)
    img = Image.frombuffer("RGBA", (w, h), buf.raw, "raw", "BGRA", 0, 1)
    img.save(out_path)
    gdi32.DeleteObject(bmp)
    gdi32.DeleteObject(brush)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc_screen)
    return ok


def main():
    if len(sys.argv) < 4:
        print("用法: python shot_by_title.py <exe> <out_png> <title_substring>")
        sys.exit(1)
    target = sys.argv[1]
    out_png = sys.argv[2]
    title_sub = sys.argv[3]
    os.makedirs(os.path.dirname(out_png), exist_ok=True)

    env = os.environ.copy()
    env["PORTABLE_SHOT_MODE"] = "1"
    proc = subprocess.Popen([target], env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"started pid={proc.pid}")
    # PyInstaller onefile 需要更长启动时间
    time.sleep(6)
    wins = find_window_by_title(title_sub)
    for attempt in range(8):
        if wins:
            break
        time.sleep(1)
        wins = find_window_by_title(title_sub)
        print(f"retry {attempt+1}: found {len(wins)} window(s)")
    print(f"found {len(wins)} candidate window(s)")
    if not wins:
        print("no window found")
        proc.kill()
        sys.exit(2)
    hwnd, cls, title, w, h = wins[0]
    print(f"capture hwnd={hwnd} class={cls} title={title!r} {w}x{h}")
    ok = capture_window(hwnd, w, h, out_png)
    print(f"PrintWindow ok={ok} saved={out_png}")
    proc.kill()
    try:
        proc.wait(timeout=5)
    except Exception:
        pass


if __name__ == "__main__":
    main()
