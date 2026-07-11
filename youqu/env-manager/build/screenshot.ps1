# screenshot.ps1 - 后台启动 Electron 并用 PrintWindow 截取窗口（不打扰用户）
# 注意：本脚本刻意不含任何中文字符串字面量，避免 PS5.x ANSI 读取导致乱码
$ErrorActionPreference = 'Stop'

$projectRoot = 'D:\Ai\mimo\youqu\env-manager'
$shotDir = 'D:\Ai\mimo\screenshots'
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Force -Path $shotDir | Out-Null }
$shotPath = Join-Path $shotDir ('env-manager-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.png')

# 1. start electron (hidden cmd wrapper)
Write-Output '[1] starting electron (hidden)...'
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c npx electron . --no-sandbox" -PassThru -WindowStyle Hidden -WorkingDirectory $projectRoot
$cmdPid = $proc.Id
Write-Output ('    cmd pid=' + $cmdPid)

# 2. wait for window to load
Write-Output '[2] waiting for window to load...'
Start-Sleep -Seconds 6

# 3. PrintWindow background capture
Add-Type -Namespace WinShot -Name Native -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool PrintWindow(System.IntPtr hwnd, System.IntPtr hdcBlt, int nFlags);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool GetWindowRect(System.IntPtr hwnd, out RECT lpRect);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, System.IntPtr lParam);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern uint GetWindowThreadProcessId(System.IntPtr hWnd, out uint lpdwProcessId);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern bool IsWindowVisible(System.IntPtr hWnd);
[System.Runtime.InteropServices.DllImport("user32.dll")]
public static extern System.IntPtr GetShellWindow();
public delegate bool EnumWindowsProc(System.IntPtr hWnd, System.IntPtr lParam);
[StructLayout(LayoutKind.Sequential)]
public struct RECT { public int Left, Top, Right, Bottom; }
"@

Add-Type -AssemblyName System.Drawing

# collect PIDs of all electron.exe processes (match by process name, no Chinese)
$electronPids = @(Get-Process -Name electron -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
Write-Output ('    electron pids: ' + ($electronPids -join ','))

$foundHwnd = [IntPtr]::Zero
$enumProc = [WinShot.Native+EnumWindowsProc]{
    param($hWnd, $lParam)
    if (-not [WinShot.Native]::IsWindowVisible($hWnd)) { return $true }
    if ($hWnd -eq [WinShot.Native]::GetShellWindow()) { return $true }
    $procId = 0
    [void][WinShot.Native]::GetWindowThreadProcessId($hWnd, [ref]$procId)
    foreach ($ep in $script:electronPids) {
        if ($procId -eq $ep) {
            $script:foundHwnd = $hWnd
            return $false
        }
    }
    return $true
}

Write-Output '[3] enumerating windows by electron pid (retry up to 15s)...'
for ($i = 0; $i -lt 10; $i++) {
    $foundHwnd = [IntPtr]::Zero
    $electronPids = @(Get-Process -Name electron -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    [void][WinShot.Native]::EnumWindows($enumProc, [IntPtr]::Zero)
    if ($foundHwnd -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 1500
    Write-Output ('    retry ' + ($i + 1) + '... pids: ' + ($electronPids -join ','))
}

if ($foundHwnd -eq [IntPtr]::Zero) {
    Write-Output 'ERROR: no visible window found'
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*env-manager*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $cmdPid -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Output ('    found hwnd=' + $foundHwnd)

$rect = New-Object WinShot.Native+RECT
[void][WinShot.Native]::GetWindowRect($foundHwnd, [ref]$rect)
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
Write-Output ('    window rect: ' + $rect.Left + ',' + $rect.Top + ' ' + $w + 'x' + $h)

if ($w -le 0 -or $h -le 0) {
    Write-Output 'ERROR: invalid window rect'
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*env-manager*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $cmdPid -Force -ErrorAction SilentlyContinue
    exit 1
}

# capture
$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
# PrintWindow flag 2 = PW_RENDERFULLCONTENT (Chromium content)
$ok = [WinShot.Native]::PrintWindow($foundHwnd, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()

if (-not $ok) {
    Write-Output 'ERROR: PrintWindow returned false'
    $bmp.Dispose()
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*env-manager*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $cmdPid -Force -ErrorAction SilentlyContinue
    exit 1
}

$bmp.Save($shotPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output ('[4] screenshot saved: ' + $shotPath)
Write-Output ('    size: ' + (Get-Item $shotPath).Length + ' bytes')

# 4. stop electron (kill whole tree)
Write-Output '[5] stopping electron...'
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*env-manager*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Stop-Process -Id $cmdPid -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Write-Output 'DONE'
