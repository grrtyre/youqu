# -*- coding: utf-8 -*-
"""tray.py —— 系统托盘（pystray）。

pystray 在自己的线程里跑，通过回调队列与主线程通信（tkinter 线程不安全）。
"""
from __future__ import annotations

import threading
from typing import Callable, Optional

import pystray
from PIL import Image

from icon import make_tray_icon


class TrayController:
    """托盘控制器。在独立线程运行。"""

    def __init__(self,
                 on_show: Callable[[], None],
                 on_toggle: Callable[[], None],
                 on_quit: Callable[[], None],
                 tooltip: str = "置顶管家"):
        self.on_show = on_show
        self.on_toggle = on_toggle
        self.on_quit = on_quit
        self.tooltip = tooltip
        self._icon: Optional[pystray.Icon] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._thread is not None:
            return
        img = make_tray_icon(64)
        menu = pystray.Menu(
            pystray.MenuItem("置顶管家", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("显示窗口", self._on_show_clicked, default=True),
            pystray.MenuItem("置顶/取消当前窗口  Ctrl+Alt+T",
                              self._on_toggle_clicked),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("退出", self._on_quit_clicked),
        )
        self._icon = pystray.Icon(
            name="topmost-manager-portable",
            icon=img,
            title=self.tooltip,
            menu=menu,
        )
        self._thread = threading.Thread(
            target=self._icon.run, daemon=True, name="tray"
        )
        self._thread.start()

    def stop(self) -> None:
        if self._icon is not None:
            try:
                self._icon.stop()
            except Exception:
                pass
            self._icon = None
        if self._thread is not None:
            self._thread.join(timeout=1.0)
            self._thread = None

    def update_icon(self, color: tuple = (0, 122, 255, 255)) -> None:
        """热更新托盘图标颜色（如置顶时变蓝）。"""
        if self._icon is None:
            return
        try:
            self._icon.icon = make_tray_icon(64, color=color)
        except Exception:
            pass

    # ---- 内部：在 pystray 线程触发，回调抛回主线程 ----
    def _on_show_clicked(self, icon, item):
        icon.stop() if False else None  # 占位，不退出
        try:
            self.on_show()
        except Exception:
            pass

    def _on_toggle_clicked(self, icon, item):
        try:
            self.on_toggle()
        except Exception:
            pass

    def _on_quit_clicked(self, icon, item):
        try:
            self.on_quit()
        except Exception:
            pass
        try:
            icon.stop()
        except Exception:
            pass
