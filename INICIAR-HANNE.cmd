@echo off
rem Hanne - roda o sistema neste computador (http://localhost:8787). Duplo clique para abrir.
chcp 65001 >nul
cd /d "%~dp0"
title Hanne - gestao do atelie (deixe esta janela aberta)
where node >nul 2>nul || (echo.& echo Node.js nao encontrado. Instale com:  winget install OpenJS.NodeJS.LTS & echo Depois feche e abra esta janela de novo.& pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo.& echo O Node.js precisa ser 22.13 ou mais novo. Atualize com:  winget upgrade OpenJS.NodeJS.LTS & pause & exit /b 1)
set "SITES_PNPM_SHARED_STORE=%~dp0.sites-runtime\pnpm-store"
if not exist "node_modules\wrangler\bin\wrangler.js" (
  echo.
  echo Instalando as dependencias. Na primeira vez leva alguns minutos...
  call npx --yes pnpm@11.25.0 install --frozen-lockfile
  if errorlevel 1 (echo.& echo A instalacao falhou. Confira a internet e tente de novo.& pause & exit /b 1)
)
node scripts\local-start.mjs --open %*
pause
