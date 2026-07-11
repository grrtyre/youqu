# Time-tracker v1.1 background screenshot
# Uses Electron's built-in capturePage() via TT_AUTO_SCREENSHOT env:
#   - app injects demo records + starts an active timer on ready
#   - after did-finish-load + render delay, app calls webContents.capturePage()
#     and writes PNG to the path in TT_AUTO_SCREENSHOT
# capturePage() is Electron's INTERNAL background capture (NOT CopyFromScreen):
#   it captures rendered web contents directly, does NOT steal focus, does NOT
#   bring the window to foreground. Satisfies "do not disturb the user".
# Pure ASCII script (PowerShell 5.x reads .ps1 as ANSI/GBK).

$ErrorActionPreference = 'Stop'

$shotDir = 'D:\Ai\mimo\screenshots'
if (-not (Test-Path $shotDir)) { New-Item -ItemType Directory -Path $shotDir -Force | Out-Null }
$shotPath = Join-Path $shotDir 'time-tracker-v1.1.png'
$dummy = Join-Path $shotDir 'tt-throwaway.png'

# Clean stale electron processes from previous runs (safe: no other app uses
# process name 'electron.exe'; VS Code etc use different process names).
Write-Host '[shot] cleaning stale electron.exe processes...'
Get-Process electron -ErrorAction SilentlyContinue | ForEach-Object {
  try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {}
}
Start-Sleep -Milliseconds 800

# Point TT_AUTO_SCREENSHOT to the REAL screenshot path so the app's own
# capturePage writes the final image there.
$env:TT_AUTO_SCREENSHOT = $shotPath
if (Test-Path $shotPath) { Remove-Item $shotPath -Force }

Write-Host '[shot] starting electron hidden...'
$proc = Start-Process -FilePath 'cmd' -ArgumentList '/c npx electron . --no-sandbox' -PassThru -WindowStyle Hidden
$cmdPid = $proc.Id
Write-Host "[shot] cmd wrapper PID=$cmdPid"

try {
  # Poll for the screenshot file. App waits 600ms after did-finish-load then
  # 5000ms before capturePage, so expect ~7-10s after window loads.
  $found = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $shotPath) {
      $len = (Get-Item $shotPath).Length
      Write-Host "[shot] file appeared after ~$($i+1)s, size=$len bytes"
      if ($len -gt 10000) { $found = $true; break }
      Write-Host '[shot] file too small, capture may still be in progress...'
    }
  }
  if (-not $found) {
    Write-Error '[shot] screenshot not produced (capturePage did not fire in time)'
  } else {
    Write-Host "[shot] OK -> $shotPath"
  }
} finally {
  Write-Host '[shot] killing electron processes...'
  try { Stop-Process -Id $cmdPid -Force -ErrorAction Stop } catch {}
  Get-Process electron -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {}
  }
  Remove-Item Env:\TT_AUTO_SCREENSHOT -ErrorAction SilentlyContinue
}

Write-Host "[shot] DONE -> $shotPath"
