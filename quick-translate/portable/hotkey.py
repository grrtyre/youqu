# -*- coding: utf-8 -*-
"""Windows 全局热键模块（ctypes 实现，无第三方依赖）。
基于 RegisterHotKey API。在独立线程中循环监听 WM_HOTKEY 消息。
"""
from __future__ import annotations

import ctypes
import threading
from ctypes import wintypes
from typing import Callable, Optional

# Windows 消息常量
WM_HOTKEY = 0x0312

# 修饰键修饰符
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

# 虚拟键码
VK_T = 0x54


class HOTKEY_MODIFIERS:
    ALT = MOD_ALT
    CONTROL = MOD_CONTROL
    SHIFT = MOD_SHIFT
    WIN = MOD_WIN


class _MSG(ctypes.Structure):
    _fields_ = [
        ("hwnd", wintypes.HWND),
        ("message", wintypes.UINT),
        ("wParam", wintypes.WPARAM),
        ("lParam", wintypes.LPARAM),
        ("time", wintypes.DWORD),
        ("pt", wintypes.POINT),
    ]


class GlobalHotkey:
    """全局热键监听器。在独立线程中运行。"""

    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._registered: dict[int, Callable[[], None]] = {}
        self._thread_id: Optional[int] = None
        self._lock = threading.Lock()
        self._next_id = 1

    def _thread_proc(self):
        # 在线程内注册热键
        user32 = ctypes.windll.user32
        # 注册所有热键
        registered_keys = []
        with self._lock:
            for kid, callback in list(self._registered.items()):
                registered_keys.append((kid, callback))

        for kid, _ in registered_keys:
            pass  # _registered 字典存了 (modifiers, vk, callback)

        # 重新设计：_registered: { kid: (modifiers, vk, callback) }
        # 实际注册
        for kid, (mods, vk, _) in registered_keys:
            ok = user32.RegisterHotKey(None, kid, mods | MOD_NOREPEAT, vk)
            if not ok:
                # 注册失败，移除
                with self._lock:
                    self._registered.pop(kid, None)

        # 消息循环
        msg = _MSG()
        while not self._stop_event.is_set():
            # PeekMessage 非阻塞，便于检查 stop 事件
            if user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):  # PM_REMOVE=1
                if msg.message == WM_HOTKEY:
                    kid = msg.wParam
                    with self._lock:
                        entry = self._registered.get(kid)
                    if entry:
                        _, _, cb = entry
                        try:
                            cb()
                        except Exception:
                            pass
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            else:
                # 没有消息，短暂等待
                self._stop_event.wait(0.02)

        # 退出前注销所有热键
        for kid, _ in registered_keys:
            user32.UnregisterHotKey(None, kid)

    def register(self, modifiers: int, vk: int, callback: Callable[[], None]) -> int:
        """注册全局热键。返回热键 ID（>0）表示成功加入待注册队列，0 失败。"""
        with self._lock:
            kid = self._next_id
            self._next_id += 1
            self._registered[kid] = (modifiers, vk, callback)
        return kid

    def start(self) -> bool:
        """启动监听线程。"""
        if self._thread and self._thread.is_alive():
            return True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._thread_proc, daemon=True)
        self._thread.start()
        return True

    def stop(self):
        """停止监听线程，注销所有热键。"""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None
        with self._lock:
            self._registered.clear()
