# -*- coding: utf-8 -*-
"""后台窗口截图工具 - 用 PrintWindow API 后台截取
按 PID + 标题定位窗口，多 flag 重试。禁止 CopyFromScreen。"""

import ctypes
import ctypes.wintypes as wintypes
import sys
import os
from PIL import Image

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

# 函数原型
user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
user32.EnumWindows.restype = wintypes.BOOL
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND,
                                             ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = wintypes.BOOL
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetWindowRect.restype = wintypes.BOOL
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetClassNameW.restype = ctypes.c_int
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
user32.PrintWindow.restype = wintypes.BOOL
user32.GetDC.argtypes = [wintypes.HWND]
user32.GetDC.restype = wintypes.HDC
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.ReleaseDC.restype = ctypes.c_int
user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.ShowWindow.restype = wintypes.BOOL
user32.UpdateWindow.argtypes = [wintypes.HWND]
user32.UpdateWindow.restype = wintypes.BOOL
user32.RedrawWindow.argtypes = [wintypes.HWND, ctypes.c_void_p,
                                 ctypes.c_void_p, wintypes.UINT]
user32.RedrawWindow.restype = wintypes.BOOL

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
gdi32.BitBlt.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int,
                          ctypes.c_int, ctypes.c_int, wintypes.HDC,
                          ctypes.c_int, ctypes.c_int, wintypes.DWORD]
gdi32.BitBlt.restype = wintypes.BOOL
gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT,
                             wintypes.UINT, wintypes.LPVOID, ctypes.c_void_p,
                             wintypes.UINT]
gdi32.GetDIBits.restype = ctypes.c_int
user32.FillRect.argtypes = [wintypes.HDC, ctypes.c_void_p, wintypes.HBRUSH]
user32.FillRect.restype = ctypes.c_int


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ('biSize', wintypes.UINT),
        ('biWidth', wintypes.LONG),
        ('biHeight', wintypes.LONG),
        ('biPlanes', wintypes.WORD),
        ('biBitCount', wintypes.WORD),
        ('biCompression', wintypes.DWORD),
        ('biSizeImage', wintypes.DWORD),
        ('biXPelsPerMeter', wintypes.LONG),
        ('biYPelsPerMeter', wintypes.LONG),
        ('biClrUsed', wintypes.DWORD),
        ('biClrImportant', wintypes.DWORD),
    ]


class RECT_C(ctypes.Structure):
    _fields_ = [('left', ctypes.c_long), ('top', ctypes.c_long),
                ('right', ctypes.c_long), ('bottom', ctypes.c_long)]


def find_main_window(pid: int, title_contains: str = ''):
    """查找属于 pid 且标题包含 title_contains 的可见顶层窗口。"""
    found = []

    def _cb(hwnd, lparam):
        wpid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
        if wpid.value != pid:
            return True
        if not user32.IsWindowVisible(hwnd):
            return True
        title_buf = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, title_buf, 256)
        cls_buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls_buf, 256)
        title = title_buf.value
        cls = cls_buf.value
        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = rect.right - rect.left
        h = rect.bottom - rect.top
        if w <= 1 or h <= 1:
            return True
        if title_contains and title_contains.lower() not in title.lower():
            return True
        found.append((hwnd, title, cls, (rect.left, rect.top,
                                         rect.right, rect.bottom), w, h))
        return True

    user32.EnumWindows(WNDENUMPROC(_cb), 0)
    return found


def capture_window(hwnd, out_path: str) -> bool:
    """后台截取窗口，保存 PNG。尝试多种 PrintWindow flag。"""
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w <= 0 or h <= 0:
        print(f'  无效窗口尺寸 {w}x{h}')
        return False

    # 强制重绘确保内容已渲染
    RDW_INVALIDATE = 0x0001
    user32.RedrawWindow(hwnd, None, None, RDW_INVALIDATE)
    user32.UpdateWindow(hwnd)

    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    bmp = gdi32.CreateCompatibleBitmap(hdc_screen, w, h)
    old = gdi32.SelectObject(hdc_mem, bmp)

    # 白底填充
    rc = RECT_C(0, 0, w, h)
    user32.FillRect(hdc_mem, ctypes.byref(rc), 5)  # 5 = WHITE_BRUSH

    # 多 flag 尝试
    captured = False
    for flag in (2, 0, 3):
        ok = user32.PrintWindow(hwnd, hdc_mem, flag)
        print(f'  PrintWindow flag={flag} -> {ok}')
        if ok:
            captured = True
            break

    # 回退：BitBlt（从窗口 DC 复制）
    if not captured:
        print('  PrintWindow 全失败，尝试 BitBlt')
        hdc_win = user32.GetDC(hwnd)
        if hdc_win:
            ok2 = gdi32.BitBlt(hdc_mem, 0, 0, w, h, hdc_win, 0, 0,
                               0x00CC0020 | 0x40000000)
            print(f'  BitBlt -> {ok2}')
            user32.ReleaseDC(hwnd, hdc_win)
            captured = ok2

    # 取像素
    bih = BITMAPINFOHEADER()
    bih.biSize = ctypes.sizeof(bih)
    bih.biWidth = w
    bih.biHeight = -h  # 自上而下
    bih.biPlanes = 1
    bih.biBitCount = 32
    bih.biCompression = 0
    buf = ctypes.create_string_buffer(w * h * 4)
    gdi32.GetDIBits(hdc_mem, bmp, 0, h, buf, ctypes.byref(bih), 0)

    img = Image.frombuffer('RGBA', (w, h), buf.raw, 'raw', 'BGRA', 0, 1)
    # 合成白底：PrintWindow 把透明区域捕获为不透明黑色，需用圆角矩形 mask 精确替换
    bg = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    bg.alpha_composite(img)
    final_rgba = bg.convert('RGBA')
    # 用圆角矩形 mask：卡片区域保留捕获像素，边框区域强制白色
    try:
        from PIL import ImageDraw
        margin = 16
        radius = 14
        mask = Image.new('L', (w, h), 0)  # 黑=边框(白), 白=卡片(保留)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([margin, margin, w - margin - 1, h - margin - 1],
                             radius=radius, fill=255)
        white = Image.new('RGBA', (w, h), (255, 255, 255, 255))
        # 卡片区域用捕获图，边框区域用白色
        card_part = Image.composite(final_rgba, Image.new('RGBA', (w,h),
                                       (255,255,255,255)), mask)
        final = card_part.convert('RGB')
    except Exception:
        # 回退：把接近纯黑的像素替换为白色
        final = final_rgba.convert('RGB')
        px = final.load()
        for y in range(h):
            for x in range(w):
                r, g, b = px[x, y]
                if r < 15 and g < 15 and b < 15:
                    px[x, y] = (255, 255, 255)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path, 'PNG')
    print(f'  保存: {out_path} ({w}x{h})')

    gdi32.SelectObject(hdc_mem, old)
    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc_screen)
    return captured


def capture_by_pid(pid: int, out_path: str, title_contains: str = '') -> bool:
    wins = find_main_window(pid, title_contains)
    if not wins:
        print(f'未找到 PID={pid} 的窗口')
        return False
    # 选最大的
    wins.sort(key=lambda x: -x[4] * x[5])
    hwnd, title, cls, rect, w, h = wins[0]
    print(f'捕获窗口: hwnd={hwnd} title={title!r} class={cls!r} {w}x{h}')
    return capture_window(hwnd, out_path)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('用法: python screenshot.py <PID> <输出路径> [标题关键词]')
        sys.exit(1)
    pid = int(sys.argv[1])
    out = sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else ''
    ok = capture_by_pid(pid, out, title)
    sys.exit(0 if ok else 1)
