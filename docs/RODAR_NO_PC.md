# Rodar o Hanne no seu computador (teste) e levar para a nuvem depois

O sistema roda igualzinho no seu computador, com banco de dados local. Bom para testar antes de publicar. Depois, a mesma base vai para a nuvem gratuita (Cloudflare) com uma cópia JSON.

## 1. Rodar no computador (Windows)

Precisa do **Node.js 22.13 ou mais novo** (`winget install OpenJS.NodeJS.LTS`).

1. Abra a pasta do projeto e dê **duplo clique em `INICIAR-HANNE.cmd`**.
2. Na primeira vez, ele instala as dependências e compila o site (alguns minutos).
3. A janela mostra o **código de configuração** e o navegador abre em **http://localhost:8787**.
4. No primeiro acesso, informe o código, seu e-mail e uma senha (mínimo 12 caracteres).

Deixe a janela aberta enquanto usa. Para parar: feche a janela ou aperte Ctrl+C.

- Os dados ficam na pasta do projeto, em `.wrangler\state`. **Não apague essa pasta.**
- O código de configuração e a chave de cifragem ficam em `.dev.vars`. Não compartilhe esse arquivo.
- Depois de atualizar o código (`git pull`), abra com `INICIAR-HANNE.cmd --build` para compilar de novo.
- Em outros sistemas: `pnpm install` e depois `npm run local -- --open`.

## 2. WhatsApp com o sistema no computador

O conector funciona do mesmo jeito, apontando para o endereço local. No PowerShell **como Administrador**, dentro da pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File .\services\baileys\windows\instalar.ps1 -Site http://localhost:8787
```

Depois, no sistema: **Atendimentos → WhatsApp → Conectar por QR Code**, cole a chave (Ctrl+V) e leia o QR com o celular. O passo a passo completo está em [WHATSAPP_NO_COMPUTADOR.md](WHATSAPP_NO_COMPUTADOR.md).

> O conector liga sozinho com o Windows; o site, não. Abra o `INICIAR-HANNE.cmd` para as mensagens chegarem ao sistema.

## 3. Levar para a nuvem gratuita (quando quiser)

A nuvem recomendada é a **Cloudflare (plano gratuito)**: o projeto já está pronto para ela (Workers + banco D1 + KV para anexos), sem custo para o uso de um ateliê.

1. **Guarde os dados do computador:** no sistema local, Configurações → **Cópia completa JSON**.
2. **Publique:** siga o [DEPLOY.md](../DEPLOY.md) (`npm run deploy:cloudflare` e os segredos `SETUP_TOKEN` e `WHATSAPP_ENCRYPTION_KEY`).
3. **Traga os dados:** no site publicado, antes de "Preparar operação", use Configurações → **Restaurar cópia JSON** com o arquivo do passo 1.
4. **WhatsApp:** rode o instalador de novo com o endereço novo (a chave é mantida) e, no site publicado, cole a chave e leia o QR:

```powershell
powershell -ExecutionPolicy Bypass -File C:\HanneWhatsApp\windows\instalar.ps1 -Site https://hanne-atelier.SEU-USUARIO.workers.dev
```

As conversas antigas do WhatsApp ficam no banco local (não entram na cópia JSON); as novas passam a chegar na nuvem.
