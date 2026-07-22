# -*- coding: utf-8 -*-
"""hotkey.py - 全局热键注册（Win32 RegisterHotKey）

使用 RegisterHotKey + 独立线程监听 WM_HOTKEY 消息，
实现全局热键唤起，不依赖第三方库。
"""
import ctypes
import ctypes.wintypes as w
import threading

# 修饰键常量
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008

VK_A = 0x41

# 热键 ID
HOTKEY_TOGGLE = 1
HOTKEY_STOP_ALL = 2


class HotkeyListener:
    """在独立线程中监听全局热键"""

    def __init__(self, on_toggle=None, on_stop_all=None):
        self._on_toggle = on_toggle
        self._on_stop_all = on_stop_all
        self._thread = None
        self._running = False
        self._thread_id = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread_id:
            # 向线程发送 WM_QUIT 退出消息循环
            ctypes.windll.user32.PostThreadMessageW(
                self._thread_id, 0x0012, 0, 0)

    def _loop(self):
        # 注册热键：Ctrl+Shift+A 唤起/隐藏窗口
        user32 = ctypes.windll.user32
        mod = MOD_CONTROL | MOD_SHIFT
        # 注册 Ctrl+Shift+A 切换显示
        if not user32.RegisterHotKey(0, HOTKEY_TOGGLE, mod, VK_A):
            # 热键可能被占用，尝试备选
            pass

        self._thread_id = ctypes.windll.kernel32.GetCurrentThreadId()

        msg = w.MSG()
        while self._running:
            ret = user32.GetMessageW(ctypes.byref(msg), 0, 0, 0)
            if ret <= 0:
                break
            if msg.message == 0x0312:  # WM_HOTKEY
                if msg.wParam == HOTKEY_TOGGLE:
                    if self._on_toggle:
                        self._on_toggle()

        # 注销热键
        user32.UnregisterHotKey(0, HOTKEY_TOGGLE)
