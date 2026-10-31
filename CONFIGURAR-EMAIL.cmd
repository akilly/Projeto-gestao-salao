@echo off
rem Configura o envio de e-mails (Brevo) para "esqueci minha senha" e primeiro acesso. Duplo clique.
chcp 65001 >nul
cd /d "%~dp0"
title Hanne - configurar e-mails
if not exist "node_modules\wrangler\bin\wrangler.js" (echo Rode primeiro o INICIAR-HANNE.cmd uma vez.& pause & exit /b 1)
node scripts\configurar-email.mjs %*
pause
