# shot-bg.ps1 - Background screenshot via PrintWindow API
# Captures Electron window without bringing it to foreground (no user disturbance)
# Usage: powershell -ExecutionPolicy Bypass -File shot-bg.ps1

param(
    [string]$OutPath = "D:\Ai\mimo\screenshots\eye-rest-manager.png",
    [int]$WaitSec = 4
)

$ErrorActionPreference = "Stop"

# C# P/Invoke definitions for PrintWindow background capture
$src = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class WinShot {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int left, top, right, bottom; }

    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static IntPtr FindWindowByPid(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lp) => {
            uint wp;
            GetWindowThreadProcessId(hWnd, out wp);
            if (wp == pid && IsWindowVisible(hWnd)) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static void Capture(IntPtr hwnd, string path) {
        RECT rect;
        GetWindowRect(hwnd, out rect);
        int w = rect.right - rect.left;
        int h = rect.bottom - rect.top;
        if (w <= 0 || h <= 0) throw new Exception("Invalid window rect: " + w + "x" + h);
        using (Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
            using (Graphics g = Graphics.FromImage(bmp)) {
                IntPtr hdc = g.GetHdc();
                // PW_RENDERFULLCONTENT = 2, renders Chromium content in background
                PrintWindow(hwnd, hdc, 2);
                g.ReleaseHdc(hdc);
            }
            bmp.Save(path, ImageFormat.Png);
        }
    }
}
"@

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition $src -Language CSharp -ReferencedAssemblies System.Drawing

# Launch Electron in background (hidden, no foreground activation)
Write-Host "Launching Electron..."
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c npx electron . --no-sandbox --screenshot-demo" -PassThru -WindowStyle Hidden
$pidVal = $proc.Id

try {
    Write-Host "Waiting $WaitSec seconds for window to load..."
    Start-Sleep -Seconds $WaitSec

    # Find the visible window belonging to this process
    $hwnd = [WinShot]::FindWindowByPid([uint32]$pidVal)
    if ($hwnd -eq [IntPtr]::Zero) {
        # Electron may spawn child processes; search children of the cmd process tree
        Write-Host "No window for cmd PID $pidVal, searching child electron processes..."
        $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $pidVal }
        foreach ($c in $children) {
            $hwnd = [WinShot]::FindWindowByPid([uint32]$c.ProcessId)
            if ($hwnd -ne [IntPtr]::Zero) { break }
        }
    }

    if ($hwnd -eq [IntPtr]::Zero) {
        # Fallback: search all electron processes
        Write-Host "Searching all electron.exe processes..."
        $electrons = Get-Process -Name electron -ErrorAction SilentlyContinue
        foreach ($e in $electrons) {
            $hwnd = [WinShot]::FindWindowByPid([uint32]$e.Id)
            if ($hwnd -ne [IntPtr]::Zero) { break }
        }
    }

    if ($hwnd -eq [IntPtr]::Zero) {
        throw "Could not find any visible Electron window to capture."
    }

    Write-Host "Found window HWND: $hwnd"
    # Ensure directory exists
    $dir = [System.IO.Path]::GetDirectoryName($OutPath)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    [WinShot]::Capture($hwnd, $OutPath)
    Write-Host "Screenshot saved to: $OutPath"
}
finally {
    # Kill the Electron process tree
    Write-Host "Stopping Electron process tree..."
    try {
        taskkill /PID $pidVal /T /F 2>$null | Out-Null
    } catch {}
    try { Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue } catch {}
}
