# screenshot.ps1 v4 - Use Get-Process MainWindowHandle instead of FindWindow
# NOTE: PyInstaller --onefile --noconsole with PySide6 (~180MB) takes ~60s to extract on first run.
#       -NoNewWindow is required for --noconsole exe to work properly.
#       MainWindowHandle returns the panel window for the child process (not parent bootloader).
param(
  [string]$OutPath = (Join-Path $PSScriptRoot 'screenshot.png'),
  [int]$WaitMs = 90000
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$src  = Join-Path $here '..\src'
$mainPy = Join-Path $src 'main.py'

Add-Type -Namespace Win32 -Name Native -MemberDefinition @"
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")]
  public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
"@

$env:WORLD_CLOCK_SCREENSHOT = '1'
$exe = Join-Path $here 'dist\WorldClock-Portable.exe'
if (-not (Test-Path $exe)) {
  $exe = Join-Path $here 'dist\WorldClock-Portable\WorldClock-Portable.exe'
}
if (Test-Path $exe) {
  # CRITICAL: -NoNewWindow is required for --noconsole PyInstaller exe to work properly.
  # Default Start-Process creates a new console window that interferes with Qt window creation.
  $proc = Start-Process -FilePath $exe -PassThru -NoNewWindow
  Write-Host "==> Started exe, PID=$($proc.Id)"
} else {
  $pythonw = 'D:\python\pythonw.exe'
  $proc = Start-Process -FilePath $pythonw -ArgumentList @($mainPy) -PassThru
  Write-Host "==> Started main.py (dev), PID=$($proc.Id)"
}

$exitCode = 0
try {
  $hwnd = [IntPtr]::Zero
  $deadline = (Get-Date).AddMilliseconds($WaitMs)
  Write-Host "==> Searching for panel window via MainWindowHandle..."
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 1000
    # PyInstaller --onefile spawns a child process; the child holds the panel window.
    # Iterate all WorldClock-Portable processes and find one with a non-zero MainWindowHandle.
    $procs = Get-Process -Name 'WorldClock-Portable' -ErrorAction SilentlyContinue
    if ($procs) {
      foreach ($p in $procs) {
        if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
          $hwnd = $p.MainWindowHandle
          Write-Host "==> Found panel: hwnd=$hwnd PID=$($p.Id) Title='$($p.MainWindowTitle)'"
          break
        }
      }
    }
    if ($hwnd -ne [IntPtr]::Zero) {
      break
    }
    if ($proc.HasExited) {
      Write-Host "==> Process exited, code=$($proc.ExitCode)" -ForegroundColor Red
      $exitCode = 1
      break
    }
  }

  if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "==> Panel not found in ${WaitMs}ms" -ForegroundColor Red
    $exitCode = 1
  } else {
    Start-Sleep -Milliseconds 1500
    $rect = New-Object Win32.Native+RECT
    [void][Win32.Native]::GetWindowRect($hwnd, [ref]$rect)
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top
    Write-Host "==> Panel: ${w}x${h} at ($($rect.Left),$($rect.Top))"

    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    [void][Win32.Native]::PrintWindow($hwnd, $hdc, 2)
    $g.ReleaseHdc($hdc)
    $g.Dispose()

    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path $dir)) { [void][System.IO.Directory]::CreateDirectory($dir) }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "==> Screenshot saved: $OutPath"
  }
}
finally {
  if ($proc -and -not $proc.HasExited) {
    # CRITICAL: PyInstaller --onefile spawns a child process that holds the mutex.
    # Stop-Process -Id only kills the parent; must use taskkill /T to kill the whole tree.
    Write-Host "==> taskkill /T /F /PID $($proc.Id)"
    & taskkill /T /F /PID $proc.Id 2>$null | Out-Null
    Start-Sleep -Milliseconds 300
    # Also kill any orphaned children by name
    Get-Process -Name 'WorldClock-Portable' -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Host "==> Killing orphaned child PID=$($_.Id)"
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "==> Killed PID=$($proc.Id) and children"
  }
}
exit $exitCode
