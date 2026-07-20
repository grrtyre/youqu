# clean_temp.ps1 - Clean PyInstaller _MEI* temp directories that may have corrupted leftovers
Write-Host "==> Cleaning _MEI* directories in TEMP..."
$tempDir = $env:TEMP
Get-ChildItem -Path $tempDir -Directory -Filter "_MEI*" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host ("==> Removing: " + $_.FullName)
  try {
    Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  } catch {
    Write-Host ("    Failed to remove (may be in use): " + $_.Name) -ForegroundColor Yellow
  }
}

# Also clean any WorldClock related temp
Get-ChildItem -Path $tempDir -Directory -Filter "*WorldClock*" -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host ("==> Removing: " + $_.FullName)
  Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "==> Done cleaning TEMP"
