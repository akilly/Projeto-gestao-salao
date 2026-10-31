/**
 * `npm run email:configurar` (ou CONFIGURAR-EMAIL.cmd): configura o envio de e-mails pelo Brevo.
 *
 * Pergunta o e-mail da titular, o remetente confirmado no Brevo e a chave de API (digitada sem aparecer na tela),
 * confere a chave e o remetente no Brevo, envia um e-mail de teste e grava:
 *   - no computador: arquivo .dev.vars (usado por `npm run local`);
 *   - com --nuvem: segredos do Worker na Cloudflare (`wrangler secret put`), para o site publicado.
 * A chave nunca é impressa nem enviada para outro lugar além do Brevo.
 */
import { createInterface } from 'node:readline';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validEmail, sendMail } from '../lib/mailer.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cloud = process.argv.includes('--nuvem');
const varsFile = path.join(root, '.dev.vars');
const current = Object.fromEntries((existsSync(varsFile) ? readFileSync(varsFile, 'utf8') : '').split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

const rl = createInterface({ input: process.stdin, output: process.stdout });
let muted = false;
rl._writeToOutput = text => { if (!muted || /\n/.test(text)) process.stdout.write(muted ? '\n' : text); };
// Fila de linhas: funciona digitando no terminal e também com respostas coladas/encadeadas de uma vez.
const lines = []; let waiting = null, closed = false;
rl.on('line', line => { if (waiting) { const resolve = waiting; waiting = null; resolve(line); } else lines.push(line); });
rl.on('close', () => { closed = true; if (waiting) waiting(''); });
const nextLine = () => lines.length ? Promise.resolve(lines.shift()) : closed ? Promise.resolve('') : new Promise(resolve => { waiting = resolve; });
const ask = async (question, fallback = '') => { process.stdout.write(question + (fallback ? ` [${fallback}]` : '') + ': '); const answer = (await nextLine()).trim(); if (closed && !answer && !fallback) throw Error('entrada encerrada antes do fim.'); return answer || fallback; };
const askSecret = async question => { process.stdout.write(question + ' (não aparece na tela): '); muted = true; const answer = await nextLine(); muted = false; return answer.trim(); };
const brevo = (key, endpoint) => fetch('https://api.brevo.com/v3/' + endpoint, { headers: { 'api-key': key, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });

console.log(`
Configurar e-mails do Hanne (Brevo, plano gratuito)
---------------------------------------------------
Antes, no site do Brevo (brevo.com):
  1. Crie a conta gratuita.
  2. Em "Remetentes" (Senders), adicione e confirme o e-mail que vai enviar as mensagens.
  3. Em "SMTP e API" > "Chaves de API", gere uma chave (começa com xkeysib-).
Destino: ${cloud ? 'site publicado na Cloudflare (segredos do Worker)' : 'este computador (.dev.vars)'}
`);

try {
  let owner = '';
  while (!validEmail(owner)) owner = (await ask('E-mail da titular (quem recebe os links de acesso)', current.OWNER_EMAIL)).toLowerCase();
  let from = '';
  while (!validEmail(from)) from = await ask('E-mail remetente confirmado no Brevo', current.MAIL_FROM || owner);
  const name = await ask('Nome do remetente', current.MAIL_FROM_NAME || 'Hanne');
  let key = await askSecret('Chave de API do Brevo' + (current.BREVO_API_KEY ? ' (Enter mantém a atual)' : ''));
  if (!key) key = current.BREVO_API_KEY || '';
  if (!/^[\w-]{20,200}$/.test(key)) throw Error('Chave de API inválida. Ela começa com xkeysib-.');

  process.stdout.write('\nConferindo a chave no Brevo... ');
  const account = await brevo(key, 'account');
  if (account.status === 401) throw Error('o Brevo recusou a chave. Gere outra em "SMTP e API" > "Chaves de API".');
  if (!account.ok) throw Error('o Brevo não respondeu (HTTP ' + account.status + '). Tente de novo em instantes.');
  console.log('ok.');
  const senders = await brevo(key, 'senders').then(r => r.ok ? r.json() : { senders: [] }).catch(() => ({ senders: [] }));
  const sender = (senders.senders || []).find(s => String(s.email).toLowerCase() === from.toLowerCase());
  if (!sender) console.log(`Atenção: ${from} não aparece entre os remetentes do Brevo. Adicione e confirme em "Remetentes", senão o envio falha.`);
  else if (sender.active === false) console.log(`Atenção: o remetente ${from} ainda não foi confirmado. Abra o e-mail de confirmação do Brevo.`);

  const values = { OWNER_EMAIL: owner, MAIL_FROM: from, MAIL_FROM_NAME: name, BREVO_API_KEY: key };
  process.stdout.write(`Enviando e-mail de teste para ${owner}... `);
  await sendMail(values, owner, {
    subject: 'Teste: e-mails do Hanne configurados',
    text: 'Tudo certo! Os links de primeiro acesso e de "esqueci minha senha" vão chegar neste endereço.',
    html: '<p style="font-family:Arial,sans-serif;font-size:16px">Tudo certo! Os links de primeiro acesso e de <b>esqueci minha senha</b> vão chegar neste endereço.</p>',
  });
  console.log('enviado. Confira a caixa de entrada (e o spam).');

  if (cloud) {
    const worker = process.env.WORKER_NAME || 'hanne-atelier';
    for (const [name, value] of Object.entries(values)) {
      const result = spawnSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'secret', 'put', name, '--name', worker], { cwd: root, input: value, stdio: ['pipe', 'inherit', 'inherit'] });
      if (result.status !== 0) throw Error(`não foi possível salvar ${name} na Cloudflare. Rode "npx wrangler login" e tente de novo.`);
    }
    console.log(`\nPronto: segredos salvos no Worker ${worker}.`);
  } else {
    const merged = { ...current, ...values };
    writeFileSync(varsFile, Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
    console.log('\nPronto: configuração salva em .dev.vars. Feche e abra o INICIAR-HANNE.cmd para valer.');
  }
} catch (failure) {
  if (failure.message === 'fetch failed' || failure.name === 'TimeoutError') failure.message = 'não consegui falar com o Brevo. Confira a internet e tente de novo.';
  console.error('\nNão foi possível configurar: ' + (failure.message === 'mail_rejected_400' || failure.message === 'mail_rejected_403' ? 'o Brevo recusou o envio. Confira se o remetente está confirmado e se a conta está ativa.' : failure.message));
  process.exitCode = 1;
} finally {
  rl.close();
}
