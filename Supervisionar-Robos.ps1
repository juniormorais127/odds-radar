$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$supervisorFile = Join-Path $taskRoot 'data/live/supervisor.pid'
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'data/live') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'logs') | Out-Null
Set-Content -LiteralPath $supervisorFile -Value $PID
$nodePath = (Get-Command node -ErrorAction Stop).Source
try {
    while ($true) {
        $liveWorker = $null
        $workerFile = Join-Path $taskRoot 'data/live/process.pid'
        if (Test-Path -LiteralPath $workerFile) {
            $workerId = [int](Get-Content -LiteralPath $workerFile)
            $candidate = Get-CimInstance Win32_Process -Filter "ProcessId=$workerId" -ErrorAction SilentlyContinue
            if ($candidate -and $candidate.CommandLine -like '*scripts/live-server.mjs*') {
                $liveWorker = Get-Process -Id $workerId -ErrorAction SilentlyContinue
            }
        }
        if (-not $liveWorker) {
            $liveWorker = Start-Process -FilePath $nodePath -ArgumentList 'scripts/live-server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'logs/live-stdout.log') -RedirectStandardError (Join-Path $taskRoot 'logs/live-stderr.log') -PassThru
            Set-Content -LiteralPath $workerFile -Value $liveWorker.Id
            Add-Content -LiteralPath (Join-Path $taskRoot 'logs/supervisor.log') -Value ((Get-Date -Format o) + ' iniciou PID ' + $liveWorker.Id)
        }
        Wait-Process -Id $liveWorker.Id -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 10
    }
} finally {
    if ((Test-Path -LiteralPath $supervisorFile) -and [int](Get-Content -LiteralPath $supervisorFile) -eq $PID) { Remove-Item -LiteralPath $supervisorFile }
}
