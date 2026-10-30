#Requires -Version 5.1
<#
  Instala o conector WhatsApp (Baileys) do ateliê Hanne neste computador.

  Uso (PowerShell como Administrador, dentro da pasta extraída do conector):
    powershell -ExecutionPolicy Bypass -File .\windows\instalar.ps1 -Site https://hanne-atelier.SEU-USUARIO.workers.dev

  O que faz:
    1. Confere o Node.js (22.13 ou mais novo).
    2. Copia o conector para C:\HanneWhatsApp e instala as dependências.
    3. Cria a configuração (.env) com uma chave nova (ou mantém a existente).
    4. Registra a tarefa "Hanne WhatsApp", que inicia com o Windows e reinicia se cair.
    5. Publica o endereço HTTPS fixo pelo Tailscale Funnel e confere a resposta.
  Reexecutar atualiza o código e preserva a chave e a sessão do WhatsApp.
#>
param(
  [Parameter(Mandatory = $true)][string]$Site,
  [string]$Destino = 'C:\HanneWhatsApp',
  [switch]$ManterLigado
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Tarefa = 'Hanne WhatsApp'
function Passo([string]$texto) { Write-Host "`n==> $texto" -ForegroundColor Magenta }
function Ok([string]$texto) { Write-Host "    $texto" -ForegroundColor Green }

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Abra o PowerShell como Administrador (botão direito > Executar como administrador) e rode de novo.'
}
$Site = $Site.Trim().TrimEnd('/')
if ($Site -notmatch '^https://[a-z0-9.-]+$') { throw 'Informe o endereço do ateliê assim: -Site https://hanne-atelier.SEU-USUARIO.workers.dev' }

Passo 'Conferindo o Node.js'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Node.js não encontrado. Instale com:  winget install OpenJS.NodeJS.LTS  , feche e abra o PowerShell (como Administrador) e rode este script de novo.' }
$versao = (& $node -p 'process.versions.node').Trim()
if ([version]$versao -lt [version]'22.13.0') { throw "O Node $versao é antigo. Atualize com:  winget upgrade OpenJS.NodeJS.LTS" }
Ok "Node $versao em $node"

Passo "Copiando o conector para $Destino"
$Origem = Split-Path -Parent $PSScriptRoot
if (Get-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $Tarefa -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$Destino*" -or $_.CommandLine -like '*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path $Destino, (Join-Path $Destino 'windows') | Out-Null
if ((Resolve-Path $Origem).Path -ne (Resolve-Path $Destino).Path) {
  foreach ($arquivo in 'server.mjs', 'store.mjs', 'package.json', 'package-lock.json', 'README.md', '.env.example') {
    $caminho = Join-Path $Origem $arquivo
    if (Test-Path $caminho) { Copy-Item $caminho $Destino -Force }
  }
  Copy-Item (Join-Path $Origem 'windows\*.ps1') (Join-Path $Destino 'windows') -Force
}
Get-ChildItem $Destino -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
Set-Content -Path (Join-Path $Destino 'windows\node-path.txt') -Value $node -Encoding ascii
Ok 'Arquivos copiados.'

Passo 'Instalando as dependências (pode levar alguns minutos)'
Push-Location $Destino
try {
  $npm = Join-Path (Split-Path $node) 'npm.cmd'
  & $npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'A instalação das dependências (npm ci) falhou. Confira a internet e rode de novo.' }
} finally { Pop-Location }
Ok 'Dependências instaladas.'

Passo 'Criando a configuração'
$envFile = Join-Path $Destino '.env'
$dados = Join-Path $Destino 'data'
$chave = $null
if (Test-Path $envFile) {
  $linha = Select-String -Path $envFile -Pattern '^BRIDGE_KEY=([A-Za-z0-9_-]{32,160})$' | Select-Object -First 1
  if ($linha) { $chave = $linha.Matches[0].Groups[1].Value; Ok 'Chave existente mantida.' }
}
if (-not $chave) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $chave = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  Ok 'Chave nova gerada.'
}
New-Item -ItemType Directory -Force -Path $dados | Out-Null
@("BRIDGE_KEY=$chave", "SITE_ORIGIN=$Site", 'PORT=3100', 'HOST=127.0.0.1', "DATA_DIR=$dados") | Set-Content -Path $envFile -Encoding ascii
# Só Administradores e o sistema leem a chave e a sessão do WhatsApp.
& icacls $Destino /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q | Out-Null
Ok "Configuração salva para o ateliê $Site"

Passo 'Registrando o conector para iniciar com o Windows'
$runner = Join-Path $Destino 'windows\executar.ps1'
$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""
$gatilho = New-ScheduledTaskTrigger -AtStartup
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$conta = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $Tarefa -Action $acao -Trigger $gatilho -Settings $ajustes -Principal $conta -Description 'Conector WhatsApp (Baileys) do ateliê Hanne' -Force | Out-Null
Start-ScheduledTask -TaskName $Tarefa
$local = $false
for ($i = 0; $i -lt 20 -and -not $local; $i++) {
  Start-Sleep -Seconds 2
  try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/health' -Headers @{ Authorization = "Bearer $chave" } -TimeoutSec 5; $local = $r.service -eq 'hanne-baileys' } catch { }
}
if (-not $local) { throw "O conector não respondeu. Veja o log em $dados\logs\conector.log e rode .\windows\status.ps1." }
Ok 'Conector rodando neste computador (porta 3100).'

if ($ManterLigado) {
  Passo 'Impedindo a suspensão na tomada'
  & powercfg /change standby-timeout-ac 0
  & powercfg /change hibernate-timeout-ac 0
  Ok 'O computador não vai mais dormir quando estiver na tomada.'
}

Passo 'Publicando o endereço HTTPS fixo (Tailscale Funnel)'
$ts = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $ts -and (Test-Path 'C:\Program Files\Tailscale\tailscale.exe')) { $ts = 'C:\Program Files\Tailscale\tailscale.exe' }
if (-not $ts) {
  Write-Warning 'Tailscale não encontrado. Instale em https://tailscale.com/download/windows , entre com sua conta e rode este script de novo.'
  exit 2
}
Write-Host '    Se aparecer um link pedindo para ativar o Funnel, abra no navegador, confirme e volte aqui.' -ForegroundColor Yellow
& $ts funnel --bg 3100
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ativar o Funnel. Confira se o Tailscale está conectado e se o Funnel foi liberado no painel.' }
$estado = & $ts status --json | ConvertFrom-Json
$endereco = 'https://' + $estado.Self.DNSName.TrimEnd('.')
$publico = $false
for ($i = 0; $i -lt 30 -and -not $publico; $i++) {
  Start-Sleep -Seconds 4
  try { $r = Invoke-RestMethod -Uri "$endereco/health" -Headers @{ Authorization = "Bearer $chave" } -TimeoutSec 10; $publico = $r.service -eq 'hanne-baileys' } catch { }
}
if (-not $publico) { Write-Warning "O endereço $endereco ainda não respondeu pela internet. Aguarde 1 ou 2 minutos e rode .\windows\status.ps1." }
else { Ok "Endereço público respondendo: $endereco" }

Set-Clipboard -Value $chave
Write-Host "`n=================================================================" -ForegroundColor Magenta
Write-Host ' Pronto! Agora, no ateliê (dados reais):' -ForegroundColor Magenta
Write-Host '   Atendimentos > WhatsApp > Conectar por QR Code'
Write-Host "   Endereço HTTPS do conector:  $endereco"
Write-Host '   Chave do conector:           já está copiada (Ctrl+V no campo)'
Write-Host ' Depois leia o QR no celular: WhatsApp > Aparelhos conectados.'
Write-Host ' Não envie a chave por chat nem por e-mail.'
Write-Host "=================================================================`n" -ForegroundColor Magenta
