# Background screenshot via PrintWindow API - pure ASCII to avoid GBK encoding issues
# Captures Electron window without bringing it to foreground (no user disturbance)

$ErrorActionPreference = 'Stop'

$cs = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public static class WinShot {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }

  public static string GetTitle(IntPtr hWnd) {
    StringBuilder sb = new StringBuilder(512);
    GetWindowTextW(hWnd, sb, 512);
    return sb.ToString();
  }

  public static IntPtr FindByPid(uint targetPid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((hWnd, lp) => {
      uint pid;
      GetWindowThreadProcessId(hWnd, out pid);
      if (pid == targetPid && IsWindowVisible(hWnd)) {
        found = hWnd;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }

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

  public static void Capture(IntPtr hwnd, string path) {
    RECT rect;
    GetWindowRect(hwnd, out rect);
    int w = rect.Right - rect.Left;
    int h = rect.Bottom - rect.Top;
    if (w <= 0 || h <= 0) throw new Exception("Invalid window rect: " + w + "x" + h);
    Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    Graphics g = Graphics.FromImage(bmp);
    IntPtr hdc = g.GetHdc();
    // PW_RENDERFULLCONTENT = 2, renders full chromium content in background
    bool ok = PrintWindow(hwnd, hdc, 2);
    g.ReleaseHdc(hdc);
    g.Dispose();
    if (!ok) throw new Exception("PrintWindow returned false");
    bmp.Save(path, ImageFormat.Png);
    bmp.Dispose();
  }
}
"@

Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing

# Showcase the new encode module during screenshot
$env:TM_DEMO_OP = 'encode'

$electronExe = "node_modules\electron\dist\electron.exe"
# Note: do NOT use -WindowStyle Hidden here — it would hide the Electron BrowserWindow itself,
# making IsWindowVisible false and PrintWindow capture blank. Launch directly so the window is
# visible (PrintWindow captures it in the background without needing foreground).
$proc = Start-Process -FilePath $electronExe -ArgumentList ". --no-sandbox" -PassThru -WorkingDirectory (Get-Location).Path
Write-Output ("PID: " + $proc.Id)

# Window title is Chinese "文本管家" = 0x6587 0x672c 0x7ba1 0x5bb6
$titleKeyword = [char]0x6587 + [char]0x672c + [char]0x7ba1 + [char]0x5bb6

$hwnd = [IntPtr]::Zero
for ($i = 0; $i -lt 12; $i++) {
  Start-Sleep -Seconds 1
  $hwnd = [WinShot]::FindByPid([uint32]$proc.Id)
  if ($hwnd -ne [IntPtr]::Zero) { break }
  $hwnd = [WinShot]::FindByTitle($titleKeyword)
  if ($hwnd -ne [IntPtr]::Zero) { break }
}

if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output "ERROR: no visible window found after retries"
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  exit 1
}

Write-Output ("HWND: " + $hwnd)
# Give Chromium extra time to finish rendering the encode demo output
Start-Sleep -Seconds 3

$outDir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outPath = Join-Path $outDir "text-manager.png"
try {
  [WinShot]::Capture($hwnd, $outPath)
  Write-Output ("SAVED: " + $outPath)
} catch {
  Write-Output ("CAPTURE ERROR: " + $_.Exception.Message)
} finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
