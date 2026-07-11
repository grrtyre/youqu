# unit-converter-manager - background screenshot via PrintWindow (no focus steal)
# Output: D:\Ai\mimo\screenshots\unit-converter.png

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$shotDir = 'D:\Ai\mimo\screenshots'
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir -Force | Out-Null }
$outFile = Join-Path $shotDir 'unit-converter.png'

# C# code: capture window via PrintWindow, find by title
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
using System.Text;

public class WinShot {
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextLengthW(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static string GetTitle(IntPtr hWnd) {
        int len = GetWindowTextLengthW(hWnd);
        if (len <= 0) return "";
        StringBuilder sb = new StringBuilder(len + 2);
        GetWindowTextW(hWnd, sb, sb.Capacity);
        return sb.ToString();
    }

    // Find the first visible window whose title contains keyword
    public static IntPtr FindByTitle(string keyword) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lp) => {
            if (!IsWindowVisible(hWnd)) return true;
            string title = GetTitle(hWnd);
            if (title != null && title.Contains(keyword)) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void CaptureWindow(IntPtr hwnd, string outFile) {
        RECT rect;
        GetWindowRect(hwnd, out rect);
        int w = rect.Right - rect.Left;
        int h = rect.Bottom - rect.Top;
        if (w <= 0 || h <= 0) throw new Exception("Invalid window size: " + w + "x" + h);
        using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                IntPtr hdc = g.GetHdc();
                // flag 2 = PW_RENDERFULLCONTENT, supports Chromium content
                PrintWindow(hwnd, hdc, 2);
                g.ReleaseHdc(hdc);
            }
            bmp.Save(outFile, ImageFormat.Png);
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

# Launch Electron in screenshot mode
Write-Host "Launching Electron (screenshot mode)..."
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c npx electron . --screenshot --no-sandbox" -PassThru -WindowStyle Hidden -WorkingDirectory $projectDir

try {
    Write-Host "Waiting for window to load (8s)..."
    Start-Sleep -Seconds 8

    # Find window by title keyword (use English part to avoid encoding issues)
    $hwnd = [WinShot]::FindByTitle("unit-converter")
    if ($hwnd -eq [IntPtr]::Zero) {
        $hwnd = [WinShot]::FindByTitle("electron")
    }
    if ($hwnd -eq [IntPtr]::Zero) {
        $hwnd = [WinShot]::FindByTitle("convert")
    }

    if ($hwnd -eq [IntPtr]::Zero) {
        throw "Electron window not found"
    }

    Write-Host "Capturing window (HWND: $hwnd)..."
    [WinShot]::CaptureWindow($hwnd, $outFile)
    Write-Host "Screenshot saved: $outFile"
} finally {
    Write-Host "Killing Electron process tree..."
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    try {
        taskkill /F /T /PID $proc.Id 2>$null | Out-Null
    } catch {}
}

Write-Host "Done"
