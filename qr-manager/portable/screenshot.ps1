# qr-manager portable screenshot script (pure ASCII)
# PrintWindow (flag 2 = PW_RENDERFULLCONTENT) background capture
# No CopyFromScreen. Only kill own process by PID. No Stop-Process -Name.
Add-Type -Language CSharp -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;

public static class WinCap {
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hwnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowTextLength(IntPtr hWnd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    public static IntPtr FindWindowByPid(uint pid) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            uint wpid;
            GetWindowThreadProcessId(hWnd, out wpid);
            if (wpid == pid && IsWindowVisible(hWnd)) {
                int len = GetWindowTextLength(hWnd);
                if (len > 0) {
                    // Match any visible top-level window from this PID.
                    // Since we just launched this process, its only visible
                    // window with a title is our QR widget main window.
                    found = hWnd;
                    return false;
                }
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static Bitmap CaptureWindow(IntPtr hwnd) {
        RECT rc;
        GetWindowRect(hwnd, out rc);
        int w = rc.Right - rc.Left;
        int h = rc.Bottom - rc.Top;
        if (w <= 0 || h <= 0) return null;
        Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp)) {
            IntPtr hdc = g.GetHdc();
            PrintWindow(hwnd, hdc, 2);  // PW_RENDERFULLCONTENT
            g.ReleaseHdc(hdc);
        }
        return bmp;
    }
}
"@ -ReferencedAssemblies System.Drawing

$ErrorActionPreference = "Stop"

$outPath = "D:\Ai\mimo\screenshots\qr-portable-preview.png"
$scriptDir = "D:\Ai\mimo\youqu\qr-manager\portable"

# 1. Launch app (hidden console, no focus steal)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "pythonw.exe"
$psi.Arguments = "qr_widget.py"
$psi.WorkingDirectory = $scriptDir
$psi.WindowStyle = "Hidden"
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$proc = [System.Diagnostics.Process]::Start($psi)
$myPid = $proc.Id
Write-Host "[INFO] Started PID=$myPid"

# 2. Wait for window to render
$waitMs = 0
$hwnd = [IntPtr]::Zero
while ($waitMs -lt 10000) {
    Start-Sleep -Milliseconds 300
    $waitMs += 300
    $hwnd = [WinCap]::FindWindowByPid([uint32]$myPid)
    if ($hwnd -ne [IntPtr]::Zero) { break }
}
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "[ERROR] Window not found"
    Stop-Process -Id $myPid -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "[INFO] Found HWND after $waitMs ms"

# 3. Extra wait for full render (QR generation)
Start-Sleep -Milliseconds 1200

# 4. Background capture (PrintWindow, no foreground switch)
$bmp = [WinCap]::CaptureWindow($hwnd)
if ($bmp -eq $null) {
    Write-Host "[ERROR] Capture failed"
    Stop-Process -Id $myPid -Force -ErrorAction SilentlyContinue
    exit 1
}

# 5. Save
$dir = Split-Path $outPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$w = $bmp.Width
$h = $bmp.Height
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "[OK] Saved: $outPath size=${w}x${h}"

# 6. Kill own process by PID
try { Stop-Process -Id $myPid -Force -ErrorAction Stop } catch {}
Write-Host "[OK] Process $myPid stopped"
