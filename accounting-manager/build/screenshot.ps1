# 记账管家截图脚本
$ErrorActionPreference = 'SilentlyContinue'
$proj = 'd:\Ai\mimo\youqu\accounting-manager'
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$shot = "D:\Ai\mimo\screenshots\accounting-dashboard-$ts.png"

# 清理可能残留的进程
Get-Process -Name "electron" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

Set-Location $proj
$env:AM_AUTO_SCREENSHOT = $shot
$env:AM_SEED = "1"

# 启动 Electron（应用会在 did-finish-load 后自动截图）
$p = Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList "." -PassThru
Write-Host "Started Electron PID=$($p.Id), waiting for screenshot..."

# 等待截图生成（最多 15 秒）
$waited = 0
while ($waited -lt 15 -and -not (Test-Path $shot)) {
  Start-Sleep -Seconds 1
  $waited++
}

# 关闭 Electron
if (-not $p.HasExited) {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500

if (Test-Path $shot) {
  $size = (Get-Item $shot).Length
  Write-Host "SUCCESS: $shot"
  Write-Host "SIZE: $size bytes, waited ${waited}s"
  # 同时复制为标准名
  Copy-Item $shot 'D:\Ai\mimo\screenshots\accounting-dashboard.png' -Force
} else {
  Write-Host "FAILED: no screenshot after ${waited}s"
}
