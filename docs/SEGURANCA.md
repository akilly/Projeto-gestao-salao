# Revisão de segurança (31/10/2026)

Escopo: código do site (rotas, autenticação, API de estado, WhatsApp/conector, interface), conector Baileys, scripts locais e dependências. Método: leitura do código, testes automatizados, teste no navegador real (CSP e fluxos de acesso) e auditoria de dependências (`pnpm audit`, `npm audit`).

## O que já estava bem

| Área | Proteção |
|---|---|
| Senha | PBKDF2-SHA-256 (100.000 iterações, o máximo aceito pelo Web Crypto do Workers) com sal aleatório; comparação em tempo constante |
| Sessão | Token aleatório de 256 bits; banco guarda só o SHA-256; cookie `__Host-` com `HttpOnly; Secure; SameSite=Strict`; 12 h; logout e redefinição revogam no servidor |
| Força bruta | Limite por IP no login, no código de configuração e na senha de exclusão (10 tentativas / 15 min) |
| CSRF | `SameSite=Strict` e checagem de `Origin` em toda escrita (`/api/state`, `/api/auth`, `/api/whatsapp`) |
| Identidade | Vem só da sessão; o cabeçalho interno é sobrescrito, então um valor enviado pelo navegador não vale |
| Exclusão | Plano de cascata recalculado no servidor, revisão otimista e **senha da conta** obrigatória |
| Dados | `validateState` no servidor; limite de 3 MB; base de demonstração isolada; trava contra gravar dados fictícios na base real |
| XSS | A interface escapa todo dado do usuário (`esc`) antes de montar HTML; a varredura não achou interpolação sem escape |
| CSV | Células iniciadas por `= + - @` recebem `'` (evita fórmula em planilha) |
| WhatsApp | Segredos cifrados com AES-GCM vinculado à conta; webhook da Meta com HMAC; conector com chave de 256 bits guardada como hash; anexos só JPEG/PNG/áudio, sem SVG/HTML |
| Conector | Sem porta aberta; só HTTPS (http apenas para `localhost`); log sem textos nem chaves; diário impede envio duplicado |
| Segredos | Nenhuma chave no repositório; `.dev.vars` e `.env` no `.gitignore` |

## Corrigido nesta revisão

| # | Achado | Risco | Correção |
|---|---|---|---|
| 1 | Páginas sem CSP nem proteção contra iframe | Médio: reforço contra XSS e *clickjacking* | `lib/security-headers.mjs`: CSP só com scripts do próprio site, `frame-ancestors 'none'`, `X-Frame-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS em HTTPS. O script inline de tema virou `theme-boot.js`. Testado em todas as telas e janelas, sem bloqueios |
| 2 | `next` 16.3.4 com falhas críticas conhecidas (RCE em otimização de imagens e `use cache`) e `sharp` antigo | Alto no papel; baixo na prática, porque o Vinext não usa essas partes | `next` 16.4.3, `sharp` 0.35.5 e *overrides* para `@babel/core`, `browserslist`, `source-map-js` e `baseline-browser-mapping`. `pnpm audit --prod`: **nenhuma vulnerabilidade** |
| 3 | Dependência `zod` sem uso | Superfície desnecessária | Removida |
| 4 | Tabela de tentativas crescia sem limite | Baixo (armazenamento) | Limpeza das entradas vencidas a cada login |
| 5 | Recuperação de senha só com o código mestre | Médio: código longo e compartilhado | Link de uso único por e-mail (abaixo) |

## Links de acesso por e-mail (novo)

- Token de 256 bits; o banco guarda só o hash; o link vale **30 min** (redefinição) ou **24 h** (primeiro acesso) e é apagado ao ser usado.
- Só o link mais recente vale; no máximo um e-mail por minuto; limites de 5 pedidos por IP a cada 15 min e de 20 por hora no total, para proteger a cota gratuita.
- A resposta é igual para qualquer e-mail, então não revela qual é o da conta.
- O primeiro acesso só envia para `OWNER_EMAIL`. Se o envio falhar, o link é apagado.
- O link usa `APP_ORIGIN`, para que um cabeçalho `Host` forjado não desvie o link para outro site. O token sai da barra de endereço assim que a página abre, e `Referrer-Policy: no-referrer` impede que ele vaze para outros sites.
- Redefinir a senha encerra todas as sessões.

## Troca de senha e IA (adicionados depois da revisão)

- **Trocar senha** (Configurações → Sua conta) exige a sessão aberta e a senha atual, com limite de tentativas. A troca encerra as sessões dos outros aparelhos e renova a cookie deste.
- **Sair da conta** apaga a sessão no servidor. Só pede confirmação quando há alteração ainda sendo salva.
- **IA:**
  - só para a titular autenticada, com checagem de origem;
  - limite diário por tarefa e conversa limitada a 20 mensagens e 6.000 caracteres;
  - o conteúdo das clientes vai como dado, com instrução para ignorar comandos embutidos;
  - a resposta da IA nunca é enviada nem aplicada sem a profissional.

## Riscos conhecidos e recomendações

1. **Plano gratuito da Cloudflare (10 ms de CPU):** o PBKDF2 do login pode passar desse limite em alguns pedidos (erro 1102). Se acontecer, o plano Workers Paid resolve sem mudar o código.
2. **Limite de login por IP:** um ataque distribuído em muitos IPs não é barrado pela contagem. A senha mínima de 12 caracteres torna esse ataque impraticável. Para endurecer, ative o *rate limiting* da Cloudflare na rota `/api/auth/*`.
3. **Rotas do conector sem limite de requisições:** a chave de 256 bits não pode ser adivinhada, mas pedidos inválidos consomem a cota diária. Uma regra de *rate limiting* da Cloudflare em `/api/whatsapp/bridge/*` resolve.
4. **Dependências de desenvolvimento:** o `pnpm audit` completo aponta falhas em ferramentas de build (eslint-config-next, vinext, wrangler, vite). Elas rodam só no computador de quem compila, não no site publicado. Atualize quando sair uma versão nova delas.
5. **Baileys não é oficial:** o WhatsApp pode restringir o número. Mantenha o volume normal de conversa.
6. **Computador do conector:** a pasta `C:\HanneWhatsApp` contém a sessão do WhatsApp. Mantenha o Windows atualizado e com senha. Se o computador for perdido, remova o aparelho em WhatsApp → Aparelhos conectados.
7. **Backups:** a cópia completa JSON contém todos os dados das clientes. Guarde em local privado.

## Como repetir a verificação

```bash
npm test && npx tsc --noEmit && npm run lint
SITES_PNPM_SHARED_STORE=.sites-runtime/pnpm-store npx pnpm@11.25.0 audit --prod
(cd services/baileys && npm audit --omit=dev && npm test)
```
