# Regex Manager background screenshot script
# Uses PrintWindow API to capture Electron window without bringing it to foreground
# Pure ASCII to avoid PS5 ANSI encoding issues

$screenshotDir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $screenshotDir)) {
  New-Item -ItemType Directory -Path $screenshotDir -Force | Out-Null
}
$outPath = Join-Path $screenshotDir "regex-manager-v1.0.png"

# Win32 API via Add-Type
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
}
"@

Add-Type -AssemblyName System.Drawing

# Start Electron in hidden mode
$electronExe = "d:\Ai\mimo\youqu\regex-manager\node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  Write-Host "ERROR: electron.exe not found at $electronExe"
  exit 1
}
$proc = Start-Process -FilePath $electronExe -ArgumentList @("d:\Ai\mimo\youqu\regex-manager", "--no-sandbox") -PassThru
Write-Host "Started Electron PID: $($proc.Id)"

# Wait for window to load
Start-Sleep -Seconds 8
Write-Host "Process still running: $(-not $proc.HasExited)"

# Find Electron window handle by process ID (include child processes)
$electronPids = @([uint32]$proc.Id)
Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id } | ForEach-Object {
  $electronPids += [uint32]$_.ProcessId
}
Write-Host "All Electron PIDs: $($electronPids -join ', ')"

$script:foundHwnd = [IntPtr]::Zero
$script:targetPids = $electronPids

$callback = [WinAPI+EnumWindowsProc]{
  param($hWnd, $lParam)
  $procId = [uint32]0
  [WinAPI]::GetWindowThreadProcessId($hWnd, [ref]$procId) | Out-Null
  if ($script:targetPids -contains $procId) {
    $visible = [WinAPI]::IsWindowVisible($hWnd)
    Write-Host "  Window $hWnd PID=$procId visible=$visible"
    if ($visible -and $script:foundHwnd -eq [IntPtr]::Zero) {
      $script:foundHwnd = $hWnd
      Write-Host "  SELECTED window handle: $hWnd"
    }
  }
  return $true
}

[WinAPI]::EnumWindows($callback, [IntPtr]::Zero)

if ($script:foundHwnd -eq [IntPtr]::Zero) {
  Write-Host "ERROR: No visible window found for Electron PIDs"
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

# Get window rect
$rect = New-Object WinAPI+RECT
[WinAPI]::GetWindowRect($foundHwnd, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
Write-Host "Window rect: L=$($rect.Left) T=$($rect.Top) W=$width H=$height"

if ($width -le 0 -or $height -le 0) {
  Write-Host "ERROR: Invalid window dimensions"
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

# Capture via PrintWindow (flag 2 = PW_RENDERFULLCONTENT for Chromium)
$bmp = New-Object System.Drawing.Bitmap $width, $height
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $gfx.GetHdc()
$result = [WinAPI]::PrintWindow($foundHwnd, $hdc, 2)
$gfx.ReleaseHdc($hdc)
$gfx.Dispose()

if ($result) {
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "SUCCESS: Screenshot saved to $outPath"
} else {
  Write-Host "ERROR: PrintWindow returned false"
}

$bmp.Dispose()

# Cleanup: kill Electron and any child processes
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "Electron process terminated"
