@echo off
rem Liga a IA (Workers AI) no sistema rodando neste computador. Duplo clique.
chcp 65001 >nul
cd /d "%~dp0"
title Hanne - ligar a IA
if not exist "node_modules\wrangler\bin\wrangler.js" (echo Rode primeiro o INICIAR-HANNE.cmd uma vez.& pause & exit /b 1)
node scripts\configurar-ia.mjs %*
pause
