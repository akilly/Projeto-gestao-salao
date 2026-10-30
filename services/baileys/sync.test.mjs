/** Teste real do conector contra um "ateliê" falso local. Não conecta ao WhatsApp nem envia mensagens. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from './store.mjs';

const KEY = 'test-only-123456789012345678901234567890';
const SENT = 'req-sent-0000000000000001', MEDIA_ID = 'media-000000000000000001';
const fingerprint = (to, text, mime) => createHash('sha256').update(JSON.stringify([to, text, mime])).digest('hex');

test('recusa endereço do ateliê que não seja HTTPS', async () => {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('./', import.meta.url), env: { ...process.env, BRIDGE_KEY: KEY, SITE_ORIGIN: 'http://evil.example.com', DATA_DIR: join(tmpdir(), 'nunca-criado') }, stdio: 'ignore' });
  const code = await new Promise(resolve => child.once('exit', resolve));
  assert.notEqual(code, 0);
});

test('sincroniza com o ateliê: resultados, anexo antes do evento, reenvio só reinforma e logout', async () => {
  const data = await mkdtemp(join(tmpdir(), 'hanne-bridge-test-'));
  // Diário com um envio já aceito e um evento recebido com anexo pendente.
  const store = openStore(join(data, 'journal.sqlite'));
  store.claim(SENT, fingerprint('+5511999990000', 'Olá', '')); store.accepted(SENT, 'WA-1');
  await mkdir(join(data, 'media'), { recursive: true }); await writeFile(join(data, 'media', MEDIA_ID), Buffer.from([0xff, 0xd8, 0xff]));
  store.enqueue({ id: 'in:abc', type: 'whatsapp.inbound_message.received', whatsappInboundMessage: { id: 'abc', type: 'image', image: { mediaRef: 'baileys:' + MEDIA_ID } }, _upload: { id: MEDIA_ID, mime: 'image/jpeg' } });
  store.db.close();

  const syncs = [], uploads = [], other = [];
  const site = http.createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (request.headers.authorization !== 'Bearer ' + KEY) { response.writeHead(401); return response.end('{}'); }
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/whatsapp/bridge/media/' + MEDIA_ID) { uploads.push({ type: request.headers['content-type'], size: body.length }); return response.end('{"stored":true}'); }
    if (request.url !== '/api/whatsapp/bridge/sync') { other.push(request.url); response.writeHead(404); return response.end('{}'); }
    const input = JSON.parse(body); syncs.push(input);
    const n = syncs.length;
    const reply = { ack: input.events.map(e => e.id), resultsAck: input.results.map(r => r.requestId), outbox: [], command: null, expectedPhone: '+5511988887777', interval: 2 };
    // 2º ciclo: o ateliê oferece de novo o envio já feito (não pode reenviar) e um novo com conector desconectado (fica para depois).
    if (n === 2) reply.outbox = [{ requestId: SENT, to: '+5511999990000', text: 'Olá' }, { requestId: 'req-new-00000000000000002', to: '+5511999990000', text: 'Oi', mime: 'image/png', media: '/api/whatsapp/bridge/outbox/req-new-00000000000000002' }];
    // 4º ciclo: a profissional desconectou no ateliê (que deixa de informar o número).
    if (n >= 4) reply.expectedPhone = '';
    if (n === 4) reply.command = 'logout';
    response.end(JSON.stringify(reply));
  });
  await new Promise(resolve => site.listen(0, '127.0.0.1', resolve));
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('./', import.meta.url), env: { ...process.env, BRIDGE_KEY: KEY, SITE_ORIGIN: 'http://127.0.0.1:' + site.address().port, DATA_DIR: data }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 150 && syncs.length < 5; i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(syncs.length >= 5, 'conector não sincronizou');
    const [first, second, third] = syncs;
    assert.equal(first.status, 'disconnected'); assert.equal(first.qr, null);
    assert.deepEqual(uploads, [{ type: 'image/jpeg', size: 3 }], 'anexo enviado antes do evento');
    assert.equal(first.events.length, 1); assert.equal(first.events[0]._upload, undefined); assert.equal(first.events[0].whatsappInboundMessage.image.mediaRef, 'baileys:' + MEDIA_ID);
    assert.deepEqual(first.results, [{ requestId: SENT, status: 'accepted', providerId: 'WA-1' }]);
    assert.deepEqual(second.results, [], 'resultado confirmado não volta');
    assert.deepEqual(third.results.map(r => r.requestId), [SENT], 'reoferta só reinforma o resultado');
    assert.deepEqual(other, [], 'não baixou anexo nem enviou com o WhatsApp desconectado');
    const status = JSON.parse(await readFile(join(data, 'status.json'), 'utf8'));
    assert.equal(status.whatsapp, 'disconnected'); assert.ok(status.lastSync);
    const check = openStore(join(data, 'journal.sqlite'));
    assert.equal(check.events().length, 0); assert.equal(check.config(), null, 'logout limpa o número esperado');
    assert.equal(check.db.prepare("SELECT count(*) n FROM sends WHERE id LIKE 'req-new%'").get().n, 0);
    check.db.close();
  } finally {
    child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); site.close(); await rm(data, { recursive: true, force: true });
  }
});
