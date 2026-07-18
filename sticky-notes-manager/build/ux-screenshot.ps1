# UX Inspection Screenshot Script - Multi-state capture
# Uses PrintWindow (background) + Chrome DevTools Protocol (remote control)
# Pure ASCII to avoid PS5.x GBK encoding issues with Chinese chars

$ErrorActionPreference = "Stop"

$projectDir = "D:\Ai\mimo\youqu\sticky-notes-manager"
$buildDir = Join-Path $projectDir "build"
$screenshotDir = "D:\Ai\mimo\screenshots"

if (-not (Test-Path $screenshotDir)) {
    New-Item -ItemType Directory -Path $screenshotDir -Force | Out-Null
}

# === 1. Generate demo data (with trash) ===
node (Join-Path $buildDir "ux-demo-data.js")
$demoJsonPath = Join-Path $buildDir "ux-demo-notes.json"

# === 2. Copy demo data to userData path ===
$appData = $env:APPDATA
$dataDir = Join-Path $appData "sticky-notes-manager"
$dataFile = Join-Path $dataDir "notes.json"
if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
Copy-Item $demoJsonPath $dataFile -Force
Write-Host "Demo data copied to: $dataFile"

# === 3. C# PrintWindow capture class ===
Add-Type -AssemblyName System.Drawing
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

    public static IntPtr FindWindowByPid(uint pid)
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
        return foundHwnd;
    }

    public static bool CaptureByPid(uint pid, string outputPath)
    {
        IntPtr foundHwnd = FindWindowByPid(pid);
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
Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing -ErrorAction SilentlyContinue

function Take-Screenshot {
    param([uint32]$processId, [string]$outputPath, [int]$maxAttempts = 6)
    $success = $false
    $attempts = 0
    while (-not $success -and $attempts -lt $maxAttempts) {
        $attempts++
        Start-Sleep -Seconds 1
        try {
            $success = [WindowCapture]::CaptureByPid($processId, $outputPath)
            if ($success) {
                Write-Host "  Capture OK: $outputPath"
            }
        } catch {
            Write-Host "  Capture attempt $attempts error: $_"
        }
    }
    return $success
}

# === 4. Launch Electron with remote debugging ===
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"
$env:STICKY_TEST_MODE = "1"
$proc = Start-Process -FilePath $electronExe -ArgumentList ". --no-sandbox --disable-gpu --remote-debugging-port=9222" -PassThru -WorkingDirectory $projectDir
Write-Host "Electron started, PID: $($proc.Id)"
$electronPid = $proc.Id

try {
    # Wait for app to be ready
    Start-Sleep -Seconds 8

    # === 5. Capture state 1: Notes view (default) ===
    Write-Host "=== State 1: Notes view ==="
    Take-Screenshot -processId $electronPid -outputPath (Join-Path $screenshotDir "ux-sticky-notes-view.png") | Out-Null

    # === 6. Connect to DevTools Protocol via HTTP ===
    Write-Host "=== Connecting to DevTools ==="
    $listUrl = "http://localhost:9222/json/list"
    $listResp = Invoke-RestMethod -Uri $listUrl -Method Get
    $pageTarget = $listResp | Where-Object { $_.type -eq "page" } | Select-Object -First 1
    if (-not $pageTarget) {
        throw "No page target found in DevTools"
    }
    $wsUrl = $pageTarget.webSocketDebuggerUrl
    Write-Host "WebSocket URL: $wsUrl"

    # === 7. Connect WebSocket and execute JS ===
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationTokenSource
    $connectTask = $ws.ConnectAsync($wsUrl, $ct.Token)
    while (-not $connectTask.IsCompleted) {
        Start-Sleep -Milliseconds 100
    }
    if ($connectTask.IsFaulted) {
        throw "WebSocket connect failed: $($connectTask.Exception)"
    }
    Write-Host "WebSocket connected"

    $msgId = 0
    function Send-Eval {
        param([string]$expression, [int]$waitMs = 600)
        $script:msgId++
        $payload = @{
            id = $script:msgId
            method = "Runtime.evaluate"
            params = @{
                expression = $expression
                returnByValue = $true
            }
        } | ConvertTo-Json -Depth 10
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $seg = [System.ArraySegment[byte]]::new($bytes)
        $sendTask = $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct.Token)
        while (-not $sendTask.IsCompleted) { Start-Sleep -Milliseconds 50 }

        # Receive response
        $recvBuffer = New-Object byte[] 65536
        $recvSeg = [System.ArraySegment[byte]]::new($recvBuffer)
        $recvTask = $ws.ReceiveAsync($recvSeg, $ct.Token)
        $timeout = 0
        while (-not $recvTask.IsCompleted -and $timeout -lt 50) {
            Start-Sleep -Milliseconds 100
            $timeout++
        }
        if ($recvTask.IsCompleted) {
            $respStr = [System.Text.Encoding]::UTF8.GetString($recvBuffer, 0, $recvTask.Result.Count)
            Write-Host "  Response: $($respStr.Substring(0, [Math]::Min(120, $respStr.Length)))"
        }
        Start-Sleep -Milliseconds $waitMs
    }

    # Force repaint trigger (PrintWindow needs active painting to capture fresh frame)
    function Force-Repaint {
        Send-Eval -expression "document.body.style.transform='translateZ(0)'; setTimeout(function(){document.body.style.transform='';},50);" -waitMs 200
    }

    # === 8. Switch to trash view ===
    Write-Host "=== State 2: Trash view ==="
    Send-Eval -expression "document.getElementById('trashEntry').click();" -waitMs 800
    Force-Repaint
    Take-Screenshot -processId $electronPid -outputPath (Join-Path $screenshotDir "ux-sticky-trash-view.png") | Out-Null

    # === 9. Back to notes view (click first .category-item in .category-list, which is "全部") ===
    Write-Host "=== State 3: Notes view + edit modal ==="
    Send-Eval -expression "document.querySelectorAll('.category-list .category-item')[0].click();" -waitMs 500
    Send-Eval -expression "var firstCard = document.querySelector('.note-card'); if (firstCard) { firstCard.click(); }" -waitMs 800
    Force-Repaint
    Take-Screenshot -processId $electronPid -outputPath (Join-Path $screenshotDir "ux-sticky-edit-modal.png") | Out-Null

    # === 10. Close modal, type in search ===
    Write-Host "=== State 4: Search active ==="
    Send-Eval -expression "document.getElementById('modalCloseBtn').click();" -waitMs 600
    Send-Eval -expression "var si = document.getElementById('searchInput'); si.value = 'test'; si.dispatchEvent(new Event('input', { bubbles: true }));" -waitMs 600
    Force-Repaint
    Take-Screenshot -processId $electronPid -outputPath (Join-Path $screenshotDir "ux-sticky-search.png") | Out-Null

    # === 11. Empty state (clear all notes via JS) ===
    Write-Host "=== State 5: Empty state ==="
    Send-Eval -expression "var si = document.getElementById('searchInput'); si.value = ''; si.dispatchEvent(new Event('input', { bubbles: true }));" -waitMs 300
    Send-Eval -expression "document.querySelectorAll('.category-list .category-item')[2].click();" -waitMs 500
    # Filter to a category with no notes (using search to make it empty)
    Send-Eval -expression "var si = document.getElementById('searchInput'); si.value = 'zzz_no_match_zzz'; si.dispatchEvent(new Event('input', { bubbles: true }));" -waitMs 500
    Force-Repaint
    Take-Screenshot -processId $electronPid -outputPath (Join-Path $screenshotDir "ux-sticky-empty-search.png") | Out-Null

    # === 12. Trigger confirm dialog (Empty trash) ===
    Write-Host "=== State 6: Confirm dialog ==="
    # First switch to trash view
    Send-Eval -expression "var si = document.getElementById('searchInput'); si.value = ''; si.dispatchEvent(new Event('input', { bubbles: true }));" -waitMs 200
    Send-Eval -expression "document.getElementById('trashEntry').click();" -waitMs 500
    # Click empty trash button - this triggers native confirm() dialog
    Send-Eval -expression "var btn = document.getElementById('emptyTrashBtn'); if (btn) btn.click();" -waitMs 1500
    Force-Repaint
    Take-Screenshot -processId $electronPid -outputPath (Join-Path $screenshotDir "ux-sticky-confirm-dialog.png") | Out-Null

    # Close WebSocket
    $closeTask = $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $ct.Token)
    while (-not $closeTask.IsCompleted) { Start-Sleep -Milliseconds 50 }
    Write-Host "WebSocket closed"

} finally {
    # === 13. Kill Electron (only self-launched PID) ===
    Write-Host "=== Cleaning up ==="
    try {
        Stop-Process -Id $electronPid -Force -ErrorAction SilentlyContinue
        Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $electronPid } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    # === 14. Cleanup demo data ===
    Start-Sleep -Seconds 1
    Remove-Item $dataFile -Force -ErrorAction SilentlyContinue
    Remove-Item $dataDir -Force -Recurse -ErrorAction SilentlyContinue
    Write-Host "Demo data cleaned up"
}

Write-Host "=== All screenshots saved to: $screenshotDir ==="
Get-ChildItem -Path $screenshotDir -Filter "ux-sticky-*.png" | Format-Table Name, Length
