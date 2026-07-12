# calculator-manager background screenshot script (no window shown)
# Uses PrintWindow API to capture off-screen Electron window
# Output: D:\Ai\mimo\screenshots\calculator-manager.png

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectDir = "D:\Ai\mimo\youqu\calculator-manager"
$shotDir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir -Force | Out-Null }
$shotPath = Join-Path $shotDir "calculator-manager.png"
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"
$demoDir = Join-Path $projectDir "build\demo-data"

Write-Host "[1/7] Preparing demo data..."
if (Test-Path $demoDir) { Remove-Item $demoDir -Recurse -Force }
New-Item -ItemType Directory -Path $demoDir -Force | Out-Null

# Demo history (UTF-8 bytes to avoid GBK corruption)
$historyJson = '[{"id":"d1","expr":"sin(pi/4)^2 + cos(pi/4)^2","result":"1","mode":"scientific","createdAt":1752318000000},{"id":"d2","expr":"2^10","result":"1,024","mode":"scientific","createdAt":1752318060000},{"id":"d3","expr":"5!","result":"120","mode":"scientific","createdAt":1752318120000},{"id":"d4","expr":"log(1000)","result":"3","mode":"scientific","createdAt":1752318180000},{"id":"d5","expr":"0xFF and 0x0F","result":"15","mode":"programmer","createdAt":1752318240000}]'
$historyBytes = [System.Text.Encoding]::UTF8.GetBytes($historyJson)
[System.IO.File]::WriteAllBytes((Join-Path $demoDir "history.json"), $historyBytes)

# Demo variables
$varsJson = '{"x":10,"r":3.5,"n":255}'
$varsBytes = [System.Text.Encoding]::UTF8.GetBytes($varsJson)
[System.IO.File]::WriteAllBytes((Join-Path $demoDir "variables.json"), $varsBytes)

Write-Host "[2/7] Launching Electron (off-screen, non-focusable)..."
$proc = Start-Process -FilePath $electronExe -ArgumentList ".","--no-sandbox","--screenshot=$shotPath" -PassThru -WindowStyle Hidden -WorkingDirectory $projectDir

Write-Host "[3/7] Waiting 8s for window to render..."
Start-Sleep -Seconds 8

Write-Host "[4/7] Loading Win32 API..."
Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @"
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
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool IsWindow(IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern int GetWindowTextLength(IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
[System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
"@ -ReferencedAssemblies System.Drawing

Add-Type -AssemblyName System.Drawing

$targetPid = [uint32]$proc.Id
$script:foundHwnd = [IntPtr]::Zero
$script:candidates = @()

# Expected main window size from main.js (960x680)
$expectedW = 960
$expectedH = 680
$expectedArea = $expectedW * $expectedH

# Match by PID and pick the window closest to expected size
$callback = [Win32.NativeMethods+EnumWindowsProc]{
    param($hWnd, $lParam)
    $p = [uint32]0
    [Win32.NativeMethods]::GetWindowThreadProcessId($hWnd, [ref]$p) | Out-Null
    if ($p -eq $script:targetPid) {
        $rect2 = New-Object Win32.NativeMethods+RECT
        $ok = [Win32.NativeMethods]::GetWindowRect($hWnd, [ref]$rect2)
        $w2 = $rect2.Right - $rect2.Left
        $h2 = $rect2.Bottom - $rect2.Top
        # Pick window with size closest to expected (must be > 100x100)
        if ($w2 -gt 100 -and $h2 -gt 100) {
            $area = $w2 * $h2
            $diff = [Math]::Abs($area - $script:expectedArea)
            if ($script:foundHwnd -eq [IntPtr]::Zero -or $diff -lt $script:bestDiff) {
                $script:foundHwnd = $hWnd
                $script:bestDiff = $diff
            }
        }
    }
    return $true
}
$script:targetPid = $targetPid
$script:expectedArea = $expectedArea
$script:bestDiff = [long]::MaxValue
[Win32.NativeMethods]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null

if ($script:foundHwnd -eq [IntPtr]::Zero) {
    Write-Host "FAILED: No Electron window found"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Get-Process -Name "electron" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*calculator-manager*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ("[5/7] Found window hwnd=" + $script:foundHwnd)

$rect = New-Object Win32.NativeMethods+RECT
[Win32.NativeMethods]::GetWindowRect($script:foundHwnd, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Host ("  Window size: " + $w + "x" + $h)

if ($w -le 0 -or $h -le 0) {
    Write-Host "FAILED: invalid window size"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "[6/7] Capturing with PrintWindow (flag=2 PW_RENDERFULLCONTENT)..."
$bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $graphics.GetHdc()
$success = [Win32.NativeMethods]::PrintWindow($script:foundHwnd, $hdc, 2)
$graphics.ReleaseHdc($hdc)
$graphics.Dispose()

if (-not $success) {
    Write-Host "  PrintWindow flag=2 returned false, retrying with flag=3..."
    $graphics3 = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc3 = $graphics3.GetHdc()
    $success = [Win32.NativeMethods]::PrintWindow($script:foundHwnd, $hdc3, 3)
    $graphics3.ReleaseHdc($hdc3)
    $graphics3.Dispose()
}

if ($success) {
    $bmp.Save($shotPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "[7/7] Screenshot saved successfully"
    Write-Host ("  Path: " + $shotPath)
    Write-Host ("  Size: " + (Get-Item $shotPath).Length + " bytes")
} else {
    Write-Host "FAILED: All PrintWindow attempts failed"
}

$bmp.Dispose()

Write-Host "Closing Electron..."
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*calculator-manager*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

# Clean up demo data
if (Test-Path $demoDir) { Remove-Item $demoDir -Recurse -Force }
Write-Host "Done"
