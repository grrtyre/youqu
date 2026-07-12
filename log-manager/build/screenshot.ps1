# Log Manager - Background screenshot script (PrintWindow, no focus stealing)
param(
    [string]$OutPath = "D:\Ai\mimo\screenshots\log-manager.png",
    [int]$WaitMs = 5000
)

$ErrorActionPreference = 'Stop'

# Ensure output directory exists
$outDir = Split-Path $OutPath -Parent
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# ---------- C# background capture via PrintWindow ----------
Add-Type -Namespace WinShot -Name Capture -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

public static IntPtr FindWindowByPid(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((hWnd, lp) => {
        uint wpid;
        GetWindowThreadProcessId(hWnd, out wpid);
        if (wpid == pid && IsWindowVisible(hWnd)) {
            found = hWnd;
        }
        return true;
    }, IntPtr.Zero);
    return found;
}

public static System.Drawing.Bitmap CaptureWindow(IntPtr hwnd) {
    RECT rect;
    GetWindowRect(hwnd, out rect);
    int w = rect.Right - rect.Left;
    int h = rect.Bottom - rect.Top;
    if (w <= 0 || h <= 0) return null;
    var bmp = new System.Drawing.Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
    using (var g = System.Drawing.Graphics.FromImage(bmp)) {
        var hdc = g.GetHdc();
        // PW_RENDERFULLCONTENT = 2, supports Chromium rendered content
        PrintWindow(hwnd, hdc, 2);
        g.ReleaseHdc(hdc);
    }
    return bmp;
}
'@ -ReferencedAssemblies System.Drawing

# ---------- Start Electron (hidden, no foreground activation) ----------
$env:LM_DEMO_FILE = "D:\Ai\mimo\youqu\log-manager\build\demo.log"
Write-Host "Starting Electron (hidden)..."
$proc = Start-Process -FilePath "cmd" -ArgumentList "/c npx electron . --no-sandbox --disable-gpu --disable-gpu-compositing" -PassThru -WindowStyle Hidden
Write-Host "Electron PID: $($proc.Id)"

try {
    Write-Host "Waiting ${WaitMs}ms for window to load..."
    Start-Sleep -Milliseconds $WaitMs

    # Find the Electron window (check process and its children)
    $targetPids = @($proc.Id)
    try {
        $children = Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $proc.Id } | Select-Object -ExpandProperty ProcessId
        $targetPids += $children
    } catch {}

    $hwnd = [IntPtr]::Zero
    foreach ($tpid in $targetPids) {
        $hwnd = [WinShot.Capture]::FindWindowByPid([uint32]$tpid)
        if ($hwnd -ne [IntPtr]::Zero) { break }
    }

    # Fallback: search all electron processes
    if ($hwnd -eq [IntPtr]::Zero) {
        $electrons = Get-Process -Name electron -ErrorAction SilentlyContinue
        foreach ($ep in $electrons) {
            $hwnd = [WinShot.Capture]::FindWindowByPid([uint32]$ep.Id)
            if ($hwnd -ne [IntPtr]::Zero) { break }
        }
    }

    # Retry once more after a short delay
    if ($hwnd -eq [IntPtr]::Zero) {
        Write-Host "Window not found yet, retrying..."
        Start-Sleep -Milliseconds 3000
        foreach ($tpid in $targetPids) {
            $hwnd = [WinShot.Capture]::FindWindowByPid([uint32]$tpid)
            if ($hwnd -ne [IntPtr]::Zero) { break }
        }
        if ($hwnd -eq [IntPtr]::Zero) {
            $electrons = Get-Process -Name electron -ErrorAction SilentlyContinue
            foreach ($ep in $electrons) {
                $hwnd = [WinShot.Capture]::FindWindowByPid([uint32]$ep.Id)
                if ($hwnd -ne [IntPtr]::Zero) { break }
            }
        }
    }

    if ($hwnd -eq [IntPtr]::Zero) {
        Write-Host "ERROR: Could not find Electron window"
        exit 1
    }

    Write-Host "Found window handle: $hwnd, capturing..."
    $bmp = [WinShot.Capture]::CaptureWindow($hwnd)
    if ($bmp -eq $null) {
        Write-Host "ERROR: Capture returned null"
        exit 1
    }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Screenshot saved: $OutPath"
}
finally {
    Write-Host "Closing Electron processes..."
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
    Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
