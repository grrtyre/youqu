# API Manager screenshot via Electron capturePage (high quality, no foreground disturbance)
# Pure ASCII script (PowerShell 5.x reads .ps1 as ANSI/GBK)
$ErrorActionPreference = "Stop"
$projectDir = "d:\Ai\mimo\youqu\api-manager"
$shotDir = "d:\Ai\mimo\screenshots"
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir | Out-Null }
$shotPath = Join-Path $shotDir "api-manager.png"
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"

# Clear userData data file so defaultData() with rich samples takes effect
$dataDir = Join-Path $env:APPDATA "api-manager\data"
if (Test-Path $dataDir) {
    Remove-Item -Path $dataDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleared old userData data dir"
}

# Remove old screenshot
Remove-Item $shotPath -ErrorAction SilentlyContinue

# Set screenshot mode env var
$env:AM_SHOT = "1"

Write-Host "Starting Electron (capturePage mode)..."
$proc = Start-Process -FilePath $electronExe -ArgumentList ".","--no-sandbox" -PassThru -WorkingDirectory $projectDir
$rootPid = $proc.Id
Write-Host "Electron root PID: $rootPid"

# Wait for screenshot file to appear (up to 25s)
$captured = $false
for ($w = 0; $w -lt 50; $w++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $shotPath) {
        $captured = $true
        Write-Host "Screenshot file detected"
        break
    }
    # Check if process exited
    try { $p = Get-Process -Id $rootPid -ErrorAction Stop } catch { break }
}

# Cleanup env
Remove-Item Env:\AM_SHOT -ErrorAction SilentlyContinue

# Force kill electron if still running
try { Stop-Process -Id $rootPid -Force -ErrorAction SilentlyContinue } catch {}
try {
    Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {}

if (-not $captured -or -not (Test-Path $shotPath)) {
    Write-Host "ERROR: screenshot was not captured"
    exit 2
}
$size = (Get-Item $shotPath).Length
Write-Host "DONE: $shotPath ($size bytes)"
