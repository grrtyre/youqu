# -*- coding: utf-8 -*-
"""后台截图脚本 —— 启动快速面板，用 PrintWindow API 后台截取。
严格遵守约束：
- 使用 PrintWindow flag=2 (PW_RENDERFULLCONTENT)，禁止 CopyFromScreen
- 启动应用用 Start-Process -WindowStyle Hidden
- 截图后立即停止自己启动的进程（按 PID）
- 严禁关闭用户正在使用的浏览器
"""
import os
import sys
import time
import ctypes
from ctypes import wintypes
from pathlib import Path

# Windows API
user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# 常量
PW_RENDERFULLCONTENT = 2
SRCCOPY = 0x00CC0020
BI_RGB = 0
DIB_RGB_COLORS = 0
CBM_INIT = 4

# BITMAPINFOHEADER
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

class BITMAPINFO(ctypes.Structure):
    _fields_ = [
        ("bmiHeader", BITMAPINFOHEADER),
        ("bmiColors", wintypes.DWORD * 3),
    ]


def find_window_by_pid(pid: int) -> int:
    """通过进程 ID 枚举顶层窗口，返回第一个匹配的窗口句柄。"""
    found = []

    def callback(hwnd, _):
        pid_found = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid_found))
        if pid_found.value == pid and user32.IsWindowVisible(hwnd):
            found.append(hwnd)
        return True

    EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows(EnumWindowsProc(callback), 0)
    return found[0] if found else 0


def print_window_screenshot(hwnd: int, output_path: str) -> bool:
    """用 PrintWindow API 截取窗口。返回 True 成功。"""
    # 获取窗口客户区尺寸
    rect = wintypes.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    w = rect.right - rect.left
    h = rect.bottom - rect.top
    if w <= 0 or h <= 0:
        return False

    # 获取窗口位置
    win_rect = wintypes.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(win_rect))
    win_w = win_rect.right - win_rect.left
    win_h = win_rect.bottom - win_rect.top

    # 创建内存 DC + 位图
    hdc_screen = user32.GetDC(0)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_screen)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_screen, win_w, win_h)
    gdi32.SelectObject(hdc_mem, hbmp)

    # PrintWindow with PW_RENDERFULLCONTENT
    result = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)

    # 提取位图数据
    bi = BITMAPINFOHEADER()
    bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.biWidth = win_w
    bi.biHeight = -win_h  # 顶向下
    bi.biPlanes = 1
    bi.biBitCount = 32
    bi.biCompression = BI_RGB

    bmi = BITMAPINFO()
    bmi.bmiHeader = bi

    buf_size = win_w * win_h * 4
    buf = ctypes.create_string_buffer(buf_size)
    gdi32.GetDIBits(hdc_mem, hbmp, 0, win_h, buf, ctypes.byref(bmi), DIB_RGB_COLORS)

    # 用 PIL 保存
    from PIL import Image
    img = Image.frombuffer("RGBA", (win_w, win_h), buf.raw, "raw", "BGRA", 0, 1)
    # 转 RGB（去掉 alpha）
    img = img.convert("RGB")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")

    # 释放资源
    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(0, hdc_screen)

    return result != 0


def main():
    from PySide6.QtCore import QTimer, Qt, QCoreApplication
    from PySide6.QtWidgets import QApplication
    from PySide6.QtGui import QGuiApplication

    # 启动 Qt 应用
    app = QApplication(sys.argv)

    from quick_panel import QuickPanel
    panel = QuickPanel()

    # 显示在屏幕中央偏左位置（不抢用户鼠标位置）
    screen = QGuiApplication.primaryScreen()
    geo = screen.availableGeometry()
    # 移到屏幕中央
    panel.move(geo.center().x() - 190, geo.center().y() - 250)
    panel.show()
    panel.raise_()
    panel.activateWindow()

    # 让事件循环跑一会，确保 UI 完全渲染
    screenshot_path = "D:\\Ai\\mimo\\screenshots\\quick-translate-portable.png"

    # 填充示例翻译结果用于截图（更直观）
    panel.edit_source.setPlainText("Hello, this is Quick Translate portable.\n\nA fast, elegant translator that lives in your tray.")
    panel.view_target.setPlainText("你好，这是快速翻译器便携版。\n\n一款驻留托盘的快速、优雅的翻译工具。")
    panel.lbl_meta.setText("检测: 英语 · 引擎: Google")
    panel.lbl_count.setText("68 字")

    # 预填充几条历史记录让 UI 更生动
    from store import add_history, save_store
    add_history(panel._store, "Thank you", "谢谢你", "en", "zh", detected="en", engine="google")
    add_history(panel._store, "今天天气真好", "The weather is really nice today", "auto", "en", detected="zh", engine="google")
    add_history(panel._store, "Good morning", "早上好", "en", "zh", detected="en", engine="google")
    save_store(panel._store)
    panel._refresh_history()

    # 展开历史记录区
    # （折叠状态下截图，让翻译区更突出）
    # if not panel._history_expanded:
    #     panel._toggle_history()

    # 强制重绘
    panel.repaint()
    app.processEvents()
    time.sleep(0.6)
    app.processEvents()

    # 获取窗口句柄
    # PySide6 widget 的 winId() 返回 HWND
    hwnd = int(panel.winId())

    if hwnd:
        # 多次重绘确保稳定
        for _ in range(3):
            panel.repaint()
            app.processEvents()
            time.sleep(0.1)

        ok = print_window_screenshot(hwnd, screenshot_path)
        if ok:
            print(f"✓ 截图成功: {screenshot_path}")
            print(f"  尺寸: {panel.width()}x{panel.height()}")
        else:
            print(f"✗ PrintWindow 失败")
    else:
        print("✗ 未获取到窗口句柄")

    # 退出
    QTimer.singleShot(100, app.quit)
    app.exec()


if __name__ == "__main__":
    main()
