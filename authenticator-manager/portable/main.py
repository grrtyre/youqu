# -*- coding: utf-8 -*-
"""便携版入口：单实例锁 + 托盘热键线程 + UI 主循环。
所有原生系统集成集中在 win32_api，UI 在 ui.py，业务在 totp/storage。"""
import os
import sys
import json
import ctypes
import traceback
from typing import Optional

# 把脚本所在目录加入 sys.path（PyInstaller --onefile 后也能 import 同目录模块）
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import styles as S
from totp import totp_now, seconds_remaining
from storage import Storage, AccountStore, Account
from win32_api import SingleInstanceLock, TrayHotkeyThread
from ui import AuthenticatorWindow


# ============ 应用 ============

class AuthenticatorApp:
    """便携版应用：协调 UI、托盘、热键、存储。"""

    def __init__(self):
        # 数据目录：%APPDATA%\AuthenticatorPortable\
        appdata = os.environ.get('APPDATA') or os.path.expanduser('~')
        self.data_dir = os.path.join(appdata, 'AuthenticatorPortable')
        os.makedirs(self.data_dir, exist_ok=True)
        self.data_path = os.path.join(self.data_dir, 'accounts.dat')

        # 图标路径（同目录 icon.png 或 icon.ico）
        self.icon_path = os.path.join(_HERE, 'icon.png')
        if not os.path.exists(self.icon_path):
            self.icon_path = os.path.join(_HERE, 'icon.ico')
        if not os.path.exists(self.icon_path):
            self.icon_path = ''

        # 单实例锁
        self.single_lock = SingleInstanceLock('Authenticator-Portable-Mimo-v1')

        # 存储
        self.store = AccountStore(Storage(self.data_path))

        # UI 与托盘
        self.window: Optional[AuthenticatorWindow] = None
        self.tray: Optional[TrayHotkeyThread] = None

    # ---- 启动 ----

    def run(self, force_show: bool = False) -> int:
        # 单实例检查（测试模式跳过，便于反复启动）
        if not force_show and not self.single_lock.try_acquire():
            # 已有实例运行：尝试唤起前一个实例（简化：直接退出）
            ctypes.windll.user32.MessageBoxW(
                0, '验证器便携版已在运行。按 Ctrl+Shift+A 唤起。',
                '验证器', 0x40)
            return 0

        # 测试模式：强制显示窗口
        if force_show:
            self.store.update_settings({'start_hidden': False, 'auto_hide': False})

        try:
            # 先启动托盘 + 热键后台线程
            self.tray = TrayHotkeyThread(
                icon_path=self.icon_path,
                tooltip='验证器 · 本地 2FA\nCtrl+Shift+A 唤起',
                on_show=self._on_tray_show,
                on_quit=self._on_tray_quit,
                hotkey_spec=self.store.settings.get('hotkey', 'Ctrl+Shift+A'),
            )
            self.tray.start()

            # 启动 UI（主线程）
            self.window = AuthenticatorWindow(self.store, on_quit=self._on_quit)
            self.window.mainloop()
            return 0
        except Exception:
            traceback.print_exc()
            return 1
        finally:
            if self.tray:
                self.tray.stop()

    # ---- 回调 ----

    def _on_tray_show(self) -> None:
        """托盘左键 / 全局热键：唤起窗口。"""
        if self.window is None:
            return
        # 在 UI 线程安全地调用 show
        try:
            self.window.after(0, self.window.show_window)
        except Exception:
            pass

    def _on_tray_quit(self) -> None:
        """托盘菜单「退出」。"""
        if self.window is None:
            return
        try:
            self.window.after(0, self.window.quit_app)
        except Exception:
            pass

    def _on_quit(self) -> None:
        """UI 退出钩子。"""
        # 让托盘线程停止
        if self.tray:
            try:
                self.tray.stop()
            except Exception:
                pass


# ============ 入口 ============

def main() -> int:
    # 高 DPI 感知（让 UI 清晰）
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # PROCESS_PER_MONITOR_DPI_AWARE
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

    # 设置 Windows 应用用户模型 ID（任务栏图标不聚合到 Python）
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            'giquwei.AuthenticatorPortable.v1')
    except Exception:
        pass

    # 命令行参数：--show 强制显示窗口（测试用）；--demo 注入演示数据
    force_show = '--show' in sys.argv
    inject_demo = '--demo' in sys.argv

    app = AuthenticatorApp()
    if inject_demo:
        _inject_demo_accounts(app.store)
    return app.run(force_show=force_show)


def _inject_demo_accounts(store: 'AccountStore') -> None:
    """注入演示账户（仅 --demo 模式，覆盖现有数据）。"""
    from storage import Account
    demos = [
        ('GitHub', 'octocat@github.com', 'JBSWY3DPEHPK3PXP', 30, 6, 'SHA1'),
        ('Google', 'user@gmail.com', 'JBSWY3DPEHPK3PXP', 30, 6, 'SHA1'),
        ('Microsoft', 'work@outlook.com', 'KRSXG5A=', 30, 6, 'SHA1'),
        ('AWS', 'iam-user', 'JBSWY3DPEHPK3PXP', 30, 6, 'SHA1'),
        ('Notion', 'me@team.com', 'JBSWY3DPEHPK3PXP', 30, 6, 'SHA1'),
    ]
    # 清空再注入
    for a in store.list_accounts():
        store.delete_account(a.id)
    for issuer, label, secret, period, digits, algo in demos:
        store.add_account(Account.new(issuer, label, secret, period, digits, algo))


if __name__ == '__main__':
    sys.exit(main())
