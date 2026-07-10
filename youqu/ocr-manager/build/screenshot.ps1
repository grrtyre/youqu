# build/screenshot.ps1 - capture 识字管家 window to D:\Ai\mimo\screenshots\
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int n);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
}
"@

$procs = Get-Process -Name "electron" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" -and $_.MainWindowHandle -ne 0 }
if (-not $procs) { $procs = Get-Process | Where-Object { $_.MainWindowTitle -like "*识字*" -and $_.MainWindowHandle -ne 0 } }
if (-not $procs) { Write-Host "ERROR: window not found"; exit 1 }
if (@($procs).Count -eq 1) { $procs = @($procs) }

# 取窗口面积最大的那个
$best = $null; $bestArea = 0
foreach ($pr in $procs) {
  $r = New-Object WinApi+RECT
  [WinApi]::GetWindowRect($pr.MainWindowHandle, [ref]$r) | Out-Null
  $area = ($r.Right - $r.Left) * ($r.Bottom - $r.Top)
  if ($area -gt $bestArea) { $bestArea = $area; $best = $pr; $bestRect = $r }
}
$proc = $best
$h = $proc.MainWindowHandle
[WinApi]::ShowWindowAsync($h, 9) | Out-Null
[WinApi]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 700

$rect = New-Object WinApi+RECT
[WinApi]::GetWindowRect($h, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$ht = $rect.Bottom - $rect.Top
Write-Host "window title='$($proc.MainWindowTitle)' rect=$w x $ht"
if ($w -le 200 -or $ht -le 200) { Write-Host "ERROR: bad rect $w x $ht"; exit 1 }

$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $ht)))
New-Item -ItemType Directory -Force -Path "D:\Ai\mimo\screenshots" | Out-Null
$out = "D:\Ai\mimo\screenshots\ocr-manager.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "SAVED $out ($w x $ht)"
