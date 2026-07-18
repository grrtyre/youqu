# -*- coding: utf-8 -*-
"""
番茄管家便携版 - 主程序入口
基于 customtkinter + pystray + pynput 的原生小组件体验。
"""
from __future__ import annotations
import os
import sys
import threading
import time
import tkinter as tk
from tkinter import font as tkfont
from typing import Optional

import customtkinter as ctk
from PIL import Image, ImageDraw

from pomodoro_core import (
    PomodoroCore, PomodoroConfig, PomodoroStore,
    PHASE_LABELS, PHASE_COLORS,
)
from ring_canvas import RingCanvas, _format_mmss


def _font(family="Microsoft YaHei UI", size=12, weight="normal"):
    """统一字体构造器，使用 CTkFont 兼容 customtkinter。"""
    return ctk.CTkFont(family=family, size=size, weight=weight)


# ============== 全局配置 ==============
APP_NAME = "番茄管家"
APP_VERSION = "1.0.0"
DATA_DIR = os.path.join(os.path.expanduser("~"), ".pomodoro-portable")
os.makedirs(DATA_DIR, exist_ok=True)
DATA_FILE = os.path.join(DATA_DIR, "data.json")
ICON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "icon.ico")

# 苹果白设计令牌
COLOR_BG = "#ffffff"
COLOR_BG_SOFT = "#f5f5f7"
COLOR_TEXT = "#1a1a1c"
COLOR_TEXT_SUB = "#6c6c70"
COLOR_ACCENT = "#007aff"
COLOR_BORDER = "#e8e8ec"
COLOR_DOT_INACTIVE = "#c7c7cc"
COLOR_TRANSPARENT = "#abcdef"
WINDOW_W, WINDOW_H = 300, 420


# ============== 顶部栏 ==============
class TopBar(ctk.CTkFrame):
    def __init__(self, master, title: str, on_settings, on_close):
        super().__init__(master, fg_color=COLOR_BG, height=44, corner_radius=0)
        self._on_settings = on_settings
        self._on_close = on_close
        self._drag_x = 0
        self._drag_y = 0

        self._title = ctk.CTkLabel(
            self, text=title,
            font=_font(size=14, weight="bold"),
            text_color=COLOR_TEXT,
        )
        self._title.pack(side="left", padx=(16, 0))

        self._btn_settings = ctk.CTkButton(
            self, text="⚙", width=32, height=32, corner_radius=10,
            font=_font(size=14),
            fg_color=COLOR_BG_SOFT, hover_color=COLOR_BORDER, text_color=COLOR_TEXT_SUB,
            command=self._on_settings,
        )
        self._btn_settings.pack(side="right", padx=(6, 10), pady=6)

        self._btn_close = ctk.CTkButton(
            self, text="✕", width=32, height=32, corner_radius=10,
            font=_font(size=14),
            fg_color=COLOR_BG_SOFT, hover_color=COLOR_BORDER, text_color=COLOR_TEXT_SUB,
            command=self._on_close,
        )
        self._btn_close.pack(side="right", padx=(0, 0), pady=6)

        for w in (self, self._title):
            w.bind("<Button-1>", self._on_drag_start)
            w.bind("<B1-Motion>", self._on_drag_motion)

    def _on_drag_start(self, e):
        self._drag_x = e.x_root - self.winfo_toplevel().winfo_x()
        self._drag_y = e.y_root - self.winfo_toplevel().winfo_y()

    def _on_drag_motion(self, e):
        top = self.winfo_toplevel()
        top.geometry(f"+{e.x_root - self._drag_x}+{e.y_root - self._drag_y}")


# ============== 周期点 ==============
class CycleDots(ctk.CTkFrame):
    def __init__(self, master, total: int = 4):
        super().__init__(master, fg_color=COLOR_BG, height=18)
        self._total = total
        self._dots = []
        for i in range(total):
            d = ctk.CTkLabel(
                self, text="", width=12, height=12,
                corner_radius=6, fg_color=COLOR_DOT_INACTIVE,
            )
            d.pack(side="left", padx=5)
            self._dots.append(d)

    def set_active(self, count: int):
        for i, d in enumerate(self._dots):
            d.configure(fg_color=COLOR_ACCENT if i < count else COLOR_DOT_INACTIVE)


# ============== 设置对话框 ==============
class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, master, config: PomodoroConfig):
        super().__init__(master, fg_color=COLOR_BG)
        self.title("设置")
        self.geometry("320x440")
        self.resizable(False, False)
        self.transient(master)
        self.grab_set()
        self._config = config
        self.result: Optional[PomodoroConfig] = None

        self.after(10, self._center)

        ctk.CTkLabel(
            self, text="设置",
            font=_font(size=18, weight="bold"),
            text_color=COLOR_TEXT,
        ).pack(pady=(20, 12))

        form = ctk.CTkFrame(self, fg_color=COLOR_BG)
        form.pack(padx=24, fill="both", expand=True)

        self._work = self._add_row(form, "工作时长（分钟）", config.work_duration, 1, 120)
        self._short = self._add_row(form, "短休息（分钟）", config.short_break, 1, 60)
        self._long = self._add_row(form, "长休息（分钟）", config.long_break, 1, 60)
        self._interval = self._add_row(form, "长休息间隔", config.long_break_interval, 2, 8)
        self._goal = self._add_row(form, "每日目标", config.daily_goal, 1, 24)
        self._hotkey = self._add_row_text(form, "全局热键", config.hotkey)
        self._hide = self._add_row(form, "失焦隐藏延迟（ms）", config.auto_hide_ms, 200, 3000, step=100)

        btns = ctk.CTkFrame(self, fg_color=COLOR_BG)
        btns.pack(pady=(10, 18))
        ctk.CTkButton(
            btns, text="取消", width=110, height=32, corner_radius=10,
            fg_color=COLOR_BG_SOFT, hover_color=COLOR_BORDER, text_color=COLOR_TEXT,
            command=self.destroy,
        ).pack(side="left", padx=6)
        ctk.CTkButton(
            btns, text="保存", width=110, height=32, corner_radius=10,
            fg_color=COLOR_ACCENT, hover_color="#0062cc", text_color="#ffffff",
            command=self._save,
        ).pack(side="left", padx=6)

    def _center(self):
        self.update_idletasks()
        w, h = 320, 440
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        self.geometry(f"{w}x{h}+{(sw - w) // 2}+{(sh - h) // 2}")

    def _add_row(self, parent, label, value, mn, mx, step=1) -> ctk.CTkEntry:
        row = ctk.CTkFrame(parent, fg_color=COLOR_BG)
        row.pack(fill="x", pady=6)
        ctk.CTkLabel(
            row, text=label, width=160, anchor="w",
            font=_font(size=12),
            text_color=COLOR_TEXT_SUB,
        ).pack(side="left")
        e = ctk.CTkEntry(
            row, width=90, height=28, corner_radius=8,
            fg_color=COLOR_BG_SOFT, border_color=COLOR_BORDER, border_width=1,
            font=_font(size=12),
        )
        e.insert(0, str(value))
        e.pack(side="right")
        return e

    def _add_row_text(self, parent, label, value) -> ctk.CTkEntry:
        return self._add_row(parent, label, value, 0, 0)

    def _save(self):
        try:
            self._config.work_duration = max(1, int(self._work.get()))
            self._config.short_break = max(1, int(self._short.get()))
            self._config.long_break = max(1, int(self._long.get()))
            self._config.long_break_interval = max(2, int(self._interval.get()))
            self._config.daily_goal = max(1, int(self._goal.get()))
            self._config.hotkey = self._hotkey.get().strip() or "Ctrl+Alt+P"
            self._config.auto_hide_ms = max(200, int(self._hide.get()))
        except ValueError:
            return
        self.result = self._config
        self.destroy()


# ============== 托盘 ==============
class TrayController:
    def __init__(self, icon_image: Image.Image, on_show, on_quit):
        import pystray
        self._pystray = pystray
        self._on_show = on_show
        self._on_quit = on_quit
        self._icon = pystray.Icon(
            "pomodoro", icon_image, APP_NAME,
            menu=pystray.Menu(
                pystray.MenuItem("显示", self._show, default=True),
                pystray.MenuItem("退出", self._quit),
            ),
        )
        self._thread = threading.Thread(target=self._icon.run, daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        try:
            self._icon.stop()
        except Exception:
            pass

    def _show(self, icon=None, item=None):
        self._on_show()

    def _quit(self, icon=None, item=None):
        self._on_quit()

    def update_tooltip(self, text: str):
        try:
            self._icon.title = text
        except Exception:
            pass


# ============== 全局热键 ==============
class HotkeyListener:
    def __init__(self, hotkey: str, on_trigger):
        from pynput import keyboard
        self._keyboard = keyboard
        self._hotkey = hotkey
        self._on_trigger = on_trigger
        self._listener = None

    @staticmethod
    def _parse(hotkey: str) -> dict:
        parts = [p.strip().lower() for p in hotkey.split("+")]
        keys = []
        for p in parts:
            if p in ("ctrl", "alt", "shift", "cmd", "win"):
                keys.append(f"<{p}>")
            else:
                keys.append(p)
        return "+".join(keys)

    def start(self):
        try:
            combo = self._parse(self._hotkey)
            self._listener = self._keyboard.GlobalHotKeys({combo: self._on_trigger})
            self._listener.start()
        except Exception:
            pass

    def stop(self):
        if self._listener:
            try:
                self._listener.stop()
            except Exception:
                pass
            self._listener = None

    def update_hotkey(self, hotkey: str):
        self.stop()
        self._hotkey = hotkey
        self.start()


# ============== 主窗口 ==============
class PomodoroApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self._store = PomodoroStore(DATA_FILE)
        self._core = PomodoroCore(self._store.config, self._store.stats)
        self._hide_job = None
        self._tick_job = None

        self.title(APP_NAME)
        self.geometry(f"{WINDOW_W}x{WINDOW_H}")
        self.minsize(WINDOW_W, WINDOW_H)
        self.maxsize(WINDOW_W, WINDOW_H)
        self.overrideredirect(True)
        self.configure(fg_color=COLOR_TRANSPARENT)
        try:
            self.wm_attributes("-transparentcolor", COLOR_TRANSPARENT)
        except Exception:
            pass
        self.attributes("-topmost", True)

        self._center_window()

        self._container = ctk.CTkFrame(
            self, fg_color=COLOR_BG, corner_radius=16,
            border_width=1, border_color=COLOR_BORDER,
        )
        self._container.pack(fill="both", expand=True, padx=6, pady=6)

        self._topbar = TopBar(
            self._container, APP_NAME,
            on_settings=self._open_settings,
            on_close=self._hide,
        )
        self._topbar.pack(fill="x")

        # 顶部栏分割线（极细，强化层次）
        ctk.CTkFrame(
            self._container, fg_color=COLOR_BORDER, height=1, corner_radius=0,
        ).pack(fill="x", padx=20)

        self._ring = RingCanvas(self._container, size=228, background=COLOR_BG)
        self._ring.pack(pady=(10, 4))

        self._dots = CycleDots(self._container, total=self._core.config.long_break_interval)
        self._dots.pack(pady=(0, 12))

        ctrl = ctk.CTkFrame(self._container, fg_color=COLOR_BG)
        ctrl.pack(pady=(0, 16))

        self._btn_skip = ctk.CTkButton(
            ctrl, text="⏭", width=34, height=34, corner_radius=10,
            font=_font(size=14),
            fg_color=COLOR_BG_SOFT, hover_color=COLOR_BORDER, text_color=COLOR_TEXT_SUB,
            command=self._skip,
        )
        self._btn_skip.pack(side="left", padx=10)

        self._btn_main = ctk.CTkButton(
            ctrl, text="开始", width=160, height=34, corner_radius=11,
            font=_font(size=13, weight="bold"),
            fg_color=COLOR_ACCENT, hover_color="#0062cc", text_color="#ffffff",
            command=self._toggle,
        )
        self._btn_main.pack(side="left", padx=10)

        self._btn_reset = ctk.CTkButton(
            ctrl, text="↻", width=34, height=34, corner_radius=10,
            font=_font(size=14),
            fg_color=COLOR_BG_SOFT, hover_color=COLOR_BORDER, text_color=COLOR_TEXT_SUB,
            command=self._reset,
        )
        self._btn_reset.pack(side="left", padx=10)

        self._stats_label = ctk.CTkLabel(
            self._container, text="",
            font=_font(size=10),
            text_color=COLOR_TEXT_SUB,
        )
        self._stats_label.pack(pady=(0, 14))

        self.bind("<FocusOut>", self._on_focus_out)
        self.bind("<FocusIn>", self._on_focus_in)

        self._tray_icon_image = self._load_tray_icon()
        self._tray = TrayController(
            self._tray_icon_image,
            on_show=self._show_from_tray,
            on_quit=self._quit,
        )
        self._tray.start()

        self._hotkey_listener = HotkeyListener(
            self._core.config.hotkey, self._toggle_visible
        )
        self._hotkey_listener.start()

        self._start_tick()

        self._update_ui()
        if os.environ.get("POMODORO_NO_AUTOHIDE") != "1":
            self.after(1500, self._hide)
        else:
            self.unbind("<FocusOut>")

    def _center_window(self):
        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = sw - WINDOW_W - 40
        y = sh - WINDOW_H - 80
        self.geometry(f"+{x}+{y}")

    def _hide(self):
        self.withdraw()

    def _show_from_tray(self):
        self.after(0, self._show)

    def _show(self):
        self.deiconify()
        self.attributes("-topmost", True)
        self.focus_force()

    def _toggle_visible(self):
        if self.state() == "withdrawn":
            self.after(0, self._show)
        else:
            self.after(0, self._hide)

    def _on_focus_out(self, e):
        if self._hide_job:
            self.after_cancel(self._hide_job)
        delay = max(200, self._core.config.auto_hide_ms)
        self._hide_job = self.after(delay, self._hide)

    def _on_focus_in(self, e):
        if self._hide_job:
            self.after_cancel(self._hide_job)
            self._hide_job = None

    def _start_tick(self):
        if self._tick_job:
            self.after_cancel(self._tick_job)
        self._tick_job = self.after(1000, self._tick)

    def _tick(self):
        event = self._core.tick(1.0)
        if event:
            self._on_phase_changed(event)
        self._update_ui()
        self._tick_job = self.after(1000, self._tick)

    def _toggle(self):
        if self._core.state == "idle":
            self._core.start()
        elif self._core.state == "paused":
            self._core.resume()
        elif self._core.is_running:
            self._core.pause()
        self._update_ui()

    def _skip(self):
        event = self._core.skip()
        if event:
            self._on_phase_changed(event)
        self._update_ui()

    def _reset(self):
        self._core.reset()
        self._update_ui()

    def _on_phase_changed(self, event: dict):
        if self._core.config.sound_enabled:
            try:
                import winsound
                freq = 800 if event.get("next_phase") == "working" else 600
                winsound.Beep(freq, 200)
            except Exception:
                pass
        next_phase = event.get("next_phase")
        if next_phase == "working" and not self._core.config.auto_start_work:
            self._core.pause()
        elif next_phase in ("short_break", "long_break") and not self._core.config.auto_start_break:
            self._core.pause()
        self._store.save(self._core.config, self._core.stats)
        self._tray.update_tooltip(f"{APP_NAME} - {self._core.phase_label}")

    def _update_ui(self):
        progress = self._core.progress
        color = self._core.phase_color
        label = self._core.phase_label
        time_text = _format_mmss(self._core.remaining_ms)
        running = self._core.is_running
        stats = self._core.today_stats()
        sub = f"今日 {stats.get('work_sessions', 0)} / {self._core.config.daily_goal} 个番茄"
        self._ring.set_state(progress, color, label, time_text, sub, running)

        if self._core.state == "idle":
            self._btn_main.configure(text="开始", fg_color=COLOR_ACCENT)
        elif self._core.state == "paused":
            self._btn_main.configure(text="继续", fg_color=COLOR_ACCENT)
        elif running:
            self._btn_main.configure(text="暂停", fg_color="#ff9500", hover_color="#e68600")

        active = self._core.cycle_count % self._core.config.long_break_interval
        if active == 0 and self._core.cycle_count > 0:
            active = self._core.config.long_break_interval
        self._dots.set_active(active)

        total_minutes = stats.get("total_minutes", 0)
        self._stats_label.configure(
            text=f"今日 {stats.get('work_sessions', 0)} 个 · {total_minutes} 分钟"
        )

        self._tray.update_tooltip(f"{APP_NAME} - {label} {time_text}")

    def _open_settings(self):
        if self._hide_job:
            self.after_cancel(self._hide_job)
            self._hide_job = None
        dlg = SettingsDialog(self, self._core.config)
        self.wait_window(dlg)
        if dlg.result:
            self._core.config = dlg.result
            self._store.save(self._core.config, self._core.stats)
            self._hotkey_listener.update_hotkey(self._core.config.hotkey)
            self._update_ui()

    def _load_tray_icon(self) -> Image.Image:
        try:
            if os.path.exists(ICON_PATH):
                return Image.open(ICON_PATH).convert("RGBA").resize((64, 64))
        except Exception:
            pass
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse((4, 4, 60, 60), fill=COLOR_ACCENT)
        d.ellipse((14, 14, 50, 50), outline="#ffffff", width=3)
        return img

    def _quit(self):
        self._store.save(self._core.config, self._core.stats)
        try:
            self._hotkey_listener.stop()
        except Exception:
            pass
        try:
            self._tray.stop()
        except Exception:
            pass
        self.after(0, self.destroy)


def main():
    ctk.set_appearance_mode("light")
    ctk.set_default_color_theme("blue")
    app = PomodoroApp()
    app.mainloop()


if __name__ == "__main__":
    main()
