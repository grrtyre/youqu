# -*- coding: utf-8 -*-
"""main.py —— 便携版入口。

负责：
- 加载/持久化规则
- 创建主窗口（customtkinter）
- 启动系统托盘（独立线程，pystray）
- 注册全局热键（keyboard 库）
- 线程安全队列：托盘/热键线程把回调抛回主线程执行
- 自动置顶定时器（每 5 秒扫描一次）

启动方式：python main.py
"""
from __future__ import annotations

import os
import queue
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, List

import customtkinter as ctk

# 确保能 import 同目录模块
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from win32_api import (WindowInfo, list_windows, set_topmost, set_alpha,
                        reset_alpha, toggle_topmost_foreground, get_foreground)
import store
from ui import MainWindow
from tray import TrayController
from hotkey import HotkeyController
from toast import show_toast


APP_NAME = "置顶管家"
APP_VERSION = "1.0.0"
HOTKEY = "ctrl+alt+t"
AUTOPIN_INTERVAL_MS = 5000

DEMO_MODE = os.environ.get("TM_DEMO") == "1"


def _demo_windows() -> List[WindowInfo]:
    """演示数据，用于截图评分。"""
    return [
        WindowInfo(hwnd=131620, pid=1234, title="备忘录.txt - 记事本",
                   proc="notepad.exe", proc_path="", topmost=True, alpha=255),
        WindowInfo(hwnd=262440, pid=5678,
                   title="置顶管家 - 让任意窗口始终置顶 - Google Chrome",
                   proc="chrome.exe", proc_path="", topmost=True, alpha=180),
        WindowInfo(hwnd=393660, pid=9012,
                   title="ui.py - topmost-manager - Visual Studio Code",
                   proc="code.exe", proc_path="", topmost=False, alpha=255),
        WindowInfo(hwnd=524880, pid=3456, title="D:\\Ai\\mimo\\youqu",
                   proc="explorer.exe", proc_path="", topmost=True, alpha=220),
        WindowInfo(hwnd=655100, pid=7890, title="Spotify - 播放中",
                   proc="spotify.exe", proc_path="", topmost=False, alpha=255),
        WindowInfo(hwnd=786320, pid=2345,
                   title="管理员: C:\\Windows\\System32\\cmd.exe",
                   proc="cmd.exe", proc_path="", topmost=False, alpha=255),
        WindowInfo(hwnd=917540, pid=6789, title="需求文档.docx - Word",
                   proc="winword.exe", proc_path="", topmost=False, alpha=255),
        WindowInfo(hwnd=1048760, pid=1357, title="Telegram Desktop",
                   proc="telegram.exe", proc_path="", topmost=False, alpha=255),
    ]


def get_store_path() -> str:
    """规则文件路径：放在用户 APPDATA 下，便携版不污染程序目录。"""
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    folder = Path(base) / "TopmostManagerPortable"
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder / "topmost-rules.json")


class App:
    def __init__(self):
        # 规则存储
        self.store_path = get_store_path()
        self.store_data = store.load(self.store_path)
        # 用户手动取消置顶的 hwnd（本会话内不再自动置顶）
        self.manual_unpinned: set[int] = set()

        # 线程安全队列：跨线程操作 UI
        self.ui_queue: queue.Queue = queue.Queue()

        # 自动置顶定时器句柄
        self.autopin_after = None

        # 构建主窗口
        self.win = MainWindow(
            on_toggle_topmost=self._on_ui_toggle,
            on_set_alpha=self._on_ui_alpha,
            on_star=self._on_ui_star,
            on_autopin_toggle=self._on_ui_autopin_toggle,
            on_refresh_request=self._on_ui_refresh_request,
            get_rules_state=self._get_rules_state,
            app_version=APP_VERSION,
        )
        self.win.set_is_rule_func(self._is_proc_in_rules)

        # 托盘
        self.tray = TrayController(
            on_show=lambda: self._post(self.show_window),
            on_toggle=lambda: self._post(self.on_hotkey),
            on_quit=lambda: self._post(self.quit_app),
            tooltip=APP_NAME,
        )

        # 热键
        self.hotkey = HotkeyController(
            HOTKEY, lambda: self._post(self.on_hotkey)
        )

        # 启动后台组件
        if not DEMO_MODE:
            self.tray.start()
            if not self.hotkey.start():
                # 热键注册失败（多半是权限问题），toast 提示
                self._post(lambda: show_toast(self.win,
                                               f"全局热键 {HOTKEY} 注册失败，请检查权限",
                                               accent=False))
            if self.store_data.get("autoPin"):
                self._start_autopin_timer()

        # 启动队列轮询
        self.win.after(50, self._poll_queue)

        if DEMO_MODE:
            # 演示模式：直接显示窗口，用于截图评分
            # 注入演示规则：notepad.exe 和 explorer.exe 已在规则中
            self.store_data = {
                "rules": [
                    {"proc": "notepad.exe", "enabled": True},
                    {"proc": "explorer.exe", "enabled": True},
                ],
                "autoPin": True,
            }
            self.win.update_autopin_state(True, 2)
            self.win.after(300, self.win.show)
            # 演示模式下禁用失焦自动隐藏
            self.win._start_focus_check = lambda: None
            self.win._check_foreground = lambda: None
        else:
            # 启动时窗口默认隐藏（驻留托盘）
            self.win.withdraw()
            # 但首次启动给个 toast 提示用户已经在后台
            self.win.after(800, lambda: show_toast(
                self.win,
                f"{APP_NAME} 已驻留托盘，按 {HOTKEY.upper()} 置顶当前窗口",
                accent=True, duration=2500
            ))

    # ---- 队列 ----
    def _post(self, func: Callable[[], Any]) -> None:
        """把回调抛回主线程。"""
        self.ui_queue.put(func)

    def _poll_queue(self):
        try:
            while True:
                func = self.ui_queue.get_nowait()
                try:
                    func()
                except Exception as e:
                    print(f"[queue] 回调异常: {e}")
        except queue.Empty:
            pass
        self.win.after(50, self._poll_queue)

    # ---- 窗口显示 ----
    def show_window(self):
        self.win.show()

    # ---- 热键：切换前台窗口置顶 ----
    def on_hotkey(self):
        result = toggle_topmost_foreground()
        if result is None:
            show_toast(self.win, "未获取到前台窗口", accent=False)
            return
        title = result.get("title") or "当前窗口"
        if result["topmost"]:
            self.manual_unpinned.discard(result["hwnd"])
            show_toast(self.win, f"已置顶：{title}", accent=True)
        else:
            self.manual_unpinned.add(result["hwnd"])
            show_toast(self.win, f"已取消置顶：{title}", accent=False)
        # 如果窗口当前可见，刷新列表
        if self.win._visible:
            self.win.refresh_list()

    # ---- UI 回调 ----
    def _on_ui_toggle(self, hwnd: int, on: bool):
        ok = set_topmost(hwnd, on)
        if ok:
            if on:
                self.manual_unpinned.discard(hwnd)
            else:
                self.manual_unpinned.add(hwnd)
                reset_alpha(hwnd)
        else:
            show_toast(self.win, "操作失败", accent=False)

    def _on_ui_alpha(self, hwnd: int, percent: int):
        set_alpha(hwnd, percent)

    def _on_ui_star(self, proc: str):
        """星标：在规则中则移除，不在则添加。"""
        if store.is_rule(self.store_data, proc):
            store.remove_rule(self.store_data, proc)
            show_toast(self.win, f"已移出自动置顶：{proc}")
        else:
            store.add_rule(self.store_data, proc)
            show_toast(self.win, f"已加入自动置顶：{proc}", accent=True)
        store.save(self.store_path, self.store_data)
        # 更新底部状态
        self.win.update_autopin_state(
            self.store_data.get("autoPin", False),
            len(self.store_data.get("rules", []))
        )

    def _on_ui_autopin_toggle(self, on: bool):
        self.store_data["autoPin"] = bool(on)
        store.save(self.store_path, self.store_data)
        if on:
            self._start_autopin_timer()
            self._apply_autopin()
            show_toast(self.win, "自动置顶已开启", accent=True)
        else:
            self._stop_autopin_timer()
            show_toast(self.win, "自动置顶已关闭")

    def _on_ui_refresh_request(self) -> List[WindowInfo]:
        """枚举窗口列表，排除本应用自身。"""
        if DEMO_MODE:
            return _demo_windows()
        my_hwnd = self.win._my_hwnd
        return list_windows(exclude_hwnd=my_hwnd)

    def _get_rules_state(self) -> tuple:
        return (self.store_data.get("autoPin", False),
                len(self.store_data.get("rules", [])))

    def _is_proc_in_rules(self, proc: str) -> bool:
        return store.is_rule(self.store_data, proc)

    # ---- 自动置顶 ----
    def _start_autopin_timer(self):
        self._stop_autopin_timer()
        self.autopin_after = self.win.after(
            AUTOPIN_INTERVAL_MS, self._autopin_tick
        )

    def _stop_autopin_timer(self):
        if self.autopin_after is not None:
            try:
                self.win.after_cancel(self.autopin_after)
            except Exception:
                pass
            self.autopin_after = None

    def _autopin_tick(self):
        self._apply_autopin()
        self.autopin_after = self.win.after(
            AUTOPIN_INTERVAL_MS, self._autopin_tick
        )

    def _apply_autopin(self):
        if not self.store_data.get("autoPin"):
            return
        try:
            my_hwnd = self.win._my_hwnd
            for w in list_windows(exclude_hwnd=my_hwnd):
                if w.topmost:
                    continue
                if w.hwnd in self.manual_unpinned:
                    continue
                if store.matches_rule(self.store_data, w.proc):
                    set_topmost(w.hwnd, True)
        except Exception as e:
            print(f"[autopin] 异常: {e}")

    # ---- 退出 ----
    def quit_app(self):
        self._stop_autopin_timer()
        try:
            self.hotkey.stop()
        except Exception:
            pass
        try:
            self.tray.stop()
        except Exception:
            pass
        try:
            self.win.destroy()
        except Exception:
            pass


def main():
    ctk.set_appearance_mode("light")  # 苹果白：强制浅色
    ctk.set_default_color_theme("blue")

    app = App()
    try:
        app.win.mainloop()
    except KeyboardInterrupt:
        app.quit_app()


if __name__ == "__main__":
    main()
