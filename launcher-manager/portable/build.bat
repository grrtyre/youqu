@echo off
chcp 65001 >nul
REM Launcher Manager 便携版构建脚本 - PyInstaller 单文件打包
REM 用法: build.bat

set ROOT=%~dp0
cd /d "%ROOT%"

echo ========================================
echo  Launcher Manager 便携版构建
echo ========================================
echo.

REM 清理旧构建
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist LauncherManager-Portable.spec del /q LauncherManager-Portable.spec

echo [1/3] 安装依赖...
python -m pip install --upgrade PySide6 PyInstaller -q
if errorlevel 1 (
    echo 依赖安装失败
    pause
    exit /b 1
)

echo [2/3] 打包单文件 EXE...
python -m PyInstaller ^
    --onefile ^
    --noconsole ^
    --name "LauncherManager-Portable" ^
    --icon "assets\icon.ico" ^
    --add-data "assets;assets" ^
    --hidden-import PySide6.QtSvg ^
    --collect-all PySide6 ^
    --exclude-module tkinter ^
    --exclude-module unittest ^
    --exclude-module pydoc ^
    --noupx ^
    launcher.py

if errorlevel 1 (
    echo 打包失败
    pause
    exit /b 1
)

echo [3/3] 完成!
echo 输出文件: dist\LauncherManager-Portable.exe
dir "dist\LauncherManager-Portable.exe"
echo.
pause
