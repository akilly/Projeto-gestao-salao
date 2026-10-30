#Requires -Version 5.1
<# Para o conector e remove a tarefa e o Funnel. Use -ApagarTudo para apagar também a chave e a sessão do WhatsApp. Rode como Administrador. #>
param([string]$Destino = 'C:\HanneWhatsApp', [switch]$ApagarTudo)
$ErrorActionPreference = 'Continue'
Stop-ScheduledTask -TaskName 'Hanne WhatsApp' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'Hanne WhatsApp' -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $ts -and (Test-Path 'C:\Program Files\Tailscale\tailscale.exe')) { $ts = 'C:\Program Files\Tailscale\tailscale.exe' }
if ($ts) { & $ts funnel reset }
if ($ApagarTudo) { Remove-Item -Recurse -Force $Destino; Write-Host 'Conector, chave e sessão apagados. Remova também o aparelho em WhatsApp > Aparelhos conectados.' }
else { Write-Host "Conector parado. A pasta $Destino (chave e sessão) foi mantida." }
