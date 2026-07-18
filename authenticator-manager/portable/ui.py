# -*- coding: utf-8 -*-
"""便携版 UI：customtkinter + tkinter Canvas 实现苹果白高端风格。
- 无边框窗口（overrideredirect）
- 失焦自动隐藏
- 账户卡片 + 倒计时环 + 一键复制
- 添加账户对话框（手动 / otpauth:// 粘贴）
- 空状态"""
import time
import threading
import tkinter as tk
from tkinter import Canvas, StringVar, BooleanVar, Event
from typing import Callable, Optional, List

import customtkinter as ctk

import styles as S
from totp import totp_now, seconds_remaining, parse_otpauth, normalize_secret, base32_decode
from storage import Account


# ============ 主题应用 ============

ctk.set_appearance_mode('light')
ctk.set_default_color_theme('blue')


# ============ 自定义圆角阴影卡片 ============

class CardFrame(ctk.CTkFrame):
    """带圆角与细腻阴影的卡片。"""

    def __init__(self, master, corner_radius: int = S.CORNER_RADIUS_LG,
                 bg_color: str = S.BG_CARD, fg_color: str = S.BG_CARD,
                 border_width: int = 1, border_color: str = S.BORDER, **kw):
        super().__init__(
            master,
            corner_radius=corner_radius,
            bg_color=bg_color,
            fg_color=fg_color,
            border_width=border_width,
            border_color=border_color,
            **kw
        )


# ============ 倒计时环 ============

class CountdownRing(Canvas):
    """Canvas 绘制的圆环倒计时。颜色随剩余秒数变化。"""

    def __init__(self, master, size: int = 38, period: int = 30,
                 on_tick: Optional[Callable[[int], None]] = None):
        super().__init__(master, width=size, height=size, bg=S.BG_CARD,
                         highlightthickness=0, bd=0)
        self.size = size
        self.period = period
        self.on_tick = on_tick
        self._remaining = period
        self._draw()

    def set_period(self, period: int) -> None:
        self.period = period
        self._remaining = period
        self._draw()

    def update_time(self) -> int:
        """刷新到当前时间，返回剩余秒数。"""
        self._remaining = seconds_remaining(self.period)
        self._draw()
        if self.on_tick:
            self.on_tick(self._remaining)
        return self._remaining

    def _color_for_remaining(self, r: int) -> str:
        if r <= 5:
            return S.STATE_URGENT
        if r <= 10:
            return S.STATE_WARN
        return S.STATE_OK

    def _draw(self) -> None:
        self.delete('all')
        size = self.size
        pad = 3
        # 背景环
        self.create_oval(pad, pad, size - pad, size - pad,
                         outline=S.BORDER, width=2)
        # 进度弧
        progress = self._remaining / self.period  # 1..0
        color = self._color_for_remaining(self._remaining)
        if progress > 0:
            extent = -360 * progress  # 负号 = 顺时针
            self.create_arc(pad, pad, size - pad, size - pad,
                            start=90, extent=extent, style='arc',
                            outline=color, width=2)
        # 中心数字
        self.create_text(size / 2, size / 2, text=str(self._remaining),
                         fill=S.TEXT_SECONDARY,
                         font=('Segoe UI', 9, 'bold'))


# ============ 账户卡片 ============

class AccountCard(CardFrame):
    """单个账户卡片：圆环 + 发行方/标签 + 验证码 + 删除按钮。"""

    def __init__(self, master, account: Account,
                 on_copy: Callable[[Account, str], None],
                 on_delete: Callable[[Account], None]):
        super().__init__(master, corner_radius=S.CORNER_RADIUS_LG)
        self.account = account
        self.on_copy = on_copy
        self.on_delete = on_delete

        # 鼠标悬停态
        self._hover = False
        self.bind('<Enter>', self._on_enter)
        self.bind('<Leave>', self._on_leave)

        # 布局
        # 左：倒计时环
        self.ring = CountdownRing(self, size=38, period=account.period)
        self.ring.grid(row=0, column=0, rowspan=2, padx=(S.PAD_MD, S.PAD_SM),
                       pady=S.PAD_MD, sticky='nsw')

        # 中：发行方 + 标签
        issuer_text = account.issuer or '未命名'
        self.lbl_issuer = ctk.CTkLabel(
            self, text=issuer_text,
            font=('Segoe UI', S.FONT_SIZE_H1, 'bold'),
            text_color=S.TEXT_PRIMARY, anchor='w')
        self.lbl_issuer.grid(row=0, column=1, padx=(0, S.PAD_SM),
                             pady=(S.PAD_MD, 0), sticky='ew')

        label_text = account.label or ''
        self.lbl_label = ctk.CTkLabel(
            self, text=label_text,
            font=('Segoe UI', S.FONT_SIZE_SMALL),
            text_color=S.TEXT_SECONDARY, anchor='w')
        self.lbl_label.grid(row=1, column=1, padx=(0, S.PAD_SM),
                            pady=(0, S.PAD_MD), sticky='ew')

        # 右：验证码 + 删除
        self.code_var = StringVar(value=self._format_code(self._current_code()))
        self.lbl_code = ctk.CTkLabel(
            self, textvariable=self.code_var,
            font=('Cascadia Code', S.FONT_SIZE_CODE, 'bold'),
            text_color=S.ACCENT, anchor='e')
        self.lbl_code.grid(row=0, column=2, padx=(S.PAD_SM, S.PAD_MD),
                           pady=(S.PAD_MD, 0), sticky='e')

        # 删除按钮（默认隐藏，悬停显示）
        self.btn_delete = ctk.CTkButton(
            self, text='删除', width=44, height=20,
            font=('Segoe UI', S.FONT_SIZE_TINY),
            fg_color='transparent', hover_color=S.STATE_URGENT,
            text_color=S.TEXT_TERTIARY,
            corner_radius=S.CORNER_RADIUS_SM,
            command=self._on_delete_click)
        self.btn_delete.grid(row=1, column=2, padx=(S.PAD_SM, S.PAD_MD),
                             pady=(0, S.PAD_MD), sticky='e')

        self.columnconfigure(1, weight=1)

        # 点击复制
        for w in (self, self.lbl_issuer, self.lbl_label, self.lbl_code, self.ring):
            w.bind('<Button-1>', self._on_card_click)

    def _current_code(self) -> str:
        try:
            return totp_now(self.account.secret, self.account.period,
                            self.account.digits, self.account.algorithm)
        except Exception:
            return '------'

    def _format_code(self, code: str) -> str:
        # 6 位 -> "123 456"，8 位 -> "1234 5678"
        if len(code) == 6:
            return code[:3] + ' ' + code[3:]
        if len(code) == 8:
            return code[:4] + ' ' + code[4:]
        return code

    def _on_card_click(self, _evt=None) -> None:
        code = self._current_code()
        self.on_copy(self.account, code)

    def _on_delete_click(self) -> None:
        self.on_delete(self.account)

    def _on_enter(self, _evt=None) -> None:
        self._hover = True
        self.configure(fg_color=S.BG_HOVER, border_color=S.BORDER)

    def _on_leave(self, _evt=None) -> None:
        self._hover = False
        self.configure(fg_color=S.BG_CARD, border_color=S.BORDER)

    def refresh(self) -> None:
        """刷新验证码与倒计时。"""
        try:
            self.code_var.set(self._format_code(self._current_code()))
        except Exception:
            self.code_var.set('------')
        self.ring.update_time()


# ============ 添加账户对话框 ============

class AddAccountDialog(ctk.CTkToplevel):
    """添加账户对话框：支持手动输入与 otpauth:// 粘贴。"""

    def __init__(self, master, on_save: Callable[[Account], None],
                 existing_issuers: List[str] = None):
        super().__init__(master)
        self.on_save = on_save
        self.existing_issuers = existing_issuers or []
        self.result: Optional[Account] = None

        self.title('添加账户')
        self.geometry('380x520')
        self.resizable(False, False)
        self.configure(fg_color=S.BG_APP)
        self.transient(master)
        self.grab_set()

        # 居中显示在主窗口上方
        self.after(10, self._center)

        # 标题
        ctk.CTkLabel(self, text='添加账户',
                     font=('Segoe UI', S.FONT_SIZE_TITLE, 'bold'),
                     text_color=S.TEXT_PRIMARY).pack(
            anchor='w', padx=S.PAD_XL, pady=(S.PAD_LG, S.PAD_SM))

        ctk.CTkLabel(self, text='密钥仅本地 DPAPI 加密存储，不上传任何服务器',
                     font=('Segoe UI', S.FONT_SIZE_TINY),
                     text_color=S.TEXT_TERTIARY).pack(
            anchor='w', padx=S.PAD_XL, pady=(0, S.PAD_LG))

        # 表单容器
        form = ctk.CTkFrame(self, fg_color='transparent')
        form.pack(fill='both', expand=True, padx=S.PAD_XL, pady=(0, S.PAD_SM))

        # otpauth:// 链接（可选，粘贴后自动填充）
        ctk.CTkLabel(form, text='otpauth:// 链接（可选，粘贴后自动填充）',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).pack(anchor='w', pady=(0, 4))
        self.ent_otpauth = ctk.CTkEntry(
            form, placeholder_text='otpauth://totp/...',
            height=34, corner_radius=S.CORNER_RADIUS_MD,
            fg_color=S.BG_INPUT, border_color=S.BORDER,
            text_color=S.TEXT_PRIMARY)
        self.ent_otpauth.pack(fill='x', pady=(0, S.PAD_MD))
        self.ent_otpauth.bind('<KeyRelease>', self._on_otpauth_change)

        # 发行方
        ctk.CTkLabel(form, text='发行方 *（如 GitHub、Google）',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).pack(anchor='w', pady=(0, 4))
        self.ent_issuer = ctk.CTkEntry(
            form, placeholder_text='GitHub', height=34,
            corner_radius=S.CORNER_RADIUS_MD,
            fg_color=S.BG_INPUT, border_color=S.BORDER,
            text_color=S.TEXT_PRIMARY)
        self.ent_issuer.pack(fill='x', pady=(0, S.PAD_MD))

        # 标签
        ctk.CTkLabel(form, text='标签（如邮箱、用户名）',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).pack(anchor='w', pady=(0, 4))
        self.ent_label = ctk.CTkEntry(
            form, placeholder_text='user@example.com', height=34,
            corner_radius=S.CORNER_RADIUS_MD,
            fg_color=S.BG_INPUT, border_color=S.BORDER,
            text_color=S.TEXT_PRIMARY)
        self.ent_label.pack(fill='x', pady=(0, S.PAD_MD))

        # 密钥
        ctk.CTkLabel(form, text='密钥 *（Base32，忽略空格大小写）',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).pack(anchor='w', pady=(0, 4))
        self.ent_secret = ctk.CTkEntry(
            form, placeholder_text='JBSWY3DPEHPK3PXP', height=34,
            corner_radius=S.CORNER_RADIUS_MD,
            fg_color=S.BG_INPUT, border_color=S.BORDER,
            text_color=S.TEXT_PRIMARY)
        self.ent_secret.pack(fill='x', pady=(0, S.PAD_MD))

        # 高级参数
        adv = ctk.CTkFrame(form, fg_color='transparent')
        adv.pack(fill='x', pady=(0, S.PAD_MD))

        ctk.CTkLabel(adv, text='周期(秒)',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).grid(row=0, column=0, padx=(0, 4), sticky='w')
        self.ent_period = ctk.CTkEntry(adv, width=60, height=30,
                                       corner_radius=S.CORNER_RADIUS_SM,
                                       fg_color=S.BG_INPUT, border_color=S.BORDER)
        self.ent_period.insert(0, '30')
        self.ent_period.grid(row=0, column=1, padx=(0, S.PAD_MD))

        ctk.CTkLabel(adv, text='位数',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).grid(row=0, column=2, padx=(0, 4), sticky='w')
        self.ent_digits = ctk.CTkEntry(adv, width=50, height=30,
                                       corner_radius=S.CORNER_RADIUS_SM,
                                       fg_color=S.BG_INPUT, border_color=S.BORDER)
        self.ent_digits.insert(0, '6')
        self.ent_digits.grid(row=0, column=3, padx=(0, S.PAD_MD))

        ctk.CTkLabel(adv, text='算法',
                     font=('Segoe UI', S.FONT_SIZE_SMALL),
                     text_color=S.TEXT_SECONDARY).grid(row=0, column=4, padx=(0, 4), sticky='w')
        self.cbo_algo = ctk.CTkComboBox(adv, values=['SHA1', 'SHA256', 'SHA512'],
                                        width=100, height=30,
                                        fg_color=S.BG_INPUT, border_color=S.BORDER,
                                        button_color=S.ACCENT, button_hover_color=S.ACCENT_HOVER,
                                        dropdown_fg_color=S.BG_CARD,
                                        text_color=S.TEXT_PRIMARY)
        self.cbo_algo.set('SHA1')
        self.cbo_algo.grid(row=0, column=5, sticky='w')

        # 错误提示
        self.lbl_error = ctk.CTkLabel(
            self, text='', font=('Segoe UI', S.FONT_SIZE_SMALL),
            text_color=S.STATE_URGENT)
        self.lbl_error.pack(pady=(0, S.PAD_SM))

        # 按钮区
        btns = ctk.CTkFrame(self, fg_color='transparent')
        btns.pack(fill='x', padx=S.PAD_XL, pady=(0, S.PAD_LG))

        ctk.CTkButton(btns, text='取消', width=88, height=34,
                      corner_radius=S.CORNER_RADIUS_MD,
                      fg_color=S.BG_CARD, hover_color=S.BG_PRESSED,
                      border_width=1, border_color=S.BORDER,
                      text_color=S.TEXT_PRIMARY,
                      command=self._on_cancel).pack(side='right', padx=(S.PAD_SM, 0))

        ctk.CTkButton(btns, text='保存', width=88, height=34,
                      corner_radius=S.CORNER_RADIUS_MD,
                      fg_color=S.ACCENT, hover_color=S.ACCENT_HOVER,
                      text_color=S.TEXT_ON_ACCENT,
                      command=self._on_save).pack(side='right')

        # Esc 取消
        self.bind('<Escape>', lambda e: self._on_cancel())
        # 回车保存
        self.bind('<Return>', lambda e: self._on_save())

        # 焦点
        self.ent_issuer.focus_set()

    def _center(self) -> None:
        self.update_idletasks()
        parent = self.master
        try:
            px = parent.winfo_rootx()
            py = parent.winfo_rooty()
            pw = parent.winfo_width()
            ph = parent.winfo_height()
            w = self.winfo_width()
            h = self.winfo_height()
            x = px + (pw - w) // 2
            y = py + (ph - h) // 2
            self.geometry(f'+{x}+{y}')
        except Exception:
            pass

    def _on_otpauth_change(self, _evt=None) -> None:
        text = self.ent_otpauth.get().strip()
        if not text.startswith('otpauth://'):
            return
        try:
            p = parse_otpauth(text)
            if p['issuer']:
                self.ent_issuer.delete(0, 'end')
                self.ent_issuer.insert(0, p['issuer'])
            if p['label']:
                self.ent_label.delete(0, 'end')
                self.ent_label.insert(0, p['label'])
            self.ent_secret.delete(0, 'end')
            self.ent_secret.insert(0, p['secret'])
            self.ent_period.delete(0, 'end')
            self.ent_period.insert(0, str(p['period']))
            self.ent_digits.delete(0, 'end')
            self.ent_digits.insert(0, str(p['digits']))
            self.cbo_algo.set(p['algorithm'])
            self.lbl_error.configure(text='')
        except Exception as e:
            self.lbl_error.configure(text=f'链接解析失败: {e}')

    def _validate(self) -> Optional[str]:
        issuer = self.ent_issuer.get().strip()
        secret = self.ent_secret.get().strip()
        if not issuer:
            return '请输入发行方'
        if not secret:
            return '请输入密钥'
        # 校验 Base32
        try:
            base32_decode(secret)
        except Exception:
            return '密钥不是有效的 Base32 字符串'
        try:
            period = int(self.ent_period.get())
            if period < 5 or period > 300:
                return '周期应在 5-300 秒之间'
        except ValueError:
            return '周期必须是数字'
        try:
            digits = int(self.ent_digits.get())
            if digits not in (6, 7, 8):
                return '位数仅支持 6 / 7 / 8'
        except ValueError:
            return '位数必须是数字'
        return None

    def _on_save(self) -> None:
        err = self._validate()
        if err:
            self.lbl_error.configure(text=err)
            return
        try:
            account = Account.new(
                issuer=self.ent_issuer.get(),
                label=self.ent_label.get(),
                secret=self.ent_secret.get(),
                period=int(self.ent_period.get()),
                digits=int(self.ent_digits.get()),
                algorithm=self.cbo_algo.get(),
            )
            # 验证可生成 TOTP
            totp_now(account.secret, account.period, account.digits, account.algorithm)
        except Exception as e:
            self.lbl_error.configure(text=f'保存失败: {e}')
            return
        self.result = account
        try:
            self.on_save(account)
        except Exception:
            pass
        self.destroy()

    def _on_cancel(self) -> None:
        self.result = None
        self.destroy()


# ============ Toast 提示 ============

class ToastLabel(ctk.CTkLabel):
    """轻量浮层提示。"""

    def __init__(self, master, text: str, duration_ms: int = 1500):
        super().__init__(master, text=text,
                         font=('Segoe UI', S.FONT_SIZE_BODY, 'bold'),
                         text_color=S.TEXT_ON_ACCENT,
                         fg_color=S.ACCENT,
                         corner_radius=S.CORNER_RADIUS_MD,
                         padx=S.PAD_MD, pady=S.PAD_SM)
        self.duration = duration_ms

    def show(self) -> None:
        self.place(relx=0.5, rely=0.5, anchor='center')
        self.after(self.duration, self.hide)

    def hide(self) -> None:
        self.place_forget()


# ============ 主窗口 ============

class AuthenticatorWindow(ctk.CTk):
    """主窗口：无边框、失焦自动隐藏、贴系统托盘弹出。"""

    def __init__(self, store, on_quit: Callable[[], None]):
        super().__init__()
        self.store = store
        self.on_quit = on_quit
        self._cards: List[AccountCard] = []
        self._toast: Optional[ToastLabel] = None
        self._auto_hide_job = None
        self._refresh_job = None
        self._force_visible = False  # 防止失焦立即隐藏
        self._settings = store.settings

        # 窗口配置
        self.title('验证器')
        self.geometry(f'{S.WINDOW_WIDTH}x{S.WINDOW_HEIGHT}')
        self.minsize(S.WINDOW_MIN_WIDTH, S.WINDOW_MIN_HEIGHT)
        self.maxsize(S.WINDOW_MAX_WIDTH, S.WINDOW_MAX_HEIGHT)
        self.configure(fg_color=S.BG_APP)
        self.overrideredirect(True)  # 无边框
        self.attributes('-topmost', True)

        # 圆角窗口（Windows 11+）：通过 DWM 启用原生圆角
        self._enable_window_rounded()

        # 失焦自动隐藏
        self.bind('<FocusOut>', self._on_focus_out)
        self.bind('<FocusIn>', self._on_focus_in)

        # 拖动窗口
        self._drag_dx = 0
        self._drag_dy = 0

        # 构建 UI
        self._build_ui()

        # 初始位置：屏幕右下角（系统托盘附近）
        self._position_near_tray()

        # 隐藏初始窗口（托盘常驻模式）
        if self._settings.get('start_hidden', True):
            self.withdraw()
        else:
            self.deiconify()

        # 启动定时刷新
        self._schedule_refresh()

    def _enable_window_rounded(self) -> None:
        """Windows 11+ 启用原生圆角。失败则忽略。"""
        try:
            import ctypes
            hwnd = ctypes.windll.user32.GetParent(self.winfo_id())
            DWMWA_WINDOW_CORNER_PREFERENCE = 33
            DWMWCP_ROUND = 2
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, DWMWA_WINDOW_CORNER_PREFERENCE,
                byref(ctypes.c_int(DWMWCP_ROUND)), ctypes.sizeof(ctypes.c_int))
        except Exception:
            pass

    def _position_near_tray(self) -> None:
        """定位到屏幕右下角（系统托盘上方）。"""
        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        w = self.winfo_width()
        h = self.winfo_height()
        margin = 16
        x = sw - w - margin
        y = sh - h - margin - 40  # 留出任务栏空间
        self.geometry(f'+{x}+{y}')

    # ---- UI 构建 ----

    def _build_ui(self) -> None:
        # 顶部栏
        topbar = ctk.CTkFrame(self, fg_color=S.BG_CARD, corner_radius=0,
                              height=52, border_width=0)
        topbar.pack(fill='x', side='top')
        topbar.pack_propagate(False)

        # 标题
        ctk.CTkLabel(topbar, text='验证器',
                     font=('Segoe UI', S.FONT_SIZE_TITLE, 'bold'),
                     text_color=S.TEXT_PRIMARY).pack(
            side='left', padx=(S.PAD_LG, S.PAD_SM))

        # 搜索框
        self.var_search = StringVar()
        self.var_search.trace_add('write', lambda *_: self._refresh_list())
        self.ent_search = ctk.CTkEntry(
            topbar, textvariable=self.var_search,
            placeholder_text='搜索账户...',
            height=30, width=140,
            corner_radius=S.CORNER_RADIUS_MD,
            fg_color=S.BG_APP, border_color=S.BORDER,
            text_color=S.TEXT_PRIMARY)
        self.ent_search.pack(side='left', padx=S.PAD_SM, fill='x', expand=True)

        # 添加按钮
        self.btn_add = ctk.CTkButton(
            topbar, text='+', width=32, height=30,
            font=('Segoe UI', S.FONT_SIZE_H1, 'bold'),
            fg_color=S.ACCENT, hover_color=S.ACCENT_HOVER,
            text_color=S.TEXT_ON_ACCENT,
            corner_radius=S.CORNER_RADIUS_MD,
            command=self._on_add_click)
        self.btn_add.pack(side='right', padx=(S.PAD_SM, S.PAD_LG))

        # 关闭按钮（最小化到托盘）
        self.btn_close = ctk.CTkButton(
            topbar, text='×', width=30, height=30,
            font=('Segoe UI', S.FONT_SIZE_TITLE),
            fg_color='transparent', hover_color=S.BG_PRESSED,
            text_color=S.TEXT_TERTIARY,
            corner_radius=S.CORNER_RADIUS_MD,
            command=self.hide_window)
        self.btn_close.pack(side='right', padx=(0, S.PAD_SM))

        # 拖动区域：标题区可拖动
        for w in (topbar,):
            w.bind('<Button-1>', self._on_drag_start)
            w.bind('<B1-Motion>', self._on_drag_motion)

        # 列表区
        self.scroll = ctk.CTkScrollableFrame(
            self, fg_color=S.BG_APP, corner_radius=0,
            scrollbar_button_color=S.BORDER,
            scrollbar_button_hover_color=S.TEXT_TERTIARY)
        self.scroll.pack(fill='both', expand=True, padx=S.PAD_SM, pady=S.PAD_SM)

        # 空状态
        self._empty_label = ctk.CTkLabel(
            self.scroll, text='暂无账户\n点击右上角 + 添加',
            font=('Segoe UI', S.FONT_SIZE_BODY),
            text_color=S.TEXT_TERTIARY, justify='center')
        # 初始渲染
        self._refresh_list()

        # 底部提示栏
        footer = ctk.CTkFrame(self, fg_color=S.BG_APP, height=24, corner_radius=0)
        footer.pack(fill='x', side='bottom')
        footer.pack_propagate(False)
        ctk.CTkLabel(footer, text='Ctrl+Shift+A 唤起 · 点击卡片复制 · 失焦自动隐藏',
                     font=('Segoe UI', S.FONT_SIZE_TINY),
                     text_color=S.TEXT_TERTIARY).pack(pady=2)

    # ---- 拖动 ----

    def _on_drag_start(self, evt: Event) -> None:
        self._drag_dx = evt.x_root - self.winfo_rootx()
        self._drag_dy = evt.y_root - self.winfo_rooty()

    def _on_drag_motion(self, evt: Event) -> None:
        x = evt.x_root - self._drag_dx
        y = evt.y_root - self._drag_dy
        self.geometry(f'+{x}+{y}')

    # ---- 焦点 / 显示 / 隐藏 ----

    def _on_focus_in(self, _evt=None) -> None:
        self._force_visible = False

    def _on_focus_out(self, _evt=None) -> None:
        if not self._settings.get('auto_hide', True):
            return
        # 短暂延迟，避免点击子窗口（如对话框）时误隐藏
        if self._auto_hide_job:
            self.after_cancel(self._auto_hide_job)
        self._auto_hide_job = self.after(150, self._do_auto_hide)

    def _do_auto_hide(self) -> None:
        self._auto_hide_job = None
        # 检查是否还有焦点（对话框打开时）
        if self.focus_get() is not None:
            return
        # 检查是否有 Toplevel 子窗口
        for child in self.winfo_children():
            if isinstance(child, ctk.CTkToplevel) and child.winfo_exists():
                return
        self.hide_window()

    def show_window(self) -> None:
        """显示并聚焦窗口。"""
        self._force_visible = True
        self.deiconify()
        self.attributes('-topmost', True)
        self.lift()
        # 重新定位到托盘附近
        if not self._is_visible_position():
            self._position_near_tray()
        # 强制聚焦
        self.after(10, self._focus_self)
        # 刷新列表
        self._refresh_list()

    def _focus_self(self) -> None:
        try:
            self.focus_force()
            self.ent_search.focus_set()
        except Exception:
            pass
        self._force_visible = False

    def _is_visible_position(self) -> bool:
        try:
            x = self.winfo_rootx()
            y = self.winfo_rooty()
            sw = self.winfo_screenwidth()
            sh = self.winfo_screenheight()
            return 0 <= x <= sw - 50 and 0 <= y <= sh - 50
        except Exception:
            return False

    def hide_window(self) -> None:
        self.withdraw()

    # ---- 账户列表 ----

    def _refresh_list(self) -> None:
        # 清空现有卡片
        for card in self._cards:
            try:
                card.destroy()
            except Exception:
                pass
        self._cards = []

        accounts = self.store.list_accounts()
        # 搜索过滤
        q = self.var_search.get().strip().lower() if hasattr(self, 'var_search') else ''
        if q:
            accounts = [a for a in accounts
                        if q in (a.issuer or '').lower() or q in (a.label or '').lower()]

        if not accounts:
            self._empty_label.pack(pady=(S.PAD_XXL, S.PAD_XXL))
            return

        self._empty_label.pack_forget()

        for acc in accounts:
            card = AccountCard(self.scroll, acc,
                               on_copy=self._on_copy_code,
                               on_delete=self._on_delete_account)
            card.pack(fill='x', pady=S.PAD_XS)
            self._cards.append(card)

    def _schedule_refresh(self) -> None:
        """每秒刷新一次倒计时与验证码。"""
        for card in self._cards:
            try:
                card.refresh()
            except Exception:
                pass
        self._refresh_job = self.after(1000, self._schedule_refresh)

    # ---- 事件 ----

    def _on_add_click(self) -> None:
        existing = [a.issuer for a in self.store.list_accounts()]
        # 防止失焦隐藏
        self._force_visible = True
        dlg = AddAccountDialog(self, on_save=self._on_account_saved,
                               existing_issuers=existing)
        # 等对话框关闭后取消强制可见
        def _after_close():
            try:
                if not dlg.winfo_exists():
                    self._force_visible = False
                    return
                self.after(200, _after_close)
            except Exception:
                self._force_visible = False
        self.after(200, _after_close)

    def _on_account_saved(self, account: Account) -> None:
        self.store.add_account(account)
        self._refresh_list()

    def _on_copy_code(self, account: Account, code: str) -> None:
        """复制验证码到剪贴板。"""
        try:
            self.clipboard_clear()
            self.clipboard_append(code)
            self.update()
        except Exception:
            pass
        # 显示 Toast
        self._show_toast(f'已复制 {account.issuer} 验证码')
        # 复制后自动隐藏
        if self._settings.get('hide_after_copy', True):
            delay = self._settings.get('hide_delay_ms', 1200)
            if self._auto_hide_job:
                self.after_cancel(self._auto_hide_job)
            self._auto_hide_job = self.after(delay, self._do_auto_hide_after_copy)

    def _do_auto_hide_after_copy(self) -> None:
        self._auto_hide_job = None
        self.hide_window()

    def _show_toast(self, text: str) -> None:
        if self._toast is not None:
            try:
                self._toast.hide()
            except Exception:
                pass
        self._toast = ToastLabel(self, text, duration_ms=1100)
        self._toast.show()

    def _on_delete_account(self, account: Account) -> None:
        # 简单二次确认
        self._force_visible = True
        from tkinter import messagebox
        result = messagebox.askyesno(
            '删除账户', f'确定删除 {account.issuer or "未命名"} 的账户？',
            parent=self, default='no')
        self._force_visible = False
        if result:
            self.store.delete_account(account.id)
            self._refresh_list()

    # ---- 退出 ----

    def quit_app(self) -> None:
        if self._refresh_job:
            self.after_cancel(self._refresh_job)
        try:
            self.on_quit()
        except Exception:
            pass
        self.destroy()


# ============ 帮助：byref 引入（部分代码用） ============

from ctypes import byref
