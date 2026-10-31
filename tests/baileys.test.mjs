/** Baileys no computador do ateliê: o conector chama o site (sincronização), sem túnel nem servidor de entrada. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleWhatsApp, isWebhookPath } from '../lib/whatsapp-handler.mjs';
import { EVENTS } from '../lib/whatsapp-domain.mjs';
const master = btoa('1'.repeat(32)), origin = 'https://hanne.test', sender = '+5511999999999';
const QR = 'data:image/png;base64,aGVsbG8=';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(x => x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', ''));
  const db = { sqlite, prepare(sql) { return { bind(...args) { return { sql, args, async first() { return sqlite.prepare(sql).get(...args); }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; } }; } }; }, async batch(ss) { sqlite.exec('BEGIN IMMEDIATE'); try { const r = ss.map(s => ({ meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } })); sqlite.exec('COMMIT'); return r; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
  return { DB: db, WHATSAPP_ENCRYPTION_KEY: master, MEDIA: kv() };
}
/** KV em memória com a mesma API usada pelo handler. */
function kv() {
  const items = new Map();
  return { items, async put(key, value, options = {}) { items.set(key, { value: value instanceof ArrayBuffer ? value : new Uint8Array(value).buffer.slice(0), metadata: options.metadata || null }); }, async get(key) { return items.get(key)?.value || null; }, async getWithMetadata(key) { const item = items.get(key); return item ? { value: item.value, metadata: item.metadata } : { value: null, metadata: null }; } };
}
const req = (path, method = 'GET', body = null, user = 'a', extra = {}) => new Request(origin + '/api/whatsapp/' + path, { method, headers: { ...(user ? { 'oai-authenticated-user-id': user } : {}), Origin: origin, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
const bridgeKey = 'test-bridge-key-12345678901234567890';
const sync = async (env, body, key = bridgeKey) => handleWhatsApp(new Request(origin + '/api/whatsapp/bridge/sync', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env);
const inbound = { id: 'in-1', type: EVENTS[0], whatsappInboundMessage: { id: 'wa-in-1', from: '+5541999999999', to: sender, type: 'text', text: { body: 'Olá' }, sendTime: new Date().toISOString() } };
async function setup() {
  const env = database();
  const r = await handleWhatsApp(req('connection', 'POST', { provider: 'baileys', bridgeKey }), env);
  assert.equal(r.status, 200);
  const first = await (await sync(env, { status: 'disconnected' })).json();
  assert.equal(first.command, 'pair', 'o conector recebe o pedido de QR na primeira sincronização');
  await sync(env, { status: 'pairing', qr: QR });
  await sync(env, { status: 'ready', phone: sender });
  return { env, c: env.DB.sqlite.prepare('SELECT * FROM wa_connections').get() };
}

test('rotas do conector são públicas só nos caminhos exatos', () => {
  for (const ok of ['/api/whatsapp/bridge/sync', '/api/whatsapp/bridge/media/abcdefghijklmnop1234', '/api/whatsapp/bridge/outbox/abcdefghijklmnop1234', '/api/whatsapp/meta-webhook/x']) assert.ok(isWebhookPath(ok), ok);
  for (const no of ['/api/whatsapp/bridge', '/api/whatsapp/bridge/sync/x', '/api/whatsapp/bridge/media/../../x', '/api/whatsapp/connection', '/api/whatsapp/baileys-webhook/x', '/api/whatsapp/webhook/x']) assert.ok(!isWebhookPath(no), no);
});

test('chave guardada só cifrada/hash; chave desconhecida é recusada; QR aparece só para a dona', async () => {
  const env = database();
  await handleWhatsApp(req('connection', 'POST', { provider: 'baileys', bridgeKey }), env);
  const row = env.DB.sqlite.prepare('SELECT * FROM wa_bridge').get();
  assert.ok(row.key_hash && row.key_hash !== bridgeKey);
  assert.notEqual(env.DB.sqlite.prepare('SELECT api_key FROM wa_connections').get().api_key, bridgeKey);
  assert.equal((await sync(env, { status: 'pairing' }, 'outra-chave-1234567890123456789012345')).status, 401);
  await sync(env, { status: 'pairing', qr: QR });
  const mine = await (await handleWhatsApp(req('connection'), env)).json();
  assert.equal(mine.qr, QR); assert.equal(mine.bridgeOnline, true); assert.ok(!JSON.stringify(mine).includes(bridgeKey));
  const other = await (await handleWhatsApp(req('connection', 'GET', null, 'b'), env)).json();
  assert.ok(!other.qr);
  assert.equal((await handleWhatsApp(req('connection', 'POST', { provider: 'baileys', bridgeKey }, 'b'), env)).status, 409, 'a mesma chave não serve para outra conta');
});

test('conectado: número fica vinculado; outro número é desconectado pelo conector', async () => {
  const { env } = await setup();
  const status = await (await handleWhatsApp(req('connection'), env)).json();
  assert.equal(status.connected, true); assert.equal(status.phone, sender);
  const wrong = await (await sync(env, { status: 'ready', phone: '+5541888888888' })).json();
  assert.equal(wrong.command, 'logout');
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM wa_connections').get().status, 'wrong_number');
});

test('eventos chegam pela sincronização, deduplicados; evento de outro número é descartado', async () => {
  const { env } = await setup();
  const r = await (await sync(env, { status: 'ready', phone: sender, events: [inbound, inbound] })).json();
  assert.deepEqual(r.ack, ['in-1', 'in-1']);
  await sync(env, { status: 'ready', phone: sender, events: [inbound] });
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_messages').get().n, 1);
  assert.equal(env.DB.sqlite.prepare('SELECT resolved FROM wa_threads').get().resolved, 0);
  const foreign = { ...inbound, id: 'other', whatsappInboundMessage: { ...inbound.whatsappInboundMessage, id: 'x', to: '+5541888888888' } };
  assert.deepEqual((await (await sync(env, { status: 'ready', phone: sender, events: [foreign] })).json()).ack, ['other']);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_messages').get().n, 1);
});

test('envio vai para a fila, sai uma vez só e o resultado atualiza a conversa', async () => {
  const { env } = await setup();
  await sync(env, { status: 'ready', phone: sender, events: [inbound] });
  env.DB.sqlite.prepare("UPDATE wa_threads SET last_inbound='2020-01-01T00:00:00.000Z'").run();
  const thread = env.DB.sqlite.prepare('SELECT * FROM wa_threads').get(), requestId = crypto.randomUUID();
  const form = () => { const f = new FormData(); f.set('threadId', thread.id); f.set('requestId', requestId); f.set('text', 'Resposta'); return f; };
  const queued = await (await handleWhatsApp(req('send', 'POST', form()), env)).json();
  assert.equal(queued.message.status, 'queued', 'Baileys não depende da janela de 24 h e vai para a fila');
  assert.equal((await handleWhatsApp(req('send', 'POST', form()), env)).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_outbox').get().n, 1, 'mesma tentativa não duplica a fila');
  const first = await (await sync(env, { status: 'ready', phone: sender })).json();
  assert.equal(first.outbox.length, 1); assert.equal(first.outbox[0].requestId, requestId); assert.equal(first.outbox[0].to, '+5541999999999'); assert.equal(first.interval, 2);
  assert.equal((await (await sync(env, { status: 'ready', phone: sender })).json()).outbox.length, 0, 'item reservado não é entregue de novo antes de 2 min');
  const done = await (await sync(env, { status: 'ready', phone: sender, results: [{ requestId, status: 'accepted', providerId: 'wa-out-1' }] })).json();
  assert.deepEqual(done.resultsAck, [requestId]);
  const message = env.DB.sqlite.prepare('SELECT * FROM wa_messages WHERE request_id=?').get(requestId);
  assert.equal(message.status, 'accepted'); assert.equal(message.provider_id, 'wa-out-1');
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_outbox').get().n, 0);
  await sync(env, { status: 'ready', phone: sender, events: [{ id: 'st-1', type: EVENTS[1], whatsappMessage: { id: 'wa-out-1', from: sender, status: 'read', externalId: requestId } }] });
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM wa_messages WHERE request_id=?').get(requestId).status, 'read');
  assert.equal((await handleWhatsApp(req('thread/' + thread.id, 'GET', null, 'b'), env)).status, 404, 'conta alheia não acessa a conversa');
});

test('resultado incerto não volta para a fila; falha mostra o motivo', async () => {
  const { env } = await setup();
  await sync(env, { status: 'ready', phone: sender, events: [inbound] });
  const thread = env.DB.sqlite.prepare('SELECT * FROM wa_threads').get();
  const send = async () => { const f = new FormData(); const id = crypto.randomUUID(); f.set('threadId', thread.id); f.set('requestId', id); f.set('text', 'Oi'); await handleWhatsApp(req('send', 'POST', f), env); return id; };
  const a = await send(), b = await send();
  await sync(env, { status: 'ready', phone: sender });
  await sync(env, { status: 'ready', phone: sender, results: [{ requestId: a, status: 'uncertain' }, { requestId: b, status: 'failed', error: 'Número sem WhatsApp.' }] });
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM wa_messages WHERE request_id=?').get(a).status, 'uncertain');
  const failed = env.DB.sqlite.prepare('SELECT * FROM wa_messages WHERE request_id=?').get(b);
  assert.equal(failed.status, 'failed'); assert.equal(failed.error, 'Número sem WhatsApp.');
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_outbox').get().n, 0);
});

test('anexos: recebido fica no KV e só a dona vê; envio com anexo é buscado pelo conector', async () => {
  const { env } = await setup();
  const mediaId = 'media-abcdefghijklmnop';
  const up = await handleWhatsApp(new Request(origin + '/api/whatsapp/bridge/media/' + mediaId, { method: 'POST', headers: { Authorization: 'Bearer ' + bridgeKey, 'Content-Type': 'image/jpeg' }, body: new Uint8Array([255, 216, 255, 1, 2, 3]) }), env);
  assert.equal(up.status, 200);
  assert.equal((await handleWhatsApp(new Request(origin + '/api/whatsapp/bridge/media/' + mediaId, { method: 'POST', headers: { Authorization: 'Bearer ' + bridgeKey, 'Content-Type': 'text/html' }, body: 'x' }), env)).status, 415);
  const photo = { id: 'in-photo', type: EVENTS[0], whatsappInboundMessage: { id: 'wa-photo', from: '+5541999999999', to: sender, type: 'image', image: { mediaRef: 'baileys:' + mediaId, caption: 'foto' }, text: { body: 'foto' }, sendTime: new Date().toISOString() } };
  await sync(env, { status: 'ready', phone: sender, events: [photo] });
  const message = env.DB.sqlite.prepare("SELECT * FROM wa_messages WHERE provider_id='wa-photo'").get();
  const view = await handleWhatsApp(req('media/' + message.id), env);
  assert.equal(view.status, 200); assert.equal(view.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await view.arrayBuffer())], [255, 216, 255, 1, 2, 3]);
  assert.equal((await handleWhatsApp(req('media/' + message.id, 'GET', null, 'b'), env)).status, 404);
  const thread = env.DB.sqlite.prepare('SELECT * FROM wa_threads').get(), requestId = crypto.randomUUID();
  const f = new FormData(); f.set('threadId', thread.id); f.set('requestId', requestId); f.set('text', ''); f.set('file', new File([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])], 'foto.jpg', { type: 'image/jpeg' }));
  const queued = await handleWhatsApp(req('send', 'POST', f), env);
  assert.equal(queued.status, 200, await queued.clone().text());
  const outbox = (await (await sync(env, { status: 'ready', phone: sender })).json()).outbox[0];
  assert.equal(outbox.mime, 'image/jpeg');
  const bytes = await handleWhatsApp(new Request(origin + outbox.media, { headers: { Authorization: 'Bearer ' + bridgeKey } }), env);
  assert.equal(bytes.status, 200); assert.equal((await bytes.arrayBuffer()).byteLength, 10);
  assert.equal((await handleWhatsApp(new Request(origin + outbox.media), env)).status, 401);
});

test('novo QR e desconexão viram comandos para o conector; depois disso ele fica em espera', async () => {
  const { env } = await setup();
  assert.equal((await handleWhatsApp(req('connection/retry', 'POST'), env)).status, 200);
  assert.equal((await (await sync(env, { status: 'ready', phone: sender })).json()).command, 'pair');
  assert.equal((await handleWhatsApp(req('connection', 'DELETE'), env)).status, 200);
  const off = await (await sync(env, { status: 'ready', phone: sender })).json();
  assert.equal(off.command, 'logout'); assert.equal(off.disconnected, true);
  assert.equal((await (await sync(env, { status: 'disconnected' })).json()).command, null);
  assert.equal((await (await handleWhatsApp(req('connection'), env)).json()).connected, false);
});

test('conector parado aparece como offline com orientação, sem fingir conexão', async () => {
  const { env } = await setup();
  env.DB.sqlite.prepare('UPDATE wa_bridge SET seen_at=?').run(Date.now() - 10 * 60000);
  const status = await (await handleWhatsApp(req('connection'), env)).json();
  assert.equal(status.connected, false); assert.equal(status.bridgeOnline, false);
  assert.match(status.setupError, /computador está ligado/);
});

test('exclusão de mensagem e conversa exige confirmação e conta certa, preserva deduplicação', async () => {
  const { env } = await setup();
  await sync(env, { status: 'ready', phone: sender, events: [inbound] });
  const thread = env.DB.sqlite.prepare('SELECT * FROM wa_threads').get(), message = env.DB.sqlite.prepare('SELECT * FROM wa_messages').get();
  assert.equal((await handleWhatsApp(req('erase-message/' + message.id, 'DELETE', { confirmed: false }), env)).status, 400);
  assert.equal((await handleWhatsApp(req('erase-thread/' + thread.id, 'DELETE', { confirmed: true }, 'b'), env)).status, 404);
  assert.equal((await handleWhatsApp(req('erase-message/' + message.id, 'DELETE', { confirmed: true }), env)).status, 200);
  const erased = env.DB.sqlite.prepare('SELECT * FROM wa_messages').get();
  assert.equal(erased.body, ''); assert.equal(erased.type, 'deleted');
  await sync(env, { status: 'ready', phone: sender, events: [inbound] });
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_messages').get().n, 1);
  assert.equal((await handleWhatsApp(req('erase-thread/' + thread.id, 'DELETE', { confirmed: true }), env)).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_threads').get().n, 0);
});

test('IA classifica sozinha as conversas com mensagem nova, uma vez por mensagem, sem travar a lista', async () => {
  const { env } = await setup();
  const calls = [];
  env.AI = { run: async (model, input) => { calls.push(input.messages.at(-1).content); return { response: { category: 'Agendamento urgente', priority: 'alta', reason: 'Quer horário amanhã.' } }; } };
  await sync(env, { status: 'ready', phone: sender, events: [{ ...inbound, whatsappInboundMessage: { ...inbound.whatsappInboundMessage, text: { body: 'Tem horário amanhã cedo?' } } }] });
  const first = await (await handleWhatsApp(req('threads'), env)).json();
  assert.equal(first.threads[0].ai_category, 'Agendamento urgente'); assert.equal(first.threads[0].ai_priority, 'alta');
  assert.match(calls[0], /Cliente: Tem horário amanhã cedo\?/);
  await handleWhatsApp(req('threads'), env);
  assert.equal(calls.length, 1, 'sem mensagem nova, não chama a IA de novo');
  // Falha da IA não quebra a lista e não fica tentando a cada atualização.
  env.AI = { run: async () => { throw Error('falhou'); } };
  await sync(env, { status: 'ready', phone: sender, events: [{ ...inbound, id: 'in-2', whatsappInboundMessage: { ...inbound.whatsappInboundMessage, id: 'wa-in-2', sendTime: new Date(Date.now() + 1000).toISOString() } }] });
  const after = await handleWhatsApp(req('threads'), env); assert.equal(after.status, 200);
  const t = env.DB.sqlite.prepare('SELECT ai_at,last_inbound FROM wa_threads').get(); assert.equal(t.ai_at, t.last_inbound);
});
