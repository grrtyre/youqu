# -*- coding: utf-8 -*-
"""Win32 API 封装：单实例锁、全局热键、系统托盘、后台 PrintWindow 截图。
所有原生调用集中在此模块，UI 层不直接接触 ctypes。"""
import os
import threading
import ctypes
import ctypes.wintypes as wintypes
from ctypes import (Structure, POINTER, sizeof, byref, c_void_p, c_int, c_uint,
                    c_long, c_short, c_ubyte, c_wchar, cast, create_string_buffer,
                    create_unicode_buffer, WINFUNCTYPE, c_ssize_t, c_size_t)
from typing import Callable, Optional, Tuple

# 兼容性补丁：部分 Python 版本的 wintypes 缺少 LRESULT/WPARAM/LPARAM
if not hasattr(wintypes, 'LRESULT'):
    wintypes.LRESULT = c_ssize_t
if not hasattr(wintypes, 'WPARAM'):
    wintypes.WPARAM = c_size_t
if not hasattr(wintypes, 'LPARAM'):
    wintypes.LPARAM = c_ssize_t


# ============ 常量 ============

WM_DESTROY = 0x0002
WM_QUIT = 0x0012
WM_HOTKEY = 0x0312
WM_USER = 0x0400
WM_TRAYICON = WM_USER + 1
WM_COMMAND = 0x0111
WM_LBUTTONUP = 0x0202
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONDBLCLK = 0x0203
WM_RBUTTONUP = 0x0205
WM_RBUTTONDOWN = 0x0204
WM_MOUSEMOVE = 0x0200

NIM_ADD = 0x00000000
NIM_MODIFY = 0x00000001
NIM_DELETE = 0x00000002
NIF_MESSAGE = 0x00000001
NIF_ICON = 0x00000002
NIF_TIP = 0x00000004

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000

VK_CONTROL = 0x11
VK_SHIFT = 0x10
VK_MENU = 0x12  # Alt
VK_A = 0x41

HWND_MESSAGE = c_void_p(-3).value  # message-only window

CS_HREDRAW = 0x0002
CS_VREDRAW = 0x0001
WHITE_BRUSH = 0

WS_OVERLAPPED = 0x00000000
WS_EX_TOOLWINDOW = 0x00000080

CW_USEDEFAULT = -2147483648

TPM_LEFTALIGN = 0x0000
TPM_RETURNCMD = 0x0100
TPM_NONOTIFY = 0x0080
TPM_RIGHTBUTTON = 0x0002

PW_RENDERFULLCONTENT = 0x00000002  # PrintWindow flag 2

# 颜色：RGB
COLOR_MENU = 5
COLOR_MENUTEXT = 8
COLOR_HIGHLIGHT = 13


# ============ 结构体 ============

class WNDCLASS(Structure):
    _fields_ = [
        ('style', wintypes.UINT),
        ('lpfnWndProc', c_void_p),
        ('cbClsExtra', c_int),
        ('cbWndExtra', c_int),
        ('hInstance', wintypes.HINSTANCE),
        ('hIcon', wintypes.HICON),
        ('hCursor', wintypes.HANDLE),
        ('hbrBackground', wintypes.HBRUSH),
        ('lpszMenuName', wintypes.LPCWSTR),
        ('lpszClassName', wintypes.LPCWSTR),
    ]


class MSG(Structure):
    _fields_ = [
        ('hwnd', wintypes.HWND),
        ('message', wintypes.UINT),
        ('wParam', wintypes.WPARAM),
        ('lParam', wintypes.LPARAM),
        ('time', wintypes.DWORD),
        ('pt', wintypes.POINT),
    ]


class NOTIFYICONDATAW(Structure):
    _fields_ = [
        ('cbSize', wintypes.DWORD),
        ('hWnd', wintypes.HWND),
        ('uID', wintypes.UINT),
        ('uFlags', wintypes.UINT),
        ('uCallbackMessage', wintypes.UINT),
        ('hIcon', wintypes.HICON),
        ('szTip', wintypes.WCHAR * 128),
        ('dwState', wintypes.DWORD),
        ('dwStateMask', wintypes.DWORD),
        ('szInfo', wintypes.WCHAR * 256),
        ('uVersion', wintypes.UINT),
        ('szInfoTitle', wintypes.WCHAR * 64),
        ('dwInfoFlags', wintypes.DWORD),
        # 64-bit 平衡：guidItem + hBalloonIcon
        ('guidItem', c_ubyte * 16),
        ('hBalloonIcon', wintypes.HICON),
    ]


class MENUITEMINFO(Structure):
    _fields_ = [
        ('cbSize', wintypes.UINT),
        ('fMask', wintypes.UINT),
        ('fType', wintypes.UINT),
        ('fState', wintypes.UINT),
        ('wID', wintypes.UINT),
        ('hSubMenu', wintypes.HMENU),
        ('hbmpChecked', wintypes.HBITMAP),
        ('hbmpUnchecked', wintypes.HBITMAP),
        ('dwItemData', ctypes.c_void_p),
        ('dwTypeData', wintypes.LPWSTR),
        ('cch', wintypes.UINT),
        ('hbmpItem', wintypes.HBITMAP),
    ]


class POINT(Structure):
    _fields_ = [('x', c_long), ('y', c_long)]


class TPMPARAMS(Structure):
    _fields_ = [('cbSize', wintypes.UINT), ('rcExclude', wintypes.RECT)]


# ============ Win32 函数签名 ============

_user32 = ctypes.windll.user32
_kernel32 = ctypes.windll.kernel32
_shell32 = ctypes.windll.shell32
_gdi32 = ctypes.windll.gdi32

# CreateWindowExW
_user32.CreateWindowExW.restype = wintypes.HWND
_user32.CreateWindowExW.argtypes = [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR,
                                    wintypes.DWORD, c_int, c_int, c_int, c_int,
                                    wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, c_void_p]
# RegisterClassW
_user32.RegisterClassW.restype = wintypes.ATOM
_user32.RegisterClassW.argtypes = [POINTER(WNDCLASS)]
# DefWindowProcW
_user32.DefWindowProcW.restype = wintypes.LRESULT
_user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
# GetMessage
_user32.GetMessageW.restype = wintypes.BOOL
_user32.GetMessageW.argtypes = [POINTER(MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
# TranslateMessage / DispatchMessage
_user32.TranslateMessage.argtypes = [POINTER(MSG)]
_user32.TranslateMessage.restype = wintypes.BOOL
_user32.DispatchMessageW.restype = wintypes.LRESULT
_user32.DispatchMessageW.argtypes = [POINTER(MSG)]
# PostMessage
_user32.PostMessageW.restype = wintypes.BOOL
_user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
# PostThreadMessage
_user32.PostThreadMessageW.restype = wintypes.BOOL
_user32.PostThreadMessageW.argtypes = [wintypes.DWORD, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
# RegisterHotKey
_user32.RegisterHotKey.restype = wintypes.BOOL
_user32.RegisterHotKey.argtypes = [wintypes.HWND, c_int, wintypes.UINT, wintypes.UINT]
# UnregisterHotKey
_user32.UnregisterHotKey.restype = wintypes.BOOL
_user32.UnregisterHotKey.argtypes = [wintypes.HWND, c_int]
# Shell_NotifyIconW
_shell32.Shell_NotifyIconW.restype = wintypes.BOOL
_shell32.Shell_NotifyIconW.argtypes = [wintypes.DWORD, POINTER(NOTIFYICONDATAW)]
# CreatePopupMenu / AppendMenuW / TrackPopupMenuEx / DestroyMenu
_user32.CreatePopupMenu.restype = wintypes.HMENU
_user32.CreatePopupMenu.argtypes = []
_user32.AppendMenuW.restype = wintypes.BOOL
_user32.AppendMenuW.argtypes = [wintypes.HMENU, wintypes.UINT, wintypes.UINT, wintypes.LPCWSTR]
_user32.TrackPopupMenuEx.restype = c_int
_user32.TrackPopupMenuEx.argtypes = [wintypes.HMENU, wintypes.UINT, c_int, c_int, wintypes.HWND, POINTER(TPMPARAMS)]
_user32.DestroyMenu.restype = wintypes.BOOL
_user32.DestroyMenu.argtypes = [wintypes.HMENU]
# GetCursorPos
_user32.GetCursorPos.restype = wintypes.BOOL
_user32.GetCursorPos.argtypes = [POINTER(POINT)]
# SetForegroundWindow
_user32.SetForegroundWindow.restype = wintypes.BOOL
_user32.SetForegroundWindow.argtypes = [wintypes.HWND]
# LoadIconW / LoadCursorW
_user32.LoadIconW.restype = wintypes.HICON
_user32.LoadIconW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR]
# DestroyIcon
_user32.DestroyIcon.restype = wintypes.BOOL
_user32.DestroyIcon.argtypes = [wintypes.HICON]
# CreateIconIndirect
_user32.CreateIconIndirect.argtypes = [c_void_p]
_user32.CreateIconIndirect.restype = wintypes.HICON
# PrintWindow
_user32.PrintWindow.restype = wintypes.BOOL
_user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
# GetWindowRect
_user32.GetWindowRect.restype = wintypes.BOOL
_user32.GetWindowRect.argtypes = [wintypes.HWND, POINTER(wintypes.RECT)]
# GetClientRect
_user32.GetClientRect.restype = wintypes.BOOL
_user32.GetClientRect.argtypes = [wintypes.HWND, POINTER(wintypes.RECT)]
# FindWindowW
_user32.FindWindowW.restype = wintypes.HWND
_user32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
# GetWindowThreadProcessId
_user32.GetWindowThreadProcessId.restype = wintypes.DWORD
_user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, POINTER(wintypes.DWORD)]
# EnumWindows
_user32.EnumWindows.restype = wintypes.BOOL
_user32.EnumWindows.argtypes = [c_void_p, wintypes.LPARAM]
# IsWindowVisible
_user32.IsWindowVisible.restype = wintypes.BOOL
_user32.IsWindowVisible.argtypes = [wintypes.HWND]
# GetWindowTextW
_user32.GetWindowTextW.restype = c_int
_user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, c_int]
# GetClassNameW
_user32.GetClassNameW.restype = c_int
_user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, c_int]
# SendMessageW
_user32.SendMessageW.restype = c_ssize_t
_user32.SendMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
# GetWindowDC
_user32.GetWindowDC.restype = wintypes.HDC
_user32.GetWindowDC.argtypes = [wintypes.HWND]
# ReleaseDC
_user32.ReleaseDC.restype = c_int
_user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
# GetDC
_user32.GetDC.restype = wintypes.HDC
_user32.GetDC.argtypes = [wintypes.HWND]

# CreateMutex
_kernel32.CreateMutexW.restype = wintypes.HANDLE
_kernel32.CreateMutexW.argtypes = [c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
_kernel32.GetLastError.restype = wintypes.DWORD
_kernel32.GetCurrentThreadId.restype = wintypes.DWORD
_kernel32.GetCurrentThreadId.argtypes = []

# GDI: CreateCompatibleDC / CreateCompatibleBitmap / SelectObject / BitBlt / DeleteDC / DeleteObject
_gdi32.CreateCompatibleDC.restype = wintypes.HDC
_gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
_gdi32.CreateCompatibleBitmap.restype = wintypes.HBITMAP
_gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, c_int, c_int]
_gdi32.SelectObject.restype = wintypes.HGDIOBJ
_gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HGDIOBJ]
_gdi32.DeleteDC.restype = wintypes.BOOL
_gdi32.DeleteDC.argtypes = [wintypes.HDC]
_gdi32.DeleteObject.restype = wintypes.BOOL
_gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
_gdi32.GetDeviceCaps.restype = c_int
_gdi32.GetDeviceCaps.argtypes = [wintypes.HDC, c_int]
_gdi32.GetObjectW.restype = c_int
_gdi32.GetObjectW.argtypes = [wintypes.HGDIOBJ, c_int, c_void_p]
# GetDIBits
_gdi32.GetDIBits.restype = c_int
_gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HBITMAP, c_uint, c_uint,
                              c_void_p, c_void_p, c_uint]
# BitBlt
_gdi32.BitBlt.restype = wintypes.BOOL
_gdi32.BitBlt.argtypes = [wintypes.HDC, c_int, c_int, c_int, c_int,
                          wintypes.HDC, c_int, c_int, wintypes.DWORD]

# CreateMutex ERROR_ALREADY_EXISTS
ERROR_ALREADY_EXISTS = 183


# ============ 单实例锁 ============

class SingleInstanceLock:
    """通过命名 Mutex 保证仅一个实例运行。"""

    def __init__(self, name: str = 'Authenticator-Portable-Mimo-SingleInstance'):
        self.name = name
        self._handle: Optional[wintypes.HANDLE] = None

    def try_acquire(self) -> bool:
        self._handle = _kernel32.CreateMutexW(None, False, self.name)
        last_err = _kernel32.GetLastError()
        return not (bool(self._handle) and last_err == ERROR_ALREADY_EXISTS)


# ============ 热键解析 ============

def parse_hotkey(spec: str) -> Optional[Tuple[int, int]]:
    """解析 'Ctrl+Shift+A' -> (mods, vk)。支持 Ctrl/Control/Shift/Alt/Win + 字母/数字。"""
    if not spec:
        return None
    parts = [p.strip().lower() for p in spec.split('+')]
    mods = 0
    vk = 0
    for p in parts:
        if p in ('ctrl', 'control'):
            mods |= MOD_CONTROL
        elif p == 'shift':
            mods |= MOD_SHIFT
        elif p == 'alt':
            mods |= MOD_ALT
        elif p in ('win', 'super', 'meta'):
            mods |= MOD_WIN
        elif len(p) == 1 and p.isalpha():
            vk = ord(p.upper())
        elif len(p) == 1 and p.isdigit():
            vk = ord(p)
        elif p.startswith('f') and p[1:].isdigit():
            vk = 0x6F + int(p[1:])  # F1=0x70
        elif p.startswith('vk') and p[2:].isdigit():
            vk = int(p[2:])
        else:
            return None
    if vk == 0 or mods == 0:
        return None
    return mods | MOD_NOREPEAT, vk


# ============ 托盘 + 热键线程 ============

# WndProc 函数原型：HWND, UINT, WPARAM, LPARAM -> LRESULT
WNDPROC = WINFUNCTYPE(wintypes.LRESULT, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)


class TrayHotkeyThread:
    """后台线程：承载一个消息窗口，处理托盘图标回调与全局热键。
    通过线程安全的回调通知 UI 线程。"""

    def __init__(
        self,
        icon_path: str,
        tooltip: str,
        on_show: Callable[[], None],
        on_quit: Callable[[], None],
        hotkey_spec: str = 'Ctrl+Shift+A',
    ):
        self.icon_path = icon_path
        self.tooltip = tooltip[: 127]
        self.on_show = on_show
        self.on_quit = on_quit
        self.hotkey_spec = hotkey_spec
        self._hwnd: Optional[int] = None
        self._thread_id: Optional[int] = None
        self._thread: Optional[threading.Thread] = None
        self._hicon: Optional[int] = None
        self._nid: Optional[NOTIFYICONDATAW] = None
        self._wndproc_ref = None  # 防止 GC
        self._hotkey_id = 1
        self._started = threading.Event()

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name='TrayHotkeyThread', daemon=True)
        self._thread.start()
        # 等待窗口创建完成（最多 2 秒）
        self._started.wait(timeout=2.0)

    def stop(self) -> None:
        if self._hwnd:
            _user32.PostMessageW(self._hwnd, WM_QUIT, 0, 0)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def update_tooltip(self, tooltip: str) -> None:
        if not self._hwnd or not self._nid:
            return
        self._nid.szTip = tooltip[: 127]
        self._nid.uFlags = NIF_TIP
        _shell32.Shell_NotifyIconW(NIM_MODIFY, byref(self._nid))

    def reregister_hotkey(self, spec: str) -> bool:
        """切换热键（在线程内执行）。"""
        if not self._hwnd:
            return False
        self.hotkey_spec = spec
        # 用 PostMessage 触发重新注册：通过自定义消息
        _user32.PostMessageW(self._hwnd, WM_USER + 100, 0, 0)
        return True

    # ---- 内部 ----

    def _load_hicon(self) -> Optional[int]:
        """从 .ico / .png 文件加载图标。失败时回退到系统默认盾牌图标。"""
        path = self.icon_path
        if path and os.path.exists(path):
            if path.lower().endswith('.ico'):
                # LoadImageW
                hicon = ctypes.windll.user32.LoadImageW(
                    0, path, 1, 0, 0, 0x00000010 | 0x00000020)  # IMAGE_ICON | LR_LOADFROMFILE | LR_DEFAULTSIZE
                if hicon:
                    return hicon
            elif path.lower().endswith('.png'):
                # 用 PIL 转 HICON
                try:
                    from PIL import Image
                    img = Image.open(path).convert('RGBA')
                    return self._pil_to_hicon(img)
                except Exception:
                    pass
        # 回退：系统默认应用图标
        hicon = _user32.LoadIconW(0, 32514)  # IDI_SHIELD = 32514
        return hicon

    def _pil_to_hicon(self, img) -> int:
        """PIL Image -> HICON。"""
        # 使用 win32 风格的 ICONINFO + CreateIconIndirect
        class ICONINFO(Structure):
            _fields_ = [
                ('fIcon', wintypes.BOOL),
                ('xHotspot', wintypes.DWORD),
                ('yHotspot', wintypes.DWORD),
                ('hbmMask', wintypes.HBITMAP),
                ('hbmColor', wintypes.HBITMAP),
            ]

        # 简化：直接用 PIL save 到临时 ico 再 LoadImage
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix='.ico', delete=False)
        tmp.close()
        try:
            img.save(tmp.name, format='ICO', sizes=[(32, 32)])
            hicon = ctypes.windll.user32.LoadImageW(
                0, tmp.name, 1, 0, 0, 0x00000010 | 0x00000020)
            return hicon
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    def _run(self) -> None:
        self._thread_id = _kernel32.GetCurrentThreadId()

        # 注册窗口类
        class_name = 'AuthenticatorPortableTray_' + str(id(self))
        self._wndproc_ref = WNDPROC(self._wndproc)

        wc = WNDCLASS()
        wc.style = 0
        wc.lpfnWndProc = cast(self._wndproc_ref, c_void_p)
        wc.hInstance = _kernel32.GetModuleHandleW(None)
        wc.lpszClassName = class_name
        atom = _user32.RegisterClassW(byref(wc))
        if not atom:
            return

        # 创建消息窗口（HWND_MESSAGE = -3，仅处理消息，不可见）
        self._hwnd = _user32.CreateWindowExW(
            0, class_name, 'AuthenticatorTray', 0,
            0, 0, 0, 0, HWND_MESSAGE, None, wc.hInstance, None)
        if not self._hwnd:
            return

        # 加载图标
        self._hicon = self._load_hicon()

        # 添加托盘图标
        nid = NOTIFYICONDATAW()
        nid.cbSize = sizeof(NOTIFYICONDATAW)
        nid.hWnd = self._hwnd
        nid.uID = 1
        nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP
        nid.uCallbackMessage = WM_TRAYICON
        nid.hIcon = self._hicon
        nid.szTip = self.tooltip
        self._nid = nid
        _shell32.Shell_NotifyIconW(NIM_ADD, byref(self._nid))

        # 注册热键
        self._register_hotkey()

        self._started.set()

        # 消息循环
        msg = MSG()
        while _user32.GetMessageW(byref(msg), None, 0, 0) > 0:
            _user32.TranslateMessage(byref(msg))
            _user32.DispatchMessageW(byref(msg))

        # 清理
        if self._nid:
            _shell32.Shell_NotifyIconW(NIM_DELETE, byref(self._nid))
        if self._hicon:
            _user32.DestroyIcon(self._hicon)
        _user32.PostMessageW(self._hwnd, WM_DESTROY, 0, 0)

    def _register_hotkey(self) -> bool:
        parsed = parse_hotkey(self.hotkey_spec)
        if not parsed:
            return False
        mods, vk = parsed
        _user32.UnregisterHotKey(self._hwnd, self._hotkey_id)
        return bool(_user32.RegisterHotKey(self._hwnd, self._hotkey_id, mods, vk))

    def _wndproc(self, hwnd, msg, wparam, lparam):
        try:
            if msg == WM_TRAYICON:
                mouse_msg = lparam & 0xFFFF
                if mouse_msg == WM_LBUTTONUP or mouse_msg == WM_LBUTTONDBLCLK:
                    # 左键单击/双击：唤起
                    try:
                        self.on_show()
                    except Exception:
                        pass
                elif mouse_msg == WM_RBUTTONUP:
                    # 右键：弹出菜单
                    self._show_context_menu()
                return 0
            if msg == WM_HOTKEY:
                if wparam == self._hotkey_id:
                    try:
                        self.on_show()
                    except Exception:
                        pass
                return 0
            if msg == WM_COMMAND:
                cmd = wparam & 0xFFFF
                if cmd == 1001:  # 显示
                    try:
                        self.on_show()
                    except Exception:
                        pass
                elif cmd == 1002:  # 退出
                    try:
                        self.on_quit()
                    except Exception:
                        pass
                return 0
            if msg == WM_USER + 100:
                # 重新注册热键
                self._register_hotkey()
                return 0
            if msg == WM_DESTROY:
                _user32.PostQuitMessage(0)
                return 0
        except Exception:
            pass
        return _user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    def _show_context_menu(self) -> None:
        menu = _user32.CreatePopupMenu()
        if not menu:
            return
        _user32.AppendMenuW(menu, 0, 1001, '显示验证器')
        _user32.AppendMenuW(menu, 0x800, 0, None)  # MF_SEPARATOR
        _user32.AppendMenuW(menu, 0, 1002, '退出')
        pt = POINT()
        _user32.GetCursorPos(byref(pt))
        # 必须在前台才能正确关闭菜单（Windows 怪癖）
        _user32.SetForegroundWindow(self._hwnd)
        cmd = _user32.TrackPopupMenuEx(
            menu, TPM_LEFTALIGN | TPM_RETURNCMD | TPM_NONOTIFY | TPM_RIGHTBUTTON,
            pt.x, pt.y, self._hwnd, None)
        _user32.DestroyMenu(menu)
        if cmd:
            _user32.PostMessageW(self._hwnd, WM_COMMAND, cmd, 0)


# ============ 后台截图：PrintWindow ============

def find_windows_by_pid(target_pid: int) -> list:
    """枚举所有顶层窗口，返回属于 target_pid 的窗口句柄列表。"""
    results = []

    @WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def _enum_proc(hwnd, lparam):
        pid = wintypes.DWORD(0)
        _user32.GetWindowThreadProcessId(hwnd, byref(pid))
        if pid.value == target_pid and _user32.IsWindowVisible(hwnd):
            # 排除通知图标窗口等无意义窗口
            title_buf = create_unicode_buffer(512)
            _user32.GetWindowTextW(hwnd, title_buf, 512)
            class_buf = create_unicode_buffer(512)
            _user32.GetClassNameW(hwnd, class_buf, 512)
            # 跳过一些系统窗口类
            if class_buf.value in ('IME', 'MSCTFIME UI', 'Default IME'):
                return True
            results.append((hwnd, title_buf.value, class_buf.value))
        return True

    _user32.EnumWindows(cast(_enum_proc, c_void_p), 0)
    return results


def print_window_to_png(hwnd: int, output_path: str) -> bool:
    """后台截图到 PNG。优先 PrintWindow flag 2，回退 flag 0 / WM_PRINT / GetWindowDC+BitBlt。
    绝不调用 CopyFromScreen / Graphics.CopyFromScreen，绝不抢前台焦点。"""
    rc = wintypes.RECT()
    if not _user32.GetWindowRect(hwnd, byref(rc)):
        return False
    width = rc.right - rc.left
    height = rc.bottom - rc.top
    if width <= 0 or height <= 0:
        return False

    hdc_screen = _user32.GetDC(0)
    hdc_mem = _gdi32.CreateCompatibleDC(hdc_screen)
    hbmp = _gdi32.CreateCompatibleBitmap(hdc_screen, width, height)
    old_bmp = _gdi32.SelectObject(hdc_mem, hbmp)

    # 尝试多种策略
    ok = False
    # 策略1: PrintWindow flag 2 (PW_RENDERFULLCONTENT)
    try:
        ok = bool(_user32.PrintWindow(hwnd, hdc_mem, PW_RENDERFULLCONTENT))
    except Exception:
        ok = False
    # 策略2: PrintWindow flag 0 (兼容模式)
    if not ok:
        try:
            ok = bool(_user32.PrintWindow(hwnd, hdc_mem, 0))
        except Exception:
            ok = False
    # 策略3: GetWindowDC + BitBlt（窗口自有 DC，非屏幕截图）
    if not ok:
        SRCCOPY = 0x00CC0020
        try:
            hwnd_dc = _user32.GetWindowDC(hwnd)
            try:
                ok = bool(_gdi32.BitBlt(hdc_mem, 0, 0, width, height, hwnd_dc, 0, 0, SRCCOPY))
            finally:
                _user32.ReleaseDC(hwnd, hwnd_dc)
        except Exception:
            ok = False

    # 转换为 PIL Image 并保存（hbmp 仍在 hdc_mem 中，直接 GetDIBits）
    if ok:
        try:
            from PIL import Image

            class _BIH(Structure):
                _fields_ = [
                    ('biSize', wintypes.DWORD), ('biWidth', c_long),
                    ('biHeight', c_long), ('biPlanes', wintypes.WORD),
                    ('biBitCount', wintypes.WORD), ('biCompression', wintypes.DWORD),
                    ('biSizeImage', wintypes.DWORD), ('biXPelsPerMeter', c_long),
                    ('biYPelsPerMeter', c_long), ('biClrUsed', wintypes.DWORD),
                    ('biClrImportant', wintypes.DWORD),
                ]

            class _BI(Structure):
                _fields_ = [('bmiHeader', _BIH), ('bmiColors', wintypes.DWORD * 3)]

            bi = _BI()
            bi.bmiHeader.biSize = sizeof(_BIH)
            bi.bmiHeader.biWidth = width
            bi.bmiHeader.biHeight = -height  # top-down
            bi.bmiHeader.biPlanes = 1
            bi.bmiHeader.biBitCount = 32
            bi.bmiHeader.biCompression = 0  # BI_RGB

            buf = create_string_buffer(width * height * 4)
            got = _gdi32.GetDIBits(hdc_mem, hbmp, 0, height, buf, byref(bi), 0)
            if got > 0:
                img = Image.frombuffer('RGBA', (width, height), buf.raw, 'raw', 'BGRA', 0, 1)
                out_dir = os.path.dirname(os.path.abspath(output_path))
                os.makedirs(out_dir, exist_ok=True)
                img.save(output_path, 'PNG')
                ok = True
            else:
                ok = False
        except Exception:
            ok = False

    # 清理
    _gdi32.SelectObject(hdc_mem, old_bmp)
    _gdi32.DeleteObject(hbmp)
    _gdi32.DeleteDC(hdc_mem)
    _user32.ReleaseDC(0, hdc_screen)
    return ok


class _BITMAPINFOHEADER(Structure):
    _fields_ = [
        ('biSize', wintypes.DWORD),
        ('biWidth', c_long),
        ('biHeight', c_long),
        ('biPlanes', wintypes.WORD),
        ('biBitCount', wintypes.WORD),
        ('biCompression', wintypes.DWORD),
        ('biSizeImage', wintypes.DWORD),
        ('biXPelsPerMeter', c_long),
        ('biYPelsPerMeter', c_long),
        ('biClrUsed', wintypes.DWORD),
        ('biClrImportant', wintypes.DWORD),
    ]


class _BITMAPINFO(Structure):
    _fields_ = [('bmiHeader', _BITMAPINFOHEADER), ('bmiColors', wintypes.DWORD * 3)]


def _hbitmap_to_pil(hbmp, width: int, height: int):
    """HBITMAP -> PIL Image（BGRA -> RGBA）。"""
    from PIL import Image

    hdc_screen = _user32.GetDC(0)
    hdc_mem = _gdi32.CreateCompatibleDC(hdc_screen)
    old_bmp = _gdi32.SelectObject(hdc_mem, hbmp)

    bi = _BITMAPINFO()
    bi.bmiHeader.biSize = sizeof(_BITMAPINFOHEADER)
    bi.bmiHeader.biWidth = width
    bi.bmiHeader.biHeight = -height  # top-down
    bi.bmiHeader.biPlanes = 1
    bi.bmiHeader.biBitCount = 32
    bi.bmiHeader.biCompression = 0  # BI_RGB

    buf = create_string_buffer(width * height * 4)
    got = _gdi32.GetDIBits(hdc_mem, hbmp, 0, height, buf, byref(bi), 0)
    _gdi32.SelectObject(hdc_mem, old_bmp)
    _gdi32.DeleteDC(hdc_mem)
    _user32.ReleaseDC(0, hdc_screen)

    if not got:
        return None

    img = Image.frombuffer('RGBA', (width, height), buf.raw, 'raw', 'BGRA', 0, 1)
    return img


def capture_process_window(pid: int, output_path: str, prefer_title_contains: str = '') -> bool:
    """枚举进程的所有窗口，截取最佳匹配项。"""
    wins = find_windows_by_pid(pid)
    if not wins:
        return False
    # 优先匹配标题包含指定字符串的窗口
    target = None
    if prefer_title_contains:
        for hwnd, title, _ in wins:
            if prefer_title_contains.lower() in title.lower():
                target = hwnd
                break
    if target is None:
        # 取第一个有标题的窗口
        for hwnd, title, _ in wins:
            if title:
                target = hwnd
                break
    if target is None:
        target = wins[0][0]
    return print_window_to_png(target, output_path)
