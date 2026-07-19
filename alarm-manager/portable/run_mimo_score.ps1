# Alarm Manager Portable - mimo aesthetic scoring
# Pure ASCII script body to avoid PS5.x GBK garbling of Chinese.
# Chinese prompt is loaded from external UTF-8 file.

$root       = 'D:\Ai\mimo'
$shotPath   = 'D:\Ai\mimo\screenshots\alarm-manager-portable-main.png'
$promptPath = 'D:\Ai\mimo\screenshots\_mimo_prompt_alarm_portable.txt'
$mimoExe    = Join-Path $root 'mimo.exe'
$mimoProfile = Join-Path $root 'profile'
$logPath    = 'D:\Ai\mimo\screenshots\alarm_portable_mimo_result.txt'

if(-not (Test-Path $shotPath)) {
  Write-Host "ERROR: Screenshot not found: $shotPath"
  exit 1
}
if(-not (Test-Path $promptPath)) {
  Write-Host "ERROR: Prompt file not found: $promptPath"
  exit 1
}

# Load Chinese prompt from UTF-8 file
$promptBytes = [System.IO.File]::ReadAllBytes($promptPath)
$prompt = [System.Text.Encoding]::UTF8.GetString($promptBytes).Trim()

Write-Host "Screenshot: $shotPath"
Write-Host "Prompt length: $($prompt.Length) chars"

$env:MIMOCODE_HOME = $mimoProfile
$env:MIMOCODE_MIMO_ONLY = 'true'

# Construct arguments - prompt first, then -f screenshot path
$argString = 'run --model "mimo/mimo-auto" --dangerously-skip-permissions -- "' + $prompt + '" -f "' + $shotPath + '"'

Write-Host "Calling mimo..."
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $mimoExe
$psi.Arguments = $argString
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
if(-not $proc.WaitForExit(180000)) {
  try { $proc.Kill() } catch {}
}
$exitCode = $proc.ExitCode

# Save raw output
[System.IO.File]::WriteAllText($logPath, "EXIT CODE: $exitCode`n---STDOUT---`n$stdout`n---STDERR---`n$stderr", [System.Text.Encoding]::UTF8)

Write-Host "=== MIMO OUTPUT ==="
Write-Host $stdout
if ($stderr -ne '') {
  Write-Host "=== STDERR ==="
  Write-Host $stderr
}

# Parse score - use ASCII-only regex
$score = 0
$lines = $stdout -split "`n"
foreach($line in $lines) {
  if($line -match 'SCORE\s*:\s*(\d+)') { $score = [int]$Matches[1] }
}
if($score -eq 0 -and $stdout -match '(\d+)\s*/\s*10') { $score = [int]$Matches[1] }
if($score -eq 0 -and $stdout -match '\b(10|[1-9])\b\s*/\s*10') { $score = [int]$Matches[1] }

Write-Host ""
Write-Host ("=== PARSED SCORE: {0}/10 ===" -f $score)
Write-Host ("Full log: {0}" -f $logPath)
