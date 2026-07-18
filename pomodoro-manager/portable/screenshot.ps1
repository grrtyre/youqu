# screenshot.ps1 - Background screenshot via PrintWindow API
$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = "D:\python\python.exe"
$outDir = "D:\Ai\mimo\screenshots"
$outPath = Join-Path $outDir "pomodoro-portable.png"

if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
if (Test-Path $outPath) { Remove-Item $outPath -Force }

Write-Host "[1/5] Launching PomodoroPortable in background..."
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $pythonExe
$psi.Arguments = "main.py"
$psi.WorkingDirectory = $projectDir
$psi.UseShellExecute = $false
$psi.WindowStyle = "Hidden"
$psi.CreateNoWindow = $true
$psi.EnvironmentVariables["POMODORO_NO_AUTOHIDE"] = "1"
$proc = [System.Diagnostics.Process]::Start($psi)
$procId = $proc.Id
Write-Host "  PID = $procId"

Write-Host "[2/5] Waiting for window to render..."
Start-Sleep -Seconds 5

Write-Host "[3/5] Locating window by PID via EnumWindows..."
Add-Type -ReferencedAssemblies @("System.Drawing") @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public static class WinShot
{
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static IntPtr FindWindowByPid(int pid)
    {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) =>
        {
            uint p;
            GetWindowThreadProcessId(h, out p);
            if ((int)p == pid && IsWindowVisible(h))
            {
                RECT r;
                GetWindowRect(h, out r);
                int w = r.Right - r.Left;
                int hgt = r.Bottom - r.Top;
                if (w >= 200 && hgt >= 200) { found = h; return false; }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void Capture(IntPtr hWnd, string path)
    {
        RECT r;
        GetWindowRect(hWnd, out r);
        int w = r.Right - r.Left;
        int h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) throw new Exception("Invalid window rect");
        using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bmp))
            {
                var hdc = g.GetHdc();
                PrintWindow(hWnd, hdc, 2);
                g.ReleaseHdc(hdc);
            }
            bmp.Save(path, ImageFormat.Png);
        }
    }
}
"@

$hwnd = [WinShot]::FindWindowByPid($procId)
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "  Window not found, retrying..."
    Start-Sleep -Seconds 3
    $hwnd = [WinShot]::FindWindowByPid($procId)
}
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Error "Failed to locate window by PID $procId"
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "  HWND = $hwnd"

Write-Host "[4/5] Capturing via PrintWindow (background)..."
try {
    [WinShot]::Capture($hwnd, $outPath)
    Write-Host "  Saved: $outPath"
} catch {
    Write-Error $_.Exception.Message
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "[5/5] Stopping self-launched process (PID $procId)..."
Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Write-Host "Screenshot saved: $outPath"
