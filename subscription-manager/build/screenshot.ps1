# screenshot.ps1 - Background screenshot via Electron capturePage (no window shown)
$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$screenshotDir = 'D:\Ai\mimo\screenshots'
if (!(Test-Path $screenshotDir)) { New-Item -ItemType Directory -Path $screenshotDir -Force | Out-Null }
$screenshotPath = Join-Path $screenshotDir 'subscription-manager.png'

# Remove old screenshot
if (Test-Path $screenshotPath) { Remove-Item $screenshotPath -Force }

# Set screenshot path env var and start Electron
$env:SUB_MGR_SCREENSHOT = $screenshotPath
$electron = Join-Path $projectDir 'node_modules\electron\dist\electron.exe'

Write-Host 'Starting Electron (background mode)...'
$proc = Start-Process -FilePath $electron -ArgumentList "." -PassThru -WindowStyle Hidden -WorkingDirectory $projectDir -RedirectStandardOutput "$projectDir\electron-out.log" -RedirectStandardError "$projectDir\electron-err.log"

# Wait up to 20s for screenshot to appear
$waited = 0
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  $waited += 0.5
  if (Test-Path $screenshotPath) { break }
  if ($proc.HasExited) { break }
}
Write-Host "Waited ${waited}s"

# Kill process
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

if (Test-Path $screenshotPath) {
  $size = (Get-Item $screenshotPath).Length
  Write-Host "SUCCESS: $screenshotPath ($size bytes)"
} else {
  Write-Host "FAILED: screenshot not generated"
  Write-Host "stdout:"
  Get-Content "$projectDir\electron-out.log" -ErrorAction SilentlyContinue
  Write-Host "stderr:"
  Get-Content "$projectDir\electron-err.log" -ErrorAction SilentlyContinue
}
