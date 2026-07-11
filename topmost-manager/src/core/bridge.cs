// bridge.cs - Win32 窗口管理桥接 (由 PowerShell Add-Type 编译)
// 注意：本文件保持 ASCII，中文窗口标题在运行时通过 Unicode API 读取，不依赖源码编码
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;

public class WinMan
{
    // ---- 枚举与基本信息 ----
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int L, T, R, B; }
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);

    // ---- 扩展样式 / 分层 / 置顶 ----
    private const int GWL_EXSTYLE = -20;
    private const uint WS_EX_TOPMOST = 0x00000008;
    private const uint WS_EX_LAYERED = 0x00080000;

    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongW")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte alpha, uint flags);
    [DllImport("user32.dll")]
    public static extern bool GetLayeredWindowAttributes(IntPtr hwnd, out uint crKey, out byte alpha, out uint flags);
    private const uint LWA_ALPHA = 0x2;

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hAfter, int X, int Y, int cx, int cy, uint flags);
    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;

    // ---- 进程信息 ----
    [DllImport("kernel32.dll")]
    public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern bool QueryFullProcessImageName(IntPtr hProcess, uint flags, StringBuilder buf, ref uint size);
    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    // ---- JSON 字符串转义 ----
    private static string J(string s)
    {
        if (s == null) s = "";
        var sb = new StringBuilder();
        foreach (char c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append("\\u" + ((int)c).ToString("x4"));
                    else sb.Append(c);
                    break;
            }
        }
        return "\"" + sb.ToString() + "\"";
    }

    private static string GetProcName(uint pid)
    {
        try
        {
            IntPtr h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if (h != IntPtr.Zero)
            {
                try
                {
                    var sb = new StringBuilder(1024);
                    uint size = 1024;
                    if (QueryFullProcessImageName(h, 0, sb, ref size))
                        return Path.GetFileNameWithoutExtension(sb.ToString());
                }
                finally { CloseHandle(h); }
            }
        }
        catch { }
        try { return Process.GetProcessById((int)pid).ProcessName; }
        catch { return ""; }
    }

    // 枚举所有可见、有标题的顶层窗口
    public static string ListWindows(string excludeStr)
    {
        long excl = 0;
        long.TryParse(excludeStr ?? "", out excl);
        IntPtr exclude = new IntPtr(excl);

        var list = new List<string>();
        EnumWindows((h, lp) =>
        {
            try
            {
                if (h == exclude) return true;
                if (!IsWindowVisible(h)) return true;
                int len = GetWindowTextLength(h);
                if (len <= 0) return true;
                var sb = new StringBuilder(len + 2);
                GetWindowText(h, sb, sb.Capacity);
                string title = sb.ToString();
                if (string.IsNullOrWhiteSpace(title)) return true;

                uint pid;
                GetWindowThreadProcessId(h, out pid);
                string proc = GetProcName(pid);

                int ex = GetWindowLong(h, GWL_EXSTYLE);
                bool top = ((uint)ex & WS_EX_TOPMOST) != 0;
                bool layered = ((uint)ex & WS_EX_LAYERED) != 0;
                int alpha = 255;
                if (layered)
                {
                    uint cr; byte a; uint fl;
                    if (GetLayeredWindowAttributes(h, out cr, out a, out fl)) alpha = a;
                }

                RECT r;
                GetWindowRect(h, out r);

                var o = new StringBuilder();
                o.Append('{');
                o.Append("\"hwnd\":\"" + h.ToInt64().ToString() + "\"");
                o.Append(",\"pid\":" + pid.ToString());
                o.Append(",\"title\":" + J(title));
                o.Append(",\"proc\":" + J(proc));
                o.Append(",\"topmost\":" + (top ? "true" : "false"));
                o.Append(",\"layered\":" + (layered ? "true" : "false"));
                o.Append(",\"alpha\":" + alpha.ToString());
                o.Append(",\"x\":" + r.L.ToString() + ",\"y\":" + r.T.ToString());
                o.Append(",\"w\":" + (r.R - r.L).ToString() + ",\"h\":" + (r.B - r.T).ToString());
                o.Append('}');
                list.Add(o.ToString());
            }
            catch { }
            return true;
        }, IntPtr.Zero);

        return "{\"ok\":true,\"data\":[" + string.Join(",", list.ToArray()) + "]}";
    }

    // 设置窗口置顶
    public static bool SetTopmost(long hwnd, bool on)
    {
        IntPtr h = new IntPtr(hwnd);
        IntPtr after = on ? HWND_TOPMOST : HWND_NOTOPMOST;
        uint flags = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_SHOWWINDOW;
        return SetWindowPos(h, after, 0, 0, 0, 0, flags);
    }

    // 设置透明度（百分比 1-100）
    public static bool SetAlpha(long hwnd, int percent)
    {
        IntPtr h = new IntPtr(hwnd);
        if (percent < 1) percent = 1;
        if (percent > 100) percent = 100;
        int ex = GetWindowLong(h, GWL_EXSTYLE);
        if (((uint)ex & WS_EX_LAYERED) == 0)
        {
            SetWindowLong(h, GWL_EXSTYLE, ex | (int)WS_EX_LAYERED);
        }
        byte alpha = (byte)(percent * 255 / 100);
        return SetLayeredWindowAttributes(h, 0, alpha, LWA_ALPHA);
    }

    // 重置透明度为不透明
    public static bool ResetAlpha(long hwnd)
    {
        IntPtr h = new IntPtr(hwnd);
        return SetLayeredWindowAttributes(h, 0, 255, LWA_ALPHA);
    }

    // 获取前台窗口句柄
    public static string GetForeground()
    {
        return GetForegroundWindow().ToInt64().ToString();
    }

    // 切换前台窗口置顶状态
    public static string ToggleTopmostForeground()
    {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero) return "{\"ok\":false,\"error\":\"no foreground\"}";
        int ex = GetWindowLong(h, GWL_EXSTYLE);
        bool top = ((uint)ex & WS_EX_TOPMOST) != 0;
        bool now = !top;
        SetTopmost(h.ToInt64(), now);
        string title = "";
        int len = GetWindowTextLength(h);
        if (len > 0)
        {
            var sb = new StringBuilder(len + 2);
            GetWindowText(h, sb, sb.Capacity);
            title = sb.ToString();
        }
        return "{\"ok\":true,\"hwnd\":\"" + h.ToInt64().ToString() + "\",\"topmost\":" + (now ? "true" : "false") + ",\"title\":" + J(title) + "}";
    }
}
