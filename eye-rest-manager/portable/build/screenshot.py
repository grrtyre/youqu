# -*- coding: utf-8 -*-
"""screenshot.py — 后台截图脚本（用于 mimo 审美评分）

用 PrintWindow API 后台截取面板与休息覆盖层，全程不抢焦点、不打扰用户。
窗口用 SW_SHOWNOACTIVATE 显示（不激活），截完立即隐藏。
不启动托盘/热键/调度，纯 UI 渲染截图。
"""
import os
import sys
import time
import ctypes
from datetime import datetime, timedelta

# 路径
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src")
sys.path.insert(0, SRC)

import tkinter as tk
import customtkinter as ctk

import styles as S
from panel import Panel
from overlay import BreakOverlay
import winapi

OUT_DIR = r"D:\Ai\mimo\screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

GA_ROOT = 2
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001


def _top_hwnd(widget):
    """获取 tkinter widget 的顶级窗口句柄。"""
    hwnd = widget.winfo_id()
    return ctypes.windll.user32.GetAncestor(hwnd, GA_ROOT)


def _show_no_activate(win, x, y):
    """以不抢焦点方式显示窗口。"""
    win.geometry(f"+{x}+{y}")
    win.deiconify()
    win.update_idletasks()
    win.update()
    hwnd = _top_hwnd(win)
    # SWP_NOACTIVATE 显示不激活
    ctypes.windll.user32.SetWindowPos(hwnd, -1, x, y, 0, 0,
                                       SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_NOSIZE)


def main():
    ctk.set_appearance_mode("light")
    ctk.set_default_color_theme("blue")
    root = ctk.CTk()
    root.withdraw()
    root.update()

    sw = root.winfo_screenwidth()
    sh = root.winfo_screenheight()

    # ---------- 截取主面板 ----------
    panel = Panel(root, {
        "on_rest_now": lambda: None,
        "on_pause_toggle": lambda: None,
        "on_open_settings": lambda: None,
        "on_hide": lambda: None,
    })
    # 定位到屏幕中央偏上
    px = (sw - S.PANEL_W) // 2
    py = max(40, (sh - S.PANEL_H) // 2 - 40)
    _show_no_activate(panel, px, py)

    # 填充模拟数据（IDLE 态，18:42 后微休息）
    panel.update_state("idle", 1122, "micro", 1200, False)
    # 构造近 7 天统计
    last7 = []
    for i in range(6, -1, -1):
        d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        completed = [4, 6, 3, 8, 5, 7, 5][6 - i]
        last7.append({"date": d, "completed": completed, "seconds": completed * 20})
    panel.update_stats({
        "todayCompleted": 5,
        "todaySkipped": 1,
        "streakDays": 3,
        "totalRestSeconds": 1240,
        "last7": last7,
    })
    panel.update_idletasks()
    panel.update()
    time.sleep(0.6)  # 等待完整渲染

    panel_path = os.path.join(OUT_DIR, "eye-rest-panel.png")
    hwnd = _top_hwnd(panel)
    ok1 = winapi.capture_window_to_file(hwnd, panel_path)
    print(f"面板截图: {panel_path} ({'成功' if ok1 else '失败'})")

    panel.withdraw()
    panel.update()

    # ---------- 截取休息覆盖层 ----------
    overlay = BreakOverlay(root, {
        "on_complete": lambda s: None,
        "on_skip": lambda: None,
        "on_postpone": lambda: None,
    })
    # 覆盖层全屏，中央卡片在屏幕中央
    overlay.start("short", 180, False)
    overlay.update_idletasks()
    overlay.update()
    time.sleep(0.8)

    overlay_path = os.path.join(OUT_DIR, "eye-rest-overlay.png")
    hwnd_o = _top_hwnd(overlay)
    # 覆盖层全屏可能很大，截取中央区域更聚焦。但为完整展示，截全屏
    ok2 = winapi.capture_window_to_file(hwnd_o, overlay_path)
    print(f"覆盖层截图: {overlay_path} ({'成功' if ok2 else '失败'})")

    overlay.close()
    root.update()

    # ---------- 额外：截取严格模式覆盖层 ----------
    overlay2 = BreakOverlay(root, {
        "on_complete": lambda s: None,
        "on_skip": lambda: None,
        "on_postpone": lambda: None,
    })
    overlay2.start("long", 600, True)  # 严格模式长休息
    overlay2.update_idletasks()
    overlay2.update()
    time.sleep(0.8)
    strict_path = os.path.join(OUT_DIR, "eye-rest-strict.png")
    ok3 = winapi.capture_window_to_file(_top_hwnd(overlay2), strict_path)
    print(f"严格模式截图: {strict_path} ({'成功' if ok3 else '失败'})")
    overlay2.close()

    root.destroy()
    print("截图完成")


if __name__ == "__main__":
    main()
