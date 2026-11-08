$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$supervisorFile = Join-Path $taskRoot 'data/live/supervisor.pid'
if (Test-Path -LiteralPath $supervisorFile) {
    $supervisorId = [int](Get-Content -LiteralPath $supervisorFile)
    $supervisor = Get-CimInstance Win32_Process -Filter "ProcessId=$supervisorId" -ErrorAction SilentlyContinue
    if ($supervisor -and $supervisor.CommandLine -like '*Supervisionar-Robos.ps1*') { Stop-Process -Id $supervisorId }
}
$pidFile = Join-Path $taskRoot 'data/live/process.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'Nenhum PID do robô salvo.'; exit }
$liveProcessId = [int](Get-Content -LiteralPath $pidFile)
$liveProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$liveProcessId" -ErrorAction SilentlyContinue
if ($liveProcess -and $liveProcess.CommandLine -like '*scripts/live-server.mjs*') { Stop-Process -Id $liveProcessId; Write-Output 'Robô ao vivo encerrado.' }
else { Write-Output 'PID antigo ou pertencente a outro processo; nenhum processo encerrado.' }
