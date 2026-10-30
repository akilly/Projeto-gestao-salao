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
    5. Confere se o conector consegue falar com o ateliê e copia a chave para colar no site.

  Não abre porta nem precisa de túnel ou domínio: o conector é quem chama o site.
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
Remove-Item (Join-Path $dados 'status.json') -ErrorAction SilentlyContinue
@("BRIDGE_KEY=$chave", "SITE_ORIGIN=$Site", "DATA_DIR=$dados") | Set-Content -Path $envFile -Encoding ascii
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

Passo 'Conferindo a comunicação com o ateliê'
# O conector grava data\status.json a cada ciclo. "Chave não cadastrada" já prova que o site respondeu.
$statusFile = Join-Path $dados 'status.json'
$estado = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try { $estado = Get-Content $statusFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $estado = $null }
  if ($estado -and ($estado.lastSync -or $estado.lastError)) { break }
}
if (-not $estado) { throw "O conector não iniciou. Veja o log em $dados\logs\conector.log e rode .\windows\status.ps1." }
if ($estado.lastSync) { Ok 'O ateliê já reconhece esta chave.' }
elseif ($estado.lastError -eq 'Chave não cadastrada') { Ok 'O ateliê respondeu. Falta só colar a chave no site (abaixo).' }
elseif ($estado.lastError -like 'HTTP 404*') { Write-Warning "O endereço $Site respondeu, mas sem a integração do WhatsApp. Confira se o site publicado é a versão mais recente." }
else { Write-Warning "Ainda não consegui falar com $Site ($($estado.lastError)). Confira o endereço e a internet; o conector continua tentando sozinho." }

if ($ManterLigado) {
  Passo 'Impedindo a suspensão na tomada'
  & powercfg /change standby-timeout-ac 0
  & powercfg /change hibernate-timeout-ac 0
  Ok 'O computador não vai mais dormir quando estiver na tomada.'
}

Set-Clipboard -Value $chave
Write-Host "`n=================================================================" -ForegroundColor Magenta
Write-Host ' Pronto! Agora, no ateliê (dados reais):' -ForegroundColor Magenta
Write-Host '   Atendimentos > WhatsApp > Conectar'
Write-Host '   Chave do conector: já está copiada (Ctrl+V no campo)'
Write-Host ' Em alguns segundos aparece o QR Code. No celular:'
Write-Host '   WhatsApp > Aparelhos conectados > Conectar um aparelho'
Write-Host ' Não envie a chave por chat nem por e-mail.'
Write-Host "=================================================================`n" -ForegroundColor Magenta
