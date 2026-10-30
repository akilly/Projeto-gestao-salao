/**
 * Esquema D1 do snapshot financeiro e das quatro tabelas do canal WhatsApp. atelier_accounts guarda snapshot e revisão por base; atelier_events guarda metadados de alterações. Cada cliente do salão está dentro do payload, não em tabela própria.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
export const atelierAccounts = sqliteTable('atelier_accounts', { userId: text('user_id').primaryKey(), revision: integer('revision').notNull().default(0), payload: text('payload').notNull(), updatedAt: text('updated_at').notNull() });
export const atelierEvents = sqliteTable('atelier_events', { id: text('id').primaryKey(), userId: text('user_id').notNull(), revision: integer('revision').notNull(), action: text('action').notNull(), changes: text('changes').notNull(), createdAt: text('created_at').notNull() });
/** Canal por conta. Chaves e segredos são cifrados pelo servidor, nunca parte do snapshot. */
export const waConnections = sqliteTable('wa_connections', {
  userId: text('user_id').primaryKey(), id: text('id').notNull().unique(), phone: text('phone').notNull().unique(),
  phoneId: text('phone_id').notNull(), wabaId: text('waba_id').notNull(), apiKey: text('api_key'),
  webhookSecret: text('webhook_secret'), webhookId: text('webhook_id'), status: text('status').notNull(),
  providerStatus: text('provider_status').notNull(), updatedAt: integer('updated_at').notNull(), lastWebhook: text('last_webhook'),
  provider: text('provider').notNull().default('ycloud'), verifyToken: text('verify_token'),
  webhookVerifiedAt: text('webhook_verified_at'), subscribedAt: text('subscribed_at'), metaLastInbound: text('meta_last_inbound'), connectionError: text('connection_error'),
});
/** Cada contato do WhatsApp é separado do cadastro de clientes; sem união por nome. */
export const waThreads = sqliteTable('wa_threads', {
  id: text('id').primaryKey(), channelId: text('channel_id').notNull(), peer: text('peer').notNull(), name: text('name').notNull(),
  lastInbound: text('last_inbound'), lastAt: text('last_at').notNull(), resolved: integer('resolved').notNull().default(0),
}, t => [uniqueIndex('wa_thread_peer').on(t.channelId, t.peer), index('wa_thread_latest').on(t.channelId, t.lastAt)]);
/** Tentativa de envio única; status de transporte é independente de pagamento. */
export const waMessages = sqliteTable('wa_messages', {
  id: text('id').primaryKey(), channelId: text('channel_id').notNull(), threadId: text('thread_id').notNull(),
  providerId: text('provider_id'), requestId: text('request_id'), fingerprint: text('fingerprint'), direction: text('direction').notNull(),
  type: text('type').notNull(), body: text('body').notNull(), media: text('media'), status: text('status').notNull(),
  error: text('error'), at: text('at').notNull(),
}, t => [uniqueIndex('wa_provider_message').on(t.channelId, t.providerId), uniqueIndex('wa_send_request').on(t.channelId, t.requestId), index('wa_thread_messages').on(t.threadId, t.at)]);
/** IDs processados evitam repetição. Evento e efeitos são confirmados no mesmo batch. */
export const waEvents = sqliteTable('wa_events', { id: text('id').primaryKey(), channelId: text('channel_id').notNull(), at: text('at').notNull() });

/** Conector Baileys no computador do ateliê: ele chama o site (sem túnel). A chave só existe como hash. */
export const waBridge = sqliteTable('wa_bridge', {
  channelId: text('channel_id').primaryKey(), keyHash: text('key_hash').notNull(), status: text('status').notNull().default('offline'),
  phone: text('phone'), qr: text('qr'), qrUntil: integer('qr_until'), seenAt: integer('seen_at'), command: text('command'),
}, t => [uniqueIndex('wa_bridge_key').on(t.keyHash)]);
/** Fila de envio buscada pelo conector; o conteúdo do anexo fica no KV MEDIA. */
export const waOutbox = sqliteTable('wa_outbox', {
  channelId: text('channel_id').notNull(), requestId: text('request_id').notNull(), messageId: text('message_id').notNull(),
  peer: text('peer').notNull(), body: text('body').notNull(), mime: text('mime'), createdAt: integer('created_at').notNull(), claimedAt: integer('claimed_at'),
}, t => [primaryKey({ columns: [t.channelId, t.requestId] })]);

/** Conta da profissional: derivação de senha, sessões revogáveis e limite de tentativas. */
export const salonCredentials=sqliteTable('salon_credentials',{id:integer('id').primaryKey(),ownerId:text('owner_id').notNull(),email:text('email').notNull(),salt:text('salt').notNull(),passwordHash:text('password_hash').notNull()});
export const salonSessions=sqliteTable('salon_sessions',{tokenHash:text('token_hash').primaryKey(),ownerId:text('owner_id').notNull(),expiresAt:integer('expires_at').notNull()});
export const salonLoginLimits=sqliteTable('salon_login_limits',{bucket:text('bucket').primaryKey(),attempts:integer('attempts').notNull(),resetAt:integer('reset_at').notNull()});
