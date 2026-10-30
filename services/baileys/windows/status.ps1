#Requires -Version 5.1
<# Mostra se o conector está rodando, se fala com o ateliê e as últimas linhas do log. Rode como Administrador. #>
param([string]$Destino = 'C:\HanneWhatsApp', [int]$Linhas = 25)
$ErrorActionPreference = 'Continue'
$tarefa = Get-ScheduledTask -TaskName 'Hanne WhatsApp' -ErrorAction SilentlyContinue
Write-Host "Tarefa do Windows:  $(if ($tarefa) { $tarefa.State } else { 'não instalada' })"
$arquivo = Join-Path $Destino 'data\status.json'
try {
  $s = Get-Content $arquivo -Raw -Encoding UTF8 | ConvertFrom-Json
  $nomes = @{ ready = 'conectado'; pairing = 'aguardando leitura do QR'; reconnecting = 'reconectando'; disconnected = 'desconectado'; wrong_number = 'número diferente do vinculado' }
  $idade = [int]((Get-Date) - [datetime]$s.updatedAt).TotalSeconds
  Write-Host "WhatsApp:           $($nomes[$s.whatsapp]) $(if ($s.phone) { '(' + $s.phone + ')' })"
  Write-Host "Ateliê:             $($s.site)"
  if ($s.lastError) { Write-Host "Comunicação:        com problema: $($s.lastError)" -ForegroundColor Red }
  else { Write-Host "Comunicação:        ok (última sincronização $($s.lastSync))" -ForegroundColor Green }
  if ($idade -gt 90) { Write-Host "Atenção: o conector não atualiza o status há $idade s; ele pode estar parado." -ForegroundColor Yellow }
} catch { Write-Host 'Conector:           sem status (ainda não iniciou ou está parado)' -ForegroundColor Red }
$log = Join-Path $Destino 'data\logs\conector.log'
if (Test-Path $log) { Write-Host "`nÚltimas linhas do log ($log):"; Get-Content $log -Tail $Linhas -Encoding UTF8 }
