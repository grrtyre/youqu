# screenshot.ps1 - Background window capture using PrintWindow API
# Pure ASCII to avoid PowerShell 5.x ANSI encoding issues
# NEVER use CopyFromScreen (it requires foreground window and disturbs user)
param(
    [string]$OutputPath = "D:\Ai\mimo\screenshots\clipboard-portable.png",
    [int]$ProcessId = 0
)

$dir = Split-Path $OutputPath -Parent
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class WindowCapture {
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static IntPtr FindWindowByPid(int pid) {
        // Find a window matching the popup size (~380x460).
        // Skip fullscreen/desktop windows.
        IntPtr bestHwnd = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if ((int)windowPid == pid) {
                RECT r;
                if (GetWindowRect(hWnd, out r)) {
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    // Popup is 380x500, allow some margin
                    if (w >= 300 && w <= 500 && h >= 400 && h <= 600) {
                        bestHwnd = hWnd;
                        return false; // found it
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return bestHwnd;
    }

    public static bool CaptureWindow(IntPtr hwnd, string path) {
        RECT rect;
        if (!GetWindowRect(hwnd, out rect)) return false;

        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return false;

        using (Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                IntPtr hdc = g.GetHdc();
                // PrintWindow flag 2 = PW_RENDERFULLCONTENT
                bool ok = PrintWindow(hwnd, hdc, 2);
                g.ReleaseHdc(hdc);
                if (!ok) return false;
            }
            bmp.Save(path, ImageFormat.Png);
            return true;
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

if ($ProcessId -eq 0) {
    $appDir = "d:\Ai\mimo\youqu\clipboard-manager\portable"
    $mainScript = Join-Path $appDir "src\main.py"

    Write-Host "Starting app (hidden + demo data)..."
    $proc = Start-Process -FilePath "python" `
        -ArgumentList @($mainScript, "--demo", "--show") `
        -PassThru -WindowStyle Hidden
    $ProcessId = $proc.Id
    Write-Host "Started PID=$ProcessId"
}

Write-Host "Waiting 3s for window..."
Start-Sleep -Seconds 3

Write-Host "Finding window handle..."
$hwnd = [WindowCapture]::FindWindowByPid($ProcessId)
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "Window not found, retry..."
    Start-Sleep -Seconds 2
    $hwnd = [WindowCapture]::FindWindowByPid($ProcessId)
}

if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "ERROR: window not found, killing process"
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "hwnd = $hwnd"
Write-Host "Capturing (PrintWindow flag=2)..."
$success = [WindowCapture]::CaptureWindow($hwnd, $OutputPath)

if ($success -and (Test-Path $OutputPath)) {
    $size = (Get-Item $OutputPath).Length
    Write-Host "OK: $OutputPath ($size bytes)"
} else {
    Write-Host "ERROR: capture failed"
}

Write-Host "Killing PID=$ProcessId"
Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue

if ($success) { exit 0 } else { exit 1 }
