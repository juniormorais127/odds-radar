$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $taskRoot 'data/live/process.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'Nenhum PID do robô salvo.'; exit }
$liveProcessId = [int](Get-Content -LiteralPath $pidFile)
$liveProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$liveProcessId" -ErrorAction SilentlyContinue
if ($liveProcess -and $liveProcess.CommandLine -like '*scripts/live-server.mjs*') { Stop-Process -Id $liveProcessId; Write-Output 'Robô ao vivo encerrado.' }
else { Write-Output 'PID antigo ou pertencente a outro processo; nenhum processo encerrado.' }
