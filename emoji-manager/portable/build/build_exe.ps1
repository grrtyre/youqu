# 构建脚本：用 PyInstaller 打包单 exe
# 用法: powershell -ExecutionPolicy Bypass -File build\build_exe.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

Write-Host "[build] cleaning old dist..." -ForegroundColor Cyan
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "build\pyinstaller") { Remove-Item -Recurse -Force "build\pyinstaller" }

Write-Host "[build] running PyInstaller..." -ForegroundColor Cyan
pyinstaller "emoji-portable.spec" --noconfirm --distpath "dist" --workpath "build\pyinstaller" 2>&1 |
    Tee-Object -FilePath "build\build.log"

$exe = Join-Path $root "dist\emoji-portable.exe"
if (Test-Path $exe) {
    $size = [math]::Round((Get-Item $exe).Length / 1MB, 2)
    Write-Host "[build] OK -> $exe ($size MB)" -ForegroundColor Green
} else {
    Write-Host "[build] FAILED: exe not found" -ForegroundColor Red
    exit 1
}
