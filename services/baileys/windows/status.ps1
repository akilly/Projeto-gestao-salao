#Requires -Version 5.1
<# Mostra se o conector está rodando, o endereço público e as últimas linhas do log. Rode como Administrador. #>
param([string]$Destino = 'C:\HanneWhatsApp', [int]$Linhas = 25)
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$envFile = Join-Path $Destino '.env'
$chave = (Select-String -Path $envFile -Pattern '^BRIDGE_KEY=(.+)$' -ErrorAction SilentlyContinue | Select-Object -First 1).Matches.Groups[1].Value
$tarefa = Get-ScheduledTask -TaskName 'Hanne WhatsApp' -ErrorAction SilentlyContinue
Write-Host "Tarefa do Windows:  $(if ($tarefa) { $tarefa.State } else { 'não instalada' })"
try {
  $s = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/session' -Headers @{ Authorization = "Bearer $chave" } -TimeoutSec 5
  $texto = @{ ready = 'conectado'; pairing = 'aguardando leitura do QR'; reconnecting = 'reconectando'; disconnected = 'desconectado'; wrong_number = 'número diferente do vinculado' }[$s.status]
  Write-Host "Conector:           no ar · WhatsApp $texto"
} catch { Write-Host 'Conector:           NÃO respondeu na porta 3100' -ForegroundColor Red }
$ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $ts -and (Test-Path 'C:\Program Files\Tailscale\tailscale.exe')) { $ts = 'C:\Program Files\Tailscale\tailscale.exe' }
if ($ts) {
  $endereco = 'https://' + ((& $ts status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.'))
  try { $r = Invoke-RestMethod -Uri "$endereco/health" -Headers @{ Authorization = "Bearer $chave" } -TimeoutSec 10; Write-Host "Endereço público:   $endereco (respondendo)" }
  catch { Write-Host "Endereço público:   $endereco (NÃO respondeu; confira o Funnel com: tailscale funnel status)" -ForegroundColor Red }
} else { Write-Host 'Tailscale:          não encontrado' -ForegroundColor Red }
$log = Join-Path $Destino 'data\logs\conector.log'
if (Test-Path $log) { Write-Host "`nÚltimas linhas do log ($log):"; Get-Content $log -Tail $Linhas -Encoding UTF8 }
