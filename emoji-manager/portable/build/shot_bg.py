# -*- coding: utf-8 -*-
# 后台截图脚本：启动便携版 → EnumWindows 找窗口 → PrintWindow(flag=2) 截图 → 关闭进程
# 严禁使用 CopyFromScreen（要求窗口在前台，会打扰用户）
# 用法: python shot_bg.py <exe_or_script> <out_png> [args...]
import sys
import os
import time
import subprocess
import ctypes
from ctypes import wintypes, c_void_p, c_int, c_uint, c_bool, c_long, POINTER, CFUNCTYPE

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

# 结构与回调
class RECT(ctypes.Structure):
    _fields_ = [("left", c_long), ("top", c_long), ("right", c_long), ("bottom", c_long)]

WNDENUMPROC = CFUNCTYPE(c_bool, wintypes.HWND, wintypes.LPARAM)

user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
user32.EnumWindows.restype = c_bool
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = c_bool
user32.GetWindowRect.argtypes = [wintypes.HWND, POINTER(RECT)]
user32.GetWindowRect.restype = c_bool
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, c_uint]
user32.PrintWindow.restype = c_bool
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, c_int]
user32.GetClassNameW.restype = c_int

# GDI
gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, c_int, c_int]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.SelectObject.restype = wintypes.HGDIOBJ
gdi32.BitBlt.argtypes = [wintypes.HDC, c_int, c_int, c_int, c_int, wintypes.HDC, c_int, c_int, wintypes.DWORD]
gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.CreateSolidBrush.argtypes = [wintypes.COLORREF]
gdi32.CreateSolidBrush.restype = wintypes.HBRUSH
user32.FillRect.argtypes = [wintypes.HDC, POINTER(RECT), wintypes.HBRUSH]
user32.FillRect.restype = c_int

# 用于保存位图到文件 —— 用 Pillow
from PIL import Image


def find_window_for_pid(pid: int):
    """通过 EnumWindows + GetWindowThreadProcessId 找到属于指定进程的可见窗口"""
    found = []

    def cb(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True
        p = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(p))
        if p.value == pid:
            # 读取类名，过滤 Qt 工具提示等辅助窗口，保留主窗口
            buf = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, buf, 256)
            cls = buf.value
            r = RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            w = r.right - r.left
            h = r.bottom - r.top
            if w > 50 and h > 50:
                found.append((hwnd, cls, w, h))
        return True

    user32.EnumWindows(WNDENUMPROC(cb), 0)
    return found


def capture_window(hwnd, w, h, out_path):
    """用 PrintWindow(hwnd, hdc, 2) 后台截取窗口内容（不抢焦点）"""
    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    bmp = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    old = gdi32.SelectObject(hdc_mem, bmp)
    # 填充白色背景，避免透明窗口截出黑色
    brush = gdi32.CreateSolidBrush(0x00FFFFFF)  # 白色 (BGR)
    gdi32.SelectObject(hdc_mem, brush)
    from ctypes import byref
    r = RECT(0, 0, w, h)
    user32.FillRect(hdc_mem, byref(r), brush)
    # PrintWindow flag 2 = PW_RENDERFULLCONTENT
    ok = user32.PrintWindow(hwnd, hdc_mem, 2)
    # 拷贝到 Pillow
    gdi32.SelectObject(hdc_mem, old)
    # 通过 GetDIBits 读取像素
    bmi = ctypes.create_string_buffer(40 + 4 * 8)
    # BITMAPINFOHEADER
    ctypes.memmove(bmi, ctypes.byref(ctypes.c_uint32(40)), 4)  # biSize
    ctypes.memmove(ctypes.addressof(bmi) + 4, ctypes.byref(ctypes.c_int32(w)), 4)
    ctypes.memmove(ctypes.addressof(bmi) + 8, ctypes.byref(ctypes.c_int32(-h)), 4)  # 负高度=top-down
    ctypes.memmove(ctypes.addressof(bmi) + 12, ctypes.byref(ctypes.c_uint16(1)), 2)  # planes
    ctypes.memmove(ctypes.addressof(bmi) + 14, ctypes.byref(ctypes.c_uint16(32)), 2)  # bitcount
    gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, c_uint, c_uint, c_void_p, c_void_p, c_uint]
    gdi32.GetDIBits.restype = c_int
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
    if len(sys.argv) < 3:
        print("用法: python shot_bg.py <script.py|exe> <out_png> [extra args]")
        sys.exit(1)
    target = sys.argv[1]
    out_png = sys.argv[2]
    extra = sys.argv[3:]
    os.makedirs(os.path.dirname(out_png), exist_ok=True)

    # 启动目标（后台，不激活到前台）
    if target.endswith(".py"):
        cmd = ["python", target] + extra
    else:
        cmd = [target] + extra
    env = os.environ.copy()
    env["PORTABLE_SHOT_MODE"] = "1"  # 截图模式：禁用失焦隐藏，预填示例
    proc = subprocess.Popen(cmd, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"started pid={proc.pid}")
    time.sleep(3.5)
    wins = find_window_for_pid(proc.pid)
    # 重试查找窗口（窗口可能延迟创建）
    for attempt in range(5):
        if wins:
            break
        time.sleep(1)
        wins = find_window_for_pid(proc.pid)
        print(f"retry {attempt+1}: found {len(wins)} candidate window(s)")
    print(f"found {len(wins)} candidate window(s)")
    if not wins:
        print("no window found")
        proc.kill()
        sys.exit(2)
    hwnd, cls, w, h = wins[0]
    print(f"capture hwnd={hwnd} class={cls} {w}x{h}")
    ok = capture_window(hwnd, w, h, out_png)
    print(f"PrintWindow ok={ok} saved={out_png}")
    proc.kill()
    proc.wait(timeout=5)


if __name__ == "__main__":
    main()
