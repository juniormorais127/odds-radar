$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$supervisorFile = Join-Path $taskRoot 'data/live/supervisor.pid'
if (Test-Path -LiteralPath $supervisorFile) {
    $supervisorId = [int](Get-Content -LiteralPath $supervisorFile)
    $supervisor = Get-CimInstance Win32_Process -Filter "ProcessId=$supervisorId" -ErrorAction SilentlyContinue
    if ($supervisor -and $supervisor.CommandLine -like '*Supervisionar-Robos.ps1*') { Write-Output 'Supervisor ativo.'; exit 0 }
}
$supervisorScript = Join-Path $taskRoot 'Supervisionar-Robos.ps1'
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-File', ('"' + $supervisorScript + '"')) -WorkingDirectory $taskRoot -WindowStyle Hidden
Write-Output 'Supervisor iniciado.'
exit 0
