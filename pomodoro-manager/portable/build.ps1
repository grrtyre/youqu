# build.ps1 - PyInstaller single-EXE build
$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = "D:\python\python.exe"
$iconPath = Join-Path $projectDir "assets\icon.ico"
$distDir = Join-Path $projectDir "dist"
$buildDir = Join-Path $projectDir "build"
$exeName = "PomodoroPortable"

Write-Host "============================================"
Write-Host "  PomodoroPortable - PyInstaller Build"
Write-Host "============================================"

if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
if (Test-Path $buildDir) { Remove-Item $buildDir -Recurse -Force }

Write-Host "[1/3] Cleaning previous build artifacts... done"

Write-Host "[2/3] Building single-EXE with PyInstaller..."

$pyArgs = @(
    "--onefile", "--noconsole",
    "--name", $exeName,
    "--icon", $iconPath,
    "--add-data", "$iconPath;assets",
    "--collect-all", "customtkinter",
    "--exclude-module", "PyQt5",
    "--exclude-module", "PyQt6",
    "--exclude-module", "PySide2",
    "--exclude-module", "PySide6",
    "--exclude-module", "matplotlib",
    "--exclude-module", "numpy",
    "--exclude-module", "scipy",
    "--exclude-module", "pandas",
    "--exclude-module", "notebook",
    "--exclude-module", "jupyter",
    "--exclude-module", "IPython",
    "--exclude-module", "pytest",
    "--exclude-module", "sphinx",
    "--exclude-module", "tkinter.test",
    "--exclude-module", "test",
    "--exclude-module", "unittest",
    "--exclude-module", "pydoc",
    "--exclude-module", "doctest",
    "--exclude-module", "pdb",
    "--exclude-module", "profile",
    "--exclude-module", "pstats",
    "--log-level", "WARN",
    "main.py"
)

Push-Location $projectDir
try {
    & $pythonExe -m PyInstaller $pyArgs
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host "[3/3] Build complete."
$exePath = Join-Path $distDir "$exeName.exe"
if (Test-Path $exePath) {
    $size = (Get-Item $exePath).Length / 1MB
    Write-Host ""
    Write-Host ("EXE: {0}" -f $exePath)
    Write-Host ("Size: {0:N2} MB" -f $size)
} else {
    Write-Error "EXE not found: $exePath"
    exit 1
}
