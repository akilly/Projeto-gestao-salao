# Integração Baileys — lado do site

Visão geral, segurança e instalação manual do conector: [`services/baileys/README.md`](../services/baileys/README.md).
Passo a passo no Windows para a titular: [`WHATSAPP_NO_COMPUTADOR.md`](WHATSAPP_NO_COMPUTADOR.md).

## Rotas (em `lib/whatsapp-handler.mjs`)

| Rota | Quem chama | Autenticação | Faz |
|---|---|---|---|
| `POST /api/whatsapp/connection` `{provider:'baileys', bridgeKey}` | Ateliê (tela) | Sessão da titular | Cadastra a chave (hash em `wa_bridge`, cifrada em `wa_connections.api_key`) e agenda o comando `pair` |
| `POST /api/whatsapp/connection/retry` | Ateliê | Sessão | Novo QR (comando `pair`) |
| `DELETE /api/whatsapp/connection` | Ateliê | Sessão | Comando `logout`; mensagens na fila viram "falhou" |
| `POST /api/whatsapp/bridge/sync` | Conector | `Bearer chave` | Recebe status/QR/eventos/resultados; devolve `ack`, `resultsAck`, `outbox`, `command`, `expectedPhone`, `interval` |
| `POST /api/whatsapp/bridge/media/<id>` | Conector | `Bearer chave` | Guarda anexo recebido no KV (`m:<canal>:<id>`, 30 dias) |
| `GET /api/whatsapp/bridge/outbox/<requestId>` | Conector | `Bearer chave` | Entrega o anexo a enviar (KV `o:<canal>:<requestId>`, 7 dias) |

## Tabelas (migração `drizzle/0004_baileys_pull.sql`)

- `wa_bridge`: uma linha por canal com `key_hash` (único), último status, número, QR (válido por 55 s), `seen_at` e comando pendente.
- `wa_outbox`: fila de envio (`request_id`, destino, texto, tipo do anexo, `claimed_at`). Item sem resultado volta à fila após 2 minutos.

## Estados da mensagem enviada

`queued` (na fila do conector) → `sending` (entregue ao conector) → `accepted` / `failed` / `uncertain`. Depois, os recibos do WhatsApp avançam para `sent`, `delivered` e `read`, sem nunca regredir.

## Limites do plano gratuito

O conector sincroniza a cada 5 s (2 s enquanto há QR ou fila; 15 s após erro): cerca de 17 mil requisições por dia, dentro das 100 mil do Workers Free. O estado só é gravado no D1 quando muda (ou a cada ~20 s). Anexos ficam no KV para não pesar a CPU do Worker.

## Implantação

```bash
CLOUDFLARE_D1_DATABASE_ID=<id do D1> CLOUDFLARE_KV_MEDIA_ID=<id do KV> npm run deploy:cloudflare
```

Secrets necessários no Worker: `SETUP_TOKEN` e `WHATSAPP_ENCRYPTION_KEY`. Sem `CLOUDFLARE_KV_MEDIA_ID`, tudo funciona, exceto anexos (o texto chega e o anexo fica só no celular).
