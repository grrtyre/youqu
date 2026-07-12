# Watermark manager - background test + screenshot script (ASCII only for PS 5.x)
# Writes a temp enabled:true config to trigger overlay rendering, captures the
# main control-panel window via PrintWindow (no foreground steal), checks the
# overlay-rendered log to verify the overlay bug fix, then kills and cleans up.

$ErrorActionPreference = "Stop"

$projectDir = "D:\Ai\mimo\youqu\watermark-manager"
$shotDir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir -Force | Out-Null }
$mainShot = Join-Path $shotDir "watermark-manager.png"
$overlayShot = Join-Path $shotDir "watermark-manager-overlay.png"

$userdata = Join-Path $env:APPDATA "watermark-manager"
if (-not (Test-Path $userdata)) { New-Item -ItemType Directory -Path $userdata -Force | Out-Null }
$configFile = Join-Path $userdata "config.json"
$backupFile = Join-Path $env:TEMP "wm-config-backup.json"
$hadConfig = $false
if (Test-Path $configFile) {
    Copy-Item $configFile $backupFile -Force
    $hadConfig = $true
}

# Temp config: enabled true (no schedule) so overlay renders immediately.
# Write as UTF-8 bytes so Chinese content is preserved.
$tempJson = '{"enabled":true,"content":"internal {USERNAME} {IP}","fontSize":18,"color":"#888888","opacity":0.15,"rotation":-25,"gapX":320,"gapY":200,"showUserName":false,"showIP":false,"showTime":false,"timeFormat":"YYYY-MM-DD HH:mm","autoStart":false,"minimizeToTray":true,"scheduleEnabled":false,"scheduleStart":"09:00","scheduleEnd":"18:00","scheduleDays":[1,2,3,4,5]}'
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configFile, $tempJson, $utf8)

# Clean stale artifacts
$hwndFile = Join-Path $env:TEMP "watermark-manager-hwnd.txt"
$overlayLog = Join-Path $env:TEMP "watermark-overlay-rendered.log"
if (Test-Path $hwndFile) { Remove-Item $hwndFile -Force }
if (Test-Path $overlayLog) { Remove-Item $overlayLog -Force }

Write-Host "Starting Electron (hidden)..."
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c npx electron . --no-sandbox" -PassThru -WindowStyle Hidden -WorkingDirectory $projectDir
Write-Host "Launcher PID: $($proc.Id)"
$electronPid = $proc.Id

# Wait for main HWND file
$hwnd = [IntPtr]::Zero
$maxWait = 25; $waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    if ((Test-Path $hwndFile)) {
        $s = (Get-Content $hwndFile -Raw).Trim()
        if ($s -match '^\d+$') { $hwnd = [IntPtr][Int64]$s; Write-Host "Got main HWND: $hwnd (${waited}s)"; break }
    }
}
Start-Sleep -Seconds 2  # let overlay render

# PrintWindow helper: capture a window, and enumerate windows of a PID
Add-Type @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class WinShotWm {
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static bool Capture(IntPtr hwnd, string savePath) {
        if (hwnd == IntPtr.Zero) return false;
        RECT rect; GetWindowRect(hwnd, out rect);
        int w = rect.Right - rect.Left; int h = rect.Bottom - rect.Top;
        if (w <= 0 || h <= 0) return false;
        Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        Graphics g = Graphics.FromImage(bmp);
        IntPtr hdc = g.GetHdc();
        bool ok = PrintWindow(hwnd, hdc, 2);
        if (!ok) { ok = PrintWindow(hwnd, hdc, 0); }
        g.ReleaseHdc(hdc); g.Dispose();
        if (ok) { bmp.Save(savePath, ImageFormat.Png); }
        bmp.Dispose();
        return ok;
    }

    public static IntPtr FindOverlayHwnd(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, lp) => {
            uint p; GetWindowThreadProcessId(h, out p);
            if (p != pid) return true;
            if (!IsWindowVisible(h)) return true;
            var t = new System.Text.StringBuilder(256); GetWindowText(h, t, 256);
            var c = new System.Text.StringBuilder(256); GetClassName(h, c, 256);
            string title = t.ToString();
            // Electron content window class is "Chrome_WidgetWin_1"; overlay title is the page <title>
            if (title.Length > 0 && c.ToString() == "Chrome_WidgetWin_1") {
                if (title.IndexOf("watermark") >= 0 || title.Length <= 4) {
                    // skip; placeholder
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static List<IntPtr> ListWindows(uint pid) {
        var list = new List<IntPtr>();
        EnumWindows((h, lp) => {
            uint p; GetWindowThreadProcessId(h, out p);
            if (p == pid && IsWindowVisible(h)) {
                var t = new System.Text.StringBuilder(256); GetWindowText(h, t, 256);
                var c = new System.Text.StringBuilder(256); GetClassName(h, c, 256);
                if (c.ToString() == "Chrome_WidgetWin_1" && t.Length > 0) list.Add(h);
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static string Titles(uint pid) {
        var sb = new System.Text.StringBuilder();
        EnumWindows((h, lp) => {
            uint p; GetWindowThreadProcessId(h, out p);
            if (p == pid && IsWindowVisible(h)) {
                var t = new System.Text.StringBuilder(256); GetWindowText(h, t, 256);
                var c = new System.Text.StringBuilder(256); GetClassName(h, c, 256);
                sb.Append("[").Append(c.ToString()).Append("] ").Append(t.ToString()).Append("\n");
            }
            return true;
        }, IntPtr.Zero);
        return sb.ToString();
    }
}
'@ -ReferencedAssemblies System.Drawing

# Capture main window
$mainOk = $false
$overlayCaptured = $false
$overlayRendered = $false
try {
    if ($hwnd -ne [IntPtr]::Zero) {
        $mainOk = [WinShotWm]::Capture($hwnd, $mainShot)
        Write-Host ("Main capture: " + $mainOk)
    } else {
        Write-Host "ERROR: no main HWND"
    }

    # List visible Chromium windows of the process and capture the overlay
    $wins = [WinShotWm]::ListWindows([uint32]$electronPid)
    Write-Host ("Visible Chrome windows: " + $wins.Count)
    foreach ($w in $wins) {
        if ($w -eq $hwnd) { continue }  # skip main window
        $ovOk = [WinShotWm]::Capture($w, $overlayShot)
        if ($ovOk) { $overlayCaptured = $true; Write-Host "Overlay captured"; break }
    }
    if (-not $overlayCaptured) { Write-Host "Overlay not captured (may be hidden)" }

    # Check overlay render log
    if (Test-Path $overlayLog) {
        $overlayRendered = $true
        Write-Host ("OVERLAY RENDERED: " + (Get-Content $overlayLog -Raw).Trim())
    } else {
        Write-Host "OVERLAY NOT RENDERED (log missing)"
    }
} finally {
    # Stop Electron
    Write-Host "Stopping Electron..."
    try { & cmd /c "taskkill /PID $electronPid /T /F 2>&1" | Out-Null } catch {}
    # Cleanup
    if (Test-Path $hwndFile) { Remove-Item $hwndFile -Force }
    if ($hadConfig) { Copy-Item $backupFile $configFile -Force } elseif (Test-Path $configFile) { Remove-Item $configFile -Force }
    if (Test-Path $backupFile) { Remove-Item $backupFile -Force }
}

Write-Host "=== RESULT ==="
Write-Host ("main_shot=" + $mainShot + " ok=" + $mainOk)
Write-Host ("overlay_shot=" + $overlayShot + " captured=" + $overlayCaptured)
Write-Host ("overlay_rendered=" + $overlayRendered)
