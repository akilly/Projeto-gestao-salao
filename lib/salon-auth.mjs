/**
 * Conta única do salão (a titular). Senha derivada por PBKDF2 com sal; sessões opacas guardadas só como hash
 * e revogáveis no servidor. Nenhum cabeçalho enviado pelo navegador concede acesso.
 *
 * Como criar a conta ou recuperar a senha (o que estiver configurado no servidor):
 *   - Por e-mail (Brevo): link de uso único enviado para OWNER_EMAIL (primeiro acesso) ou para o e-mail da conta
 *     ("esqueci a senha"). Rotas: POST /api/auth/request-link e POST /api/auth/complete.
 *   - Por código: SETUP_TOKEN (alternativa sem e-mail). Rotas: POST /api/auth/setup e POST /api/auth/reset.
 */
import { mailEnabled, validEmail, accessEmail, sendMail } from './mailer.mjs';

// Chave dos registros já existentes no D1. Mantida para que a base atual continue acessível após a migração de hospedagem.
const OWNER = '09ae2a95-650c-4113-8388-7df822b1c7e9';
const cookieName = '__Host-hanne-session';
const SESSION_MS = 12 * 3600 * 1000;
const LINK_MS = { setup: 24 * 3600 * 1000, reset: 30 * 60 * 1000 };
const MIN_PASSWORD = 12;

const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
/** Comparação em tempo constante (inclui o comprimento). */
export function timingEqual(a, b) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
export async function credential(db) { return db.prepare('SELECT * FROM salon_credentials WHERE id = 1').first(); }

/** O código só é aceito quando configurado com tamanho mínimo; compara resumos para não vazar o comprimento. */
const setupEnabled = env => typeof env?.SETUP_TOKEN === 'string' && env.SETUP_TOKEN.length >= 16;
async function validSetupCode(env, code) { return setupEnabled(env) && typeof code === 'string' && timingEqual(await digest(code.trim()), await digest(env.SETUP_TOKEN)); }
const ownerEmail = env => (typeof env?.OWNER_EMAIL === 'string' ? env.OWNER_EMAIL.trim().toLowerCase() : '');
const sessionToken = request => request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);

/** Limite de tentativas por balde (IP + ação). Devolve true quando ainda está dentro do limite. */
async function withinLimit(db, key, max, windowMs = 900000) {
  const bucket = await digest(key), now = Date.now();
  await db.prepare('INSERT INTO salon_login_limits (bucket,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_at < ? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END').bind(bucket, now + windowMs, now, now).run();
  const row = await db.prepare('SELECT attempts FROM salon_login_limits WHERE bucket = ?').bind(bucket).first();
  return row.attempts <= max;
}
const clearLimit = async (db, key) => db.prepare('DELETE FROM salon_login_limits WHERE bucket = ?').bind(await digest(key)).run();
const clientIP = request => request.headers.get('cf-connecting-ip') || 'shared';

/** Endereço público usado nos links: APP_ORIGIN quando definido; senão, a origem da própria requisição. */
function appOrigin(request, env) {
  try { if (env?.APP_ORIGIN) { const u = new URL(env.APP_ORIGIN); if (u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname)) return u.origin; } } catch { /* usa a requisição */ }
  return new URL(request.url).origin;
}

/** Confere a senha da titular para ações sensíveis (exclusão). Mesmo derivador e limite de tentativas do login, em balde próprio. */
export async function confirmPassword(request, db, password) {
  if (typeof password !== 'string' || !password || password.length > 200) return { ok: false, status: 403, error: 'Digite a senha da conta para confirmar a exclusão.' };
  const account = await credential(db);
  if (!account) return { ok: false, status: 403, error: 'Crie a conta da titular antes de excluir registros.' };
  const key = 'delete:' + clientIP(request);
  if (!await withinLimit(db, key, 10)) return { ok: false, status: 429, error: 'Muitas tentativas de senha. Aguarde 15 minutos.' };
  if (!timingEqual(await derive(password, account.salt), account.password_hash)) return { ok: false, status: 403, error: 'Senha incorreta. A exclusão não foi feita.' };
  await clearLimit(db, key);
  return { ok: true };
}

export async function salonIdentity(request, db) {
  const token = sessionToken(request);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const session = await db.prepare('SELECT owner_id FROM salon_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token), Date.now()).first();
    if (session) return session.owner_id;
  }
  return null;
}

export async function authorizeRequest(request, db) {
  const user = await salonIdentity(request, db); if (!user) return null;
  // A identidade repassada aos handlers vem sempre da sessão; qualquer valor enviado pelo cliente é sobrescrito.
  const headers = new Headers(request.headers); headers.set('oai-authenticated-user-id', user);
  // Vinext pode encaminhar um NextRequest de outro contexto. O runtime Worker não aceita esse objeto como argumento do construtor Request.
  const init = { method: request.method, headers, redirect: request.redirect, signal: request.signal };
  if (request.method !== 'GET' && request.method !== 'HEAD') { init.body = request.body; init.duplex = 'half'; }
  return new Request(request.url, init);
}

/** Abre uma sessão nova (cookie HttpOnly, Secure, SameSite=Strict) e limpa as expiradas. */
async function openSession(db) {
  const token = randomToken(), now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM salon_sessions WHERE expires_at < ?').bind(now),
    db.prepare('INSERT INTO salon_sessions (token_hash,owner_id,expires_at) VALUES (?,?,?)').bind(await digest(token), OWNER, now + SESSION_MS),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MS / 1000}` });
}

/** Grava a senha nova: cria a conta (setup) ou troca a senha e encerra todas as sessões (reset). */
async function storePassword(db, kind, email, password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(24))), hash = await derive(password, salt);
  if (kind === 'reset') {
    await db.batch([db.prepare('UPDATE salon_credentials SET email=?,salt=?,password_hash=? WHERE id=1').bind(email, salt, hash), db.prepare('DELETE FROM salon_sessions').bind()]);
    return true;
  }
  const result = await db.prepare('INSERT OR IGNORE INTO salon_credentials (id,owner_id,email,salt,password_hash) VALUES (1,?,?,?,?)').bind(OWNER, email, salt, hash).run();
  return result.meta.changes === 1;
}

const LINK_SENT = 'Se o e-mail estiver correto, você vai receber um link em alguns minutos. Confira também a caixa de spam.';

/** Pede um link por e-mail. A resposta é sempre a mesma, para não revelar qual e-mail é o da conta. */
async function requestLink(request, db, env, input, fetcher) {
  if (!mailEnabled(env)) return json({ error: 'O envio de e-mails ainda não foi configurado neste servidor.' }, 503);
  const kind = input.purpose === 'setup' ? 'setup' : input.purpose === 'reset' ? 'reset' : '';
  const email = String(input.email || '').trim().toLowerCase();
  if (!kind || !validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  // Por IP (5 a cada 15 min) e no total (20 por hora): protege a cota gratuita e a caixa de entrada da titular.
  if (!await withinLimit(db, 'mail:' + clientIP(request), 5) || !await withinLimit(db, 'mail:all', 20, 3600000)) return json({ error: 'Muitos pedidos de e-mail. Aguarde alguns minutos.' }, 429);
  const account = await credential(db);
  const target = kind === 'setup' ? (!account && ownerEmail(env) && timingEqual(email, ownerEmail(env)) ? email : '') : (account && timingEqual(email, account.email) ? account.email : '');
  if (target) {
    const now = Date.now();
    // Um link por minuto: novos pedidos dentro desse intervalo não disparam outro e-mail.
    const recent = await db.prepare('SELECT 1 FROM salon_tokens WHERE kind = ? AND created_at > ? LIMIT 1').bind(kind, now - 60000).first();
    if (!recent) {
      const token = randomToken(), link = `${appOrigin(request, env)}/login?acesso=${token}`;
      // Só o link mais recente vale: os anteriores do mesmo tipo são apagados.
      await db.batch([
        db.prepare('DELETE FROM salon_tokens WHERE kind = ? OR expires_at < ?').bind(kind, now),
        db.prepare('INSERT INTO salon_tokens (token_hash,kind,email,expires_at,created_at) VALUES (?,?,?,?,?)').bind(await digest(token), kind, target, now + LINK_MS[kind], now),
      ]);
      try { await sendMail(env, target, accessEmail(kind, link, LINK_MS[kind] / 60000), fetcher); }
      catch { await db.prepare('DELETE FROM salon_tokens WHERE token_hash = ?').bind(await digest(token)).run(); }
    }
  }
  return json({ ok: true, message: LINK_SENT });
}

/** Conclui pelo link: define a senha, invalida o link e já entra. */
async function completeLink(request, db, input) {
  const token = String(input.token || ''), password = input.password;
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Link inválido. Peça um novo.' }, 400);
  if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 200) return json({ error: `Use uma senha com pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
  if (!await withinLimit(db, 'complete:' + clientIP(request), 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  const hash = await digest(token);
  const link = await db.prepare('SELECT * FROM salon_tokens WHERE token_hash = ? AND expires_at > ?').bind(hash, Date.now()).first();
  if (!link) return json({ error: 'Este link expirou ou já foi usado. Peça um novo.' }, 410);
  // Consome o link antes de gravar: dois envios simultâneos não usam o mesmo link.
  const consumed = await db.prepare('DELETE FROM salon_tokens WHERE token_hash = ?').bind(hash).run();
  if (consumed.meta.changes !== 1) return json({ error: 'Este link expirou ou já foi usado. Peça um novo.' }, 410);
  const account = await credential(db);
  if (link.kind === 'setup' && account) return json({ error: 'A conta já foi criada. Entre com sua senha ou use "Esqueci minha senha".' }, 409);
  if (link.kind === 'reset' && (!account || !timingEqual(link.email, account.email))) return json({ error: 'Este link não vale mais. Peça um novo.' }, 410);
  if (!await storePassword(db, link.kind, link.email, password)) return json({ error: 'A conta já foi criada.' }, 409);
  await db.prepare('DELETE FROM salon_tokens WHERE kind = ?').bind(link.kind).run();
  return openSession(db);
}

export async function handleAuth(request, db, env = {}, fetcher = fetch) {
  try {
    const path = new URL(request.url).pathname.split('/').pop();
    if (request.method === 'GET' && path === 'status') {
      const configured = !!await credential(db);
      // emailSetup: o primeiro acesso por e-mail só existe quando o e-mail da titular está definido no servidor.
      return json({ configured, canSetup: setupEnabled(env), emailEnabled: mailEnabled(env), emailSetup: mailEnabled(env) && !!ownerEmail(env), signedIn: !!await salonIdentity(request, db) });
    }
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Origem não autorizada.' }, 403);
    if (path === 'logout') {
      await db.prepare('DELETE FROM salon_sessions WHERE token_hash = ?').bind(await digest(sessionToken(request) || '')).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookieName + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Formato inválido.' }, 415);
    const raw = await request.text(); if (raw.length > 4000) return json({ error: 'Dados excessivos.' }, 413);
    let input; try { input = JSON.parse(raw); } catch { return json({ error: 'Dados inválidos.' }, 400); }
    if (!input || typeof input !== 'object') return json({ error: 'Dados inválidos.' }, 400);
    if (path === 'request-link') return requestLink(request, db, env, input, fetcher);
    if (path === 'complete') return completeLink(request, db, input);

    const { email, password, setupCode } = input, normalized = String(email || '').trim().toLowerCase();
    if (!validEmail(normalized) || typeof password !== 'string' || password.length > 200) return json({ error: 'Confira o e-mail e a senha.' }, 400);
    // Login, cadastro e recuperação por código compartilham o limite por IP: o código também não pode ser testado à força.
    const key = path + ':' + clientIP(request);
    if (!await withinLimit(db, key, 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    const account = await credential(db);
    if (path === 'setup' || path === 'reset') {
      if (!setupEnabled(env)) return json({ error: 'O código de configuração ainda não foi definido no servidor.' }, 403);
      if (!await validSetupCode(env, setupCode)) return json({ error: 'Código de configuração incorreto.' }, 403);
      if (account && path === 'setup') return json({ error: 'A conta já foi configurada.' }, 409);
      if (!account && path === 'reset') return json({ error: 'Crie a conta primeiro.' }, 409);
      if (password.length < MIN_PASSWORD) return json({ error: `Use uma senha com pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
      if (!await storePassword(db, path, normalized, password)) return json({ error: 'A conta já foi configurada.' }, 409);
    } else if (path === 'login') {
      const computed = await derive(password, account?.salt || 'unconfigured-salon');
      if (!account || !timingEqual(normalized, account.email) || !timingEqual(computed, account.password_hash)) return json({ error: 'E-mail ou senha incorretos.' }, 401);
    } else return json({ error: 'Caminho não encontrado.' }, 404);
    await clearLimit(db, key);
    return openSession(db);
  } catch { return json({ error: 'Não foi possível acessar a conta. Tente novamente.' }, 503); }
}
