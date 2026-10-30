/**
 * Conector do WhatsApp (Baileys) que roda no computador do ateliê.
 *
 * Modo "o conector chama o site": não abre porta, não precisa de túnel nem domínio.
 * A cada poucos segundos ele faz POST em SITE_ORIGIN/api/whatsapp/bridge/sync com:
 *   - status da sessão, número conectado e QR Code (só enquanto pareando);
 *   - mensagens recebidas/enviadas pelo celular (eventos) e resultados dos envios.
 * A resposta traz: confirmações (ack/resultsAck), a fila de mensagens a enviar (outbox)
 * e comandos ('pair' para gerar QR, 'logout' para desconectar).
 *
 * Garantias:
 *   - Nenhuma mensagem é enviada sozinha: a fila só contém o que a profissional clicou para enviar.
 *   - Cada envio é anotado no diário local ANTES de ir ao WhatsApp; se cair no meio, o resultado
 *     fica "incerto" e nunca é reenviado automaticamente (evita mensagem duplicada para a cliente).
 *   - O log não mostra textos, chaves, QR nem números completos.
 */
import { mkdir, writeFile, readFile, rm, readdir, stat, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import makeWASocket, { useMultiFileAuthState as loadAuthState, DisconnectReason, downloadMediaMessage, normalizeMessageContent, jidNormalizedUser, generateMessageIDV2, fetchLatestWaWebVersion } from 'baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { openStore } from './store.mjs';

/* ---------- Configuração (.env) ---------- */
const KEY = process.env.BRIDGE_KEY || '';
const SITE = (process.env.SITE_ORIGIN || '').replace(/\/+$/, '');
if (!/^[A-Za-z0-9_-]{32,160}$/.test(KEY)) throw Error('Configure BRIDGE_KEY no arquivo .env (o instalador gera uma automaticamente).');
// HTTPS obrigatório; http só para testes locais no próprio computador.
if (!/^(https:\/\/[^/\s]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/.test(SITE)) throw Error('Configure SITE_ORIGIN com o endereço do ateliê, por exemplo https://hanne-atelier.SEU-USUARIO.workers.dev');
const VERSION = 2;
const MIMES = ['image/jpeg', 'image/png', 'audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'];
const maxBytes = mime => (mime.startsWith('image/') ? 5 : 16) * 1024 * 1024;

process.umask(0o077);
const DIR = resolve(process.env.DATA_DIR || './data');
const AUTH = join(DIR, 'auth'), MEDIA = join(DIR, 'media');
await mkdir(MEDIA, { recursive: true, mode: 0o700 });
const store = openStore(join(DIR, 'journal.sqlite'));
const logger = pino({ level: 'silent' });

/* ---------- Log e diagnóstico ---------- */
const log = message => console.log(new Date().toISOString(), '[hanne-whatsapp]', message);
const masked = phone => (phone ? phone.slice(0, 5) + '…' + phone.slice(-2) : '');
/** data/status.json: lido pelo status.ps1 para mostrar a situação sem abrir o site. */
const diag = { version: VERSION, site: SITE, lastSync: null, lastError: null };
async function writeStatus() {
  try { await writeFile(join(DIR, 'status.json'), JSON.stringify({ ...diag, whatsapp: status, phone: masked(ownPhone()), updatedAt: new Date().toISOString() }, null, 2)); } catch { /* diagnóstico é opcional */ }
}
let lastLogged = '';
/** Evita repetir a mesma mensagem de erro a cada sincronização. */
const logOnce = message => { if (message !== lastLogged) { lastLogged = message; log(message); } };

/* ---------- Estado da sessão do WhatsApp ---------- */
let socket = null, status = 'disconnected', qr = null, qrUntil = 0, starting = false, reconnect = null, failures = 0;
let expectedPhone = store.config()?.expectedPhone || '';
const phoneOf = jid => { const number = String(jid || '').split('@')[0].split(':')[0]; return /^[1-9]\d{7,14}$/.test(number) ? '+' + number : ''; };
const ownPhone = () => phoneOf(socket?.user?.id);
const hasSession = () => access(join(AUTH, 'creds.json')).then(() => true, () => false);

/** Guarda evento para o próximo sync; o id torna o reenvio idempotente no site. */
function event(type, message, id, upload) {
  const body = { id: id || randomUUID(), type, [type === 'whatsapp.inbound_message.received' ? 'whatsappInboundMessage' : 'whatsappMessage']: message };
  if (upload) body._upload = upload;
  store.enqueue(body);
}
async function contactJid(message) {
  const original = message.key.remoteJid || '';
  if (original.endsWith('@s.whatsapp.net')) return jidNormalizedUser(original);
  if (original.endsWith('@lid')) return message.key.remoteJidAlt || await socket.signalRepository?.lidMapping?.getPNForLID(original) || '';
  return '';
}
/** Só conversas individuais novas; grupos, status e histórico antigo ficam de fora. */
async function receive(message) {
  const peer = phoneOf(await contactJid(message)), own = ownPhone();
  if (!peer || !own || !message.message || !message.key.id) return;
  const outgoing = !!message.key.fromMe;
  // Mensagem enviada pelo próprio ateliê já está registrada lá; não duplica como "eco".
  if (outgoing && store.db.prepare('SELECT id FROM sends WHERE provider_id=?').get(message.key.id)) return;
  const content = normalizeMessageContent(message.message) || {}, image = content.imageMessage, audio = content.audioMessage;
  const type = image ? 'image' : audio ? 'audio' : content.conversation || content.extendedTextMessage ? 'text' : 'unsupported';
  const text = content.conversation || content.extendedTextMessage?.text || image?.caption || '';
  let media, upload;
  if (image || audio) try {
    const bytes = await downloadMediaMessage(message, 'buffer', {}, { logger, reuploadRequest: socket.updateMediaMessage });
    const mime = String((image || audio).mimetype || '').split(';')[0];
    if (MIMES.includes(mime) && bytes.length <= maxBytes(mime)) {
      const id = randomUUID();
      await writeFile(join(MEDIA, id), bytes);
      media = { [type]: { mediaRef: 'baileys:' + id, caption: image?.caption || '' } };
      upload = { id, mime };
    }
  } catch { /* Sem o anexo, a mensagem continua visível no celular. */ }
  event(outgoing ? 'whatsapp.smb.message.echoes' : 'whatsapp.inbound_message.received', {
    id: message.key.id, from: outgoing ? own : peer, to: outgoing ? peer : own, type, text: { body: text }, ...media,
    sendTime: new Date(Number(message.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
    customerProfile: { name: outgoing ? peer : message.pushName || peer }
  }, (outgoing ? 'out:' : 'in:') + message.key.id, upload);
}

/** Abre (ou retoma) a sessão. Um único socket por vez; reconecta sozinho, exceto após logout. */
async function start() {
  if (starting || socket) return;
  starting = true; status = 'reconnecting';
  try {
    const { state, saveCreds } = await loadAuthState(AUTH);
    // Usa a versão atual do WhatsApp Web quando disponível; se falhar, fica com a padrão da biblioteca.
    const latest = await fetchLatestWaWebVersion({ signal: AbortSignal.timeout(5000) }).catch(() => null);
    const own = socket = makeWASocket({ auth: state, logger, ...(latest?.version ? { version: latest.version } : {}), syncFullHistory: false, markOnlineOnConnect: false, shouldIgnoreJid: jid => jid.endsWith('@g.us') || jid === 'status@broadcast' });
    own.ev.on('creds.update', saveCreds);
    own.ev.on('connection.update', async update => {
      if (socket !== own) return;
      if (update.qr) {
        qr = await QRCode.toDataURL(update.qr, { width: 280, margin: 3 }); qrUntil = Date.now() + 55000;
        if (status !== 'pairing') log('QR Code pronto: abra o ateliê em Atendimentos → WhatsApp para ler com o celular.');
        status = 'pairing';
      }
      if (update.connection === 'open') {
        qr = null; qrUntil = 0;
        if (expectedPhone && ownPhone() !== expectedPhone) { status = 'wrong_number'; log('O QR foi lido por um número diferente do vinculado; sessão encerrada.'); await own.logout().catch(() => {}); return; }
        status = 'ready'; failures = 0; log('WhatsApp conectado (' + masked(ownPhone()) + ').');
      }
      if (update.connection === 'close') {
        socket = null; qr = null;
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut || status === 'wrong_number') {
          // Sessão inválida: apaga as credenciais para o próximo pareamento gerar um QR novo.
          if (status !== 'wrong_number') status = 'disconnected';
          await rm(AUTH, { recursive: true, force: true });
          log('Sessão do WhatsApp encerrada. Para conectar de novo, gere um QR no ateliê.');
        } else {
          status = 'reconnecting';
          // 515 = reinício pedido pelo WhatsApp logo após parear; é normal.
          // Espera crescente (5 s, 10 s, 20 s… até 2 min) para não insistir sem parar se a internet cair.
          const wait = code === DisconnectReason.restartRequired ? 500 : Math.min(120000, 5000 * 2 ** failures++);
          if (code !== DisconnectReason.restartRequired) logOnce('Conexão com o WhatsApp caiu (código ' + (code || '?') + '); tentando de novo sozinho.');
          clearTimeout(reconnect); reconnect = setTimeout(() => void start(), wait);
        }
      }
    });
    own.ev.on('messages.upsert', update => { if (update.type === 'notify') for (const message of update.messages) void receive(message).catch(() => {}); });
    own.ev.on('messages.update', updates => {
      const names = { 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' };
      for (const { key, update } of updates) if (key.fromMe && names[update.status]) {
        const externalId = store.db.prepare('SELECT id FROM sends WHERE provider_id=?').get(key.id)?.id || '';
        event('whatsapp.message.updated', { id: key.id, from: ownPhone(), status: names[update.status], externalId }, 'status:' + key.id + ':' + update.status);
      }
    });
  } catch (error) {
    socket = null; status = 'reconnecting';
    log('Falha ao iniciar a sessão (' + (error?.message || 'erro') + '); nova tentativa em 30 s.');
    clearTimeout(reconnect); reconnect = setTimeout(() => void start(), 30000);
  } finally { starting = false; }
}
/** Desconecta de verdade: sai da conta no WhatsApp e apaga credenciais e pendências locais. */
async function logout() {
  clearTimeout(reconnect);
  const own = socket; socket = null; status = 'disconnected'; qr = null; failures = 0;
  try { await own?.logout(); } catch { own?.end(undefined); }
  await rm(AUTH, { recursive: true, force: true });
  store.db.exec('DELETE FROM events;');
  expectedPhone = ''; store.config(null);
  log('Desconectado a pedido do ateliê.');
}

/* ---------- Comunicação com o site ---------- */
const auth = { Authorization: 'Bearer ' + KEY };
async function call(path, init = {}) {
  return fetch(SITE + path, { ...init, headers: { ...auth, ...init.headers }, redirect: 'error', signal: AbortSignal.timeout(init.timeout || 20000) });
}
/** Envia o arquivo de um evento antes do próprio evento. Retorna false se deve tentar depois. */
async function uploadMedia(row) {
  const { id, mime } = row._upload;
  const path = join(MEDIA, id);
  let bytes = null; try { bytes = await readFile(path); } catch { /* arquivo já removido */ }
  let ok = false;
  if (bytes) {
    const response = await call('/api/whatsapp/bridge/media/' + id, { method: 'POST', headers: { 'Content-Type': mime }, body: bytes, timeout: 60000 });
    if (response.status >= 500 && response.status !== 503) return false; // falha temporária
    ok = response.ok; // 503 = ateliê sem armazenamento de anexos; 4xx = formato recusado
  }
  delete row._upload;
  if (!ok) { const message = row.whatsappInboundMessage || row.whatsappMessage; const type = message?.type; if (type && message[type]) delete message[type]; }
  store.replace(row);
  await rm(path, { force: true });
  return true;
}
/** Um ciclo: informa o estado, recebe a fila e os comandos. Retorna em quantos segundos repetir. */
async function sync() {
  // Anexos pendentes vão primeiro; o evento só segue quando o arquivo já está no ateliê.
  const events = [];
  for (const { body } of store.events()) {
    const row = JSON.parse(body);
    if (row._upload && !(await uploadMedia(row).catch(() => false))) break;
    events.push(row);
  }
  const results = store.unreported().map(r => ({ requestId: r.id, status: r.status, providerId: r.provider_id || undefined, error: r.error || undefined }));
  const response = await call('/api/whatsapp/bridge/sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: VERSION, status, phone: ownPhone(), qr: status === 'pairing' && Date.now() < qrUntil ? qr : null, events, results })
  });
  if (response.status === 401) { diag.lastError = 'Chave não cadastrada'; logOnce('O ateliê ainda não reconhece esta chave. Cole a chave em Atendimentos → WhatsApp → Conectar.'); return 15; }
  if (!response.ok) { diag.lastError = 'HTTP ' + response.status; logOnce('O ateliê respondeu com erro (HTTP ' + response.status + '); tentando de novo.'); return 15; }
  const data = await response.json();
  diag.lastSync = new Date().toISOString(); diag.lastError = null;
  logOnce('Comunicação com o ateliê funcionando.');
  for (const id of data.ack || []) store.delivered(id);
  for (const id of data.resultsAck || []) store.reported(id);
  if (typeof data.expectedPhone === 'string' && data.expectedPhone !== expectedPhone) { expectedPhone = data.expectedPhone; store.config({ expectedPhone }); }
  // Canal desconectado no site (ou pedido explícito): encerra a sessão local.
  if (data.command === 'logout' || (data.disconnected && (socket || await hasSession()))) await logout();
  else if (data.command === 'pair' && !socket && !starting) { if (status === 'wrong_number') status = 'disconnected'; await start(); }
  for (const item of Array.isArray(data.outbox) ? data.outbox : []) await sendItem(item);
  return Math.min(60, Math.max(2, Number(data.interval) || 5));
}
/** Envia um item da fila. O diário garante no máximo uma tentativa por requestId. */
async function sendItem(item) {
  const id = String(item?.requestId || ''), to = String(item?.to || ''), text = String(item?.text || ''), mime = item?.mime ? String(item.mime) : '';
  if (!/^[\w-]{16,100}$/.test(id) || !/^\+[1-9]\d{7,14}$/.test(to) || text.length > 4096 || (mime && !MIMES.includes(mime)) || (!text && !mime)) return;
  const fingerprint = createHash('sha256').update(JSON.stringify([to, text, mime])).digest('hex');
  const previous = store.db.prepare('SELECT fingerprint FROM sends WHERE id=?').get(id);
  if (previous) { if (previous.fingerprint === fingerprint) store.reportAgain(id); return; } // já tentado: só reinforma
  if (status !== 'ready' || !socket) return; // o site oferece de novo depois
  let bytes = null;
  if (mime) {
    if (!/^\/api\/whatsapp\/bridge\/outbox\/[\w-]{16,100}$/.test(String(item.media || ''))) return;
    const response = await call(item.media, { timeout: 60000 }).catch(() => null);
    if (!response) return;
    if (response.status === 404) { store.claim(id, fingerprint); store.failed(id, 'O anexo não está mais disponível no ateliê.'); return; }
    if (!response.ok) return;
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes(mime)) { store.claim(id, fingerprint); store.failed(id, 'Arquivo grande demais para o WhatsApp.'); return; }
  }
  const jid = to.slice(1) + '@s.whatsapp.net';
  const [check] = await socket.onWhatsApp(jid).catch(() => []);
  if (check && check.exists === false) { store.claim(id, fingerprint); store.failed(id, 'Este número não tem WhatsApp.'); return; }
  // Daqui em diante, qualquer interrupção deixa o envio como "incerto" (nunca reenvia sozinho).
  store.claim(id, fingerprint);
  const messageId = generateMessageIDV2(socket.user?.id);
  store.db.prepare('UPDATE sends SET provider_id=? WHERE id=?').run(messageId, id);
  try {
    const content = mime ? (mime.startsWith('image/') ? { image: bytes, caption: text, mimetype: mime } : { audio: bytes, mimetype: mime }) : { text };
    const sent = await socket.sendMessage(jid, content, { messageId });
    if (sent?.key?.id) store.accepted(id, sent.key.id);
  } catch { /* permanece incerto; a profissional confere no celular */ }
}

/* ---------- Laço principal ---------- */
let running = true, timer = null;
async function loop() {
  let wait = 15;
  try { wait = await sync(); }
  catch (error) { diag.lastError = error?.name === 'TimeoutError' ? 'Tempo esgotado' : 'Sem conexão'; logOnce('Não consegui falar com o ateliê (' + diag.lastError + '). Confira a internet; vou tentar de novo.'); }
  await writeStatus();
  if (running) timer = setTimeout(loop, wait * 1000);
}
process.on('unhandledRejection', error => log('Erro inesperado: ' + (error?.message || error)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { running = false; clearTimeout(timer); clearTimeout(reconnect); socket?.end(undefined); store.db.close(); process.exit(0); });
// Arquivos recebidos que não puderam ser enviados ao ateliê são apagados após 30 dias.
setInterval(async () => { try { for (const file of await readdir(MEDIA)) { const path = join(MEDIA, file); if (Date.now() - (await stat(path)).mtimeMs > 30 * 86400000) await rm(path, { force: true }); } } catch {} }, 3600000).unref();

log('Conector iniciado. Ateliê: ' + SITE);
if (await hasSession()) { log('Sessão salva encontrada; conectando ao WhatsApp…'); void start(); }
else log('Aguardando o ateliê pedir o QR Code (Atendimentos → WhatsApp → Conectar).');
void loop();
