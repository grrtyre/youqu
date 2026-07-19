# -*- coding: utf-8 -*-
"""hotkey.py —— 全局热键（keyboard 库）。

注册 Ctrl+Alt+T 切换当前前台窗口置顶状态。
keyboard 库内部用低级键盘钩子，能在任何应用中捕获。
"""
from __future__ import annotations

import threading
from typing import Callable, Optional

import keyboard


class HotkeyController:
    """全局热键控制器。"""

    def __init__(self,
                 hotkey: str,
                 on_triggered: Callable[[], None]):
        self.hotkey = hotkey
        self.on_triggered = on_triggered
        self._registered = False

    def start(self) -> bool:
        if self._registered:
            return True
        try:
            keyboard.add_hotkey(self.hotkey, self._on_hotkey,
                                 suppress=False)
            self._registered = True
            return True
        except Exception as e:
            print(f"[hotkey] 注册失败: {e}")
            return False

    def stop(self) -> None:
        if not self._registered:
            return
        try:
            keyboard.remove_hotkey(self.hotkey)
        except Exception:
            pass
        self._registered = False

    def _on_hotkey(self):
        try:
            self.on_triggered()
        except Exception as e:
            print(f"[hotkey] 回调异常: {e}")
