# -*- coding: utf-8 -*-
"""overlay.py — 全屏休息覆盖层（精致版）

休息时全屏半透明遮罩 + 中央投影白卡：大圆环倒计时 + 线性护眼图标 + 动作引导。
苹果白风格：暖色偏移半透明遮罩（#1f1c1a，非纯黑）、白色卡片多层投影悬浮、绿色鲜亮圆环。

严格模式视觉语言：
- 卡片顶部横跨橙色锁条带（强视觉压迫感）
- 大 pill 徽章带盾牌图标
- 圆环改用橙色 #ff9500
- 隐藏跳过/延后按钮
- 中央倒计时下方文字改为"已锁定 · 专注放松"
- 单按钮"休息进行中"带锁图标（无省略号）
"""
from __future__ import annotations

import math
import ctypes
import tkinter as tk
from tkinter import Canvas, Toplevel

import customtkinter as ctk

import styles as S
from core import pick_exercises, format_duration


def _patch_round_rect(canvas: Canvas):
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


def _draw_shadow_card_overlay(canvas: Canvas, x1, y1, x2, y2, r,
                              fill=S.BG_CARD, outline=S.BORDER_SOFT, outline_w=1):
    """绘制带 5 层弥散阴影的圆角卡片（覆盖层专用，深色背景下的柔和投影）。

    深色背景下用渐深的灰色模拟弥散阴影：外层最大最淡（最大扩散），内层最小最深。
    """
    shadow_layers = [
        (16, 18, "#2a2a30"),  # 最外层：偏移最大、最淡（环境光扩散）
        (12, 14, "#232328"),  # 次外层
        (8, 10, "#1e1e24"),   # 中层
        (5, 6, "#1a1a20"),    # 次内层
        (3, 3, "#18181e"),    # 最内层：偏移最小、最深（关键光）
    ]
    for off_x, off_y, gray in shadow_layers:
        canvas.create_round_rectangle(
            x1 + off_x, y1 + off_y, x2 + off_x, y2 + off_y,
            r=r, fill=gray, outline="")
    canvas.create_round_rectangle(
        x1, y1, x2, y2, r=r, fill=fill, outline=outline, width=outline_w)


def _draw_eye_icon(canvas: Canvas, cx: float, cy: float, w: float = 48,
                   h: float = 30, color: str = S.ACCENT):
    """绘制 SF Symbols 风格线性眼睛图标（精致版）。"""
    canvas.delete("eye")
    # 眼睛轮廓（椭圆，2.5px 线宽）
    canvas.create_oval(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2,
                       outline=color, width=2.5, tags="eye")
    # 瞳孔（实心圆）
    pr = h * 0.30
    canvas.create_oval(cx - pr, cy - pr, cx + pr, cy + pr,
                       fill=color, outline="", tags="eye")
    # 高光（小白点，偏左上）
    hr = pr * 0.42
    canvas.create_oval(cx - hr - 1.5, cy - hr - 1.5,
                       cx + hr - 1.5, cy + hr - 1.5,
                       fill="#ffffff", outline="", tags="eye")


def _draw_lock_icon(canvas: Canvas, cx: float, cy: float, size: float = 14,
                    color: str = "#ffffff"):
    """绘制小锁图标（用于严格模式按钮）。"""
    canvas.delete("lock")
    # 锁体（圆角矩形）
    body_w, body_h = size, size * 0.75
    bx1 = cx - body_w / 2
    by1 = cy - body_h / 4
    bx2 = cx + body_w / 2
    by2 = cy + body_h * 0.75
    canvas.create_round_rectangle(bx1, by1, bx2, by2, r=2,
                                  fill=color, outline="", tags="lock")
    # 锁环（圆弧）
    arc_r = body_w * 0.35
    canvas.create_arc(cx - arc_r, by1 - arc_r * 1.2,
                      cx + arc_r, by1 + arc_r * 0.2,
                      start=0, extent=180, style="arc",
                      width=1.8, outline=color, tags="lock")


class BreakOverlay(Toplevel):
    """全屏休息覆盖层。"""

    def __init__(self, master: tk.Tk, callbacks: dict) -> None:
        super().__init__(master)
        self._cb = callbacks
        self._strict = False
        self._break_type = "micro"
        self._total_sec = 20
        self._remaining = 20
        self._exercises: list[dict] = []
        self._ex_idx = 0
        self._tick_id = None

        # 全屏无边框置顶
        self.overrideredirect(True)
        self.configure(bg=S.MASK_COLOR)
        self.attributes("-topmost", True)
        self.attributes("-alpha", 0.78)  # 半透明遮罩
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        self.geometry(f"{sw}x{sh}+0+0")

        self._build_ui()
        self.bind("<Escape>", self._on_escape)

    def _build_ui(self) -> None:
        center = tk.Frame(self, bg=S.MASK_COLOR)
        center.place(relx=0.5, rely=0.5, anchor="center")

        # 卡片尺寸
        card_w, card_h = 560, 620

        # 卡片画布：绘制 5 层投影 + 白色圆角卡片
        self.card_canvas = Canvas(center, width=card_w + 50, height=card_h + 50,
                                  bg=S.MASK_COLOR, highlightthickness=0)
        _patch_round_rect(self.card_canvas)
        self.card_canvas.pack(padx=0, pady=0)

        # 卡片本体（5 层弥散阴影）
        _draw_shadow_card_overlay(self.card_canvas, 25, 25,
                                  25 + card_w, 25 + card_h, 22)

        inner_x = 25
        inner_y = 25

        # ---- 严格模式顶部锁条带（横跨卡片顶部，强视觉压迫感）----
        # 8px 高的橙色条带，紧贴卡片顶部内边缘
        self.strict_bar_id = self.card_canvas.create_round_rectangle(
            inner_x + 4, inner_y + 4,
            inner_x + card_w - 4, inner_y + 12,
            r=4, fill=S.WARNING, outline="", state="hidden")

        # ---- header：休息类型（居中）----
        header_y = inner_y + 36
        self.type_label = tk.Label(self.card_canvas, text="短休息",
                                   font=S.FONT_H2, bg=S.BG_CARD,
                                   fg=S.TEXT_PRIMARY)
        self.card_canvas.create_window(inner_x + card_w / 2, header_y,
                                       window=self.type_label)

        # ---- 严格模式 pill 徽章（带盾牌图标 + 锁，更显眼）----
        # pill 尺寸更大，背景橙色浅底 + 边框
        self.strict_pill = tk.Frame(self.card_canvas, bg=S.WARNING_SOFT,
                                    highlightthickness=1,
                                    highlightbackground=S.WARNING,
                                    highlightcolor=S.WARNING)
        # 用 Canvas 画小盾牌 + 锁
        shield = Canvas(self.strict_pill, width=22, height=22,
                        bg=S.WARNING_SOFT, highlightthickness=0)
        shield.pack(side="left", padx=(12, 4), pady=6)
        # 盾牌轮廓（带锁）
        shield.create_polygon([11, 2, 19, 5, 19, 13, 11, 19, 3, 13, 3, 5],
                              outline=S.WARNING, width=1.8, fill="")
        # 锁体
        shield.create_rectangle(8, 9, 14, 15, fill=S.WARNING, outline=S.WARNING)
        # 锁环
        shield.create_arc(8.5, 5, 13.5, 11, start=0, extent=180,
                          style="arc", width=1.5, outline=S.WARNING)
        tk.Label(self.strict_pill, text="严格模式 · 已锁定",
                 font=(S.FONT_FAMILY, 11, "bold"),
                 bg=S.WARNING_SOFT, fg=S.WARNING).pack(
                     side="left", padx=(0, 12))
        # 默认隐藏，严格模式时显示
        self.strict_pill_window_id = None

        # ---- 大圆环倒计时 ----
        ring_y = inner_y + 210
        self.ring = Canvas(self.card_canvas,
                           width=S.RING_OVERLAY_SIZE + 30,
                           height=S.RING_OVERLAY_SIZE + 30,
                           bg=S.BG_CARD, highlightthickness=0)
        self.card_canvas.create_window(inner_x + card_w / 2, ring_y,
                                       window=self.ring)

        # ---- 眼睛图标（线性，SF Symbols 风格）----
        icon_y = inner_y + 400
        self.icon_canvas = Canvas(self.card_canvas, width=64, height=44,
                                  bg=S.BG_CARD, highlightthickness=0)
        self.card_canvas.create_window(inner_x + card_w / 2, icon_y,
                                       window=self.icon_canvas)
        _draw_eye_icon(self.icon_canvas, 32, 22)

        # ---- 动作标题（与图标间距增加）----
        title_y = inner_y + 444
        self.ex_title = tk.Label(self.card_canvas, text="轻柔眨眼",
                                 font=S.FONT_H1, bg=S.BG_CARD,
                                 fg=S.TEXT_PRIMARY)
        self.card_canvas.create_window(inner_x + card_w / 2, title_y,
                                       window=self.ex_title)

        # ---- 动作引导 ----
        instr_y = inner_y + 482
        self.ex_instruction = tk.Label(self.card_canvas, text="",
                                       font=S.FONT_BODY, bg=S.BG_CARD,
                                       fg=S.TEXT_SECONDARY,
                                       wraplength=440, justify="center")
        self.card_canvas.create_window(inner_x + card_w / 2, instr_y,
                                       window=self.ex_instruction)

        # ---- 动作进度点（增大尺寸 + 当前页更明显）----
        dots_y = inner_y + 524
        self.dots_canvas = Canvas(self.card_canvas, width=240, height=22,
                                  bg=S.BG_CARD, highlightthickness=0)
        self.card_canvas.create_window(inner_x + card_w / 2, dots_y,
                                       window=self.dots_canvas)

        # ---- 严格模式锁定提示（更显眼）----
        lock_y = inner_y + 558
        self.lock_label = tk.Label(self.card_canvas,
                                   text="休息时间已锁定，请专注放松",
                                   font=(S.FONT_FAMILY, 11, "bold"),
                                   bg=S.BG_CARD, fg=S.WARNING)
        self.lock_window_id = None

        # ---- 底部按钮（统一高度 40px + 圆角 10）----
        btn_y = inner_y + card_h - 44
        btn_wrap = tk.Frame(self.card_canvas, bg=S.BG_CARD)
        self.card_canvas.create_window(inner_x + card_w / 2, btn_y,
                                       window=btn_wrap)

        # 跳过按钮
        self.skip_btn = ctk.CTkButton(btn_wrap, text="跳过", width=130, height=40,
                                      corner_radius=10, font=S.FONT_BODY,
                                      fg_color=S.BG_INNER, hover_color=S.BG_HOVER,
                                      text_color=S.TEXT_SECONDARY, border_width=1,
                                      border_color=S.BORDER,
                                      command=self._on_skip)
        self.skip_btn.pack(side="left", padx=5)

        # 延后按钮
        self.postpone_btn = ctk.CTkButton(btn_wrap, text="延后 5 分钟",
                                          width=130, height=40,
                                          corner_radius=10, font=S.FONT_BODY,
                                          fg_color=S.BG_INNER,
                                          hover_color=S.BG_HOVER,
                                          text_color=S.TEXT_SECONDARY,
                                          border_width=1,
                                          border_color=S.BORDER,
                                          command=self._on_postpone)
        self.postpone_btn.pack(side="left", padx=5)

        # 完成按钮（普通模式）/ 休息进行中按钮（严格模式，带锁图标）
        self.complete_btn = ctk.CTkButton(btn_wrap, text="完成休息",
                                          width=140, height=40,
                                          corner_radius=10,
                                          font=S.FONT_BODY_BOLD,
                                          fg_color=S.ACCENT,
                                          hover_color=S.ACCENT_HOVER,
                                          text_color="#ffffff",
                                          command=self._on_complete)
        self.complete_btn.pack(side="left", padx=5)

        # 严格模式专用按钮（带锁图标，橙色）
        self.strict_btn = ctk.CTkButton(btn_wrap, text="  休息进行中",
                                        width=160, height=40,
                                        corner_radius=10,
                                        font=S.FONT_BODY_BOLD,
                                        fg_color=S.WARNING,
                                        hover_color=S.WARNING,
                                        text_color="#ffffff",
                                        state="disabled")
        # 默认不显示

    # -------------------------------------------------------------------
    # 启动休息
    # -------------------------------------------------------------------
    def start(self, break_type: str, duration_sec: int, strict: bool) -> None:
        self._break_type = break_type
        self._total_sec = duration_sec
        self._remaining = duration_sec
        self._strict = strict
        self._exercises = pick_exercises(break_type, duration_sec)
        self._ex_idx = 0

        type_map = {"micro": "微休息", "short": "短休息", "long": "长休息"}
        self.type_label.config(text=type_map.get(break_type, "休息"))

        if strict:
            # 显示顶部锁条带
            self.card_canvas.itemconfig(self.strict_bar_id, state="normal")
            # 显示 pill 徽章
            if self.strict_pill_window_id is None:
                self.strict_pill_window_id = self.card_canvas.create_window(
                    25 + 560 / 2, 25 + 36 + 26, window=self.strict_pill)
            # 显示锁定提示
            if self.lock_window_id is None:
                self.lock_window_id = self.card_canvas.create_window(
                    25 + 560 / 2, 25 + 558, window=self.lock_label)
            # 隐藏跳过/延后/完成按钮
            self.skip_btn.pack_forget()
            self.postpone_btn.pack_forget()
            self.complete_btn.pack_forget()
            # 显示严格模式专用按钮（带锁图标）
            self.strict_btn.pack(side="top", padx=5)
            # 圆环下方文字改为"已锁定 · 专注放松"通过 _draw_ring 处理
        else:
            # 隐藏严格模式元素
            self.card_canvas.itemconfig(self.strict_bar_id, state="hidden")
            if self.strict_pill_window_id is not None:
                self.card_canvas.delete(self.strict_pill_window_id)
                self.strict_pill_window_id = None
            if self.lock_window_id is not None:
                self.card_canvas.delete(self.lock_window_id)
                self.lock_window_id = None
            # 显示普通按钮
            self.skip_btn.pack(side="left", padx=5)
            self.postpone_btn.pack(side="left", padx=5)
            self.complete_btn.pack(side="left", padx=5)
            self.strict_btn.pack_forget()

        self._render_dots()
        self._update_exercise()
        self._draw_ring()
        self.deiconify()
        self.lift()
        self.focus_force()
        if strict:
            self.protocol("WM_DELETE_WINDOW", lambda: None)
        self._tick()

    def _render_dots(self) -> None:
        c = self.dots_canvas
        c.delete("all")
        n = len(self._exercises)
        if n == 0:
            return
        # 增大点的尺寸：当前页 14×14，非当前页 8×8
        gap = 14
        total_w = n * 14 + (n - 1) * gap
        start_x = (240 - total_w) / 2
        dot_color = S.WARNING if self._strict else S.ACCENT
        for i in range(n):
            cx = start_x + i * (14 + gap) + 7
            if i == self._ex_idx:
                # 当前页：大点 + 强调色
                c.create_oval(cx - 7, 4, cx + 7, 18,
                              fill=dot_color, outline="")
            else:
                # 非当前页：小点 + 浅灰
                c.create_oval(cx - 4, 7, cx + 4, 15,
                              fill=S.BG_HOVER, outline="")

    def _update_exercise(self) -> None:
        if not self._exercises:
            return
        ex = self._exercises[min(self._ex_idx, len(self._exercises) - 1)]
        self.ex_title.config(text=ex["title"])
        self.ex_instruction.config(text=ex["instruction"])
        self._render_dots()

    # -------------------------------------------------------------------
    # 圆环绘制（严格模式橙色 + 普通模式绿色鲜亮）
    # -------------------------------------------------------------------
    def _draw_ring(self) -> None:
        c = self.ring
        c.delete("all")
        size = S.RING_OVERLAY_SIZE
        cx = cy = (size + 30) / 2
        r = size / 2 - 12
        box = (cx - r, cy - r, cx + r, cy + r)
        ring_width = 18  # 加粗更显眼

        # 底环
        c.create_arc(box, start=90, extent=-359.5, style="arc",
                     width=ring_width, outline=S.RING_TRACK)
        # 进度环颜色：严格模式橙色压迫感，普通模式鲜亮绿
        ring_color = S.RING_STRICT if self._strict else S.RING_BREAK
        progress = self._remaining / self._total_sec if self._total_sec > 0 else 0
        extent = -359.5 * max(0.0, min(1.0, progress))
        if extent < -0.5:
            c.create_arc(box, start=90, extent=extent, style="arc",
                         width=ring_width, outline=ring_color)
        # 12 点断点渐隐
        c.create_oval(cx - 10, cy - r - 10, cx + 10, cy - r + 10,
                      fill=S.BG_CARD, outline="")

        # 中央倒计时
        c.create_text(cx, cy - 12,
                      text=format_duration(max(0, self._remaining)),
                      font=S.FONT_TIMER_OVERLAY, fill=S.TEXT_PRIMARY)
        # 圆环下方文字：严格模式"已锁定 · 专注放松"，普通模式"放松双眼"
        sub_text = "已锁定 · 专注放松" if self._strict else "放松双眼"
        sub_color = S.WARNING if self._strict else S.TEXT_SECONDARY
        c.create_text(cx, cy + 36, text=sub_text,
                      font=S.FONT_H2, fill=sub_color)

    # -------------------------------------------------------------------
    # 倒计时
    # -------------------------------------------------------------------
    def _tick(self) -> None:
        if self._remaining <= 0:
            self._on_complete()
            return
        self._draw_ring()
        if self._exercises:
            seg = max(1, self._total_sec // len(self._exercises))
            idx = min(len(self._exercises) - 1, (self._total_sec - self._remaining) // seg)
            if idx != self._ex_idx:
                self._ex_idx = idx
                self._update_exercise()
        self._remaining -= 1
        self._tick_id = self.after(1000, self._tick)

    # -------------------------------------------------------------------
    # 按钮回调
    # -------------------------------------------------------------------
    def _on_escape(self, _e=None) -> None:
        if not self._strict:
            self._on_skip()

    def _on_skip(self) -> None:
        if self._strict:
            return
        self._stop_tick()
        self._cb["on_skip"]()

    def _on_postpone(self) -> None:
        if self._strict:
            return
        self._stop_tick()
        self._cb["on_postpone"]()

    def _on_complete(self) -> None:
        self._stop_tick()
        self._cb["on_complete"](self._total_sec - max(0, self._remaining))

    def _stop_tick(self) -> None:
        if self._tick_id is not None:
            self.after_cancel(self._tick_id)
            self._tick_id = None

    def close(self) -> None:
        self._stop_tick()
        try:
            self.withdraw()
            self.destroy()
        except Exception:
            pass
