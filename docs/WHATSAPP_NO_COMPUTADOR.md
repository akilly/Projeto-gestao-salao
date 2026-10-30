# WhatsApp do ateliê rodando no seu computador (Windows)

O conector liga o WhatsApp do ateliê ao sistema. Ele roda escondido no seu computador e **conversa sozinho com o site**: não precisa abrir porta, criar túnel nem comprar domínio. É gratuito.

> **Antes de começar:** o conector usa o Baileys, que não é oficial da Meta. O WhatsApp pode restringir o número. Faça o primeiro teste com **um número de teste**, e só depois use o número do salão.

## O que você vai precisar

- Um computador com Windows 10 ou 11, ligado na tomada e na internet enquanto quiser receber e enviar pelo sistema.
- O endereço do ateliê publicado, por exemplo `https://hanne-atelier.SEU-USUARIO.workers.dev`.
- Um celular com o WhatsApp (ou WhatsApp Business) do número que será conectado.
- Cerca de 15 minutos.

## 1. Instalar o Node.js

Abra o **PowerShell como Administrador** (menu Iniciar → digite *PowerShell* → botão direito → *Executar como administrador*) e rode:

```powershell
winget install OpenJS.NodeJS.LTS
```

Feche o PowerShell e abra de novo, também como Administrador.

## 2. Baixar e instalar o conector

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
- gera uma **chave secreta** (fica só neste computador e, depois de colada, no ateliê);
- registra a tarefa **Hanne WhatsApp**, que liga junto com o Windows e reinicia sozinha se cair;
- confere se o conector consegue falar com o ateliê;
- com `-ManterLigado`, impede o computador de dormir quando estiver na tomada.

No fim aparece o aviso de que a **chave já foi copiada**.

## 3. Conectar no ateliê e ler o QR Code

1. No ateliê, use os **dados reais** e abra **Atendimentos → WhatsApp → Conectar por QR Code**.
2. Em **Chave do conector**, aperte **Ctrl+V**. Não envie a chave por chat nem por e-mail.
3. Confirme. Em alguns segundos aparece o QR Code.
4. No celular: **WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho** e leia o código.
5. Quando aparecer **WhatsApp conectado**, mande uma mensagem de outro celular para o número conectado e responda pelo ateliê.

## Conferir se está tudo funcionando

```powershell
powershell -ExecutionPolicy Bypass -File C:\HanneWhatsApp\windows\status.ps1
```

Mostra se a tarefa está rodando, o estado do WhatsApp (conectado, aguardando QR, reconectando), se a comunicação com o ateliê está ok e as últimas linhas do log (`C:\HanneWhatsApp\data\logs\conector.log`).

## Problemas comuns

| O que aparece | O que fazer |
|---|---|
| "Aguardando o conector do computador" | Rode o `status.ps1`. Se a tarefa não estiver rodando, reinicie o computador. Se a comunicação mostrar problema, confira a internet e o endereço do ateliê. |
| "Chave não cadastrada" no `status.ps1` | Falta colar a chave no ateliê. Para copiar de novo: abra `C:\HanneWhatsApp\.env` no Bloco de Notas (como Administrador) e copie o que vem depois de `BRIDGE_KEY=`. |
| "HTTP 404" no `status.ps1` | O site publicado ainda não tem a integração. Publique a versão mais recente. |
| "Número diferente do vinculado" | O conector só aceita o número já usado no histórico. Para trocar de número, desconecte no ateliê e conecte de novo. |
| O WhatsApp desconectou sozinho | Clique em **Gerar novo QR** no ateliê e leia de novo. Se acontecer com frequência, confira se o computador não está dormindo ou sem internet. |
| O computador reiniciou | Nada a fazer: a tarefa liga o conector sozinha e a sessão do WhatsApp continua salva. |
| Mensagem "Na fila do conector" por muito tempo | O computador está desligado ou sem internet. Ela é enviada quando ele voltar. |

## Atualizar ou remover

- **Atualizar:** baixe o `.zip` novo e rode o `instalar.ps1` de novo. A chave e a sessão são mantidas.
- **Parar e remover:** `powershell -ExecutionPolicy Bypass -File C:\HanneWhatsApp\windows\desinstalar.ps1`. Acrescente `-ApagarTudo` para apagar também a chave e a sessão, e remova o aparelho em **WhatsApp → Aparelhos conectados**.

## Trocar do número de teste para o número do salão

1. No ateliê: **Atendimentos → WhatsApp → Desconectar**.
2. No celular de teste: remova o aparelho em **Aparelhos conectados**.
3. Clique em **Conectar por QR Code** de novo, cole a mesma chave e leia o QR com o celular do salão.

## Segurança

- A pasta `C:\HanneWhatsApp` só pode ser lida por Administradores e pelo sistema. Ela guarda a chave e a sessão do WhatsApp.
- O conector não abre nenhuma porta no computador: ele só faz chamadas ao endereço do ateliê.
- O ateliê guarda apenas o "resumo" (hash) da chave e uma cópia cifrada.
- O conector não envia nada sozinho: cada mensagem sai quando você clica em enviar no ateliê.
