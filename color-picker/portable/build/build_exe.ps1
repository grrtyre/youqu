# build_exe.ps1 - Build single-EXE portable distribution with PyInstaller
# Pure ASCII to avoid PS 5.x ANSI encoding issues.
# Usage: powershell -ExecutionPolicy Bypass -File build\build_exe.ps1

$ErrorActionPreference = 'Stop'
$portableRoot = Split-Path -Parent $PSScriptRoot
Set-Location $portableRoot
Write-Output "Portable root: $portableRoot"

# Output name
$exeName = 'ColorPicker-Portable.exe'

# Clean previous build
$distDir = Join-Path $portableRoot 'dist'
$buildDir = Join-Path $portableRoot 'build_pyinstaller'
if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }

# Icon
$iconPath = Join-Path $portableRoot 'assets\icon.ico'
if (-not (Test-Path $iconPath)) {
    Write-Output "WARN: icon not found at $iconPath"
    $iconArg = ''
} else {
    $iconArg = "--icon=$iconPath"
}

# Exclude unused PySide6 modules to reduce size
$excludes = @(
    'PySide6.Qt3DCore','PySide6.Qt3DRender','PySide6.Qt3DInput','PySide6.Qt3DLogic','PySide6.Qt3DAnimation',
    'PySide6.Qt3DExtras','PySide6.QtCharts','PySide6.QtDataVisualization','PySide6.QtDataVisualizationQml',
    'PySide6.QtChartsQml','PySide6.QtMultimedia','PySide6.QtMultimediaWidgets','PySide6.QtNetwork',
    'PySide6.QtNfc','PySide6.QtPositioning','PySide6.QtLocation','PySide6.QtSensors','PySide6.QtSerialPort',
    'PySide6.QtSql','PySide6.QtTest','PySide6.QtWebChannel','PySide6.QtWebEngineCore','PySide6.QtWebEngineQuick',
    'PySide6.QtWebEngineWidgets','PySide6.QtWebSockets','PySide6.QtXml','PySide6.QtRemoteObjects',
    'PySide6.QtScxml','PySide6.QtQuick','PySide6.QtQuickWidgets','PySide6.QtQuickControls2','PySide6.QtQuick3D',
    'PySide6.QtQml','PySide6.QtDesigner','PySide6.QtHelp','PySide6.QtPdf','PySide6.QtPdfWidgets',
    'PySide6.QtPrintSupport','PySide6.QtBluetooth','PySide6.QtConcurrent','PySide6.QtStateMachine',
    'PySide6.QtUiTools','PySide6.QtVirtualKeyboard','PySide6.QtOpenGL','PySide6.QtOpenGLWidgets',
    'PySide6.QtShaderTools','PySide6.QtQuickTest'
)
$excludeArgs = ($excludes | ForEach-Object { "--exclude-module=$_" }) -join ' '

# Source files
$srcMain = Join-Path $portableRoot 'src\main.py'

# Build PyInstaller command (no --collect-all to keep size down)
$cmd = "python -m PyInstaller --onefile --noconsole --name ColorPicker-Portable $iconArg $excludeArgs --add-data `"$iconPath;assets`" `"$srcMain`""
Write-Output "CMD: $cmd"

Invoke-Expression $cmd
if ($LASTEXITCODE -ne 0) {
    Write-Error "PyInstaller failed with exit code $LASTEXITCODE"
    exit 1
}

# Move exe to dist/
$outExe = Join-Path $distDir $exeName
$genExe = Join-Path $distDir 'ColorPicker-Portable.exe'
if (Test-Path $genExe) {
    $size = (Get-Item $genExe).Length
    $sizeMB = [math]::Round($size / 1MB, 2)
    Write-Output "BUILD OK: $genExe ($sizeMB MB)"
} else {
    Write-Error "Built exe not found: $genExe"
    exit 2
}

# Copy icon to dist for reference
Copy-Item $iconPath (Join-Path $distDir 'icon.ico') -Force

Write-Output "DONE"
