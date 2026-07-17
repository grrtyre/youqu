# -*- coding: utf-8 -*-
"""
单进程截图脚本 —— 后台 PrintWindow 截取
- 在本进程内启动 QApplication
- 显示快速面板 + 管理窗口
- 通过 EnumWindows + GetWindowThreadProcessId 找到本进程的所有窗口
- PrintWindow(PW_RENDERFULLCONTENT=2) 后台截取
- 退出
"""
from __future__ import annotations

import os
import sys
import time
import ctypes
from ctypes import wintypes
from typing import List

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import QApplication

# PrintWindow flags
PW_RENDERFULLCONTENT = 0x00000002

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

SHOT_DIR = r"D:\Ai\mimo\screenshots"
os.makedirs(SHOT_DIR, exist_ok=True)


def enum_windows_for_pid(pid: int) -> List[int]:
    """枚举属于指定 PID 的所有顶级可见窗口"""
    found: List[int] = []
    EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _cb(hwnd: int, lparam: int) -> bool:
        wpid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
        if wpid.value == pid and user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                found.append(hwnd)
        return True

    user32.EnumWindows(EnumWindowsProc(_cb), 0)
    return found


def get_window_title(hwnd: int) -> str:
    buf = ctypes.create_unicode_buffer(256)
    user32.GetWindowTextW(hwnd, buf, 256)
    return buf.value


def capture_window(hwnd: int, save_path: str) -> bool:
    rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w <= 0 or h <= 0:
        print(f"  invalid size {w}x{h} for hwnd={hwnd}")
        return False

    hdc_window = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_window)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_window, w, h)
    gdi32.SelectObject(hdc_mem, hbmp)

    ok = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ("biSize", wintypes.UINT),
            ("biWidth", wintypes.LONG),
            ("biHeight", wintypes.LONG),
            ("biPlanes", wintypes.WORD),
            ("biBitCount", wintypes.WORD),
            ("biCompression", wintypes.UINT),
            ("biSizeImage", wintypes.UINT),
            ("biXPelsPerMeter", wintypes.LONG),
            ("biYPelsPerMeter", wintypes.LONG),
            ("biClrUsed", wintypes.UINT),
            ("biClrImportant", wintypes.UINT),
        ]

    bi = BITMAPINFOHEADER()
    bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.biWidth = w
    bi.biHeight = -h
    bi.biPlanes = 1
    bi.biBitCount = 32
    bi.biCompression = 0

    buf_size = w * h * 4
    buf = ctypes.create_string_buffer(buf_size)
    gdi32.GetDIBits(hdc_mem, hbmp, 0, h, buf, ctypes.byref(bi), 0)

    saved = False
    try:
        from PIL import Image
        img = Image.frombuffer("RGBA", (w, h), buf.raw, "raw", "BGRA", 0, 1)
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (245, 245, 247))
            bg.paste(img, mask=img.split()[3])
            img = bg
        img.save(save_path, "PNG")
        saved = True
        print(f"  saved: {save_path} ({w}x{h}) PrintWindow={ok}")
    except Exception as e:
        print(f"  PIL save failed: {e}")
    finally:
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_mem)
        user32.ReleaseDC(0, hdc_window)

    return saved


def main():
    # 把当前目录加入 path
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)

    from store import PromptStore
    from quick_panel import QuickPanel
    from manager_window import ManagerWindow
    from styles import APPLE_QSS

    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)
    app.setStyleSheet(APPLE_QSS)

    # 用临时数据文件
    import tempfile
    tmp_dir = tempfile.mkdtemp(prefix="mimo_pm_")
    data_path = os.path.join(tmp_dir, "prompts.json")
    store = PromptStore(data_path)

    # 显示快速面板
    panel = QuickPanel(store)
    panel.show_near_cursor()
    # 显式定位到屏幕左上角偏右下，避开任务栏
    panel.move(80, 80)

    # 显示管理窗口
    mgr = ManagerWindow(store)
    mgr.move(560, 80)
    mgr.show()
    mgr.raise_()
    mgr.activateWindow()

    # 处理事件 1.2 秒，让 UI 渲染完
    end = time.time() + 1.2
    while time.time() < end:
        app.processEvents()
        time.sleep(0.05)

    # 截图
    pid = os.getpid()
    print(f"=== capturing windows for pid={pid} ===")
    hwnds = enum_windows_for_pid(pid)
    print(f"  found {len(hwnds)} visible top-level window(s)")

    saved_paths = []
    for i, hwnd in enumerate(hwnds):
        title = get_window_title(hwnd)
        print(f"  hwnd={hwnd} title={title!r}")
        # 安全文件名：替换非法字符
        safe_title = "".join(c if c not in '<>:"/\\|?*' else "_" for c in (title or "win"))
        fname = f"prompt-manager-portable-{i+1}-{safe_title}.png"
        save_path = os.path.join(SHOT_DIR, fname)
        if capture_window(hwnd, save_path):
            saved_paths.append(save_path)

    print("=== captured files ===")
    for p in saved_paths:
        print(" -", p)

    # 清理临时目录
    try:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except Exception:
        pass

    # 退出
    print("=== exiting ===")
    app.quit()
    sys.exit(0)


if __name__ == "__main__":
    main()
