# -*- coding: utf-8 -*-
"""win32_api.py —— 通过 ctypes 直接调用 Win32 API，
完成窗口枚举 / 置顶 / 透明度 / 前台窗口获取。

相比 Electron 原版的 C# + PowerShell 桥接进程，这里直接 ctypes 调用，
无需常驻桥接进程，启动更快、内存更低。
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
from dataclasses import dataclass
from typing import List, Optional

# ---- 常量 ----
GWL_EXSTYLE = -20
WS_EX_TOPMOST = 0x00000008
WS_EX_LAYERED = 0x00080000
WS_VISIBLE = 0x10000000
WS_EX_NOACTIVATE = 0x08000000

HWND_TOPMOST = ctypes.c_void_p(-1)
HWND_NOTOPMOST = ctypes.c_void_p(-2)
SWP_NOMOVE = 0x0002
SWP_NOSIZE = 0x0001
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040

LWA_ALPHA = 0x0002

# 进程查询权限
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000

# ---- 结构与函数签名 ----
user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
psapi = ctypes.WinDLL("psapi", use_last_error=True)

# EnumWindows
WNDENUMPROC = ctypes.WINFUNCTYPE(
    wintypes.BOOL, wintypes.HWND, wintypes.LPARAM
)
user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
user32.EnumWindows.restype = wintypes.BOOL

# GetWindowTextLengthW / GetWindowTextW
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowTextLengthW.restype = ctypes.c_int
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int

# IsWindowVisible
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = wintypes.BOOL

# GetWindowLongPtrW（64 位安全）
user32.GetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.GetWindowLongPtrW.restype = ctypes.c_ssize_t
user32.SetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_ssize_t]
user32.SetWindowLongPtrW.restype = ctypes.c_ssize_t

# GetWindowThreadProcessId
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD

# SetWindowPos
user32.SetWindowPos.argtypes = [
    wintypes.HWND, wintypes.HWND,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    wintypes.UINT,
]
user32.SetWindowPos.restype = wintypes.BOOL

# GetForegroundWindow
user32.GetForegroundWindow.argtypes = []
user32.GetForegroundWindow.restype = wintypes.HWND

# SetLayeredWindowAttributes
user32.SetLayeredWindowAttributes.argtypes = [
    wintypes.HWND, wintypes.COLORREF, wintypes.BYTE, wintypes.DWORD
]
user32.SetLayeredWindowAttributes.restype = wintypes.BOOL

# GetLayeredWindowAttributes
user32.GetLayeredWindowAttributes.argtypes = [
    wintypes.HWND, ctypes.POINTER(wintypes.COLORREF),
    ctypes.POINTER(wintypes.BYTE), ctypes.POINTER(wintypes.DWORD)
]
user32.GetLayeredWindowAttributes.restype = wintypes.BOOL

# IsIconic（最小化）
user32.IsIconic.argtypes = [wintypes.HWND]
user32.IsIconic.restype = wintypes.BOOL

# ---- 进程信息 ----
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.CloseHandle.restype = wintypes.BOOL

# QueryFullProcessImageNameW
kernel32.QueryFullProcessImageNameW.argtypes = [
    wintypes.HANDLE, wintypes.DWORD,
    wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)
]
kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL


@dataclass
class WindowInfo:
    """单条窗口信息。"""
    hwnd: int
    pid: int
    title: str
    proc: str           # 小写进程名，如 "notepad.exe"
    proc_path: str      # 完整路径
    topmost: bool
    alpha: int          # 0-255，255 表示不透明


def _get_window_text(hwnd: int) -> str:
    length = user32.GetWindowTextLengthW(hwnd)
    if length <= 0:
        return ""
    buf = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buf, length + 1)
    return buf.value


def _get_proc_name(pid: int) -> tuple[str, str]:
    """返回 (小写进程名, 完整路径)。失败返回 ("", "")。"""
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return ("", "")
    try:
        size = wintypes.DWORD(260)
        buf = ctypes.create_unicode_buffer(size.value)
        if kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
            full = buf.value
            import os
            name = os.path.basename(full).lower()
            return (name, full)
    finally:
        kernel32.CloseHandle(handle)
    return ("", "")


def _is_topmost(hwnd: int) -> bool:
    ex = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
    return bool(ex & WS_EX_TOPMOST)


def _get_alpha(hwnd: int) -> int:
    """获取窗口透明度 0-255。非分层窗口返回 255。"""
    ex = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
    if not (ex & WS_EX_LAYERED):
        return 255
    color = wintypes.COLORREF()
    alpha = wintypes.BYTE()
    flags = wintypes.DWORD()
    if user32.GetLayeredWindowAttributes(hwnd, ctypes.byref(color),
                                          ctypes.byref(alpha), ctypes.byref(flags)):
        if flags.value & LWA_ALPHA:
            return alpha.value
    return 255


def list_windows(exclude_hwnd: Optional[int] = None) -> List[WindowInfo]:
    """枚举所有可见的、有标题的顶层窗口。

    exclude_hwnd: 要排除的窗口句柄（通常是本应用自身）。
    """
    results: List[WindowInfo] = []

    def _enum_proc(hwnd, lparam):
        if not user32.IsWindowVisible(hwnd):
            return True  # 继续枚举
        if exclude_hwnd is not None and hwnd == exclude_hwnd:
            return True
        title = _get_window_text(hwnd)
        if not title:
            return True
        # 跳过最小化的窗口（标题仍在但用户看不到）
        if user32.IsIconic(hwnd):
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        proc_name, proc_path = _get_proc_name(pid.value)
        if not proc_name:
            return True
        # 过滤一些系统进程的辅助窗口（如 ApplicationFrameHost 的隐藏窗口）
        results.append(WindowInfo(
            hwnd=int(hwnd),
            pid=int(pid.value),
            title=title,
            proc=proc_name,
            proc_path=proc_path,
            topmost=_is_topmost(hwnd),
            alpha=_get_alpha(hwnd),
        ))
        return True

    user32.EnumWindows(WNDENUMPROC(_enum_proc), 0)
    return results


def set_topmost(hwnd: int, on: bool) -> bool:
    """切换窗口置顶状态。"""
    insert_after = HWND_TOPMOST if on else HWND_NOTOPMOST
    ok = user32.SetWindowPos(
        hwnd, insert_after,
        0, 0, 0, 0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
    )
    return bool(ok)


def get_foreground() -> Optional[int]:
    hwnd = user32.GetForegroundWindow()
    return int(hwnd) if hwnd else None


def set_alpha(hwnd: int, percent: int) -> bool:
    """设置窗口透明度。percent: 10-100，100 表示完全不透明。

    会自动给窗口加上 WS_EX_LAYERED 扩展样式。
    """
    percent = max(10, min(100, int(percent)))
    alpha = int(round(percent * 2.55))
    # 加上分层窗口样式
    ex = user32.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
    if not (ex & WS_EX_LAYERED):
        user32.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex | WS_EX_LAYERED)
    return bool(user32.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA))


def reset_alpha(hwnd: int) -> bool:
    """恢复窗口完全不透明（不取消分层样式，避免闪烁）。"""
    return bool(user32.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA))


def toggle_topmost_foreground() -> Optional[dict]:
    """切换当前前台窗口的置顶状态。

    返回:
        dict: {hwnd, title, proc, topmost} 成功
        None: 没有前台窗口
    """
    hwnd = get_foreground()
    if not hwnd:
        return None
    title = _get_window_text(hwnd)
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    proc_name, _ = _get_proc_name(pid.value)
    is_top = _is_topmost(hwnd)
    new_state = not is_top
    ok = set_topmost(hwnd, new_state)
    if not ok:
        return None
    # 取消置顶时顺便恢复不透明
    if not new_state:
        reset_alpha(hwnd)
    return {
        "hwnd": hwnd,
        "title": title,
        "proc": proc_name,
        "topmost": new_state,
    }
