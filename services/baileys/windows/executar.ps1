#Requires -Version 5.1
<# Mantém o conector rodando: reinicia em 10 s se o processo terminar. Chamado pela tarefa "Hanne WhatsApp". #>
$ErrorActionPreference = 'Continue'
$Pasta = Split-Path -Parent $PSScriptRoot
$node = (Get-Content (Join-Path $PSScriptRoot 'node-path.txt') -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $node -or -not (Test-Path $node)) { $node = 'node' }
$logs = Join-Path $Pasta 'data\logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = Join-Path $logs 'conector.log'
Set-Location $Pasta
while ($true) {
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Move-Item $log "$log.1" -Force }
  # cmd grava a saída do Node em UTF-8, sem a conversão do PowerShell 5.1.
  & cmd.exe /d /c "`"$node`" --no-warnings --env-file=.env server.mjs >> `"$log`" 2>&1"
  [IO.File]::AppendAllText($log, "$(Get-Date -Format o) [hanne-whatsapp] O processo terminou; reiniciando em 10 s.`r`n")
  Start-Sleep -Seconds 10
}
