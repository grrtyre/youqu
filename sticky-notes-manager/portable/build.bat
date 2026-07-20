@echo off
chcp 65001 >nul
REM 便签管家便携版 - PyInstaller 打包脚本
REM 单 EXE 便携分发，无控制台窗口

setlocal
set PROJECT_NAME=便签管家便携版
set MAIN_SCRIPT=main.py
set OUT_DIR=dist
set SPEC_DIR=build

echo ======================================
echo [%PROJECT_NAME%] 开始 PyInstaller 打包
echo ======================================
echo.

REM 清理旧产物
if exist %OUT_DIR% rmdir /s /q %OUT_DIR%
if exist %SPEC_DIR% rmdir /s /q %SPEC_DIR%
if exist %MAIN_SCRIPT:.py=.spec% del /q %MAIN_SCRIPT:.py=.spec%

REM 打包命令
REM --onefile        单 EXE
REM --noconsole      无控制台窗口
REM --windowed       GUI 应用
REM --name           输出 EXE 名称
REM --icon           应用图标（动态生成）
REM --add-data       附加数据（这里无）
REM --collect-submodules  PySide6 子模块
REM --noupx          不使用 UPX（避免误报病毒）
REM --clean          清理 PyInstaller 缓存

pyinstaller ^
    --onefile ^
    --windowed ^
    --noconsole ^
    --name "StickyNotesPortable" ^
    --collect-submodules PySide6 ^
    --collect-submodules keyboard ^
    --hidden-import PySide6.QtSvg ^
    --hidden-import PySide6.QtWidgets ^
    --hidden-import PySide6.QtGui ^
    --hidden-import PySide6.QtCore ^
    --exclude-module tkinter ^
    --exclude-module unittest ^
    --exclude-module email ^
    --exclude-module http ^
    --exclude-module urllib ^
    --exclude-module xml ^
    --exclude-module pydoc ^
    --clean ^
    --noconfirm ^
    %MAIN_SCRIPT%

if errorlevel 1 (
    echo.
    echo [ERROR] PyInstaller 打包失败
    exit /b 1
)

echo.
echo [OK] 打包完成
echo 输出文件: %OUT_DIR%\StickyNotesPortable.exe

REM 重命名为中文名
if exist %OUT_DIR%\StickyNotesPortable.exe (
    copy /y %OUT_DIR%\StickyNotesPortable.exe "%OUT_DIR%\便签管家便携版.exe" >nul
    echo 中文版: %OUT_DIR%\便签管家便携版.exe
)

endlocal
