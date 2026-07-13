# 计算器便携版构建脚本
# 用法：在 portable/ 目录下运行 .\build.ps1
# 依赖：Python 3.12+、PySide6、PyInstaller

$ErrorActionPreference = "Stop"

Write-Host "=== 计算器便携版构建 ===" -ForegroundColor Cyan

# 检查依赖
$deps = @("PySide6", "PyInstaller")
foreach ($d in $deps) {
    $installed = pip show $d 2>$null
    if (-not $installed) {
        Write-Host "安装依赖: $d" -ForegroundColor Yellow
        pip install $d
    }
}

# 清理旧产物
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
if (Test-Path "build\calculator-portable") { Remove-Item "build\calculator-portable" -Recurse -Force }

# 构建
Write-Host "开始构建..." -ForegroundColor Green
pyinstaller `
    --onefile `
    --noconsole `
    --name "calculator-portable" `
    --icon "assets/icon.ico" `
    --add-data "assets/icon.ico;assets" `
    --exclude-module PyQt5 `
    --exclude-module PyQt6 `
    --exclude-module tkinter `
    --exclude-module unittest `
    --exclude-module pydoc `
    --exclude-module test `
    --exclude-module matplotlib `
    --exclude-module numpy `
    --exclude-module pandas `
    "src/app.py"

# 验证
$exe = "dist\calculator-portable.exe"
if (Test-Path $exe) {
    $size = (Get-Item $exe).Length / 1MB
    Write-Host ("构建成功: {0} ({1:N1} MB)" -f $exe, $size) -ForegroundColor Green
} else {
    Write-Host "构建失败: 未找到 $exe" -ForegroundColor Red
    exit 1
}
