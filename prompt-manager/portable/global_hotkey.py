# -*- coding: utf-8 -*-
"""全局热键 —— Windows API 原生实现，无第三方依赖"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
from typing import Callable, Optional

# Windows 消息与常量
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000
WM_HOTKEY = 0x0312
GWLP_WNDPROC = -4

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32


class GlobalHotkeyManager:
    """
    通过创建隐藏窗口 + RegisterHotKey 实现全局热键。
    必须在与 Qt 主线程相同的线程中创建并运行消息循环。
    """

    def __init__(self):
        self._callbacks: dict[int, Callable[[], None]] = {}
        self._hwnd: Optional[int] = None
        self._next_id: int = 1
        self._running = False
        self._old_wndproc = None

    def _wnd_proc(self, hwnd, msg, wparam, lparam):
        if msg == WM_HOTKEY:
            hotkey_id = wparam
            cb = self._callbacks.get(hotkey_id)
            if cb:
                try:
                    cb()
                except Exception as e:
                    print(f"hotkey callback error: {e}")
            return 0
        return user32.CallWindowProcW(self._old_wndproc, hwnd, msg, wparam, lparam)

    def start(self) -> bool:
        """注册隐藏窗口，准备接收热键消息。返回是否成功。"""
        if self._hwnd is not None:
            return True

        # 注册窗口类
        wc = type("WNDCLASS", (), {})()
        wc.style = 0
        wc.lpfnWndProc = None  # 先用默认
        wc.cbClsExtra = 0
        wc.cbWndExtra = 0
        wc.hInstance = kernel32.GetModuleHandleW(None)
        wc.hIcon = 0
        wc.hCursor = 0
        wc.hbrBackground = 0
        wc.lpszMenuName = None
        wc.lpszClassName = "MimoPromptHotkeyWnd"

        WNDCLASS = ctypes.WINFUNCTYPE(ctypes.c_long, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
        # 用结构体
        class _WC(ctypes.Structure):
            _fields_ = [
                ("style", wintypes.UINT),
                ("lpfnWndProc", WNDCLASS),
                ("cbClsExtra", ctypes.c_int),
                ("cbWndExtra", ctypes.c_int),
                ("hInstance", wintypes.HINSTANCE),
                ("hIcon", wintypes.HICON),
                ("hCursor", wintypes.HANDLE),
                ("hbrBackground", wintypes.HBRUSH),
                ("lpszMenuName", wintypes.LPCWSTR),
                ("lpszClassName", wintypes.LPCWSTR),
            ]

        self._WNDCLASS = WNDCLASS  # 保存类型
        self._def_proc = WNDCLASS(self._wnd_proc)

        wc2 = _WC()
        wc2.style = 0
        wc2.lpfnWndProc = self._def_proc
        wc2.cbClsExtra = 0
        wc2.cbWndExtra = 0
        wc2.hInstance = kernel32.GetModuleHandleW(None)
        wc2.hIcon = 0
        wc2.hCursor = 0
        wc2.hbrBackground = 0
        wc2.lpszMenuName = None
        wc2.lpszClassName = "MimoPromptHotkeyWnd"

        atom = user32.RegisterClassW(ctypes.byref(wc2))
        if not atom:
            err = ctypes.get_last_error()
            print(f"RegisterClassW failed: {err}")
            return False

        # 创建隐藏消息窗口
        self._hwnd = user32.CreateWindowExW(
            0,
            "MimoPromptHotkeyWnd",
            "MimoPromptHotkey",
            0,
            0, 0, 0, 0,
            0, 0, kernel32.GetModuleHandleW(None), 0
        )
        if not self._hwnd:
            err = ctypes.get_last_error()
            print(f"CreateWindowExW failed: {err}")
            return False

        # 替换 wndproc 以拦截 WM_HOTKEY
        WNDPROC = WNDCLASS
        self._new_proc = WNDPROC(self._wnd_proc)
        self._old_wndproc = user32.SetWindowLongPtrW(self._hwnd, GWLP_WNDPROC, ctypes.cast(self._new_proc, ctypes.c_void_p).value)
        self._running = True
        return True

    def register(self, modifiers: int, vk: int, callback: Callable[[], None]) -> Optional[int]:
        """注册全局热键。成功返回 id，失败返回 None。"""
        if not self._hwnd:
            if not self.start():
                return None
        hid = self._next_id
        self._next_id += 1
        ok = user32.RegisterHotKey(self._hwnd, hid, modifiers | MOD_NOREPEAT, vk)
        if not ok:
            err = ctypes.get_last_error()
            print(f"RegisterHotKey failed (mod={modifiers}, vk={vk}): err={err}")
            return None
        self._callbacks[hid] = callback
        return hid

    def unregister(self, hid: int) -> None:
        if self._hwnd:
            user32.UnregisterHotKey(self._hwnd, hid)
        self._callbacks.pop(hid, None)

    def stop(self) -> None:
        if not self._hwnd:
            return
        for hid in list(self._callbacks.keys()):
            try:
                user32.UnregisterHotKey(self._hwnd, hid)
            except Exception:
                pass
        self._callbacks.clear()
        try:
            user32.DestroyWindow(self._hwnd)
        except Exception:
            pass
        self._hwnd = None
        self._running = False


def parse_hotkey(spec: str) -> tuple[int, int]:
    """解析 'Ctrl+Shift+P' 这样的字符串为 (modifiers, vk)"""
    parts = [p.strip().lower() for p in spec.split("+")]
    mods = 0
    vk = 0
    key_map = {
        "ctrl": MOD_CONTROL, "control": MOD_CONTROL,
        "shift": MOD_SHIFT,
        "alt": MOD_ALT,
        "win": MOD_WIN, "super": MOD_WIN, "meta": MOD_WIN,
    }
    # 字母键 VK
    for p in parts:
        if p in key_map:
            mods |= key_map[p]
        elif len(p) == 1 and p.isalpha():
            vk = ord(p.upper())
        elif len(p) == 1 and p.isdigit():
            vk = ord(p)
        elif p.startswith("f") and p[1:].isdigit():
            # F1-F24
            n = int(p[1:])
            if 1 <= n <= 24:
                vk = 0x6F + n  # F1=0x70
        elif p == "space":
            vk = 0x20
        elif p == "enter" or p == "return":
            vk = 0x0D
        elif p == "tab":
            vk = 0x09
        elif p == "esc" or p == "escape":
            vk = 0x1B
        elif p == "backspace" or p == "back":
            vk = 0x08
        else:
            # 单字符其他符号
            if len(p) == 1:
                vk = ord(p.upper())
    return mods, vk
