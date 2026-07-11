# Sticky Notes Manager - Background Screenshot Script (PrintWindow API)
# Pure ASCII to avoid PS5.x GBK encoding issues with Chinese chars

$ErrorActionPreference = "Stop"

$projectDir = "D:\Ai\mimo\youqu\sticky-notes-manager"
$buildDir = Join-Path $projectDir "build"

# === 1. Generate demo data via Node.js (UTF-8 safe) ===
node (Join-Path $buildDir "gen-demo-data.js")
$demoJsonPath = Join-Path $buildDir "demo-notes.json"

# === 2. Copy demo data to userData path ===
$appData = $env:APPDATA
$dataDir = Join-Path $appData "sticky-notes-manager"
$dataFile = Join-Path $dataDir "notes.json"

if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
Copy-Item $demoJsonPath $dataFile -Force
Write-Host "Demo data copied to: $dataFile"

# === 3. Launch Electron (not hidden - window must be visible for PrintWindow) ===
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"
$env:STICKY_TEST_MODE = "1"
$proc = Start-Process -FilePath $electronExe -ArgumentList ". --no-sandbox --disable-gpu" -PassThru -WorkingDirectory $projectDir
Write-Host "Electron started, PID: $($proc.Id)"

Start-Sleep -Seconds 8

# === 4. PrintWindow background capture ===
$screenshotDir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $screenshotDir)) {
    New-Item -ItemType Directory -Path $screenshotDir -Force | Out-Null
}
$outputPath = Join-Path $screenshotDir "sticky-notes-manager.png"

$csCode = @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public class WindowCapture
{
    [DllImport("user32.dll")]
    static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static bool CaptureByPid(uint pid, string outputPath)
    {
        IntPtr foundHwnd = IntPtr.Zero;

        EnumWindows(new EnumWindowsProc((hWnd, lParam) =>
        {
            uint windowPid;
            GetWindowThreadProcessId(hWnd, out windowPid);
            if (windowPid == pid && IsWindowVisible(hWnd))
            {
                foundHwnd = hWnd;
                return false;
            }
            return true;
        }), IntPtr.Zero);

        if (foundHwnd == IntPtr.Zero)
        {
            EnumWindows(new EnumWindowsProc((hWnd, lParam) =>
            {
                uint windowPid;
                GetWindowThreadProcessId(hWnd, out windowPid);
                if (windowPid == pid)
                {
                    foundHwnd = hWnd;
                    return false;
                }
                return true;
            }), IntPtr.Zero);
        }

        if (foundHwnd == IntPtr.Zero) return false;

        RECT rect;
        GetWindowRect(foundHwnd, out rect);
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return false;

        using (Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(bmp))
            {
                IntPtr hdc = g.GetHdc();
                PrintWindow(foundHwnd, hdc, 2);
                g.ReleaseHdc(hdc);
            }
            bmp.Save(outputPath, ImageFormat.Png);
        }
        return true;
    }
}
"@

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing

$success = $false
$attempts = 0
while (-not $success -and $attempts -lt 6) {
    $attempts++
    Start-Sleep -Seconds 2
    try {
        $success = [WindowCapture]::CaptureByPid($proc.Id, $outputPath)
        if ($success) { Write-Host "Capture attempt $attempts succeeded" }
    } catch {
        Write-Host "Capture attempt $attempts error: $_"
    }
}

if ($success) {
    Write-Host "Screenshot saved: $outputPath"
} else {
    Write-Host "Screenshot FAILED after $attempts attempts"
}

# === 5. Kill Electron ===
try {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id } | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {}

# === 6. Cleanup demo data ===
Start-Sleep -Seconds 1
Remove-Item $dataFile -Force -ErrorAction SilentlyContinue
Remove-Item $dataDir -Force -Recurse -ErrorAction SilentlyContinue
Write-Host "Demo data cleaned up"

Write-Host "Done"
