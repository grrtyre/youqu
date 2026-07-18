# -*- coding: utf-8 -*-
"""winapi.py — Win32 API 封装

职责：
1. 全局热键 RegisterHotKey / UnregisterHotKey（独立消息循环线程）
2. 单实例锁 CreateMutex
3. 后台截图 PrintWindow（用于 mimo 审美评分，禁止 CopyFromScreen）
4. 全屏检测（休息抑制判断）

所有函数仅在 Windows 可用，通过 ctypes 调用，无额外依赖。
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as w
import threading
from ctypes import wintypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# 消息常量
WM_HOTKEY = 0x0312
MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_NOREPEAT = 0x4000

# PrintWindow 标志
PW_RENDERFULLCONTENT = 2  # 后台渲染完整内容（含子窗口）

# ShowWindow 命令
SW_HIDE = 0
SW_SHOWNOACTIVATE = 4

# 窗口长度偏移
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080


# ---------------------------------------------------------------------------
# 单实例锁
# ---------------------------------------------------------------------------
class SingleInstance:
    """通过命名互斥量保证只有一个实例运行。"""

    def __init__(self, name: str = "EyeRestPortable_Mutex_v1") -> None:
        self._name = name
        self._handle = kernel32.CreateMutexW(None, False, name)
        # GetLastError 返回 183 (ERROR_ALREADY_EXISTS) 表示已存在
        self._already_running = (kernel32.GetLastError() == 183)

    @property
    def already_running(self) -> bool:
        return self._already_running


# ---------------------------------------------------------------------------
# 全局热键线程
# ---------------------------------------------------------------------------
class HotKeyThread(threading.Thread):
    """独立线程注册全局热键并运行消息循环，收到热键后回调（在子线程触发）。"""

    def __init__(self, callbacks: dict[int, callable]) -> None:
        """
        callbacks: {key_id: callable} —— key_id 为整数标识，callable 无参。
        线程内捕获 WM_HOTKEY，根据 wParam 调用对应回调。
        注意：回调在子线程执行，操作 UI 需通过 tk.after 调度回主线程。
        """
        super().__init__(daemon=True)
        self._callbacks = callbacks
        self._registered: list[tuple[int, int, int]] = []  # (id, mod, vk)
        self._thread_id: int | None = None
        self._stop_event = threading.Event()

    def register(self, key_id: int, modifiers: int, vk: int) -> bool:
        """注册热键（必须在 _register_all 中调用，即线程内）。"""
        ok = user32.RegisterHotKey(None, key_id, modifiers | MOD_NOREPEAT, vk)
        if ok:
            self._registered.append((key_id, modifiers, vk))
        return bool(ok)

    def _register_all(self) -> None:
        """在线程启动后注册所有热键（RegisterHotKey 需在调用线程生效）。"""
        # 默认热键：由 main.py 通过 register 预先填好 _registered？不，这里改为读取预设
        # 实际：main.py 在 start 前调用 _queue 注册列表，这里统一注册
        for key_id, mod, vk in self._pending:
            self.register(key_id, mod, vk)

    def set_bindings(self, bindings: list[tuple[int, int, int]]) -> None:
        """主线程调用：设置要注册的热键列表 [(id, mod, vk), ...]。必须在 start 前。"""
        self._pending = list(bindings)

    def run(self) -> None:
        self._thread_id = kernel32.GetCurrentThreadId()
        self._register_all()
        # 消息循环
        msg = w.MSG()
        while not self._stop_event.is_set():
            # PeekMessage 非阻塞，配合短暂等待避免 CPU 占满
            if user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):  # PM_REMOVE=1
                if msg.message == WM_HOTKEY:
                    key_id = msg.wParam
                    cb = self._callbacks.get(key_id)
                    if cb:
                        try:
                            cb()
                        except Exception:
                            pass
            else:
                self._stop_event.wait(0.03)
        # 注销热键
        for key_id, _, _ in self._registered:
            user32.UnregisterHotKey(None, key_id)

    def stop(self) -> None:
        self._stop_event.set()


# ---------------------------------------------------------------------------
# 虚拟按键码
# ---------------------------------------------------------------------------
VK_MAP = {
    "A": 0x41, "B": 0x42, "C": 0x43, "D": 0x44, "E": 0x45, "F": 0x46,
    "G": 0x47, "P": 0x50, "R": 0x52, "S": 0x53, "T": 0x54, "X": 0x58,
}


def make_binding(key_id: int, ctrl: bool, shift: bool, alt: bool, key: str) -> tuple[int, int, int]:
    """构造热键绑定元组 (id, mod, vk)。"""
    mod = MOD_NOREPEAT
    if ctrl:
        mod |= MOD_CONTROL
    if shift:
        mod |= MOD_SHIFT
    if alt:
        mod |= MOD_ALT
    vk = VK_MAP.get(key.upper(), ord(key.upper()))
    return (key_id, mod, vk)


# ---------------------------------------------------------------------------
# 全屏检测（判断前台窗口是否全屏，用于休息抑制）
# ---------------------------------------------------------------------------
def is_foreground_fullscreen() -> bool:
    """检测前台窗口是否覆盖整个主屏幕（用于全屏时抑制休息）。"""
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return False
    rect = w.RECT()
    user32.GetWindowRect(hwnd, ctypes.byref(rect))
    # 获取窗口所在显示器的工作区 vs 全屏区
    monitor = user32.MonitorFromWindow(hwnd, 2)  # MONITOR_DEFAULTTONEAREST
    info = ctypes.create_string_buffer(40)
    ctypes.memset(info, 0, 40)
    ctypes.cast(info, ctypes.POINTER(ctypes.c_long))[0] = 40  # cbSize
    user32.GetMonitorInfoW(monitor, info)
    # info 是 MONITORINFOEX：rcMonitor(16 longs) 后是 rcWork
    # rcMonitor 偏移 4（跳过 cbSize），rcWork 偏移 4+16
    long_arr = ctypes.cast(info, ctypes.POINTER(ctypes.c_long))
    mx, my, mx2, my2 = long_arr[4], long_arr[5], long_arr[6], long_arr[7]
    return rect.left <= mx and rect.top <= my and rect.right >= mx2 and rect.bottom >= my2


# ---------------------------------------------------------------------------
# 后台截图：PrintWindow（禁止 CopyFromScreen）
# ---------------------------------------------------------------------------
def capture_window_to_file(hwnd: int, out_path: str, scale: float = 1.0) -> bool:
    """用 PrintWindow 后台截取指定窗口，保存为 PNG。

    使用 PW_RENDERFULLCONTENT=2 确保后台渲染完整内容。
    全程不把窗口置前，不打扰用户。
    """
    try:
        from PIL import Image  # 延迟导入
    except ImportError:
        return False

    gdi32 = ctypes.windll.gdi32

    # 获取窗口客户区尺寸
    rect = w.RECT()
    user32.GetClientRect(hwnd, ctypes.byref(rect))
    w_px = rect.right - rect.left
    h_px = rect.bottom - rect.top
    if w_px <= 0 or h_px <= 0:
        # 退而用窗口尺寸
        wr = w.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(wr))
        w_px = wr.right - wr.left
        h_px = wr.bottom - wr.top
        if w_px <= 0 or h_px <= 0:
            return False

    # 创建兼容 DC 与位图
    hdc_window = user32.GetDC(hwnd)
    hdc_mem = gdi32.CreateCompatibleDC(hdc_window)
    bmp = gdi32.CreateCompatibleBitmap(hdc_window, w_px, h_px)
    gdi32.SelectObject(hdc_mem, bmp)

    # PrintWindow 后台渲染（flag=2 渲染完整内容）
    result = user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT)
    if not result:
        # 部分窗口 PrintWindow 失败，回退到 BitBlt（仍在后台 DC，非 CopyFromScreen）
        gdi32.BitBlt(hdc_mem, 0, 0, w_px, h_px, hdc_window, 0, 0, 0x00CC0020)  # SRCCOPY

    # 读取位图位数据
    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG),
            ("biHeight", wintypes.LONG), ("biPlanes", wintypes.WORD),
            ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
            ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG),
            ("biYPelsPerMeter", wintypes.LONG), ("biClrUsed", wintypes.DWORD),
            ("biClrImportant", wintypes.DWORD),
        ]

    bi = BITMAPINFOHEADER()
    bi.biSize = ctypes.sizeof(bi)
    bi.biWidth = w_px
    bi.biHeight = -h_px  # 负值 = 自上而下
    bi.biPlanes = 1
    bi.biBitCount = 32
    bi.biCompression = 0  # BI_RGB

    buf = ctypes.create_string_buffer(w_px * h_px * 4)
    gdi32.GetDIBits(hdc_mem, bmp, 0, h_px, buf, ctypes.byref(bi), 0)

    img = Image.frombuffer("RGBA", (w_px, h_px), buf.raw, "raw", "BGRA", 0, 1)

    # 缩放
    if scale != 1.0:
        nw, nh = int(w_px * scale), int(h_px * scale)
        img = img.resize((nw, nh), Image.LANCZOS)

    img.save(out_path, "PNG")

    # 释放资源
    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(hdc_mem)
    user32.ReleaseDC(hwnd, hdc_window)
    return True


# ---------------------------------------------------------------------------
# 窗口工具：设置为工具窗口（不在任务栏显示）、获取进程自己的窗口
# ---------------------------------------------------------------------------
def set_tool_window(hwnd: int) -> None:
    """设置窗口为工具窗口，不在任务栏显示（输入法式体验）。"""
    ex = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
    user32.SetWindowLongW(hwnd, GWL_EXSTYLE, ex | WS_EX_TOOLWINDOW)


def find_my_windows() -> list[int]:
    """枚举当前进程的所有顶级窗口句柄（用于 PrintWindow 截图定位）。"""
    pid = kernel32.GetCurrentProcessId()
    found = []

    EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _cb(hwnd, _lparam):
        wpid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(wpid))
        if wpid.value == pid and user32.IsWindowVisible(hwnd):
            found.append(hwnd)
        return True

    user32.EnumWindows(EnumWindowsProc(_cb), 0)
    return found
