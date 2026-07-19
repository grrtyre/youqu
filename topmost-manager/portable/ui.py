# -*- coding: utf-8 -*-
"""ui.py —— 主窗口（customtkinter，苹果白高端风格）。

设计要点：
- 无边框 frameless，自定义标题栏（可拖动）
- 尺寸 380×480（满足 ≤400×500）
- 失焦自动隐藏（输入法式行为）
- Esc 隐藏
- 窗口列表：图标圆 + 标题 + 进程名 + 置顶开关 + 透明度滑条 + 星标
- 顶部搜索框，底部自动置顶开关 + 规则数 + 版本号
"""
from __future__ import annotations

import hashlib
import os
import tkinter as tk
from typing import Callable, List, Optional

import customtkinter as ctk
from PIL import Image, ImageDraw, ImageTk

from win32_api import WindowInfo, set_topmost, set_alpha, reset_alpha


# ---- 配色（苹果白高端风格）----
BG = "#f2f2f5"              # 主背景（稍深一点，让卡片更突出）
CARD = "#ffffff"            # 卡片白
CARD_HOVER = "#f7f7f9"      # 卡片悬停
TEXT = "#1d1d1f"            # 主文本
SUB = "#86868b"             # 次文本
ACCENT = "#007aff"          # 蓝色强调
ACCENT_HOVER = "#0066d6"    # 蓝色悬停
BORDER = "#e5e5ea"          # 边框
BORDER_LIGHT = "#efeff2"    # 浅边框
DANGER = "#ff3b30"          # 红
SUCCESS = "#34c759"         # 绿

# ---- 尺寸 ----
WIN_W = 380
WIN_H = 480
ROW_PAD = 8
SHADOW_OFFSET = 8           # 阴影窗口偏移
SHADOW_ALPHA = 0.15         # 阴影透明度

# ---- 头像颜色池（按 proc 哈希取色）----
AVATAR_COLORS = [
    "#007aff", "#ff3b30", "#34c759", "#ff9500", "#af52de",
    "#5856d6", "#ff2d55", "#5ac8fa", "#ffd60a", "#30b0c7",
]


def avatar_color(proc: str) -> str:
    h = hashlib.md5(proc.encode("utf-8")).hexdigest()
    idx = int(h[:8], 16) % len(AVATAR_COLORS)
    return AVATAR_COLORS[idx]


def truncate(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def make_avatar_image(letter: str, color: str, size: int = 28) -> Image.Image:
    """生成圆形头像图片。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([(0, 0), (size - 1, size - 1)], fill=color)
    # 字
    from PIL import ImageFont
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc",
                                   int(size * 0.55))
    except Exception:
        font = ImageFont.load_default()
    # 居中
    bbox = d.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    d.text((x, y), letter, font=font, fill=(255, 255, 255, 255))
    return img


class WindowRow(ctk.CTkFrame):
    """单行窗口信息卡片（grid 布局，保证列对齐）。"""

    # 固定列宽（px）：头像 | 标题区 | 开关 | 滑条 | 星标
    COL_AVATAR = 44
    COL_SWITCH = 46
    COL_SLIDER = 76
    COL_STAR = 30
    ROW_HEIGHT = 56

    def __init__(self, master, info: WindowInfo, is_rule: bool,
                 on_toggle: Callable[[int, bool], None],
                 on_alpha: Callable[[int, int], None],
                 on_star: Callable[[str], None]):
        # 置顶的窗口用极淡的蓝色背景，强化"已置顶"视觉反馈
        bg = "#f0f7ff" if info.topmost else CARD
        border = "#cfe4ff" if info.topmost else BORDER_LIGHT
        super().__init__(master, fg_color=bg, corner_radius=12,
                          border_width=1, border_color=border,
                          height=self.ROW_HEIGHT)
        self.info = info
        self.on_toggle = on_toggle
        self.on_alpha = on_alpha
        self.on_star = on_star
        self.pack_propagate(False)  # 锁定高度

        # grid 列定义：头像 | 标题(扩展) | 开关 | 滑条 | 星标
        self.grid_columnconfigure(0, minsize=self.COL_AVATAR, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_columnconfigure(2, minsize=self.COL_SWITCH, weight=0)
        self.grid_columnconfigure(3, minsize=self.COL_SLIDER, weight=0)
        self.grid_columnconfigure(4, minsize=self.COL_STAR, weight=0)
        self.grid_rowconfigure(0, weight=1)

        # 第 0 列：头像
        letter = (info.proc[:1] or "?").upper()
        color = avatar_color(info.proc)
        avatar_img = make_avatar_image(letter, color, 30)
        self.avatar = ctk.CTkLabel(self, text="", width=36, height=36,
                                    image=ctk.CTkImage(avatar_img,
                                                       size=(30, 30)))
        self.avatar.grid(row=0, column=0, padx=(8, 4), pady=10,
                          sticky="w")

        # 第 1 列：标题 + 进程名
        mid = ctk.CTkFrame(self, fg_color="transparent")
        mid.grid(row=0, column=1, padx=(2, 6), pady=8, sticky="nsew")
        mid.grid_rowconfigure(0, weight=1)
        mid.grid_columnconfigure(0, weight=1)

        self.title_lbl = ctk.CTkLabel(
            mid, text=truncate(info.title, 28),
            font=ctk.CTkFont(family="Microsoft YaHei UI",
                              size=12, weight="bold"),
            text_color=TEXT, anchor="w", justify="left",
        )
        self.title_lbl.grid(row=0, column=0, sticky="sw", padx=0, pady=(0, 0))

        proc_text = info.proc
        if info.topmost and info.alpha < 255:
            proc_text += f"  ·  {int(round(info.alpha / 2.55))}%"
        self.proc_lbl = ctk.CTkLabel(
            mid, text=proc_text,
            font=ctk.CTkFont(family="Microsoft YaHei UI", size=10),
            text_color=SUB, anchor="w", justify="left",
        )
        self.proc_lbl.grid(row=1, column=0, sticky="nw", padx=0, pady=(0, 0))
        mid.grid_rowconfigure(1, weight=1)

        # 第 2 列：置顶开关
        self.switch_var = ctk.BooleanVar(value=info.topmost)
        self.switch = ctk.CTkSwitch(
            self, text="", variable=self.switch_var,
            progress_color=ACCENT, button_color=CARD,
            button_hover_color="#f0f0f0",
            fg_color="#e5e5ea",
            width=42, height=24,
            command=self._on_toggle,
        )
        self.switch.grid(row=0, column=2, padx=(2, 2), pady=10,
                          sticky="e")

        # 第 3 列：透明度滑条（仅置顶时显示，否则留空保持网格对齐）
        if info.topmost:
            self.alpha_var = ctk.IntVar(value=int(round(info.alpha / 2.55)))
            self.alpha_slider = ctk.CTkSlider(
                self, from_=10, to=100, width=60,
                variable=self.alpha_var,
                progress_color=ACCENT,
                button_color=CARD, button_hover_color="#f0f0f0",
                button_length=12,
                command=self._on_alpha,
            )
            self.alpha_slider.grid(row=0, column=3, padx=(2, 4), pady=10,
                                    sticky="e")

        # 第 4 列：星标
        self.star_btn = ctk.CTkButton(
            self, text="★" if is_rule else "☆", width=26, height=26,
            font=ctk.CTkFont(size=14),
            fg_color="transparent", hover_color="#dbeafe" if is_rule else "#ebebef",
            text_color=ACCENT if is_rule else SUB,
            corner_radius=13,
            command=self._on_star,
        )
        self.star_btn.grid(row=0, column=4, padx=(2, 8), pady=10,
                            sticky="e")

    def _on_toggle(self):
        new_state = self.switch_var.get()
        self.on_toggle(self.info.hwnd, new_state)

    def _on_alpha(self, value):
        self.on_alpha(self.info.hwnd, int(value))

    def _on_star(self):
        self.on_star(self.info.proc)


class MainWindow(ctk.CTk):
    """主窗口控制器。"""

    def __init__(self,
                 on_toggle_topmost: Callable[[int, bool], None],
                 on_set_alpha: Callable[[int, int], None],
                 on_star: Callable[[str], None],
                 on_autopin_toggle: Callable[[bool], None],
                 on_refresh_request: Callable[[], List[WindowInfo]],
                 get_rules_state: Callable[[], tuple],
                 app_version: str = "1.0.0"):
        super().__init__()
        self.on_toggle_topmost = on_toggle_topmost
        self.on_set_alpha = on_set_alpha
        self.on_star = on_star
        self.on_autopin_toggle = on_autopin_toggle
        self.on_refresh_request = on_refresh_request
        self.get_rules_state = get_rules_state
        self.app_version = app_version

        # 自有 hwnd（用于枚举时排除自身）
        self._my_hwnd: Optional[int] = None
        self._drag_offset = (0, 0)
        self._alpha_throttle_after = None
        self._last_alpha_value = {}
        self._visible = False

        # 阴影窗口（在主窗口下方，模拟真实投影）
        self._shadow_win = None

        # 窗口基础设置
        self.title("置顶管家")
        self.geometry(f"{WIN_W}x{WIN_H}")
        self.minsize(WIN_W, 320)
        self.maxsize(WIN_W, WIN_H + 40)
        self.configure(fg_color=BG)
        self.overrideredirect(True)  # 无边框
        self.attributes("-topmost", True)
        self.attributes("-alpha", 0.0)  # 初始透明，淡入
        # 内容容器：白底圆角，制造卡片感
        self._content = ctk.CTkFrame(self, fg_color=BG, corner_radius=14,
                                      border_width=0)
        self._content.pack(fill="both", expand=True, padx=0, pady=0)

        self._build_title_bar()
        self._build_search()
        self._build_list()
        self._build_footer()

        # 绑定
        self.bind("<Escape>", lambda e: self.hide())
        self.bind("<FocusOut>", self._on_focus_out)
        self.bind_all("<Button-1>", self._on_any_click, add="+")

        # 失焦检测定时器
        self._focus_check_after = None

        # 初始位置：屏幕右下，托盘上方
        self._position_bottom_right()

        # 创建阴影窗口
        self._create_shadow()

        # 准备好后淡入显示
        self.after(50, self._initial_show)

    # ---- 构建 UI ----
    def _build_title_bar(self):
        bar = ctk.CTkFrame(self._content, fg_color=BG, height=42,
                           corner_radius=0)
        bar.pack(side="top", fill="x", padx=0, pady=0)
        bar.pack_propagate(False)

        # 图标 + 标题
        title = ctk.CTkLabel(
            bar, text="📌  置顶管家",
            font=ctk.CTkFont(family="Microsoft YaHei UI",
                              size=15, weight="bold"),
            text_color=TEXT,
        )
        title.pack(side="left", padx=16)

        # 拖动绑定
        for w in (bar, title):
            w.bind("<Button-1>", self._on_drag_start)
            w.bind("<B1-Motion>", self._on_drag_motion)
            w.bind("<ButtonRelease-1>", self._on_drag_end)

        # 关闭按钮（圆形悬停）
        close = ctk.CTkButton(
            bar, text="✕", width=30, height=30,
            font=ctk.CTkFont(size=13, weight="normal"),
            fg_color="transparent", hover_color="#ebebef",
            text_color=SUB,
            corner_radius=15,
            command=self.hide,
        )
        close.pack(side="right", padx=(0, 10), pady=6)

        # 刷新按钮
        refresh = ctk.CTkButton(
            bar, text="↻", width=30, height=30,
            font=ctk.CTkFont(size=15),
            fg_color="transparent", hover_color="#ebebef",
            text_color=SUB,
            corner_radius=15,
            command=self.refresh_list,
        )
        refresh.pack(side="right", padx=(0, 4), pady=6)

    def _build_search(self):
        # 搜索容器：白色卡片 + 细腻阴影感（通过外层细边框模拟）
        wrap = ctk.CTkFrame(self._content, fg_color=BG, height=50)
        wrap.pack(side="top", fill="x", padx=12, pady=(4, 6))
        wrap.pack_propagate(False)

        # 内层搜索框（白底圆角，带细边框）
        self.search_var = ctk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._apply_filter())
        self.search_entry = ctk.CTkEntry(
            wrap, textvariable=self.search_var,
            placeholder_text="🔍  搜索窗口标题或进程名…",
            font=ctk.CTkFont(family="Microsoft YaHei UI", size=12),
            fg_color=CARD, border_color=BORDER, border_width=1,
            corner_radius=10, height=36,
            text_color=TEXT,
            placeholder_text_color=SUB,
        )
        self.search_entry.pack(side="left", fill="x", expand=True,
                                pady=7, padx=4)
        # 焦点高亮
        self.search_entry.bind("<FocusIn>", lambda e:
            self.search_entry.configure(border_color=ACCENT))
        self.search_entry.bind("<FocusOut>", lambda e:
            self.search_entry.configure(border_color=BORDER))

    def _build_list(self):
        self.list_container = ctk.CTkScrollableFrame(
            self._content, fg_color=BG, corner_radius=0,
            scrollbar_button_color=SUB,
            scrollbar_button_hover_color=ACCENT,
        )
        self.list_container.pack(side="top", fill="both", expand=True,
                                  padx=12, pady=(0, 6))
        self._rows: List[WindowRow] = []

        # 空提示
        self.empty_label = ctk.CTkLabel(
            self.list_container,
            text="没有可见窗口",
            font=ctk.CTkFont(family="Microsoft YaHei UI", size=12),
            text_color=SUB,
        )

    def _build_footer(self):
        # 顶部分隔线（明确视觉分隔）
        divider = ctk.CTkFrame(self._content, fg_color=BORDER, height=1,
                               corner_radius=0)
        divider.pack(side="bottom", fill="x", padx=0, pady=0)

        footer = ctk.CTkFrame(self._content, fg_color=CARD, height=42,
                              corner_radius=0,
                              border_width=0)
        footer.pack(side="bottom", fill="x", padx=0, pady=0)
        footer.pack_propagate(False)

        autopin_state, rule_count = self.get_rules_state()

        # 自动置顶开关
        ctk.CTkLabel(
            footer, text="自动置顶",
            font=ctk.CTkFont(family="Microsoft YaHei UI", size=11),
            text_color=TEXT,
        ).pack(side="left", padx=(12, 4))
        self.autopin_var = ctk.BooleanVar(value=autopin_state)
        self.autopin_switch = ctk.CTkSwitch(
            footer, text="", variable=self.autopin_var,
            progress_color=ACCENT, button_color=CARD,
            button_hover_color="#e5e5ea",
            width=36, height=20,
            command=self._on_autopin_toggle,
        )
        self.autopin_switch.pack(side="left", padx=(0, 12))

        # 规则数
        self.rule_count_lbl = ctk.CTkLabel(
            footer, text=f"规则 {rule_count} 项",
            font=ctk.CTkFont(family="Microsoft YaHei UI", size=11),
            text_color=SUB,
        )
        self.rule_count_lbl.pack(side="left", padx=4)

        # 版本号
        ctk.CTkLabel(
            footer, text=f"v{self.app_version}",
            font=ctk.CTkFont(family="Microsoft YaHei UI", size=10),
            text_color=SUB,
        ).pack(side="right", padx=12)

    # ---- 阴影窗口 ----
    def _create_shadow(self):
        """创建阴影窗口：在主窗口下方，半透明黑色，制造真实投影。

        tkinter 无原生阴影，用独立 Toplevel + -alpha 模拟。
        """
        try:
            self._shadow_win = tk.Toplevel(self)
            self._shadow_win.overrideredirect(True)
            self._shadow_win.attributes("-topmost", True)
            self._shadow_win.attributes("-alpha", SHADOW_ALPHA)
            self._shadow_win.configure(bg="#000000")
            # 初始隐藏
            self._shadow_win.withdraw()
        except Exception as e:
            print(f"[shadow] 创建失败: {e}")
            self._shadow_win = None

    def _position_shadow(self):
        if self._shadow_win is None:
            return
        try:
            x = self.winfo_x() - SHADOW_OFFSET
            y = self.winfo_y() - SHADOW_OFFSET + 2
            w = WIN_W + SHADOW_OFFSET * 2
            h = WIN_H + SHADOW_OFFSET * 2
            self._shadow_win.geometry(f"{w}x{h}+{x}+{y}")
        except Exception:
            pass

    def _show_shadow(self):
        if self._shadow_win is None:
            return
        try:
            self._position_shadow()
            self._shadow_win.deiconify()
            # 主窗口保持在阴影之上
            self.lift(self._shadow_win)
        except Exception:
            pass

    def _hide_shadow(self):
        if self._shadow_win is None:
            return
        try:
            self._shadow_win.withdraw()
        except Exception:
            pass

    # ---- 显示/隐藏 ----
    def _position_bottom_right(self):
        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = sw - WIN_W - 16
        y = sh - WIN_H - 60
        self.geometry(f"{WIN_W}x{WIN_H}+{x}+{y}")

    def _initial_show(self):
        # 获取自身 hwnd
        try:
            import ctypes
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            self._my_hwnd = int(hwnd) if hwnd else None
        except Exception:
            self._my_hwnd = None
        # 淡入
        self._fade_in()
        # 首次刷新
        self.refresh_list()

    def _fade_in(self, alpha: float = 0.0):
        alpha = min(1.0, alpha + 0.15)
        try:
            self.attributes("-alpha", alpha)
        except Exception:
            return
        if alpha < 1.0:
            self.after(16, lambda: self._fade_in(alpha))

    def show(self):
        if self._visible:
            # 已可见则刷新
            self.refresh_list()
            return
        self._visible = True
        self._position_bottom_right()
        self._show_shadow()
        self.deiconify()
        self.attributes("-alpha", 0.0)
        self._fade_in()
        self.refresh_list()
        # 启动失焦检测
        self._start_focus_check()

    def hide(self):
        if not self._visible:
            return
        self._visible = False
        self._stop_focus_check()
        try:
            self.attributes("-alpha", 0.0)
        except Exception:
            pass
        self._hide_shadow()
        self.withdraw()

    def _start_focus_check(self):
        self._stop_focus_check()
        self._focus_check_after = self.after(300, self._check_foreground)

    def _stop_focus_check(self):
        if self._focus_check_after is not None:
            try:
                self.after_cancel(self._focus_check_after)
            except Exception:
                pass
            self._focus_check_after = None

    def _check_foreground(self):
        if not self._visible:
            return
        try:
            import ctypes
            fg = ctypes.windll.user32.GetForegroundWindow()
            my = self._my_hwnd
            # 如果前台不是本窗口，且本窗口可见，则隐藏
            if fg and my and int(fg) != int(my):
                self.hide()
                return
        except Exception:
            pass
        self._focus_check_after = self.after(300, self._check_foreground)

    def _on_focus_out(self, event):
        # 焦点丢失后再延迟检查（避免点击自身控件误触）
        if self._visible:
            self.after(250, self._check_foreground)

    def _on_any_click(self, event):
        # 点击窗口内部时，重置失焦计时（避免某些边缘情况下被误隐藏）
        pass

    # ---- 拖动 ----
    def _on_drag_start(self, event):
        self._drag_offset = (event.x_root - self.winfo_x(),
                              event.y_root - self.winfo_y())

    def _on_drag_motion(self, event):
        x = event.x_root - self._drag_offset[0]
        y = event.y_root - self._drag_offset[1]
        self.geometry(f"+{x}+{y}")
        # 阴影跟随
        if self._shadow_win is not None:
            try:
                self._shadow_win.geometry(
                    f"+{x - SHADOW_OFFSET}+{y - SHADOW_OFFSET + 2}"
                )
            except Exception:
                pass

    def _on_drag_end(self, event):
        pass

    # ---- 窗口列表 ----
    def refresh_list(self):
        """重新枚举并渲染窗口列表。"""
        # 清空旧行
        for row in self._rows:
            try:
                row.destroy()
            except Exception:
                pass
        self._rows = []

        windows = self.on_refresh_request()
        autopin_state, rule_count = self.get_rules_state()
        # 自动置顶 + 置顶窗口排前面
        windows.sort(key=lambda w: (not w.topmost, w.title.lower()))

        filter_text = self.search_var.get().strip().lower() if hasattr(self, "search_var") else ""
        for w in windows:
            if filter_text and filter_text not in w.title.lower() \
               and filter_text not in w.proc.lower():
                continue
            # 星标状态由注入的规则判断函数决定
            row = WindowRow(
                self.list_container,
                info=w,
                is_rule=self._is_proc_in_rules(w.proc),
                on_toggle=self._handle_toggle,
                on_alpha=self._handle_alpha,
                on_star=self._handle_star,
            )
            row.pack(fill="x", padx=2, pady=(0, 8))
            self._rows.append(row)

        if not self._rows:
            self.empty_label.pack(pady=40)

        # 更新底部规则数
        if hasattr(self, "rule_count_lbl"):
            self.rule_count_lbl.configure(text=f"规则 {rule_count} 项")

    def _is_proc_in_rules(self, proc: str) -> bool:
        """由 main 注入实际判断。"""
        return self._is_rule_func(proc) if hasattr(self, "_is_rule_func") else False

    def set_is_rule_func(self, func: Callable[[str], bool]):
        """注入规则判断函数。"""
        self._is_rule_func = func

    def _apply_filter(self):
        """搜索框过滤时，重新渲染列表（不重新枚举）。"""
        # 简化：直接重新刷新
        self.refresh_list()

    # ---- 行事件处理 ----
    def _handle_toggle(self, hwnd: int, on: bool):
        self.on_toggle_topmost(hwnd, on)

    def _handle_alpha(self, hwnd: int, value: int):
        # 节流：100ms 内只发一次
        self._last_alpha_value[hwnd] = value
        if self._alpha_throttle_after is not None:
            try:
                self.after_cancel(self._alpha_throttle_after)
            except Exception:
                pass
        self._alpha_throttle_after = self.after(
            80, lambda: self._flush_alpha()
        )

    def _flush_alpha(self):
        self._alpha_throttle_after = None
        for hwnd, value in self._last_alpha_value.items():
            self.on_set_alpha(hwnd, value)
        self._last_alpha_value.clear()

    def _handle_star(self, proc: str):
        self.on_star(proc)
        # 星标后刷新底部规则数
        _, rule_count = self.get_rules_state()
        if hasattr(self, "rule_count_lbl"):
            self.rule_count_lbl.configure(text=f"规则 {rule_count} 项")
        # 刷新列表以更新星标显示
        self.refresh_list()

    def _on_autopin_toggle(self):
        new_state = self.autopin_var.get()
        self.on_autopin_toggle(new_state)

    def update_autopin_state(self, state: bool, rule_count: int):
        """外部规则变化后，更新底部开关与计数。"""
        self.autopin_var.set(state)
        if hasattr(self, "rule_count_lbl"):
            self.rule_count_lbl.configure(text=f"规则 {rule_count} 项")
