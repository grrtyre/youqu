# -*- coding: utf-8 -*-
"""panel.py — 主面板（输入法式弹出，380×500）

布局：顶部标题栏 + 圆环倒计时 + 今日统计卡片 + 近7天柱状图 + 操作按钮。
苹果白高端风格：白底卡片、多层弥散阴影、#007aff 蓝 + #34c759 护眼绿双色体系、系统字体。
圆环加粗匹配字号、12 点断点渐隐、统计卡片差异化配色（绿/灰/蓝）、柱状图 sqrt 归一化柔和波动。
失焦自动隐藏（输入法式体验），通过 main.py 的前台窗口轮询触发 hide()。
"""
from __future__ import annotations

import math
import ctypes
import tkinter as tk
from ctypes import wintypes
from datetime import datetime
from tkinter import Canvas, Toplevel

import customtkinter as ctk

import styles as S
from core import STATES, format_duration


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _patch_round_rect(canvas: Canvas):
    """给 Canvas 添加 create_round_rectangle 方法。"""
    if hasattr(canvas, "create_round_rectangle"):
        return
    def create_round_rectangle(self, x1, y1, x2, y2, r=8, **kw):
        points = []
        for (cx, cy, sx, sy) in [
            (x2 - r, y1 + r, 1, -1), (x2 - r, y2 - r, 1, 1),
            (x1 + r, y2 - r, -1, 1), (x1 + r, y1 + r, -1, -1),
        ]:
            for a in range(0, 91, 6):
                ang = math.radians(a)
                points.append(cx + sx * r * math.sin(ang))
                points.append(cy + sy * r * math.cos(ang))
        return self.create_polygon(points, smooth=False, **kw)
    canvas.__class__.create_round_rectangle = create_round_rectangle


def _draw_shadow_card(canvas: Canvas, x1, y1, x2, y2, r,
                      fill=S.BG_CARD, outline=S.BORDER_SOFT, outline_w=1):
    """绘制带多层弥散阴影的圆角卡片（苹果级真实投影）。

    通过 5 层不同灰度/偏移的圆角矩形模拟 ambient + key light 投影，
    比单层 shadow 更柔和、更有层次感。
    """
    # 5 层弥散阴影：从大到小、从淡到深
    # 外层最大最淡（模拟 ambient light），内层最小最深（模拟 key light）
    shadow_layers = [
        (6, 8, "#e8e8ee"),   # 最外层：偏移大、最淡
        (5, 6, "#e0e0e8"),   # 次外层
        (4, 4, "#d8d8e2"),   # 中层
        (3, 2, "#d2d2dc"),   # 次内层
        (2, 1, "#ccccd6"),   # 最内层：偏移小、最深
    ]
    for off_x, off_y, gray in shadow_layers:
        canvas.create_round_rectangle(
            x1 + off_x, y1 + off_y, x2 + off_x, y2 + off_y,
            r=r, fill=gray, outline="")
    # 卡片本体
    canvas.create_round_rectangle(
        x1, y1, x2, y2, r=r, fill=fill, outline=outline, width=outline_w)


class Panel(Toplevel):
    """主面板：弹出式小组件，托盘 + 热键唤起，失焦隐藏。"""

    def __init__(self, master: tk.Tk, app_callbacks: dict) -> None:
        super().__init__(master)
        self._cb = app_callbacks  # {on_rest_now, on_pause_toggle, on_open_settings, on_hide}

        # ---- 窗口基础属性 ----
        self.overrideredirect(True)
        self.configure(bg=S.BG_APP)
        self.geometry(f"{S.PANEL_W}x{S.PANEL_H}+0+0")
        self.attributes("-topmost", True)
        try:
            DWMWA_WINDOW_CORNER_PREFERENCE = 33
            hwnd = self.winfo_id()
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, DWMWA_WINDOW_CORNER_PREFERENCE,
                ctypes.byref(ctypes.c_int(2)), ctypes.sizeof(ctypes.c_int))
        except Exception:
            pass

        # ---- 状态 ----
        self._state = STATES["IDLE"]
        self._seconds_to_break = 0
        self._next_type = "micro"
        self._paused = False
        self._shown_at = 0.0

        self._build_ui()
        self.bind("<Escape>", lambda e: self._cb["on_hide"]())

    # -------------------------------------------------------------------
    # UI 构建
    # -------------------------------------------------------------------
    def _build_ui(self) -> None:
        outer = tk.Frame(self, bg=S.BG_APP)
        outer.pack(fill="both", expand=True, padx=14, pady=14)

        # ---- 顶部标题栏（带护眼绿点品牌色）----
        top = tk.Frame(outer, bg=S.BG_APP)
        top.pack(fill="x")
        # 护眼绿点（品牌色标识）
        brand_dot = tk.Label(top, text="●", font=(S.FONT_FAMILY, 11),
                             bg=S.BG_APP, fg=S.ACCENT_WARM)
        brand_dot.pack(side="left", padx=(0, 6))
        title = tk.Label(top, text="护眼管家", font=S.FONT_TITLE,
                         bg=S.BG_APP, fg=S.TEXT_PRIMARY)
        title.pack(side="left")
        close_btn = tk.Label(top, text="✕", font=(S.FONT_FAMILY, 13),
                             bg=S.BG_APP, fg=S.TEXT_TERTIARY, cursor="hand2")
        close_btn.pack(side="right")
        close_btn.bind("<Button-1>", lambda e: self._cb["on_hide"]())
        close_btn.bind("<Enter>", lambda e: close_btn.config(fg=S.TEXT_PRIMARY))
        close_btn.bind("<Leave>", lambda e: close_btn.config(fg=S.TEXT_TERTIARY))

        # ---- 圆环倒计时 + 状态文字（融合布局，避免孤立）----
        ring_wrap = tk.Frame(outer, bg=S.BG_APP)
        ring_wrap.pack(fill="x", pady=(8, 2))
        self.ring_canvas = Canvas(ring_wrap,
                                  width=S.RING_SIZE + 30,
                                  height=S.RING_SIZE + 30,
                                  bg=S.BG_APP, highlightthickness=0)
        _patch_round_rect(self.ring_canvas)
        self.ring_canvas.pack()
        self._draw_ring(progress=1.0, label="准备中", time_text="--:--")

        # ---- 状态标签（紧贴圆环下方，作为圆环一部分）----
        self.state_label = tk.Label(outer, text="待命中", font=S.FONT_SMALL,
                                    bg=S.BG_APP, fg=S.TEXT_SECONDARY)
        self.state_label.pack(pady=(0, 10))

        # ---- 统计卡片（Canvas 多层阴影 + 差异化配色）----
        stats_wrap = tk.Frame(outer, bg=S.BG_APP)
        stats_wrap.pack(fill="x", pady=(0, 10))
        self.stat_canvas = Canvas(stats_wrap, height=88, bg=S.BG_APP,
                                  highlightthickness=0)
        _patch_round_rect(self.stat_canvas)
        self.stat_canvas.pack(fill="x")
        self._stat_cards_meta = []  # [(key, val_id, color, unit)]
        self._draw_stat_cards()

        # ---- 7 天柱状图卡片（白底圆角 + 多层阴影）----
        chart_wrap = tk.Frame(outer, bg=S.BG_APP)
        chart_wrap.pack(fill="x", pady=(0, 10))
        self.chart_canvas = Canvas(chart_wrap, height=96, bg=S.BG_APP,
                                   highlightthickness=0)
        _patch_round_rect(self.chart_canvas)
        self.chart_canvas.pack(fill="x")
        self._draw_chart_header_and_area([])

        # ---- 底部按钮区 ----
        btn_frame = tk.Frame(outer, bg=S.BG_APP)
        btn_frame.pack(fill="x", side="bottom")

        self.rest_btn = ctk.CTkButton(btn_frame, text="立即休息", height=38,
                                      corner_radius=S.RADIUS_SM, font=S.FONT_BODY_BOLD,
                                      fg_color=S.ACCENT, hover_color=S.ACCENT_HOVER,
                                      command=self._cb["on_rest_now"])
        self.rest_btn.pack(side="left", expand=True, fill="x", padx=(0, 5))

        self.pause_btn = ctk.CTkButton(btn_frame, text="暂停", height=38,
                                       corner_radius=S.RADIUS_SM, font=S.FONT_BODY,
                                       fg_color=S.BG_INNER, hover_color=S.BG_HOVER,
                                       text_color=S.TEXT_PRIMARY, border_width=1,
                                       border_color=S.BORDER,
                                       command=self._cb["on_pause_toggle"])
        self.pause_btn.pack(side="left", expand=True, fill="x", padx=5)

        self.settings_btn = ctk.CTkButton(btn_frame, text="设置", height=38,
                                          corner_radius=S.RADIUS_SM, font=S.FONT_BODY,
                                          fg_color=S.BG_INNER, hover_color=S.BG_HOVER,
                                          text_color=S.TEXT_PRIMARY, border_width=1,
                                          border_color=S.BORDER,
                                          command=self._cb["on_open_settings"])
        self.settings_btn.pack(side="left", expand=True, fill="x", padx=(5, 0))

    def _draw_stat_cards(self) -> None:
        """绘制三张统计卡片：差异化配色（绿/灰/蓝）+ 多层阴影 + 数字标签行距加大。"""
        c = self.stat_canvas
        c.delete("all")
        c.update_idletasks()
        w = max(c.winfo_width(), 340)
        h = 88
        margin = 4
        gap = 8
        card_w = (w - 2 * margin - 2 * gap) / 3
        self._stat_cards_meta = []
        # 差异化配色：今日完成=护眼绿、已跳过=中灰、连续天数=蓝
        items = [("todayCompleted", "今日完成", S.ACCENT_WARM, "次"),
                 ("todaySkipped", "已跳过", S.TEXT_SECONDARY, "次"),
                 ("streakDays", "连续天数", S.ACCENT, "天")]
        for i, (key, label, color, unit) in enumerate(items):
            x1 = margin + i * (card_w + gap)
            y1 = 4
            x2 = x1 + card_w
            y2 = h - 4
            # 多层阴影卡片
            _draw_shadow_card(c, x1, y1, x2, y2, 10)
            cx = (x1 + x2) / 2
            # 数值（粗大，差异化颜色）— 上移留出与标签的呼吸距离
            val_id = c.create_text(cx, y1 + 32, text="0",
                                   font=S.FONT_H1, fill=color)
            # 标签（小浅灰）— 与数值保持 18px 间距
            c.create_text(cx, y2 - 14, text=label,
                          font=S.FONT_CAPTION, fill=S.TEXT_TERTIARY)
            self._stat_cards_meta.append((key, val_id, color, unit))

    def _draw_chart_header_and_area(self, last7: list[dict]) -> None:
        """绘制柱状图卡片：标题 + 7天柱状图（sqrt 归一化 + 圆角柱 + 统一字号）。"""
        c = self.chart_canvas
        c.delete("all")
        c.update_idletasks()
        w = max(c.winfo_width(), 300)
        h = 96
        margin = 4
        # 卡片本体（多层阴影）
        _draw_shadow_card(c, margin, 2, w - margin, h - 2, 12)
        # 标题
        c.create_text(margin + 14, 16, text="近 7 天护眼记录",
                      font=S.FONT_CAPTION, fill=S.TEXT_TERTIARY, anchor="w")
        # 柱状图区域
        chart_x1 = margin + 14
        chart_x2 = w - margin - 14
        chart_y1 = 30
        chart_y2 = h - 10
        chart_h = chart_y2 - chart_y1
        chart_w = chart_x2 - chart_x1

        if not last7:
            # 空数据占位
            c.create_text(w / 2, (chart_y1 + chart_y2) / 2, text="暂无数据",
                          font=S.FONT_SMALL, fill=S.TEXT_TERTIARY)
            return

        max_val = max((d["completed"] for d in last7), default=1) or 1
        bar_gap = 8
        bar_w = (chart_w - 6 * bar_gap) / 7
        for i, d in enumerate(last7):
            x = chart_x1 + i * (bar_w + bar_gap)
            val = d["completed"]
            # sqrt 归一化：柔和波动，避免大值和小值比例失调
            norm = math.sqrt(val / max_val) if max_val > 0 else 0
            bh = max(3, int(chart_h * 0.78 * norm))
            color = S.ACCENT_WARM if val > 0 else S.BG_HOVER
            # 圆角柱（顶部圆角）
            c.create_round_rectangle(x, chart_y2 - bh, x + bar_w, chart_y2,
                                     r=3, fill=color, outline="")
            weekday = "一二三四五六日"[datetime.strptime(d["date"], "%Y-%m-%d").weekday()]
            c.create_text(x + bar_w / 2, chart_y2 + 0, text=weekday,
                          font=S.FONT_CAPTION, fill=S.TEXT_TERTIARY,
                          anchor="n")
            if val > 0:
                c.create_text(x + bar_w / 2, chart_y2 - bh - 4, text=str(val),
                              font=(S.FONT_FAMILY, 9, "bold"),
                              fill=S.TEXT_SECONDARY, anchor="s")

    # -------------------------------------------------------------------
    # 圆环绘制（加粗匹配字号 + 12 点断点渐隐）
    # -------------------------------------------------------------------
    def _draw_ring(self, progress: float, label: str, time_text: str) -> None:
        c = self.ring_canvas
        c.delete("all")
        size = S.RING_SIZE
        cx = cy = (size + 30) / 2
        r = size / 2 - 10
        box = (cx - r, cy - r, cx + r, cy + r)
        ring_width = 13  # 加粗以匹配字号视觉重量

        # 底环（灰）
        c.create_arc(box, start=90, extent=-359.5, style="arc",
                     width=ring_width, outline=S.RING_TRACK)
        # 进度环
        ring_color = S.RING_PROGRESS_WARM  # 待命态用护眼绿（品牌色）
        if self._state == STATES["WARNING"]:
            ring_color = S.RING_WARNING
        elif self._state == STATES["BREAK"]:
            ring_color = S.RING_BREAK
        extent = -359.5 * max(0.0, min(1.0, progress))
        if extent < -0.5:
            c.create_arc(box, start=90, extent=extent, style="arc",
                         width=ring_width, outline=ring_color)
        # 12 点断点渐隐：用背景色椭圆 + 一小段底环弧覆盖，柔化起止
        c.create_oval(cx - 8, cy - r - 8, cx + 8, cy - r + 8,
                      fill=S.BG_APP, outline="")

        # 中央文字（缩小匹配圆环，留呼吸感）
        c.create_text(cx, cy - 8, text=time_text,
                      font=S.FONT_TIMER, fill=S.TEXT_PRIMARY)
        c.create_text(cx, cy + 22, text=label,
                      font=S.FONT_SMALL, fill=S.TEXT_SECONDARY)

    # -------------------------------------------------------------------
    # 外部更新接口
    # -------------------------------------------------------------------
    def update_state(self, state: str, seconds_to_break: int, next_type: str,
                     total_interval: int, paused: bool) -> None:
        self._state = state
        self._seconds_to_break = seconds_to_break
        self._next_type = next_type
        self._paused = paused

        time_text = format_duration(max(0, seconds_to_break))
        progress = (seconds_to_break / total_interval) if total_interval > 0 else 0
        type_label = {"micro": "微休息", "short": "短休息", "long": "长休息"}.get(next_type, "休息")
        label = f"距下次{type_label}"
        if state == STATES["WARNING"]:
            label = f"即将开始{type_label}"
        if paused:
            label = "已暂停"
            time_text = "⏸"

        self._draw_ring(progress, label, time_text)

        state_map = {
            STATES["IDLE"]: "待命中",
            STATES["WARNING"]: "休息即将开始",
            STATES["BREAK"]: "休息中",
            STATES["PAUSED"]: "已暂停",
        }
        self.state_label.config(text=state_map.get(state, "待命中"),
                                fg=S.WARNING if state == STATES["WARNING"] else S.TEXT_SECONDARY)
        self.pause_btn.configure(text="恢复" if paused else "暂停")

    def update_stats(self, stats: dict) -> None:
        c = self.stat_canvas
        for key, val_id, color, unit in self._stat_cards_meta:
            val = stats.get(key, 0)
            c.itemconfig(val_id, text=f"{val}")
        self._draw_chart_header_and_area(stats.get("last7", []))

    # -------------------------------------------------------------------
    # 显示/隐藏
    # -------------------------------------------------------------------
    def show_near_cursor(self) -> None:
        pt = wintypes.POINT()
        ctypes.windll.user32.GetCursorPos(ctypes.byref(pt))
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = pt.x + 16
        y = pt.y + 16
        if x + S.PANEL_W > sw - 8:
            x = pt.x - S.PANEL_W - 16
        if y + S.PANEL_H > sh - 8:
            y = sh - S.PANEL_H - 8
        if x < 8:
            x = 8
        if y < 8:
            y = 8
        self.geometry(f"+{x}+{y}")
        self.deiconify()
        self.lift()
        self.focus_force()
        import time
        self._shown_at = time.time()
        # 刷新依赖宽度的 Canvas
        self.after(60, self._refresh_canvases)

    def _refresh_canvases(self) -> None:
        self._draw_stat_cards()
        # 重新填值
        c = self.stat_canvas
        # 占位保持

    def hide(self) -> None:
        self.withdraw()
