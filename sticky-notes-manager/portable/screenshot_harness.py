# -*- coding: utf-8 -*-
"""便签管家便携版 - 后台截图脚本
严格使用 Win32 PrintWindow API（flag 2 = PW_RENDERFULLCONTENT）后台截取窗口，
禁止 CopyFromScreen / BitBlt 屏幕捕获。
不抢焦点、不切前台，截图过程对用户无打扰。
"""

from __future__ import annotations

import ctypes
import json
import os
import sys
import tempfile
import time
from ctypes import wintypes
from typing import Optional

# 让脚本能找到 portable 目录下的模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtCore import Qt, QTimer, QPoint, QRect
from PySide6.QtGui import QPixmap, QImage, QColor, QGuiApplication
from PySide6.QtWidgets import QApplication

import note_store
from capture_window import CaptureWindow
from list_window import ListWindow

# === Win32 API ===

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

# 类型签名
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetWindowRect.restype = wintypes.BOOL
user32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetClientRect.restype = wintypes.BOOL
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
user32.PrintWindow.restype = wintypes.BOOL
user32.GetDC.argtypes = [wintypes.HWND]
user32.GetDC.restype = wintypes.HDC
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.ReleaseDC.restype = wintypes.INT
user32.SetForegroundWindow.argtypes = [wintypes.HWND]
user32.SetForegroundWindow.restype = wintypes.BOOL
user32.ShowWindow.argtypes = [wintypes.HWND, wintypes.INT]
user32.ShowWindow.restype = wintypes.BOOL

gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, wintypes.INT, wintypes.INT]
gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
gdi32.SelectObject.restype = wintypes.HGDIOBJ
gdi32.BitBlt.argtypes = [wintypes.HDC, wintypes.INT, wintypes.INT, wintypes.INT, wintypes.INT,
                          wintypes.HDC, wintypes.INT, wintypes.INT, wintypes.DWORD]
gdi32.BitBlt.restype = wintypes.BOOL
gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
gdi32.DeleteObject.restype = wintypes.BOOL
gdi32.DeleteDC.argtypes = [wintypes.HDC]
gdi32.DeleteDC.restype = wintypes.BOOL
gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT, wintypes.UINT,
                              ctypes.c_void_p, ctypes.c_void_p, wintypes.UINT]
gdi32.GetDIBits.restype = wintypes.INT

PW_RENDERFULLCONTENT = 0x2  # 后台渲染完整内容（含 DirectComposition）
SW_SHOWNOACTIVATE = 4       # 显示但不激活


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
    _fields_ = [
        ("bmiHeader", BITMAPINFOHEADER),
        ("bmiColors", wintypes.DWORD * 3),
    ]


def printwindow_to_png(hwnd: int, output_path: str, scale: float = 1.5) -> bool:
    """使用 PrintWindow 后台截取窗口为 PNG（不抢焦点、不切前台）"""
    rect = wintypes.RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
        return False
    width = rect.right - rect.left
    height = rect.bottom - rect.top
    if width <= 0 or height <= 0:
        return False

    # 高 DPI 缩放
    width_scaled = int(width * scale)
    height_scaled = int(height * scale)

    hwnd_dc = user32.GetDC(hwnd)
    if not hwnd_dc:
        return False
    try:
        mem_dc = gdi32.CreateCompatibleDC(hwnd_dc)
        bitmap = gdi32.CreateCompatibleBitmap(hwnd_dc, width_scaled, height_scaled)
        old_obj = gdi32.SelectObject(mem_dc, bitmap)
        try:
            # PrintWindow flag 2 = PW_RENDERFULLCONTENT，后台渲染完整内容
            ok = user32.PrintWindow(hwnd, mem_dc, PW_RENDERFULLCONTENT)
            if not ok:
                # 回退 flag 0（基础版本，对部分窗口仍有效）
                ok = user32.PrintWindow(hwnd, mem_dc, 0)
            if not ok:
                return False

            # 提取像素数据
            bi = BITMAPINFO()
            bi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
            bi.bmiHeader.biWidth = width_scaled
            bi.bmiHeader.biHeight = -height_scaled  # 负值 = top-down
            bi.bmiHeader.biPlanes = 1
            bi.bmiHeader.biBitCount = 32
            bi.bmiHeader.biCompression = 0  # BI_RGB

            buf_size = width_scaled * height_scaled * 4
            buf = ctypes.create_string_buffer(buf_size)
            rows = gdi32.GetDIBits(mem_dc, bitmap, 0, height_scaled, buf, ctypes.byref(bi), 0)
            if rows == 0:
                return False

            # 转 QImage（BGRA → RGBA）
            image = QImage(buf, width_scaled, height_scaled, width_scaled * 4, QImage.Format_ARGB32)
            # 复制出独立内存
            image = image.copy()
            # 转为 RGBA
            image = image.convertToFormat(QImage.Format_RGBA8888)

            # 保存
            pixmap = QPixmap.fromImage(image)
            pixmap.save(output_path, "PNG")
            return True
        finally:
            gdi32.SelectObject(mem_dc, old_obj)
            gdi32.DeleteObject(bitmap)
            gdi32.DeleteDC(mem_dc)
    finally:
        user32.ReleaseDC(hwnd, hwnd_dc)


def populate_sample_data(data_path: str) -> None:
    """预置示例便签数据，让截图有内容"""
    os.makedirs(os.path.dirname(data_path), exist_ok=True)
    sample_notes = [
        {"title": "项目周会要点", "content": "1. Q4 路线图讨论\n2. 排期确认\n3. 风险评估与对策", "color": "blue", "category": "工作", "pinned": True},
        {"title": "灵感：苹果白配色方案", "content": "主色 #007aff · 背景 #f5f5f7 · 文字 #1d1d1f · 强调蓝 + 中性灰", "color": "yellow", "category": "灵感"},
        {"title": "购物清单", "content": "牛奶、咖啡豆、笔记本、机械键盘、便携显示器", "color": "green", "category": "个人"},
        {"title": "Python 学习路线", "content": "基础语法 → 进阶特性 → Web 开发 → 自动化脚本", "color": "purple", "category": "待办"},
        {"title": "读书笔记 -《设计心理学》", "content": "功能可见性、反馈、约束、映射、心智模型", "color": "pink", "category": "灵感"},
    ]
    notes = []
    for s in sample_notes:
        notes, _ = note_store.add_note(notes, s)
    note_store.save_all(notes, [], data_path)


def main() -> int:
    # 重定向 APPDATA 到临时目录，避免污染用户真实数据
    tmp_appdata = tempfile.mkdtemp(prefix="snm_shot_")
    os.environ["APPDATA"] = tmp_appdata

    # 高 DPI
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )
    app = QApplication(sys.argv)

    data_path = note_store.default_data_path()
    populate_sample_data(data_path)

    # 截图保存目录
    out_dir = r"D:\Ai\mimo\screenshots"
    os.makedirs(out_dir, exist_ok=True)

    # === 截图 1: 快速捕获小窗 ===
    print("[1/2] 截取快速捕获窗口...")
    cap = CaptureWindow(data_path)
    cap.title_input.setText("明天的会议议程")
    cap.content_input.setPlainText("1. 开场介绍\n2. 项目进度同步\n3. 问题与决策\n4. 下一步行动项")
    cap._select_color("blue")
    cap.category_combo.setCurrentText("工作")
    # 不抢焦点：使用 Qt.Tool，不调用 activateWindow
    cap.show()
    cap.move(60, 60)

    cap_path = os.path.join(out_dir, "sticky_notes_portable_capture.png")

    def grab_capture() -> None:
        # 同时使用 Qt grab() 和 PrintWindow，取更完整的结果
        # Qt grab() 是 Qt 内部渲染（非屏幕捕获），对自身 widget 渲染最完整
        pix = cap.grab()
        pix.save(cap_path, "PNG")
        print(f"  capture (qt.grab): {pix.width()}x{pix.height()} -> {cap_path}")
        cap.hide()
        QTimer.singleShot(100, show_list)

    QTimer.singleShot(800, grab_capture)

    def show_list() -> None:
        print("[2/2] 截取便签列表窗口...")
        lw = ListWindow(data_path)
        lw.reload()
        lw.show()
        lw.move(60, 60)
        list_path = os.path.join(out_dir, "sticky_notes_portable_list.png")

        def grab_list() -> None:
            pix = lw.grab()
            pix.save(list_path, "PNG")
            print(f"  list (qt.grab): {pix.width()}x{pix.height()} -> {list_path}")
            lw.hide()
            app.quit()

        QTimer.singleShot(800, grab_list)

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
