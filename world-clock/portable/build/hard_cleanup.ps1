# hard_cleanup.ps1 - Force kill ALL WorldClock processes by name
# Use taskkill /F /IM to kill all instances regardless of parent-child relationship
Write-Host "==> Force killing all WorldClock-Portable.exe instances..."
& taskkill /F /IM WorldClock-Portable.exe 2>$null | Out-Host
& taskkill /F /IM WorldClock-Debug.exe 2>$null | Out-Host

Write-Host "==> Force killing all pythonw.exe instances..."
& taskkill /F /IM pythonw.exe 2>$null | Out-Host

Start-Sleep -Seconds 2

# Verify
$remaining = Get-Process | Where-Object { $_.ProcessName -like 'WorldClock*' -or $_.ProcessName -eq 'pythonw' }
if ($remaining) {
  Write-Host "==> WARNING: Still running after hard cleanup:" -ForegroundColor Red
  $remaining | Select-Object Id, ProcessName | Format-Table -AutoSize
  # Try one more time with Stop-Process
  $remaining | ForEach-Object {
    Write-Host "==> Force Stop-Process -Id $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Milliseconds 500
  $stillRemaining = Get-Process | Where-Object { $_.ProcessName -like 'WorldClock*' -or $_.ProcessName -eq 'pythonw' }
  if ($stillRemaining) {
    Write-Host "==> FAILED: Still running after second attempt:" -ForegroundColor Red
    $stillRemaining | Select-Object Id, ProcessName | Format-Table -AutoSize
  } else {
    Write-Host "==> All cleared after second attempt" -ForegroundColor Green
  }
} else {
  Write-Host "==> All cleared" -ForegroundColor Green
}
