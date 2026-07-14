# screenshot.ps1 - PrintWindow background screenshot for ColorPicker portable
# Pure ASCII to avoid PS 5.x ANSI encoding issues.
# Usage: powershell -ExecutionPolicy Bypass -File build\screenshot.ps1

param(
    [string]$Exe = 'python',
    [string[]]$AppArgs = @('src\main.py', '--demo', '--show', '--screenshot'),
    [string]$Out = 'build\screenshot.png',
    [int]$WaitMs = 3500
)

$ErrorActionPreference = 'Stop'
$portableRoot = Split-Path -Parent $PSScriptRoot
Set-Location $portableRoot

# Ensure build dir exists
$outDir = Split-Path -Parent $Out
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}
$absOut = [System.IO.Path]::GetFullPath((Join-Path $portableRoot $Out))
$absOutDir = Split-Path -Parent $absOut
if (-not (Test-Path $absOutDir)) {
    New-Item -ItemType Directory -Force -Path $absOutDir | Out-Null
}
Write-Output "Output: $absOut"

# --- Win32 API via Add-Type ---
$src = @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public static class WinCap {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextW(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetClassNameW(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static IntPtr FindWindowByPid(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint wpid;
            GetWindowThreadProcessId(hWnd, out wpid);
            if (wpid == pid) {
                // Skip invisible windows only if we haven't found any yet
                bool vis = IsWindowVisible(hWnd);
                RECT r;
                if (GetWindowRect(hWnd, out r)) {
                    int w = r.Right - r.Left;
                    int h = r.Bottom - r.Top;
                    if (w >= 100 && h >= 100) {
                        // Prefer visible windows, but accept invisible ones as fallback
                        if (vis) {
                            found = hWnd;
                            return false; // stop on visible window
                        }
                        if (found == IntPtr.Zero) {
                            found = hWnd; // keep looking for visible one
                        }
                    }
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static Bitmap CaptureWindow(IntPtr hWnd) {
        RECT r;
        if (!GetWindowRect(hWnd, out r)) return null;
        int w = r.Right - r.Left;
        int h = r.Bottom - r.Top;
        if (w <= 0 || h <= 0) return null;
        Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp)) {
            IntPtr hdc = g.GetHdc();
            // PrintWindow flag 2 = PW_RENDERFULLCONTENT (captures modern rendering)
            PrintWindow(hWnd, hdc, 2);
            g.ReleaseHdc(hdc);
        }
        return bmp;
    }
}
"@
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition $src -ReferencedAssemblies System.Drawing

# --- Launch app ---
Write-Output "Launching: $Exe $($AppArgs -join ' ')"
$p = Start-Process -FilePath $Exe -ArgumentList $AppArgs -PassThru -WindowStyle Hidden
$pid_val = $p.Id
Write-Output "PID=$pid_val"

try {
    Write-Output "Waiting ${WaitMs}ms for window..."
    Start-Sleep -Milliseconds $WaitMs

    if ($p.HasExited) {
        Write-Error "Process exited before screenshot. Code=$($p.ExitCode)"
        exit 2
    }

    # Find the window
    $hwnd = [WinCap]::FindWindowByPid([uint32]$pid_val)
    if ($hwnd -eq [IntPtr]::Zero) {
        Write-Error "No visible window found for PID=$pid_val"
        exit 3
    }
    Write-Output "Found window HWND=$hwnd"

    # Capture
    $bmp = [WinCap]::CaptureWindow($hwnd)
    if ($bmp -eq $null) {
        Write-Error "PrintWindow returned null bitmap"
        exit 4
    }
    Write-Output "Captured: $($bmp.Width)x$($bmp.Height)"

    # Save as PNG via FileStream (more reliable than direct path save)
    $fs = [System.IO.File]::Create($absOut)
    try {
        $bmp.Save($fs, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $fs.Close()
    }
    $bmp.Dispose()
    Write-Output "Saved: $absOut"
    Write-Output "OK"
}
finally {
    # Stop the process by PID (do NOT close any user browsers!)
    if ($p -and -not $p.HasExited) {
        try { Stop-Process -Id $pid_val -Force -ErrorAction Stop } catch {}
        Write-Output "Stopped PID=$pid_val"
    }
}
