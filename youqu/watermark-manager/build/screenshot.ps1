# 水印管家 - 后台截图脚本（通过窗口句柄精确截图）
# 使用 PrintWindow API 后台截取 Electron 窗口，不打扰用户
# 注意：此脚本为纯 ASCII，避免 PowerShell 5.x 编码问题

$ErrorActionPreference = "Stop"

# 截图保存路径
$shotDir = "D:\Ai\mimo\screenshots"
if (-not (Test-Path $shotDir)) {
    New-Item -ItemType Directory -Path $shotDir -Force | Out-Null
}
$shotPath = Join-Path $shotDir "watermark-manager.png"

# 句柄文件路径
$hwndFile = Join-Path $env:TEMP "watermark-manager-hwnd.txt"
# 删除旧的句柄文件
if (Test-Path $hwndFile) { Remove-Item $hwndFile -Force }

# 项目目录
$projectDir = "D:\Ai\mimo\youqu\watermark-manager"

Write-Host "Starting Electron (hidden)..."
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c npx electron . --no-sandbox" -PassThru -WindowStyle Hidden -WorkingDirectory $projectDir
Write-Host "Launcher PID: $($proc.Id)"

# 等待窗口加载和句柄文件生成
$hwnd = $null
$maxWait = 20
$waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    if (Test-Path $hwndFile) {
        $hwndStr = Get-Content $hwndFile -Raw
        $hwndStr = $hwndStr.Trim()
        if ($hwndStr -match '^\d+$') {
            $hwnd = [IntPtr][Int64]$hwndStr
            Write-Host "Got HWND: $hwnd (waited ${waited}s)"
            break
        }
    }
}

# 额外等待确保渲染完成（ready 信号已确保 init 完成，这里只需短暂等待）
Start-Sleep -Seconds 1

# PrintWindow C# 代码
Add-Type @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class WinShot3 {
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int nCmdShow);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static bool Capture(IntPtr hwnd, string savePath) {
        if (hwnd == IntPtr.Zero) return false;
        RECT rect;
        GetWindowRect(hwnd, out rect);
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;
        if (width <= 0 || height <= 0) return false;

        // 尝试多种 PrintWindow flag
        Bitmap bmp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        Graphics g = Graphics.FromImage(bmp);
        IntPtr hdc = g.GetHdc();

        bool ok = false;
        // flag 2 = PW_RENDERFULLCONTENT
        ok = PrintWindow(hwnd, hdc, 2);
        if (!ok) {
            // flag 0 = 默认
            ok = PrintWindow(hwnd, hdc, 0);
        }
        g.ReleaseHdc(hdc);
        g.Dispose();
        if (ok) { bmp.Save(savePath, ImageFormat.Png); }
        bmp.Dispose();
        return ok;
    }
}
'@ -ReferencedAssemblies System.Drawing

if ($hwnd -ne $null -and $hwnd -ne [IntPtr]::Zero) {
    Write-Host "Capturing window via HWND..."
    $ok = [WinShot3]::Capture($hwnd, $shotPath)
    if ($ok) {
        Write-Host "Screenshot saved: $shotPath"
    } else {
        Write-Host "ERROR: PrintWindow failed for HWND"
    }
} else {
    Write-Host "ERROR: No HWND found after waiting ${waited}s"
}

# 关闭 Electron 进程
Write-Host "Stopping Electron..."
$stopResult = & cmd /c "taskkill /PID $($proc.Id) /T /F 2>&1"
Write-Host $stopResult

# 清理句柄文件
if (Test-Path $hwndFile) { Remove-Item $hwndFile -Force }

Write-Host "Done."
