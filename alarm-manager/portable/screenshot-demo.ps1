# Alarm Manager Portable - background PrintWindow screenshot script
# Strict rules: background start + PrintWindow API + Stop-Process by PID + no user disruption
# Forbidden: CopyFromScreen, closing user's browser (Stop-Process -Name msedge)

$ErrorActionPreference = "Stop"

$exePath = "D:\Ai\mimo\youqu\alarm-manager\portable\bin\Release\net8.0-windows\win-x64\AlarmManagerPortable.exe"
$outDir = "D:\Ai\mimo\screenshots"
$outFile = Join-Path $outDir "alarm-manager-portable-main.png"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

Write-Host "[1/6] Launch demo process (hidden console)..."
$proc = Start-Process -FilePath $exePath -ArgumentList "--demo" -PassThru -WindowStyle Hidden
$demoPid = $proc.Id
Write-Host "      PID = $demoPid"

Write-Host "[2/6] Wait 3.5s for window to render..."
Start-Sleep -Milliseconds 3500

Write-Host "[3/6] Enumerate windows to find target by PID..."
Add-Type -ReferencedAssemblies System.Drawing, System.Drawing.Primitives @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public static class WinCapture
{
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int size);

    [DllImport("user32.dll")]
    private static extern int GetWindowThreadProcessId(IntPtr hWnd, out int pid);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int flags);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    public const int PW_RENDERFULLCONTENT = 2;

    public static IntPtr FindWindowByPid(int targetPid)
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) =>
        {
            int pid;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pid != targetPid) return true;
            if (!IsWindowVisible(hWnd)) return true;
            // First visible top-level window of this PID
            found = hWnd;
            return false;
        }, IntPtr.Zero);
        return found;
    }

    public static bool CaptureWindow(IntPtr hWnd, string outputPath)
    {
        RECT rect;
        if (!GetWindowRect(hWnd, out rect)) return false;
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return false;

        using (var bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                IntPtr hdc = g.GetHdc();
                bool ok = PrintWindow(hWnd, hdc, PW_RENDERFULLCONTENT);
                g.ReleaseHdc(hdc);
                if (!ok) return false;
            }
            bmp.Save(outputPath, ImageFormat.Png);
        }
        return true;
    }
}
"@

$hwnd = [WinCapture]::FindWindowByPid($demoPid)
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "      FAIL: no target window found"
    Stop-Process -Id $demoPid -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "      hwnd = $hwnd"

Write-Host "[4/6] PrintWindow background capture (PW_RENDERFULLCONTENT=2)..."
$ok = [WinCapture]::CaptureWindow($hwnd, $outFile)
if (-not $ok) {
    Write-Host "      FAIL: capture failed"
    Stop-Process -Id $demoPid -Force -ErrorAction SilentlyContinue
    exit 1
}
$size = (Get-Item $outFile).Length
Write-Host "      OK: $outFile ($size bytes)"

Write-Host "[5/6] Stop demo process by PID = $demoPid..."
Stop-Process -Id $demoPid -Force -ErrorAction SilentlyContinue
Write-Host "      stopped"

Write-Host "[6/6] Done. Screenshot: $outFile"
