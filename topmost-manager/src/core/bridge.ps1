# bridge.ps1 - PowerShell wrapper for WinMan C# bridge
# ASCII only (PS5 reads .ps1 as ANSI/GBK on Chinese Windows). Chinese window
# titles flow at runtime through Unicode APIs and UTF-8 stdout, never via source.
$ErrorActionPreference = 'Stop'
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}
$cs = Join-Path $PSScriptRoot 'bridge.cs'
Add-Type -Path $cs

$stdin = [Console]::In
$stdout = [Console]::Out

while ($true) {
    $line = $stdin.ReadLine()
    if ($null -eq $line) { break }
    if ($line.Trim() -eq '') { continue }
    try {
        $req = $line | ConvertFrom-Json
        switch ($req.cmd) {
            'list' {
                $r = [WinMan]::ListWindows($req.exclude)
                $stdout.WriteLine($r); $stdout.Flush()
            }
            'top' {
                $r = [WinMan]::SetTopmost([long]$req.hwnd, [bool]$req.on)
                $stdout.WriteLine(('{"ok":' + ($r.ToString().ToLower()) + '}')); $stdout.Flush()
            }
            'alpha' {
                $r = [WinMan]::SetAlpha([long]$req.hwnd, [int]$req.percent)
                $stdout.WriteLine(('{"ok":' + ($r.ToString().ToLower()) + '}')); $stdout.Flush()
            }
            'reset' {
                $r = [WinMan]::ResetAlpha([long]$req.hwnd)
                $stdout.WriteLine(('{"ok":' + ($r.ToString().ToLower()) + '}')); $stdout.Flush()
            }
            'fg' {
                $h = [WinMan]::GetForeground()
                $stdout.WriteLine(('{"ok":true,"hwnd":"' + $h + '"}')); $stdout.Flush()
            }
            'topfg' {
                $r = [WinMan]::ToggleTopmostForeground()
                $stdout.WriteLine($r); $stdout.Flush()
            }
            'ping' {
                $stdout.WriteLine('{"ok":true,"pong":true}'); $stdout.Flush()
            }
            default {
                $stdout.WriteLine('{"ok":false,"error":"unknown cmd"}'); $stdout.Flush()
            }
        }
    } catch {
        $msg = $_.Exception.Message -replace '[\\"]', '\$0' -replace '[\r\n]', ' '
        $stdout.WriteLine(('{"ok":false,"error":"' + $msg + '"}')); $stdout.Flush()
    }
}
