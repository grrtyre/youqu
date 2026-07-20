# build_exe.ps1 - PyInstaller onefile build (single EXE portable distribution)
# Usage: powershell -ExecutionPolicy Bypass -File build_exe.ps1
# No C drive installation, all cache output to this directory
# NOTE: Uses --console (not --noconsole) because runw.exe bootloader hangs on extraction
#       for large PySide6 bundles. Console window is hidden at runtime via ctypes in main.py.
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $here '..\src'
$mainPy = Join-Path $src 'main.py'
$outDir = Join-Path $here 'dist'
$workDir = Join-Path $here 'build_pyinstaller'
$python = 'D:\python\python.exe'

Write-Host "==> Build dir: $here"
Write-Host "==> Source dir: $src"
Write-Host "==> Output dir: $outDir"
Write-Host "==> Python: $python"

# Clean old artifacts
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }

# Ensure PyInstaller cache stays in this dir
$env:PYINSTALLER_CONFIG_DIR = $workDir
$env:PIP_CACHE_DIR = Join-Path $here '.pip_cache'

# Use --onefile + --console (console hidden at runtime via ctypes)
# Use --collect-binaries + --collect-submodules (NOT --collect-all) to skip translations data files
& $python -m PyInstaller `
  --onefile `
  --console `
  --name "WorldClock-Portable" `
  --distpath "$outDir" `
  --workpath "$workDir" `
  --specpath "$workDir" `
  --collect-binaries PySide6 `
  --collect-submodules PySide6 `
  --exclude-module PySide6.QtQml `
  --exclude-module PySide6.QtQuick `
  --exclude-module PySide6.QtQuick3D `
  --exclude-module PySide6.QtQuickWidgets `
  --exclude-module PySide6.QtQuickControls2 `
  --exclude-module PySide6.QtQuickShapes `
  --exclude-module PySide6.QtQuickTest `
  --exclude-module PySide6.QtQuickLayouts `
  --exclude-module PySide6.QtQuickTemplates2 `
  --exclude-module PySide6.QtMultimedia `
  --exclude-module PySide6.QtMultimediaWidgets `
  --exclude-module PySide6.QtWebEngine `
  --exclude-module PySide6.QtWebEngineWidgets `
  --exclude-module PySide6.QtWebEngineCore `
  --exclude-module PySide6.QtWebChannel `
  --exclude-module PySide6.QtWebSockets `
  --exclude-module PySide6.QtSql `
  --exclude-module PySide6.QtNetwork `
  --exclude-module PySide6.QtTest `
  --exclude-module PySide6.QtDesigner `
  --exclude-module PySide6.QtHelp `
  --exclude-module PySide6.QtPdf `
  --exclude-module PySide6.QtPdfWidgets `
  --exclude-module PySide6.QtCharts `
  --exclude-module PySide6.QtDataVisualization `
  --exclude-module PySide6.QtOpenGL `
  --exclude-module PySide6.QtOpenGLWidgets `
  --exclude-module PySide6.Qt3DCore `
  --exclude-module PySide6.Qt3DRender `
  --exclude-module PySide6.Qt3DInput `
  --exclude-module PySide6.Qt3DLogic `
  --exclude-module PySide6.Qt3DAnimation `
  --exclude-module PySide6.Qt3DExtras `
  --exclude-module PySide6.QtBluetooth `
  --exclude-module PySide6.QtPositioning `
  --exclude-module PySide6.QtLocation `
  --exclude-module PySide6.QtSensors `
  --exclude-module PySide6.QtSerialPort `
  --exclude-module PySide6.QtSerialBus `
  --exclude-module PySide6.QtNfc `
  --exclude-module PySide6.QtScxml `
  --exclude-module PySide6.QtStateMachine `
  --exclude-module PySide6.QtSvg `
  --exclude-module PySide6.QtSvgWidgets `
  --exclude-module PySide6.QtUiTools `
  --exclude-module PySide6.QtXml `
  --hidden-import zoneinfo `
  --hidden-import tzdata `
  "$mainPy"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed (exit $LASTEXITCODE)" -ForegroundColor Red
  exit 1
}

$exePath = Join-Path $outDir "WorldClock-Portable.exe"
if (Test-Path $exePath) {
  $size = (Get-Item $exePath).Length / 1MB
  Write-Host ("==> Build OK: {0}  ({1:N1} MB)" -f $exePath, $size) -ForegroundColor Green
} else {
  Write-Host "EXE not found: $exePath" -ForegroundColor Red
  exit 1
}
