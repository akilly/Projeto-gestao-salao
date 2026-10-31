# Publicação no Cloudflare Workers + D1

O sistema é um Worker (Vinext) com banco D1. O plano gratuito da Cloudflare atende o uso de uma profissional. Os passos abaixo são feitos uma única vez no computador de quem administra a conta.

## 1. Pré-requisitos

- Node.js 22.13 ou mais recente.
- Conta Cloudflare (gratuita).
- Dependências instaladas na pasta do projeto:

```bash
npx pnpm@11.25.0 install
```

## 2. Entrar na Cloudflare e criar o banco

```bash
npx wrangler login
```

```bash
npx wrangler d1 create hanne-atelier-db
```

Guarde o `database_id` exibido (formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

## 3. Publicar

No PowerShell:

```powershell
$env:CLOUDFLARE_D1_DATABASE_ID="cole-o-database_id-aqui"; npm run deploy:cloudflare
```

No macOS/Linux:

```bash
CLOUDFLARE_D1_DATABASE_ID=cole-o-database_id-aqui npm run deploy:cloudflare
```

O script faz o build, aponta o Worker para o banco, aplica as migrações em `drizzle/` e publica. O endereço final aparece no fim (por exemplo `https://hanne-atelier.SEU-USUARIO.workers.dev`). Variáveis opcionais: `WORKER_NAME` (padrão `hanne-atelier`) e `D1_DATABASE_NAME` (padrão `hanne-atelier-db`). Para conferir o pacote sem publicar, acrescente `-- --dry-run`.

## 4. Segredos do servidor

### E-mails de acesso (recomendado)

Com o envio de e-mails configurado, o **primeiro acesso** e o **"Esqueci minha senha"** funcionam por um link enviado ao e-mail da titular. O envio usa o **Brevo** (gratuito, 300 e-mails por dia):

1. Crie a conta em brevo.com, confirme o e-mail remetente em **Remetentes** e gere uma chave em **SMTP e API → Chaves de API**.
2. Rode o assistente. Ele confere a chave, envia um e-mail de teste e salva os segredos no Worker:

```bash
npm run email:configurar -- --nuvem
```

O assistente grava `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` e `OWNER_EMAIL` (o único e-mail que pode receber o link de primeiro acesso). Defina também o endereço público usado nos links:

```bash
npx wrangler secret put APP_ORIGIN --name hanne-atelier   # ex.: https://hanne-atelier.SEU-USUARIO.workers.dev
```

### Código de configuração (alternativa sem e-mail)

O **código de configuração** também cria a conta da titular e permite redefinir a senha. Use um valor longo e aleatório (mínimo 16 caracteres) e guarde-o em local seguro, como um gerenciador de senhas:

```bash
npx wrangler secret put SETUP_TOKEN --name hanne-atelier
```

Chave de cifragem das credenciais do WhatsApp (gere uma vez e **nunca troque** depois de conectar o número, ou as credenciais salvas deixam de abrir):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```bash
npx wrangler secret put WHATSAPP_ENCRYPTION_KEY --name hanne-atelier
```

O conector do WhatsApp (Baileys) não precisa de nenhum secret extra: ele roda no computador do ateliê e chama o site com a própria chave. Para receber e enviar **anexos** (fotos e áudios), crie um namespace KV e informe o ID no deploy: `npx wrangler kv namespace create hanne-media` e depois `CLOUDFLARE_KV_MEDIA_ID=<id> npm run deploy:cloudflare`.

### Inteligência artificial

Não precisa de segredo: o deploy liga o **Workers AI** (binding `AI`) automaticamente. O plano gratuito tem 10.000 *neurons* por dia e o sistema limita o uso para caber nisso. Veja `docs/INTELIGENCIA_ARTIFICIAL.md`.

## 5. Primeiro acesso

1. Abra o endereço publicado. Com e-mail configurado, informe o e-mail da titular e abra o link recebido para criar a senha (mínimo 12 caracteres). Sem e-mail, a tela pede o código de configuração.
2. **Trazendo dados da versão anterior:** antes de “Preparar operação”, vá em Configurações → **Restaurar cópia JSON** e escolha o arquivo baixado em “Cópia completa JSON” na versão antiga. A restauração só é aceita com a base vazia.
3. Sem dados anteriores, siga por “Preparar operação”.

Esqueceu a senha? Na tela de login, “Esqueci minha senha” envia um link (válido por 30 minutos) para o e-mail da conta; sem e-mail configurado, pede o código de configuração. A redefinição encerra as sessões abertas em outros aparelhos.

## 6. WhatsApp por QR (Baileys)

O conector roda no computador do ateliê e chama o site (veja `docs/WHATSAPP_NO_COMPUTADOR.md`). Rode o instalador com `-Site` igual ao endereço publicado no passo 3, sem barra no final.

## Atualizações

Depois de mudanças no código, repita o passo 3. As migrações já aplicadas não são repetidas.

## Desenvolvimento local

```bash
npm run dev
```

Para testar o cadastro da titular localmente, crie o arquivo `.dev.vars` (não versionado) com `SETUP_TOKEN=um-codigo-local-de-teste`. Ou crie o usuário de teste direto no banco local com `npm run user:test:create`. Testes: `npm test`.
