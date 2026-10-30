# WhatsApp do ateliê rodando no seu computador (Windows)

O conector Baileys liga o WhatsApp do ateliê ao sistema. Ele precisa ficar rodando o tempo todo num computador ligado à internet. Este guia instala o conector no Windows, cria um endereço HTTPS fixo pelo Tailscale (gratuito) e conecta o número lendo um QR Code.

> **Antes de começar:** o Baileys não é oficial da Meta. O WhatsApp pode restringir ou banir o número. Faça o primeiro teste com **um número de teste**, e só depois use o número do salão.

## O que você vai precisar

- Um computador com Windows 10 ou 11, ligado na tomada e na internet o tempo todo.
- O endereço do ateliê publicado, por exemplo `https://hanne-atelier.SEU-USUARIO.workers.dev`.
- Um celular com o WhatsApp (ou WhatsApp Business) do número que será conectado.
- Cerca de 20 minutos.

## 1. Instalar o Node.js

Abra o **PowerShell como Administrador** (menu Iniciar → digite *PowerShell* → botão direito → *Executar como administrador*) e rode:

```powershell
winget install OpenJS.NodeJS.LTS
```

Feche o PowerShell e abra de novo, também como Administrador.

## 2. Instalar o Tailscale e liberar o Funnel

1. Baixe e instale: https://tailscale.com/download/windows
2. Entre com uma conta (Google, Microsoft ou e-mail). O ícone do Tailscale aparece perto do relógio.
3. Mais adiante, o instalador do conector ativa o **Funnel**, que publica o endereço HTTPS. Se aparecer um link pedindo para ativar o Funnel ou os certificados HTTPS, abra o link, confirme e volte para o PowerShell.

O endereço fica assim: `https://nome-do-pc.algumacoisa.ts.net`. Ele não muda, mesmo depois de reiniciar o computador.

## 3. Baixar e instalar o conector

1. No ateliê, abra **Atendimentos → WhatsApp → Conectar por QR Code → Baixar conector e instruções**.
2. Extraia o arquivo `.zip`, por exemplo em `Downloads\hanne-baileys`.
3. No PowerShell (como Administrador), entre na pasta extraída e rode o instalador com o endereço do seu ateliê:

```powershell
cd $HOME\Downloads\hanne-baileys
powershell -ExecutionPolicy Bypass -File .\windows\instalar.ps1 -Site https://hanne-atelier.SEU-USUARIO.workers.dev -ManterLigado
```

O instalador:

- confere o Node.js;
- copia o conector para `C:\HanneWhatsApp` e instala as dependências;
- gera uma **chave secreta** (só fica neste computador);
- registra a tarefa **Hanne WhatsApp**, que liga junto com o Windows e reinicia sozinha se cair;
- publica o endereço HTTPS pelo Tailscale e confere se ele responde;
- com `-ManterLigado`, impede o computador de dormir quando estiver na tomada.

No fim aparecem o **endereço HTTPS** e o aviso de que a **chave já foi copiada**.

## 4. Conectar no ateliê e ler o QR Code

1. No ateliê, use os **dados reais** e abra **Atendimentos → WhatsApp → Conectar por QR Code**.
2. Cole o **endereço HTTPS** mostrado pelo instalador.
3. Em **Chave do conector**, aperte **Ctrl+V**. Não envie a chave por chat nem por e-mail.
4. Confirme. Em alguns segundos aparece o QR Code.
5. No celular: **WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho** e leia o código.
6. Quando aparecer **WhatsApp conectado**, mande uma mensagem de outro celular para o número conectado e responda pelo ateliê.

## Conferir se está tudo funcionando

```powershell
powershell -ExecutionPolicy Bypass -File C:\HanneWhatsApp\windows\status.ps1
```

O comando mostra se a tarefa está rodando, o estado do WhatsApp (conectado, aguardando QR, reconectando), se o endereço público responde e as últimas linhas do log (`C:\HanneWhatsApp\data\logs\conector.log`).

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| O QR Code não aparece | Rode o `status.ps1`. Se o conector não respondeu, reinicie o computador. Se o endereço público não respondeu, confira o Tailscale (ícone conectado) e rode `tailscale funnel status`. |
| "A chave do conector não foi aceita" | Copie de novo a linha `BRIDGE_KEY=` de `C:\HanneWhatsApp\.env` (abra o Bloco de Notas como Administrador) e cole no ateliê. |
| "Número diferente do vinculado" | O conector só aceita o número já usado no histórico. Para trocar de número, desconecte no ateliê e conecte de novo. |
| O WhatsApp desconectou sozinho | Gere um novo QR no ateliê e leia de novo. Se acontecer com frequência, confira se o computador não está dormindo ou sem internet. |
| O computador reiniciou | Nada a fazer: a tarefa liga o conector sozinha e a sessão do WhatsApp continua salva. |

## Atualizar ou remover

- **Atualizar:** baixe o `.zip` novo e rode o `instalar.ps1` de novo. A chave e a sessão são mantidas.
- **Parar e remover:** `powershell -ExecutionPolicy Bypass -File C:\HanneWhatsApp\windows\desinstalar.ps1`. Acrescente `-ApagarTudo` para apagar também a chave e a sessão, e remova o aparelho em **WhatsApp → Aparelhos conectados**.

## Trocar do número de teste para o número do salão

1. No ateliê: **Atendimentos → WhatsApp → Desconectar**.
2. No celular de teste: remova o aparelho em **Aparelhos conectados**.
3. Clique em **Conectar por QR Code** de novo e leia o QR com o celular do salão.

## Segurança

- A pasta `C:\HanneWhatsApp` só pode ser lida por Administradores e pelo sistema. Ela guarda a chave e a sessão do WhatsApp.
- O endereço público só responde a quem tem a chave. O site guarda a chave cifrada.
- O conector não envia nada sozinho: cada mensagem sai quando você clica em enviar no ateliê.
