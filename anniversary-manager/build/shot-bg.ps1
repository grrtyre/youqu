# Background screenshot script using Electron capturePage (no foreground interruption)
# Window is hidden (show:false), capturePage captures rendered content in background
# This is NOT CopyFromScreen - it is Electron's native internal rendering capture

$ErrorActionPreference = 'Stop'
$projectDir = 'D:\Ai\mimo\youqu\anniversary-manager'
$outPath = 'D:\Ai\mimo\screenshots\anniversary-manager-v1.1.0.png'

# Remove old screenshot if exists
if (Test-Path $outPath) { Remove-Item $outPath -Force }

# Kill any existing electron processes for this project to avoid single-instance lock
Get-Process -Name electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*anniversary-manager*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

# Start Electron with screenshot mode
# AM_AUTO_SCREENSHOT=filepath triggers capturePage in main.js (window hidden via show:false)
$env:AM_DEMO = '1'
$env:AM_AUTO_SCREENSHOT = $outPath
$env:ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
$electronExe = Join-Path $projectDir 'node_modules\electron\dist\electron.exe'
$proc = Start-Process -FilePath $electronExe -ArgumentList ". --no-sandbox" -PassThru -WorkingDirectory $projectDir
Write-Host "[shot] started electron pid=$($proc.Id)"

# Wait for screenshot file to be created (capturePage takes ~4s after page load)
$maxWait = 20
$waited = 0
while ($waited -lt $maxWait -and -not (Test-Path $outPath)) {
    Start-Sleep -Seconds 1
    $waited++
    # Check if process died
    $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if (-not $alive) {
        Write-Host "[shot] ERROR: electron process exited before screenshot was taken"
        exit 1
    }
}
Write-Host "[shot] waited ${waited}s"

# Kill all electron processes immediately
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (Test-Path $outPath) {
    $size = (Get-Item $outPath).Length
    Write-Host "[shot] saved: $outPath ($size bytes)"
} else {
    Write-Host "[shot] ERROR: screenshot file not created after ${maxWait}s"
    exit 1
}
