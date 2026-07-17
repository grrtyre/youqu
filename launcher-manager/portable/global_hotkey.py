# -*- coding: utf-8 -*-
"""全局热键 —— Win32 RegisterHotKey + Qt nativeEventFilter 捕获 WM_HOTKEY
用 Alt+Space 唤起启动器。"""

from __future__ import annotations
import ctypes
from ctypes import wintypes

from PySide6.QtCore import QAbstractNativeEventFilter


# Win32 常量
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000
VK_SPACE = 0x20
WM_HOTKEY = 0x0312
HOTKEY_ID = 0xA001


# 函数原型
_user32 = ctypes.windll.user32
_register_hotkey = _user32.RegisterHotKey
_register_hotkey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT,
                             wintypes.UINT]
_register_hotkey.restype = wintypes.BOOL

_unregister_hotkey = _user32.UnregisterHotKey
_unregister_hotkey.argtypes = [wintypes.HWND, ctypes.c_int]
_unregister_hotkey.restype = wintypes.BOOL


def register_alt_space() -> bool:
    """注册全局热键 Alt+Space。返回是否成功。"""
    ok = _register_hotkey(None, HOTKEY_ID, MOD_ALT | MOD_NOREPEAT, VK_SPACE)
    return bool(ok)


def unregister_alt_space():
    """注销全局热键。"""
    _unregister_hotkey(None, HOTKEY_ID)


class HotkeyEventFilter(QAbstractNativeEventFilter):
    """Qt nativeEventFilter，捕获 WM_HOTKEY 并触发回调。
    用法：filter = HotkeyEventFilter(callback); app.installNativeEventFilter(filter)
    """

    def __init__(self, callback):
        super().__init__()
        self._callback = callback

    def nativeEventFilter(self, eventType, message):
        # PySide6: message 是 sip 包装的 MSG 指针
        try:
            # eventType 形如 b"windows_generic_MSG"
            if eventType == b'windows_generic_MSG' or \
               eventType == 'windows_generic_MSG':
                # 把 message 转成 MSG 结构
                msg = ctypes.wintypes.MSG.from_address(
                    int(message))
                if msg.message == WM_HOTKEY and msg.wParam == HOTKEY_ID:
                    if self._callback:
                        self._callback()
                    return (True, 0)
        except Exception:
            pass
        return (False, 0)
