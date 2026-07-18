# -*- coding: utf-8 -*-
"""main.py — 护眼管家便携版主入口

像输入法一样的护眼提醒：托盘常驻 + 全局热键唤起 + 失焦自动隐藏 + 定时休息覆盖层。
苹果白高端风格，纯本地运行，不联网不上传。

职责编排：
1. 单实例锁（CreateMutex）
2. 隐藏主窗口（CTk）
3. 系统托盘（pystray，独立线程）
4. 全局热键线程（RegisterHotKey + WM_HOTKEY）
5. 休息调度引擎（after 每秒推进状态机）
6. 失焦隐藏轮询（前台窗口不属于本进程则隐藏面板）
"""
from __future__ import annotations

import os
import sys
import time
import threading
from datetime import datetime, timedelta

import tkinter as tk
import customtkinter as ctk

# 确保能 import 同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import styles as S
from core import (
    Store, STATES, normalize_settings, is_in_dnd,
    schedule_next_breaks, seconds_between, BREAK_TYPES,
)
from panel import Panel
from overlay import BreakOverlay
from settings_window import SettingsWindow
import winapi
from winapi import SingleInstance, HotKeyThread, make_binding, is_foreground_fullscreen

# 热键 ID
HK_TOGGLE = 1   # Ctrl+Shift+E 显示/隐藏
HK_REST = 2     # Ctrl+Shift+B 立即休息
HK_PAUSE = 3    # Ctrl+Shift+P 暂停/恢复

# 免打扰结束后自动恢复的检查间隔
DND_CHECK_INTERVAL = 30


class EyeRestApp:
    def __init__(self) -> None:
        # 单实例
        self.si = SingleInstance()
        if self.si.already_running:
            # 已有实例运行，安静退出
            sys.exit(0)

        # 数据存储
        self.store = Store()
        self.settings = self.store.get_settings()

        # 隐藏主窗口（CTk 提供 customtkinter 主题）
        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")
        self.root = ctk.CTk()
        self.root.title("EyeRestPortable")
        self.root.geometry("1x1+0+0")
        self.root.overrideredirect(True)
        self.root.withdraw()  # 隐藏主窗口

        # UI 组件（按需创建）
        self.panel: Panel | None = None
        self.overlay: BreakOverlay | None = None
        self.settings_win: SettingsWindow | None = None

        # 调度状态
        self.state = STATES["IDLE"]
        self.paused = False
        self.next_break_time: datetime | None = None
        self.next_type: str = "micro"
        self.current_interval: int = 20 * 60
        self._recompute_next_break()

        # 系统托盘
        self.tray = self._create_tray()
        self.tray_thread = threading.Thread(target=self.tray.run, daemon=True)
        self.tray_thread.start()

        # 全局热键线程
        self.hotkey_thread = HotKeyThread({
            HK_TOGGLE: lambda: self.root.after(0, self.toggle_panel),
            HK_REST: lambda: self.root.after(0, self.start_break_now),
            HK_PAUSE: lambda: self.root.after(0, self.toggle_pause),
        })
        self.hotkey_thread.set_bindings([
            make_binding(HK_TOGGLE, ctrl=True, shift=True, alt=False, key="E"),
            make_binding(HK_REST, ctrl=True, shift=True, alt=False, key="B"),
            make_binding(HK_PAUSE, ctrl=True, shift=True, alt=False, key="P"),
        ])
        self.hotkey_thread.start()

        # 启动循环
        self.root.after(1000, self._schedule_tick)
        self.root.after(500, self._focus_check)

    # -------------------------------------------------------------------
    # 托盘
    # -------------------------------------------------------------------
    def _create_tray(self):
        import pystray
        from PIL import Image, ImageDraw
        # 生成图标：绿色圆 + 眼睛形状
        size = 64
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        # 圆角背景
        d.rounded_rectangle([4, 4, size - 4, size - 4], radius=14, fill=(52, 199, 89, 255))
        # 眼睛（白色椭圆 + 蓝色瞳孔）
        d.ellipse([14, 22, 50, 42], fill=(255, 255, 255, 255))
        d.ellipse([27, 26, 37, 38], fill=(0, 122, 255, 255))
        d.ellipse([30, 29, 34, 35], fill=(255, 255, 255, 230))

        menu = pystray.Menu(
            pystray.MenuItem("显示面板", lambda: self.root.after(0, self.show_panel), default=True),
            pystray.MenuItem("立即休息", lambda: self.root.after(0, self.start_break_now)),
            pystray.MenuItem("暂停 / 恢复", lambda: self.root.after(0, self.toggle_pause)),
            pystray.MenuItem("设置", lambda: self.root.after(0, self.open_settings)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("退出", lambda: self.root.after(0, self.quit_app)),
        )
        return pystray.Icon("EyeRestPortable", img, "护眼管家", menu)

    # -------------------------------------------------------------------
    # 面板
    # -------------------------------------------------------------------
    def _ensure_panel(self) -> Panel:
        if self.panel is None:
            self.panel = Panel(self.root, {
                "on_rest_now": self.start_break_now,
                "on_pause_toggle": self.toggle_pause,
                "on_open_settings": self.open_settings,
                "on_hide": self.hide_panel,
            })
        return self.panel

    def show_panel(self) -> None:
        p = self._ensure_panel()
        p.update_state(self.state, self._seconds_to_break(), self.next_type,
                       self.current_interval, self.paused)
        p.update_stats(self.store.get_stats())
        p.show_near_cursor()

    def hide_panel(self) -> None:
        if self.panel is not None:
            self.panel.hide()

    def toggle_panel(self) -> None:
        if self.panel is not None and self.panel.winfo_viewable():
            self.hide_panel()
        else:
            self.show_panel()

    # -------------------------------------------------------------------
    # 设置
    # -------------------------------------------------------------------
    def open_settings(self) -> None:
        if self.settings_win is not None and self.settings_win.winfo_exists():
            self.settings_win.lift()
            self.settings_win.focus_force()
            return
        self.settings_win = SettingsWindow(self.root, self.settings, self._on_settings_saved)

    def _on_settings_saved(self, new_settings: dict) -> None:
        self.settings = normalize_settings(new_settings)
        self.store.set_settings(self.settings)
        self._recompute_next_break()

    # -------------------------------------------------------------------
    # 暂停
    # -------------------------------------------------------------------
    def toggle_pause(self) -> None:
        self.paused = not self.paused
        if self.paused:
            self.state = STATES["PAUSED"]
        else:
            self.state = STATES["IDLE"]
            self._recompute_next_break()
        self._refresh_panel()

    # -------------------------------------------------------------------
    # 调度引擎
    # -------------------------------------------------------------------
    def _recompute_next_break(self) -> None:
        """从当前时间重新计算下次休息。"""
        now = datetime.now()
        # 免打扰时段内：推迟到免打扰结束
        if is_in_dnd(now, self.settings["dnd"]):
            # 计算免打扰结束时间
            try:
                eh, em = map(int, self.settings["dnd"]["end"].split(":"))
                end_dt = now.replace(hour=eh, minute=em, second=0, microsecond=0)
                if end_dt <= now:
                    end_dt += timedelta(days=1)
                base = end_dt
            except (ValueError, KeyError):
                base = now
        else:
            base = now
        sched = schedule_next_breaks(self.settings, base)
        if sched:
            self.next_break_time = sched[0]["time"]
            self.next_type = sched[0]["type"]
            self.current_interval = self.settings["breaks"][self.next_type]["interval"] * 60
        else:
            self.next_break_time = None

    def _seconds_to_break(self) -> int:
        if self.next_break_time is None:
            return 0
        return seconds_between(datetime.now(), self.next_break_time)

    def _schedule_tick(self) -> None:
        """每秒推进状态机。"""
        try:
            if not self.paused and self.state != STATES["BREAK"]:
                # 全屏抑制
                if self.settings["fullscreenSuppress"] and is_foreground_fullscreen():
                    # 推迟 60 秒
                    if self.next_break_time and self._seconds_to_break() < 60:
                        self.next_break_time = datetime.now() + timedelta(seconds=60)
                # 免打扰检查
                if is_in_dnd(datetime.now(), self.settings["dnd"]):
                    self._recompute_next_break()
                else:
                    sec = self._seconds_to_break()
                    new_state = self._idle_state(sec)
                    if new_state == STATES["BREAK"]:
                        self.start_break_now()
                    elif new_state == STATES["WARNING"] and self.state != STATES["WARNING"]:
                        self.state = STATES["WARNING"]
                        self._refresh_panel()
                    elif new_state == STATES["IDLE"] and self.state == STATES["WARNING"]:
                        self.state = STATES["IDLE"]
            # 刷新面板（若可见）
            self._refresh_panel()
        except Exception:
            pass
        self.root.after(1000, self._schedule_tick)

    def _idle_state(self, sec: int) -> str:
        lead = self.settings["warning"]["leadTime"] if self.settings["warning"]["enabled"] else 0
        if sec <= 0:
            return STATES["BREAK"]
        if sec <= lead:
            return STATES["WARNING"]
        return STATES["IDLE"]

    def _refresh_panel(self) -> None:
        if self.panel is not None and self.panel.winfo_viewable():
            self.panel.update_state(self.state, self._seconds_to_break(),
                                    self.next_type, self.current_interval, self.paused)

    # -------------------------------------------------------------------
    # 休息覆盖层
    # -------------------------------------------------------------------
    def start_break_now(self) -> None:
        if self.state == STATES["BREAK"]:
            return
        self.state = STATES["BREAK"]
        self.hide_panel()
        # 选择休息类型：优先用 next_type，否则取第一个启用的
        btype = self.next_type if self.next_type in BREAK_TYPES else "micro"
        cfg = self.settings["breaks"].get(btype)
        if not cfg or not cfg["enabled"]:
            for t in BREAK_TYPES:
                if self.settings["breaks"][t]["enabled"]:
                    btype = t
                    cfg = self.settings["breaks"][t]
                    break
        if cfg is None:
            self.state = STATES["IDLE"]
            self._recompute_next_break()
            return
        duration = cfg["duration"]

        def on_complete(rested_sec: int) -> None:
            self.store.record_completed(rested_sec)
            self._finish_break()

        def on_skip() -> None:
            self.store.record_skipped()
            self._finish_break()

        def on_postpone() -> None:
            self.store.record_skipped()
            self.next_break_time = datetime.now() + timedelta(minutes=5)
            self.next_type = btype
            self.current_interval = self.settings["breaks"][btype]["interval"] * 60
            self._finish_break()

        if self.overlay is not None:
            try:
                self.overlay.close()
            except Exception:
                pass
        self.overlay = BreakOverlay(self.root, {
            "on_complete": on_complete,
            "on_skip": on_skip,
            "on_postpone": on_postpone,
        })
        self.overlay.start(btype, duration, self.settings["strictMode"])

    def _finish_break(self) -> None:
        if self.overlay is not None:
            try:
                self.overlay.close()
            except Exception:
                pass
            self.overlay = None
        self.state = STATES["IDLE"]
        self._recompute_next_break()

    # -------------------------------------------------------------------
    # 失焦隐藏轮询（输入法式）
    # -------------------------------------------------------------------
    def _focus_check(self) -> None:
        try:
            if self.panel is not None and self.panel.winfo_viewable():
                # 距显示至少 400ms 才检查，避免刚弹出就隐藏
                if time.time() - self.panel._shown_at > 0.4:
                    import ctypes
                    from ctypes import wintypes
                    fg = ctypes.windll.user32.GetForegroundWindow()
                    if fg:
                        pid = wintypes.DWORD()
                        ctypes.windll.user32.GetWindowThreadProcessId(fg, ctypes.byref(pid))
                        my_pid = ctypes.windll.kernel32.GetCurrentProcessId()
                        if pid.value != my_pid:
                            # 前台不属于本进程 → 隐藏面板
                            self.hide_panel()
        except Exception:
            pass
        self.root.after(500, self._focus_check)

    # -------------------------------------------------------------------
    # 退出
    # -------------------------------------------------------------------
    def quit_app(self) -> None:
        try:
            self.hotkey_thread.stop()
        except Exception:
            pass
        try:
            self.tray.stop()
        except Exception:
            pass
        self.root.quit()
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def main() -> None:
    app = EyeRestApp()
    app.run()


if __name__ == "__main__":
    main()
