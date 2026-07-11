# Background screenshot script using PrintWindow API
# Pure ASCII to avoid PowerShell 5.x ANSI encoding issues
# Uses Get-Process MainWindowHandle to find the Electron window

$ErrorActionPreference = 'Stop'

$shotDir = 'D:\Ai\mimo\screenshots'
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir -Force | Out-Null }
$shotPath = Join-Path $shotDir 'network-manager.png'

# Start Electron in demo mode
$env:NM_DEMO = '1'
$electronExe = Join-Path $PWD 'node_modules\electron\dist\electron.exe'
$proc = Start-Process -FilePath $electronExe -ArgumentList ". --no-sandbox" -PassThru
$epid = $proc.Id
Write-Host "Started Electron PID: $epid"

# Wait for window to load
Start-Sleep -Seconds 5

# Find the Electron main window handle via Get-Process
$electronProcs = Get-Process -Name electron -ErrorAction SilentlyContinue
$foundHwnd = [IntPtr]::Zero
foreach ($p in $electronProcs) {
  if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
    $foundHwnd = $p.MainWindowHandle
    Write-Host "Found window: PID=$($p.Id) Handle=$foundHwnd Title=$($p.MainWindowTitle)"
    break
  }
}

if ($foundHwnd -eq [IntPtr]::Zero) {
  Write-Host "ERROR: No Electron window found"
  Write-Host "Electron processes:"
  foreach ($p in $electronProcs) {
    Write-Host "  PID=$($p.Id) MainWindowHandle=$($p.MainWindowHandle) Title='$($p.MainWindowTitle)'"
  }
  Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
  exit 1
}

# Load Windows API
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI2 {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

# Get window rect
$rect = New-Object WinAPI2+RECT
[WinAPI2]::GetWindowRect($foundHwnd, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
Write-Host "Window size: ${width}x${height}"

if ($width -le 0 -or $height -le 0) {
  Write-Host "ERROR: Invalid window size"
  Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
  exit 1
}

# Capture with PrintWindow (flag 2 = PW_RENDERFULLCONTENT)
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $gfx.GetHdc()
$result = [WinAPI2]::PrintWindow($foundHwnd, $hdc, 2)
$gfx.ReleaseHdc($hdc)
$gfx.Dispose()

if ($result) {
  $bmp.Save($shotPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Screenshot saved: $shotPath"
} else {
  Write-Host "ERROR: PrintWindow returned false"
}

$bmp.Dispose()

# Kill Electron
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Electron processes killed"
