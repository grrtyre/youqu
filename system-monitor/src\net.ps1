# Network stats via Windows performance counters (pure ASCII)
$ErrorActionPreference = 'SilentlyContinue'
$filter = { $_.InstanceName -notmatch 'loopback|isatap|teredo' }
$rx = (Get-Counter '\Network Interface(*)\Bytes Received/sec').CounterSamples | Where-Object $filter
$tx = (Get-Counter '\Network Interface(*)\Bytes Sent/sec').CounterSamples | Where-Object $filter
$rxSum = ($rx | Measure-Object CookedValue -Sum).Sum
$txSum = ($tx | Measure-Object CookedValue -Sum).Sum
if (-not $rxSum) { $rxSum = 0 }
if (-not $txSum) { $txSum = 0 }
$rxSum = [math]::Round($rxSum, 0)
$txSum = [math]::Round($txSum, 0)
$ifaces = @($rx | ForEach-Object { $_.InstanceName } | Where-Object { $_ })
$obj = New-Object PSObject -Property @{ rx = $rxSum; tx = $txSum; ifaces = $ifaces }
Write-Output ($obj | ConvertTo-Json -Compress -Depth 3)
