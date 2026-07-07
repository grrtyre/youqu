# Screenshot script: capture only the electron app window (exclude IDE background)
Add-Type -AssemblyName System.Drawing,System.Windows.Forms

$code = @"
using System;
using System.Runtime.InteropServices;
public class WinApi {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
Add-Type -TypeDefinition $code -Language CSharp

# Find electron process with a main window handle
$procs = Get-Process -Name electron -ErrorAction SilentlyContinue
$target = $null
if ($procs) {
  foreach ($p in $procs) {
    if ($p.MainWindowHandle -ne [IntPtr]::Zero) { $target = $p; break }
  }
}

if ($null -eq $target) {
  Write-Output "no electron window handle found"
  exit 1
}

Write-Output ("target pid=" + $target.Id + " handle=" + $target.MainWindowHandle)
[WinApi]::ShowWindow($target.MainWindowHandle, 9) | Out-Null
Start-Sleep -Milliseconds 500
[WinApi]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 1000

$r = New-Object WinApi+RECT
[WinApi]::GetWindowRect($target.MainWindowHandle, [ref]$r) | Out-Null
$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top
Write-Output ("rect: left=" + $r.Left + " top=" + $r.Top + " w=" + $w + " h=" + $h)

if ($w -gt 0 -and $h -gt 0) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
  $path = 'D:\Ai\mimo\screenshots\countdown-ui.png'
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output ("saved " + $path)
} else {
  Write-Output "invalid window rect"
}
