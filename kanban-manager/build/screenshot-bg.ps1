# Kanban Manager - Background Screenshot Script (PrintWindow API)
# Does not disturb user: no foreground, no topmost, kill process after capture
# Only kills electron processes started by THIS script (PID diff), never user browser

param(
    [string]$AppDir = 'D:\Ai\mimo\youqu\kanban-manager',
    [string]$OutPath = 'D:\Ai\mimo\youqu\kanban-manager\docs\screenshot.png',
    [int]$WaitMs = 30000
)

$ErrorActionPreference = 'Stop'

# ---- Cleanup function: define before use ----
function Invoke-Cleanup($excludeIds) {
    Write-Host "Killing electron processes started by this script..."
    $currentElectron = @(Get-Process -Name electron -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    foreach ($eid in $currentElectron) {
        if ($excludeIds -notcontains $eid) {
            try { Stop-Process -Id $eid -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
    Get-Process | Where-Object { $_.ProcessName -eq 'cmd' -and $_.StartTime -gt (Get-Date).AddMinutes(-2) } | ForEach-Object {
        try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
}

# ---- Load Win32 API ----
$sig = @'
[DllImport("user32.dll")]
public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
[DllImport("user32.dll")]
public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
[DllImport("user32.dll")]
public static extern bool MoveWindow(IntPtr hwnd, int x, int y, int w, int h, bool repaint);
[DllImport("user32.dll")]
public static extern IntPtr GetTopWindow(IntPtr hwnd);
[DllImport("user32.dll")]
public static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
[DllImport("user32.dll")]
public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint lpdwProcessId);
[DllImport("user32.dll")]
public static extern bool IsWindowVisible(IntPtr hwnd);
[DllImport("user32.dll")]
public static extern int GetWindowText(IntPtr hwnd, System.Text.StringBuilder text, int count);
public struct RECT { public int Left, Top, Right, Bottom; }
'@
Add-Type -MemberDefinition $sig -Namespace Win32 -Name Util -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Drawing

# ---- Create docs dir ----
$outDir = Split-Path $OutPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# ---- Record existing electron PIDs before launch ----
$beforeElectronIds = @(Get-Process -Name electron -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)

# ---- Launch Electron (use electron.cmd directly, no npx delay) ----
Write-Host "Launching Electron..."
$electronExe = Join-Path $AppDir 'node_modules\.bin\electron.cmd'
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $electronExe
$psi.Arguments = '. --no-sandbox'
$psi.WorkingDirectory = $AppDir
$psi.UseShellExecute = $false
$psi.WindowStyle = 'Hidden'
$proc = [System.Diagnostics.Process]::Start($psi)
Write-Host ("electron parent PID: " + $proc.Id)

# Wait and find window
$startTs = Get-Date
$targetHwnd = [IntPtr]::Zero
$targetPid = 0
Write-Host "Waiting for window..."
while (((Get-Date) - $startTs).TotalMilliseconds -lt $WaitMs) {
    Start-Sleep -Milliseconds 800
    $hwnd = [Win32.Util]::GetTopWindow([IntPtr]::Zero)
    while ($hwnd -ne [IntPtr]::Zero) {
        $pid2 = 0
        [void][Win32.Util]::GetWindowThreadProcessId($hwnd, [ref]$pid2)
        $visible = [Win32.Util]::IsWindowVisible($hwnd)
        # Match new electron process (not in before list)
        if ($visible -and $beforeElectronIds -notcontains $pid2 -and $pid2 -ne 0) {
            $isElectron = $false
            try {
                $p = Get-Process -Id $pid2 -ErrorAction Stop
                if ($p.ProcessName -eq 'electron') { $isElectron = $true }
            } catch {}
            if ($isElectron) {
                $targetHwnd = $hwnd
                $targetPid = $pid2
                break
            }
        }
        $hwnd = [Win32.Util]::GetWindow($hwnd, 2)
    }
    if ($targetHwnd -ne [IntPtr]::Zero) { break }
}

if ($targetHwnd -eq [IntPtr]::Zero) {
    Write-Error "Electron window not found"
    Invoke-Cleanup $beforeElectronIds
    exit 1
}
Write-Host ("Found window hwnd: " + $targetHwnd + " PID: " + $targetPid)

# Move offscreen, resize
[void][Win32.Util]::MoveWindow($targetHwnd, -2000, -2000, 1280, 820, $true)
Start-Sleep -Milliseconds 2500

# Capture
$rect = New-Object Win32.Util+RECT
[void][Win32.Util]::GetWindowRect($targetHwnd, [ref]$rect)
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
if ($w -le 0 -or $h -le 0) { $w = 1280; $h = 820 }
Write-Host ("Window size: ${w}x${h}")

$bmp = New-Object System.Drawing.Bitmap $w, $h
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $gfx.GetHdc()
$ok = [Win32.Util]::PrintWindow($targetHwnd, $hdc, 2)
$gfx.ReleaseHdc($hdc)
$gfx.Dispose()

if ($ok) {
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host ("Screenshot saved: " + $OutPath)
} else {
    Write-Error "PrintWindow failed"
}
$bmp.Dispose()

# ---- Cleanup ----
Invoke-Cleanup $beforeElectronIds

Write-Host "DONE"
