using System;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace AlarmManager.Portable.Core
{
    /// <summary>
    /// 全局热键 - Win32 RegisterHotKey / UnregisterHotKey 封装
    /// 用于全局热键唤起主窗口（Ctrl+Alt+A）
    /// </summary>
    public class GlobalHotkey : IDisposable
    {
        // 修饰键
        public const int MOD_ALT = 0x0001;
        public const int MOD_CONTROL = 0x0002;
        public const int MOD_SHIFT = 0x0004;
        public const int MOD_WIN = 0x0008;
        public const int MOD_NOREPEAT = 0x4000;

        // 热键消息
        public const int WM_HOTKEY = 0x0312;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        private readonly HwndSource _source;
        private readonly int _id;
        private bool _registered;
        private readonly Action _onPressed;

        /// <param name="window">关联的 WPF 窗口（必须已初始化）</param>
        /// <param name="onPressed">热键触发回调（在 UI 线程）</param>
        public GlobalHotkey(Window window, Action onPressed) : this(window, MOD_CONTROL | MOD_ALT, 0x41, onPressed)
        {
            // 默认 Ctrl+Alt+A（A=0x41）
        }

        public GlobalHotkey(Window window, int modifiers, int vk, Action onPressed)
        {
            _onPressed = onPressed ?? throw new ArgumentNullException(nameof(onPressed));
            _id = GetHashCode();
            var helper = new WindowInteropHelper(window);
            if (helper.Handle == IntPtr.Zero)
            {
                helper.EnsureHandle();
            }
            _source = HwndSource.FromHwnd(helper.Handle);
            if (_source == null) throw new InvalidOperationException("无法获取 HwndSource");
            _source.AddHook(HwndHook);

            _registered = RegisterHotKey(helper.Handle, _id, modifiers | MOD_NOREPEAT, vk);
            if (!_registered)
            {
                int err = Marshal.GetLastWin32Error();
                // 不抛异常 - 让 UI 继续运行（仅日志）
                System.Diagnostics.Debug.WriteLine($"[GlobalHotkey] 注册失败 win32err={err}");
            }
        }

        /// <summary>是否已成功注册</summary>
        public bool IsRegistered => _registered;

        private IntPtr HwndHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_HOTKEY && wParam.ToInt32() == _id)
            {
                _onPressed();
                handled = true;
            }
            return IntPtr.Zero;
        }

        public void Dispose()
        {
            if (_registered)
            {
                var helper = new WindowInteropHelper(System.Windows.Application.Current?.MainWindow ?? new Window());
                UnregisterHotKey(helper.Handle, _id);
                _registered = false;
            }
            _source.RemoveHook(HwndHook);
        }
    }
}
