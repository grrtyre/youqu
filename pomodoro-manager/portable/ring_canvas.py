# -*- coding: utf-8 -*-
"""
番茄管家便携版 - Canvas 圆环进度组件
基于 tkinter Canvas 绘制：背景轨道 + 进度弧 + 端点高亮 + 中心文字 + 呼吸光晕。
"""
from __future__ import annotations
import math
import tkinter as tk
from tkinter import font as tkfont
from typing import Optional


def _hex_to_rgb(hex_color: str):
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _rgb_to_hex(r, g, b):
    return f"#{int(r):02x}{int(g):02x}{int(b):02x}"


def _lighten(hex_color: str, amount: float) -> str:
    """向白色混合，amount 0~1。"""
    r, g, b = _hex_to_rgb(hex_color)
    nr = int(r + (255 - r) * amount)
    ng = int(g + (255 - g) * amount)
    nb = int(b + (255 - b) * amount)
    return _rgb_to_hex(nr, ng, nb)


def _format_mmss(ms: int) -> str:
    total = max(0, ms // 1000)
    m = total // 60
    s = total % 60
    return f"{m:02d}:{s:02d}"


class RingCanvas(tk.Canvas):
    """
    Canvas 圆环组件：
    - 背景轨道（浅灰圆环）
    - 进度弧（阶段色，圆头帽模拟）
    - 进度端点小圆点
    - 中心：阶段标签 + 大时间 + 副文本
    - 呼吸光晕（运行中柔和脉动）
    """

    def __init__(self, parent, size: int = 228, **kwargs):
        super().__init__(parent, width=size, height=size, highlightthickness=0,
                         background=kwargs.pop("background", "#ffffff"), **kwargs)
        self._size = size
        self._progress: float = 0.0
        self._phase_color: str = "#8e8e93"
        self._phase_label: str = "准备就绪"
        self._time_text: str = "25:00"
        self._sub_text: str = ""
        self._running: bool = False
        self._glow: float = 0.0
        self._glow_phase: float = 0.0

        # 字体（系统字体优先）
        self._label_font = tkfont.Font(family="Microsoft YaHei UI", size=11, weight="normal")
        self._time_font = tkfont.Font(family="Microsoft YaHei UI", size=44, weight="bold")
        self._sub_font = tkfont.Font(family="Microsoft YaHei UI", size=10, weight="normal")

        # 呼吸动画
        self._glow_job = None

        self._draw()

    def set_state(self, progress: float, phase_color: str, phase_label: str,
                  time_text: str, sub_text: str, running: bool) -> None:
        self._progress = max(0.0, min(1.0, progress))
        self._phase_color = phase_color
        self._phase_label = phase_label
        self._time_text = time_text
        self._sub_text = sub_text
        self._running = running
        if running and self._glow_job is None:
            self._tick_glow()
        elif not running and self._glow_job is not None:
            self.after_cancel(self._glow_job)
            self._glow_job = None
            self._glow = 0.0
        self._draw()

    def _tick_glow(self) -> None:
        # 正弦呼吸：0.15 ~ 0.55 的柔和脉动
        self._glow_phase += 0.08
        self._glow = 0.35 + 0.20 * math.sin(self._glow_phase)
        self._draw()
        self._glow_job = self.after(50, self._tick_glow)

    def _draw(self) -> None:
        self.delete("all")
        s = self._size
        cx = s / 2.0
        cy = s / 2.0
        # 圆环外径（留 28px 给光晕）
        ring_r = (s - 56) / 2.0
        stroke = 11

        # ---- 呼吸光晕（外层柔和发光圆）----
        if self._running and self._glow > 0:
            # 用多层 stipple 圆模拟光晕
            glow_r = ring_r + 17
            glow_color = _lighten(self._phase_color, 0.5)
            # 由外到内 stipple 渐变
            stipple_levels = [("gray25", glow_r), ("gray50", glow_r - 3),
                              ("gray75", glow_r - 6)]
            for st, r in stipple_levels:
                self.create_oval(cx - r, cy - r, cx + r, cy + r,
                                 outline="", fill=glow_color, stipple=st, tags="glow")

        # ---- 背景轨道 ----
        self.create_oval(cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r,
                         outline="#e8e8ec", width=stroke, tags="track")

        # ---- 进度弧 ----
        if self._progress > 0.001:
            extent = -self._progress * 360
            self.create_arc(cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r,
                            start=90, extent=extent, style="arc",
                            outline=self._phase_color, width=stroke,
                            tags="progress")

        # ---- 进度端点小圆点（高亮）----
        if self._progress > 0.001 and self._progress < 0.999:
            angle = math.radians(90 - self._progress * 360)
            dx = cx + ring_r * math.cos(angle)
            dy = cy - ring_r * math.sin(angle)
            # 外圈（阶段色）
            self.create_oval(dx - 7.5, dy - 7.5, dx + 7.5, dy + 7.5,
                             fill=self._phase_color, outline="", tags="dot")
            # 内圈白色
            self.create_oval(dx - 2.8, dy - 2.8, dx + 2.8, dy + 2.8,
                             fill="#ffffff", outline="", tags="dot")

        # ---- 中心：阶段标签 + 大时间 + 副文本 ----
        # 阶段标签（紧贴时间上方）
        self.create_text(cx, cy - 38, text=self._phase_label,
                         font=self._label_font, fill=self._phase_color, tags="label")
        # 大时间（主视觉）
        self.create_text(cx, cy + 4, text=self._time_text,
                         font=self._time_font, fill="#1a1a1c", tags="time")
        # 副文本
        if self._sub_text:
            self.create_text(cx, cy + 44, text=self._sub_text,
                             font=self._sub_font, fill="#6c6c70", tags="sub")
