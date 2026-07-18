# -*- coding: utf-8 -*-
"""settings_window.py — 设置窗口

配置三级休息周期（间隔/时长/启用）、严格模式、免打扰时段、预警、声音。
苹果白风格，与主面板视觉一致。
"""
from __future__ import annotations

import tkinter as tk
from tkinter import Toplevel

import customtkinter as ctk

import styles as S


class SettingsWindow(Toplevel):
    def __init__(self, master: tk.Tk, settings: dict, on_save: callable) -> None:
        super().__init__(master)
        self._on_save = on_save
        self._settings = settings
        self.title("护眼管家 · 设置")
        self.configure(bg=S.BG_APP)
        self.geometry("440x620")
        self.resizable(False, False)
        self.attributes("-topmost", True)
        self.transient(master)

        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        container = tk.Frame(self, bg=S.BG_APP)
        container.pack(fill="both", expand=True, padx=20, pady=20)

        # 标题
        tk.Label(container, text="设置", font=S.FONT_H1, bg=S.BG_APP,
                 fg=S.TEXT_PRIMARY).pack(anchor="w", pady=(0, 16))

        # ---- 休息周期卡片 ----
        self._vars = {}
        breaks_card = self._card(container, "休息周期")
        for t, name, color in [("micro", "微休息", S.SUCCESS),
                               ("short", "短休息", S.ACCENT),
                               ("long", "长休息", "#5856d6")]:
            cfg = self._settings["breaks"][t]
            row = tk.Frame(breaks_card, bg=S.BG_CARD)
            row.pack(fill="x", padx=14, pady=8)
            tk.Label(row, text=f"● {name}", font=S.FONT_BODY_BOLD, bg=S.BG_CARD,
                     fg=color).pack(side="left")
            # 启用开关
            en_var = tk.BooleanVar(value=cfg["enabled"])
            self._vars[f"{t}_enabled"] = en_var
            sw = ctk.CTkSwitch(row, text="", variable=en_var, width=46,
                               fg_color=S.BG_HOVER, progress_color=S.ACCENT,
                               button_color="#ffffff", button_hover_color="#f0f0f5")
            sw.pack(side="right")

            row2 = tk.Frame(breaks_card, bg=S.BG_CARD)
            row2.pack(fill="x", padx=14, pady=(0, 8))
            tk.Label(row2, text="间隔", font=S.FONT_SMALL, bg=S.BG_CARD,
                     fg=S.TEXT_SECONDARY).pack(side="left")
            int_var = tk.StringVar(value=str(cfg["interval"]))
            self._vars[f"{t}_interval"] = int_var
            ctk.CTkEntry(row2, textvariable=int_var, width=60, height=28,
                         corner_radius=S.RADIUS_SM, font=S.FONT_BODY,
                         fg_color=S.BG_INNER, border_color=S.BORDER).pack(side="left", padx=(6, 4))
            tk.Label(row2, text="分钟   时长", font=S.FONT_SMALL, bg=S.BG_CARD,
                     fg=S.TEXT_SECONDARY).pack(side="left", padx=(4, 0))
            dur_var = tk.StringVar(value=str(cfg["duration"]))
            self._vars[f"{t}_duration"] = dur_var
            ctk.CTkEntry(row2, textvariable=dur_var, width=60, height=28,
                         corner_radius=S.RADIUS_SM, font=S.FONT_BODY,
                         fg_color=S.BG_INNER, border_color=S.BORDER).pack(side="left", padx=(4, 4))
            tk.Label(row2, text="秒", font=S.FONT_SMALL, bg=S.BG_CARD,
                     fg=S.TEXT_SECONDARY).pack(side="left")

        # ---- 选项卡片 ----
        opt_card = self._card(container, "提醒方式")
        # 严格模式
        strict_var = tk.BooleanVar(value=self._settings["strictMode"])
        self._vars["strictMode"] = strict_var
        self._opt_row(opt_card, "严格模式", "休息时不可跳过/延后/关闭", strict_var)
        # 预警
        warn_var = tk.BooleanVar(value=self._settings["warning"]["enabled"])
        self._vars["warning_enabled"] = warn_var
        self._opt_row(opt_card, "休息前预警", "提前 10 秒提醒", warn_var)
        # 全屏抑制
        fs_var = tk.BooleanVar(value=self._settings["fullscreenSuppress"])
        self._vars["fullscreenSuppress"] = fs_var
        self._opt_row(opt_card, "全屏时抑制", "运行全屏应用时不打断", fs_var)
        # 声音
        sound_var = tk.BooleanVar(value=self._settings["sound"])
        self._vars["sound"] = sound_var
        self._opt_row(opt_card, "提示音", "休息开始/结束播放声音", sound_var)

        # ---- 免打扰卡片 ----
        dnd_card = self._card(container, "免打扰时段")
        dnd_var = tk.BooleanVar(value=self._settings["dnd"]["enabled"])
        self._vars["dnd_enabled"] = dnd_var
        self._opt_row(dnd_card, "启用免打扰", "此时段内不弹出休息", dnd_var)
        time_row = tk.Frame(dnd_card, bg=S.BG_CARD)
        time_row.pack(fill="x", padx=14, pady=(0, 12))
        tk.Label(time_row, text="从", font=S.FONT_SMALL, bg=S.BG_CARD,
                 fg=S.TEXT_SECONDARY).pack(side="left")
        start_var = tk.StringVar(value=self._settings["dnd"]["start"])
        self._vars["dnd_start"] = start_var
        ctk.CTkEntry(time_row, textvariable=start_var, width=70, height=28,
                     corner_radius=S.RADIUS_SM, font=S.FONT_BODY,
                     fg_color=S.BG_INNER, border_color=S.BORDER).pack(side="left", padx=(6, 8))
        tk.Label(time_row, text="到", font=S.FONT_SMALL, bg=S.BG_CARD,
                 fg=S.TEXT_SECONDARY).pack(side="left")
        end_var = tk.StringVar(value=self._settings["dnd"]["end"])
        self._vars["dnd_end"] = end_var
        ctk.CTkEntry(time_row, textvariable=end_var, width=70, height=28,
                     corner_radius=S.RADIUS_SM, font=S.FONT_BODY,
                     fg_color=S.BG_INNER, border_color=S.BORDER).pack(side="left", padx=(6, 0))

        # ---- 底部按钮 ----
        btn_row = tk.Frame(container, bg=S.BG_APP)
        btn_row.pack(fill="x", side="bottom", pady=(8, 0))
        ctk.CTkButton(btn_row, text="取消", height=36, corner_radius=S.RADIUS_SM,
                      font=S.FONT_BODY, fg_color=S.BG_INNER, hover_color=S.BG_HOVER,
                      text_color=S.TEXT_PRIMARY, border_width=1, border_color=S.BORDER,
                      command=self._on_close).pack(side="left", expand=True, fill="x", padx=(0, 4))
        ctk.CTkButton(btn_row, text="保存", height=36, corner_radius=S.RADIUS_SM,
                      font=S.FONT_BODY_BOLD, fg_color=S.ACCENT, hover_color=S.ACCENT_HOVER,
                      command=self._on_save_click).pack(side="left", expand=True, fill="x", padx=(4, 0))

    def _card(self, parent: tk.Frame, title: str) -> tk.Frame:
        card = tk.Frame(parent, bg=S.BG_CARD, highlightthickness=1,
                        highlightbackground=S.BORDER_SOFT, highlightcolor=S.BORDER_SOFT)
        card.pack(fill="x", pady=(0, 12))
        tk.Label(card, text=title, font=S.FONT_CAPTION, bg=S.BG_CARD,
                 fg=S.TEXT_TERTIARY).pack(anchor="w", padx=14, pady=(10, 4))
        return card

    def _opt_row(self, card: tk.Frame, title: str, desc: str, var: tk.BooleanVar) -> None:
        row = tk.Frame(card, bg=S.BG_CARD)
        row.pack(fill="x", padx=14, pady=6)
        info = tk.Frame(row, bg=S.BG_CARD)
        info.pack(side="left", fill="x")
        tk.Label(info, text=title, font=S.FONT_BODY_BOLD, bg=S.BG_CARD,
                 fg=S.TEXT_PRIMARY).pack(anchor="w")
        tk.Label(info, text=desc, font=S.FONT_CAPTION, bg=S.BG_CARD,
                 fg=S.TEXT_TERTIARY).pack(anchor="w")
        sw = ctk.CTkSwitch(row, text="", variable=var, width=46,
                           fg_color=S.BG_HOVER, progress_color=S.ACCENT,
                           button_color="#ffffff", button_hover_color="#f0f0f5")
        sw.pack(side="right")

    def _on_save_click(self) -> None:
        # 收集设置
        s = self._settings
        for t in ("micro", "short", "long"):
            try:
                s["breaks"][t]["enabled"] = self._vars[f"{t}_enabled"].get()
                s["breaks"][t]["interval"] = int(self._vars[f"{t}_interval"].get())
                s["breaks"][t]["duration"] = int(self._vars[f"{t}_duration"].get())
            except (tk.TclError, ValueError):
                pass
        s["strictMode"] = self._vars["strictMode"].get()
        s["warning"]["enabled"] = self._vars["warning_enabled"].get()
        s["fullscreenSuppress"] = self._vars["fullscreenSuppress"].get()
        s["sound"] = self._vars["sound"].get()
        s["dnd"]["enabled"] = self._vars["dnd_enabled"].get()
        s["dnd"]["start"] = self._vars["dnd_start"].get()
        s["dnd"]["end"] = self._vars["dnd_end"].get()
        self._on_save(s)
        self._on_close()

    def _on_close(self) -> None:
        self.destroy()
