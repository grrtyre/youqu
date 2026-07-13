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

$dir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$outPath = "$dir\screen-recorder-manager.png"

$electronExe = "node_modules\electron\dist\electron.exe"
# Create .demo signal file: showInactive (no focus steal) + inject sample history for a fuller screenshot
# Note: do NOT use -WindowStyle Hidden — it hides the Electron BrowserWindow too,
# making IsWindowVisible false and PrintWindow unable to render Chromium content.
# PrintWindow captures in background without stealing focus (no SetForegroundWindow).
$demoFile = Join-Path (Get-Location).Path ".demo"
Set-Content -Path $demoFile -Value "1" -Encoding ASCII -NoNewline
$proc = Start-Process -FilePath $electronExe -ArgumentList ". --no-sandbox" -PassThru -WorkingDirectory (Get-Location).Path -RedirectStandardOutput "electron-out.log" -RedirectStandardError "electron-err.log"
Write-Output ("PID: " + $proc.Id)

# Wait for window to load, then retry finding it
$hwnd = [IntPtr]::Zero
# Title keyword: "录屏管家" = 0x5f55 0x5c4f 0x7ba1 0x5bb6
$titleKeyword = [char]0x5f55 + [char]0x5c4f + [char]0x7ba1 + [char]0x5bb6
for ($i = 0; $i -lt 15; $i++) {
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
Start-Sleep -Seconds 6

try {
  [WinShot]::Capture($hwnd, $outPath)
  $size = (Get-Item $outPath).Length
  Write-Output ("SAVED: " + $outPath + " (" + $size + " bytes)")
} catch {
  Write-Output ("CAPTURE ERROR: " + $_.Exception.Message)
  # Retry once after a longer wait
  Start-Sleep -Seconds 3
  try {
    [WinShot]::Capture($hwnd, $outPath)
    $size = (Get-Item $outPath).Length
    Write-Output ("SAVED on retry: " + $outPath + " (" + $size + " bytes)")
  } catch {
    Write-Output ("CAPTURE RETRY ERROR: " + $_.Exception.Message)
  }
} finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $demoFile -Force -ErrorAction SilentlyContinue
}
