# -*- coding: utf-8 -*-
"""toast.py —— 轻量级 toast 通知。

不依赖 Windows 原生 toast（需要 AUMID 注册），用 tkinter Toplevel
自己做一个小弹层，靠近屏幕右下角，2 秒后自动淡出关闭。

只在主线程调用（tkinter 不是线程安全的）。
"""
from __future__ import annotations

import tkinter as tk
from typing import Optional


class Toast:
    """单例式 toast 管理器。重复调用会先关掉旧的。"""

    _current: Optional["Toast"] = None

    # 苹果白配色
    BG = "#ffffff"
    TEXT = "#1d1d1f"
    SUB = "#86868b"
    ACCENT = "#007aff"
    BORDER = "#e5e5ea"

    def __init__(self, root: tk.Misc, text: str, accent: bool = False,
                 duration: int = 1800):
        # 关掉上一个
        if Toast._current is not None:
            try:
                Toast._current._close_immediate()
            except Exception:
                pass
        Toast._current = self

        self.root = root
        self.duration = duration
        self.alpha = 0.0
        self._closed = False

        self.top = tk.Toplevel(root)
        self.top.overrideredirect(True)
        self.top.attributes("-alpha", 0.0)
        self.top.attributes("-topmost", True)
        # 不抢焦点
        self.top.attributes("-disabled", False)

        # 内容
        accent_color = self.ACCENT if accent else self.SUB
        # 左侧色条
        bar = tk.Frame(self.top, bg=accent_color, width=3)
        bar.pack(side="left", fill="y", padx=0, pady=8)
        # 文本
        text_color = self.TEXT
        label = tk.Label(
            self.top, text=text, fg=text_color, bg=self.BG,
            font=("Microsoft YaHei UI", 10), wraplength=260,
            justify="left", padx=12, pady=8,
        )
        label.pack(side="left", fill="both", expand=True)

        # 圆角边框（用 1px 边框模拟，tkinter 无原生圆角）
        self.top.config(bg=self.BORDER, bd=0, highlightthickness=0)
        bar.config(bg=self.BORDER)  # 外层做边框
        # 内层白底
        inner = tk.Frame(self.top, bg=self.BG)
        inner.place(x=1, y=1, relwidth=1.0, relheight=1.0,
                    width=-2, height=-2)
        # 重新放内容到 inner
        bar2 = tk.Frame(inner, bg=accent_color, width=3)
        bar2.pack(side="left", fill="y", padx=0, pady=7)
        lbl2 = tk.Label(
            inner, text=text, fg=text_color, bg=self.BG,
            font=("Microsoft YaHei UI", 10), wraplength=258,
            justify="left", padx=12, pady=7,
        )
        lbl2.pack(side="left", fill="both", expand=True)

        # 计算位置：右下角，离任务栏有点距离
        self.top.update_idletasks()
        w = max(280, lbl2.winfo_reqwidth() + 40)
        h = max(36, lbl2.winfo_reqheight() + 16)
        sw = self.top.winfo_screenwidth()
        sh = self.top.winfo_screenheight()
        x = sw - w - 16
        y = sh - h - 60  # 避开任务栏
        self.top.geometry(f"{w}x{h}+{x}+{y}")
        self.top.geometry(f"{w}x{h}+{x}+{y}")

        # 淡入
        self._fade_in()

        # 计时关闭
        self.top.after(duration, self._fade_out)

    def _fade_in(self, step: float = 0.12):
        if self._closed:
            return
        self.alpha = min(1.0, self.alpha + step)
        try:
            self.top.attributes("-alpha", self.alpha)
        except Exception:
            return
        if self.alpha < 1.0:
            self.top.after(20, lambda: self._fade_in(step))

    def _fade_out(self, step: float = 0.10):
        if self._closed:
            return
        self.alpha = max(0.0, self.alpha - step)
        try:
            self.top.attributes("-alpha", self.alpha)
        except Exception:
            return
        if self.alpha > 0.0:
            self.top.after(20, lambda: self._fade_out(step))
        else:
            self._close_immediate()

    def _close_immediate(self):
        if self._closed:
            return
        self._closed = True
        try:
            self.top.destroy()
        except Exception:
            pass
        if Toast._current is self:
            Toast._current = None


def show_toast(root: tk.Misc, text: str, accent: bool = False,
               duration: int = 1800) -> Toast:
    """在主线程调用，显示一个 toast。"""
    return Toast(root, text, accent=accent, duration=duration)
