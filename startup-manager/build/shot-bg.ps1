#requires -version 5.1
# startup-manager background screenshot (PrintWindow, no focus stealing)
param([string]$Out = "D:\Ai\mimo\screenshots\startup-manager.png")

$ErrorActionPreference = 'Stop'
$proj = 'D:\Ai\mimo\youqu\startup-manager'

$outDir = Split-Path $Out -Parent
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# Record existing electron PIDs to avoid capturing unrelated windows
$before = @(Get-Process -Name "electron" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
$beforeSet = @{}
foreach ($p in $before) { $beforeSet[$p] = $true }

Write-Host "Starting Electron..."
$elExe = Join-Path $proj "node_modules\electron\dist\electron.exe"
if (!(Test-Path $elExe)) { throw "electron.exe not found at $elExe" }
$proc = Start-Process -FilePath $elExe -ArgumentList ".","--no-sandbox" -PassThru -WindowStyle Hidden -WorkingDirectory $proj

try {
    Write-Host "Waiting for window (8s)..."
    Start-Sleep -Seconds 8

    Add-Type -AssemblyName System.Drawing
    Add-Type -Name 'Win32Shot' -Namespace 'StartupMgr' -PassThru -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool IsWindowVisible(IntPtr hWnd);
public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
[StructLayout(LayoutKind.Sequential)]
public struct RECT { public int Left, Top, Right, Bottom; }
"@

    # Get NEW electron process IDs (launched by us)
    $after = @(Get-Process -Name "electron" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    $newPids = @{}
    foreach ($p in $after) { if (-not $beforeSet.ContainsKey($p)) { $newPids[$p] = $true } }
    Write-Host ("New electron PIDs: " + ($newPids.Keys -join ','))

    $script:foundHwnd = [IntPtr]::Zero
    $cb = [StartupMgr.Win32Shot+EnumWindowsProc]{
        param($hWnd, $lParam)
        $epid = 0
        [void][StartupMgr.Win32Shot]::GetWindowThreadProcessId($hWnd, [ref]$epid)
        if ($script:newPids.ContainsKey([int]$epid)) {
            $visible = [StartupMgr.Win32Shot]::IsWindowVisible($hWnd)
            $r = New-Object StartupMgr.Win32Shot+RECT
            [void][StartupMgr.Win32Shot]::GetWindowRect($hWnd, [ref]$r)
            $w = $r.Right - $r.Left
            $h = $r.Bottom - $r.Top
            if ($visible -and $w -gt 400 -and $h -gt 400) {
                $script:foundHwnd = $hWnd
            }
        }
        return $true
    }
    [void][StartupMgr.Win32Shot]::EnumWindows($cb, [IntPtr]::Zero)

    if ($script:foundHwnd -eq [IntPtr]::Zero) {
        Write-Host "Window not found, retry (4s)..."
        Start-Sleep -Seconds 4
        $after2 = @(Get-Process -Name "electron" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
        foreach ($p in $after2) { if (-not $beforeSet.ContainsKey($p)) { $newPids[$p] = $true } }
        [void][StartupMgr.Win32Shot]::EnumWindows($cb, [IntPtr]::Zero)
    }

    if ($script:foundHwnd -eq [IntPtr]::Zero) {
        throw "Electron window handle not found"
    }

    $rect = New-Object StartupMgr.Win32Shot+RECT
    [void][StartupMgr.Win32Shot]::GetWindowRect($script:foundHwnd, [ref]$rect)
    $w = $rect.Right - $rect.Left
    $h = $rect.Bottom - $rect.Top
    Write-Host "Window size: ${w}x${h}"

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $g.GetHdc()
    $ok = [StartupMgr.Win32Shot]::PrintWindow($script:foundHwnd, $hdc, 2)
    $g.ReleaseHdc($hdc)
    $g.Dispose()

    if ($ok) {
        $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Screenshot saved: $Out"
    } else {
        Write-Host "PrintWindow returned false"
    }
    $bmp.Dispose()
} finally {
    Write-Host "Closing Electron..."
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    try { Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
}

Write-Host "Done"
