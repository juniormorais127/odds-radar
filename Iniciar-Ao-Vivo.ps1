$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
try {
    $existing = Invoke-RestMethod -Uri 'http://127.0.0.1:4180/health' -TimeoutSec 2
    if ($existing.service -eq 'odds-radar-live') { Write-Output 'Robô ao vivo já está em execução.'; exit 0 }
    throw 'A porta 4180 está sendo usada por outro serviço.'
} catch {
    if ($_.Exception.Message -like '*outro serviço*') { throw }
}
$nodePath = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'logs') | Out-Null
$process = Start-Process -FilePath $nodePath -ArgumentList 'scripts/live-server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'logs/live-stdout.log') -RedirectStandardError (Join-Path $taskRoot 'logs/live-stderr.log') -PassThru
New-Item -ItemType Directory -Force -Path (Join-Path $taskRoot 'data/live') | Out-Null
Set-Content -LiteralPath (Join-Path $taskRoot 'data/live/process.pid') -Value $process.Id
Write-Output ('Robô iniciado. PID: ' + $process.Id)
