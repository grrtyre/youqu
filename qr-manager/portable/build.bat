@echo off
REM qr-manager 便携版构建脚本 - PyInstaller --onefile
REM 使用方式：在 portable/ 目录下执行 build.bat

setlocal
cd /d %~dp0

echo ===== 清理旧构建 =====
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist qr-portable.spec del /q qr-portable.spec

echo ===== 安装/检查 PyInstaller =====
python -m pip install --quiet pyinstaller>=6.0

echo ===== 开始构建（单 exe） =====
python -m PyInstaller ^
    --onefile ^
    --noconsole ^
    --name "QR-Manager-Portable" ^
    --windowed ^
    --clean ^
    --noconfirm ^
    --collect-all qrcode ^
    --collect-all pyzbar ^
    --collect-all PIL ^
    --hidden-import keyboard ^
    --hidden-import PySide6.QtWidgets ^
    --hidden-import PySide6.QtGui ^
    --hidden-import PySide6.QtCore ^
    qr_widget.py

if errorlevel 1 (
    echo [ERROR] 构建失败
    exit /b 1
)

echo ===== 构建完成 =====
dir dist\*.exe
endlocal
