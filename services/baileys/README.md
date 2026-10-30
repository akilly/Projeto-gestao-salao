> **Instalação no Windows (recomendada):** siga o `LEIA-ME.md` deste pacote (ou `docs/WHATSAPP_NO_COMPUTADOR.md` no repositório). O script `windows\instalar.ps1` faz tudo automaticamente.

# Conector WhatsApp (Baileys)

Processo Node que mantém a sessão do WhatsApp (como o WhatsApp Web) no computador do ateliê e conversa com o site publicado no Cloudflare Workers.

## Como funciona (modo "o conector chama o site")

```
Computador do ateliê                              Site (Cloudflare Workers + D1 + KV)
┌─────────────────────────┐   POST /api/whatsapp/bridge/sync (a cada 2–15 s)   ┌───────────────────────┐
│ server.mjs (Baileys)    │ ─────────────────────────────────────────────────▶ │ status, QR, eventos,   │
│ data/auth  (sessão)     │ ◀───────────────────────────────────────────────── │ resultados → ack, fila │
│ data/journal.sqlite     │   POST /bridge/media/<id> (anexo recebido)          │ de envio e comandos    │
│ data/status.json        │   GET  /bridge/outbox/<id> (anexo a enviar)         └───────────────────────┘
└─────────────────────────┘
```

- **Sem porta aberta, túnel ou domínio.** Só conexões de saída HTTPS. Custo zero nos planos gratuitos.
- **Autenticação:** `Authorization: Bearer BRIDGE_KEY`. O site guarda só o hash da chave (tabela `wa_bridge`) e uma cópia cifrada (AES-GCM) em `wa_connections.api_key`.
- **Comandos do site:** `pair` (gerar QR) e `logout` (desconectar e apagar a sessão local).
- **Fila de envio:** o site só coloca na fila o que a profissional clicou para enviar. Item sem resultado é oferecido de novo após 2 min; o diário local impede envio duplicado.
- **Anexos:** recebidos vão para o Workers KV (`MEDIA`) por 30 dias, sempre **antes** do evento que os referencia. Sem KV configurado, o texto da mensagem chega normalmente e o anexo fica só no celular.

## Instalação manual (Linux/macOS ou para desenvolvimento)

Requisitos: Node 22.13 ou superior, pasta de dados persistente e privada, um único processo por pasta.

1. Em `services/baileys`, rode `npm ci`.
2. Copie `.env.example` para `.env` e gere a chave: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
3. Preencha `BRIDGE_KEY`, `SITE_ORIGIN` (endereço HTTPS do site, sem barra final) e `DATA_DIR`.
4. Rode `npm start` e configure reinício automático no gerenciador de serviços do sistema.
5. No site: Dados reais → Atendimentos → WhatsApp → Conectar. Cole a chave. Nunca envie a chave por chat.
6. Leia o QR em WhatsApp → Aparelhos conectados → Conectar um aparelho.

Para testes locais, `SITE_ORIGIN` aceita também `http://127.0.0.1:PORTA` ou `http://localhost:PORTA`.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `server.mjs` | Sessão Baileys + laço de sincronização com o site |
| `store.mjs` | Diário SQLite: envios (antes do efeito externo), eventos pendentes, número esperado |
| `data/status.json` | Diagnóstico lido por `windows/status.ps1` (sem segredos) |
| `windows/*.ps1` | Instalar, executar (tarefa do Windows), ver status e desinstalar |
| `*.test.mjs` | `npm test`: diário e sincronização contra um site falso local |

## Segurança

- Um conector atende uma única conta e um único número. Número diferente do já vinculado é recusado (no conector e no site).
- `data/auth` guarda as credenciais do aparelho conectado: material sensível. O instalador restringe a pasta a Administradores e SYSTEM.
- O log não registra textos, chaves, QR nem números completos.
- Apenas conversas individuais novas. Grupos, status e histórico antigo não são importados.

## Limites

Baileys é uma biblioteca independente, não oficial da Meta: não há garantia de estabilidade nem proteção contra restrições do número. Use com volume normal de conversa, sem disparos em massa. O computador precisa estar ligado e com internet para enviar e receber; mensagens recebidas com ele desligado chegam quando ele volta (o WhatsApp as entrega ao reconectar).

Texto até 4.096 caracteres; imagem JPEG/PNG até 5 MB; áudio até 16 MB (sem legenda). Envio com resultado incerto nunca é repetido automaticamente: confira no celular.

Fontes: https://github.com/WhiskeySockets/Baileys. Dependência fixada em `baileys 7.0.0-rc14`; atualizações exigem revisão e novo teste real.
