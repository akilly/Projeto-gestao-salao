/**
 * Contas do Hanne. Cada conta é um salão com dados próprios (clientes, agenda, financeiro, WhatsApp, IA):
 * o owner_id da sessão é a chave de todos os registros. A primeira conta é a titular (role "admin"), que
 * convida os outros salões. Senha derivada por PBKDF2 com sal; sessões opacas guardadas só como hash e
 * revogáveis no servidor. Nenhum cabeçalho enviado pelo navegador concede acesso.
 *
 * Criar a primeira conta ou recuperar a senha (o que estiver configurado no servidor):
 *   - Por e-mail (Brevo): link de uso único enviado para OWNER_EMAIL (primeiro acesso) ou para o e-mail da conta
 *     ("esqueci a senha"). Rotas: POST /api/auth/request-link e POST /api/auth/complete.
 *   - Por código: SETUP_TOKEN (alternativa sem e-mail). Rotas: POST /api/auth/setup e POST /api/auth/reset.
 * Com a sessão aberta: change-password, change-email (+ confirm-email pelo link) e logout.
 * Só a titular: GET users, POST invite, cancel-invite e user-access (desativar/reativar um salão).
 */
import { mailEnabled, validEmail, accessEmail, sendMail } from './mailer.mjs';

// Chave dos registros já existentes no D1. A titular continua com ela para a base atual seguir acessível.
const OWNER = '09ae2a95-650c-4113-8388-7df822b1c7e9';
const cookieName = '__Host-hanne-session';
const SESSION_MS = 12 * 3600 * 1000;
const LINK_MS = { setup: 24 * 3600 * 1000, reset: 30 * 60 * 1000, invite: 7 * 86400 * 1000, email: 24 * 3600 * 1000 };
const MIN_PASSWORD = 12;

const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const cleanEmail = value => String(value || '').trim().toLowerCase();
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))); }
export async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
/** Comparação em tempo constante (inclui o comprimento). */
export function timingEqual(a, b) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }

/* ---------- Contas ---------- */
export const accountById = (db, id) => db.prepare('SELECT * FROM salon_users WHERE owner_id = ?').bind(id).first();
export const accountByEmail = (db, email) => db.prepare('SELECT * FROM salon_users WHERE email = ?').bind(cleanEmail(email)).first();
const hasAccounts = async db => !!await db.prepare('SELECT 1 FROM salon_users LIMIT 1').first();

/** Cria a conta (titular ou salão convidado). Devolve false se o e-mail ou o id já existirem. */
async function createAccount(db, { id, email, password, role }) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(24))), hash = await derive(password, salt);
  const result = await db.prepare('INSERT OR IGNORE INTO salon_users (owner_id,email,salt,password_hash,role,disabled,created_at) VALUES (?,?,?,?,?,0,?)').bind(id, cleanEmail(email), salt, hash, role, Date.now()).run();
  return result.meta.changes === 1;
}
/** Grava uma senha nova e encerra todas as sessões daquela conta. */
async function setPassword(db, id, password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(24))), hash = await derive(password, salt);
  await db.batch([db.prepare('UPDATE salon_users SET salt=?,password_hash=? WHERE owner_id=?').bind(salt, hash, id), db.prepare('DELETE FROM salon_sessions WHERE owner_id = ?').bind(id)]);
}
const passwordMatches = async (account, password) => !!account && typeof password === 'string' && timingEqual(await derive(password, account.salt), account.password_hash);

/** O código só é aceito quando configurado com tamanho mínimo; compara resumos para não vazar o comprimento. */
const setupEnabled = env => typeof env?.SETUP_TOKEN === 'string' && env.SETUP_TOKEN.length >= 16;
async function validSetupCode(env, code) { return setupEnabled(env) && typeof code === 'string' && timingEqual(await digest(code.trim()), await digest(env.SETUP_TOKEN)); }
const ownerEmail = env => (typeof env?.OWNER_EMAIL === 'string' ? cleanEmail(env.OWNER_EMAIL) : '');
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

/* ---------- Sessão ---------- */
/** Conta da sessão (ativa). Contas desativadas pela titular deixam de ter acesso na hora. */
async function sessionAccount(request, db) {
  const token = sessionToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare('SELECT u.* FROM salon_sessions s JOIN salon_users u ON u.owner_id = s.owner_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0').bind(await digest(token), Date.now()).first();
}
export async function salonIdentity(request, db) { return (await sessionAccount(request, db))?.owner_id || null; }

export async function authorizeRequest(request, db) {
  const user = await salonIdentity(request, db); if (!user) return null;
  // A identidade repassada aos handlers vem sempre da sessão; qualquer valor enviado pelo cliente é sobrescrito.
  const headers = new Headers(request.headers); headers.set('oai-authenticated-user-id', user);
  // Vinext pode encaminhar um NextRequest de outro contexto. O runtime Worker não aceita esse objeto como argumento do construtor Request.
  const init = { method: request.method, headers, redirect: request.redirect, signal: request.signal };
  if (request.method !== 'GET' && request.method !== 'HEAD') { init.body = request.body; init.duplex = 'half'; }
  return new Request(request.url, init);
}

/** Confere a senha da conta da sessão para ações sensíveis (exclusão). Mesmo limite de tentativas do login, em balde próprio. */
export async function confirmPassword(request, db, password) {
  if (typeof password !== 'string' || !password || password.length > 200) return { ok: false, status: 403, error: 'Digite a senha da conta para confirmar a exclusão.' };
  const id = request.headers.get('oai-authenticated-user-id'), account = id && await accountById(db, id);
  if (!account) return { ok: false, status: 403, error: 'Entre na conta antes de excluir registros.' };
  const key = 'delete:' + clientIP(request);
  if (!await withinLimit(db, key, 10)) return { ok: false, status: 429, error: 'Muitas tentativas de senha. Aguarde 15 minutos.' };
  if (!await passwordMatches(account, password)) return { ok: false, status: 403, error: 'Senha incorreta. A exclusão não foi feita.' };
  await clearLimit(db, key);
  return { ok: true };
}

/** Abre uma sessão nova (cookie HttpOnly, Secure, SameSite=Strict) e limpa as expiradas. */
async function openSession(db, ownerId) {
  const token = randomToken(), now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM salon_sessions WHERE expires_at < ?').bind(now),
    // Limpa contadores de tentativas vencidos para a tabela não crescer sem limite.
    db.prepare('DELETE FROM salon_login_limits WHERE reset_at < ?').bind(now - 86400000),
    db.prepare('INSERT INTO salon_sessions (token_hash,owner_id,expires_at) VALUES (?,?,?)').bind(await digest(token), ownerId, now + SESSION_MS),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MS / 1000}` });
}

/* ---------- Links de uso único ---------- */
/** Cria o link (só o hash fica guardado; o anterior do mesmo tipo e e-mail deixa de valer). */
async function issueLink(db, kind, email, ownerId = null) {
  const token = randomToken(), now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM salon_tokens WHERE (kind = ? AND email = ?) OR expires_at < ?').bind(kind, email, now),
    db.prepare('INSERT INTO salon_tokens (token_hash,kind,email,owner_id,expires_at,created_at) VALUES (?,?,?,?,?,?)').bind(await digest(token), kind, email, ownerId, now + LINK_MS[kind], now),
  ]);
  return token;
}
/** Consome o link antes de agir: dois envios simultâneos não usam o mesmo link. */
async function consumeLink(db, token, kinds) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = await digest(token);
  const link = await db.prepare('SELECT * FROM salon_tokens WHERE token_hash = ? AND expires_at > ?').bind(hash, Date.now()).first();
  if (!link || !kinds.includes(link.kind)) return null;
  const consumed = await db.prepare('DELETE FROM salon_tokens WHERE token_hash = ?').bind(hash).run();
  return consumed.meta.changes === 1 ? link : null;
}
const linkURL = (request, env, kind, token) => `${appOrigin(request, env)}/login?${kind === 'email' ? 'email' : 'acesso'}=${token}`;
async function mailLink(request, db, env, kind, email, ownerId, fetcher) {
  const token = await issueLink(db, kind, email, ownerId);
  try { await sendMail(env, email, accessEmail(kind, linkURL(request, env, kind, token), LINK_MS[kind] / 60000), fetcher); return true; }
  catch { await db.prepare('DELETE FROM salon_tokens WHERE token_hash = ?').bind(await digest(token)).run(); return false; }
}

const LINK_SENT = 'Se o e-mail estiver correto, você vai receber um link em alguns minutos. Confira também a caixa de spam.';

/** Pede um link por e-mail. A resposta é sempre a mesma, para não revelar quais e-mails têm conta. */
async function requestLink(request, db, env, input, fetcher) {
  if (!mailEnabled(env)) return json({ error: 'O envio de e-mails ainda não foi configurado neste servidor.' }, 503);
  const kind = input.purpose === 'setup' ? 'setup' : input.purpose === 'reset' ? 'reset' : '';
  const email = cleanEmail(input.email);
  if (!kind || !validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  // Por IP (5 a cada 15 min) e no total (20 por hora): protege a cota gratuita e as caixas de entrada.
  if (!await withinLimit(db, 'mail:' + clientIP(request), 5) || !await withinLimit(db, 'mail:all', 20, 3600000)) return json({ error: 'Muitos pedidos de e-mail. Aguarde alguns minutos.' }, 429);
  let ownerId = null, allowed = false;
  if (kind === 'setup') allowed = !await hasAccounts(db) && !!ownerEmail(env) && timingEqual(email, ownerEmail(env));
  else { const account = await accountByEmail(db, email); allowed = !!account && !account.disabled; ownerId = account?.owner_id || null; }
  if (allowed) {
    // Um link por minuto para o mesmo e-mail: novos pedidos dentro desse intervalo não disparam outro e-mail.
    const recent = await db.prepare('SELECT 1 FROM salon_tokens WHERE kind = ? AND email = ? AND created_at > ? LIMIT 1').bind(kind, email, Date.now() - 60000).first();
    if (!recent) await mailLink(request, db, env, kind, email, ownerId, fetcher);
  }
  return json({ ok: true, message: LINK_SENT });
}

/** Conclui pelo link (primeiro acesso, nova senha ou convite de salão): define a senha, invalida o link e já entra. */
async function completeLink(request, db, input) {
  const password = input.password;
  if (!/^[a-f0-9]{64}$/.test(String(input.token || ''))) return json({ error: 'Link inválido. Peça um novo.' }, 400);
  if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 200) return json({ error: `Use uma senha com pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
  if (!await withinLimit(db, 'complete:' + clientIP(request), 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  const link = await consumeLink(db, String(input.token), ['setup', 'reset', 'invite']);
  if (!link) return json({ error: 'Este link expirou ou já foi usado. Peça um novo.' }, 410);
  let ownerId;
  if (link.kind === 'setup') {
    if (await hasAccounts(db) || !await createAccount(db, { id: OWNER, email: link.email, password, role: 'admin' })) return json({ error: 'A conta já foi criada. Entre com sua senha ou use "Esqueci minha senha".' }, 409);
    ownerId = OWNER;
  } else if (link.kind === 'invite') {
    ownerId = crypto.randomUUID();
    if (!await createAccount(db, { id: ownerId, email: link.email, password, role: 'member' })) return json({ error: 'Já existe uma conta com este e-mail. Entre com sua senha ou use "Esqueci minha senha".' }, 409);
  } else {
    const account = await accountById(db, link.owner_id);
    if (!account || account.disabled || !timingEqual(link.email, account.email)) return json({ error: 'Este link não vale mais. Peça um novo.' }, 410);
    await setPassword(db, account.owner_id, password); ownerId = account.owner_id;
  }
  await db.prepare('DELETE FROM salon_tokens WHERE kind = ? AND email = ?').bind(link.kind, link.email).run();
  return openSession(db, ownerId);
}

/* ---------- Conta da sessão ---------- */
/** Troca a senha com a sessão aberta: exige a senha atual, encerra as sessões de outros aparelhos e renova a desta. */
async function changePassword(request, db, input) {
  const account = await sessionAccount(request, db);
  if (!account) return json({ error: 'Sua sessão terminou. Entre novamente.' }, 401);
  const { currentPassword, newPassword } = input;
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 200) return json({ error: 'Digite a senha atual.' }, 400);
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD || newPassword.length > 200) return json({ error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
  if (newPassword === currentPassword) return json({ error: 'A nova senha precisa ser diferente da atual.' }, 400);
  const key = 'change:' + clientIP(request);
  if (!await withinLimit(db, key, 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  if (!await passwordMatches(account, currentPassword)) return json({ error: 'A senha atual está incorreta.' }, 403);
  await setPassword(db, account.owner_id, newPassword);
  await clearLimit(db, key);
  return openSession(db, account.owner_id);
}

/**
 * Troca o e-mail de acesso. Exige a senha atual. Com e-mail configurado, só muda depois que o link enviado ao
 * novo endereço for aberto (um erro de digitação não tranca a conta). Sem e-mail configurado, muda na hora.
 */
async function changeEmail(request, db, env, input, fetcher) {
  const account = await sessionAccount(request, db);
  if (!account) return json({ error: 'Sua sessão terminou. Entre novamente.' }, 401);
  const email = cleanEmail(input.newEmail);
  if (!validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (email === account.email) return json({ error: 'Este já é o e-mail da conta.' }, 400);
  const key = 'email:' + clientIP(request);
  if (!await withinLimit(db, key, 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  if (!await passwordMatches(account, input.password)) return json({ error: 'A senha atual está incorreta.' }, 403);
  await clearLimit(db, key);
  if (await accountByEmail(db, email)) return json({ error: 'Este e-mail já é usado por outra conta do Hanne.' }, 409);
  if (mailEnabled(env)) {
    if (!await mailLink(request, db, env, 'email', email, account.owner_id, fetcher)) return json({ error: 'Não foi possível enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.' }, 503);
    return json({ ok: true, pending: true, message: `Enviamos um link para ${email}. O e-mail da conta só muda depois que você abrir esse link (vale 24 horas).` });
  }
  await db.prepare('UPDATE salon_users SET email = ? WHERE owner_id = ?').bind(email, account.owner_id).run();
  return json({ ok: true, pending: false, email, message: 'E-mail atualizado. Use o novo e-mail no próximo login.' });
}

/** Confirma o novo e-mail pelo link. Não abre sessão: quem abriu o link entra depois com o e-mail novo e a senha. */
async function confirmEmail(request, db, input) {
  if (!await withinLimit(db, 'confirm:' + clientIP(request), 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  const link = await consumeLink(db, String(input.token || ''), ['email']);
  if (!link) return json({ error: 'Este link expirou ou já foi usado. Peça a troca de novo em Configurações.' }, 410);
  const account = await accountById(db, link.owner_id);
  if (!account || account.disabled) return json({ error: 'Este link não vale mais.' }, 410);
  if (await accountByEmail(db, link.email)) return json({ error: 'Este e-mail já é usado por outra conta do Hanne.' }, 409);
  await db.batch([db.prepare('UPDATE salon_users SET email = ? WHERE owner_id = ?').bind(link.email, account.owner_id), db.prepare("DELETE FROM salon_tokens WHERE kind = 'email' AND owner_id = ?").bind(account.owner_id)]);
  return json({ ok: true, email: link.email, message: 'E-mail confirmado. Entre com o novo e-mail e a mesma senha.' });
}

/* ---------- Salões (somente a titular) ---------- */
async function listUsers(db, admin) {
  const users = (await db.prepare('SELECT owner_id,email,role,disabled,created_at FROM salon_users ORDER BY role = \'admin\' DESC, created_at').all()).results || [];
  const invites = (await db.prepare("SELECT email,expires_at FROM salon_tokens WHERE kind = 'invite' AND expires_at > ? ORDER BY created_at").bind(Date.now()).all()).results || [];
  return json({ users: users.map(u => ({ id: u.owner_id, email: u.email, role: u.role, disabled: !!u.disabled, createdAt: u.created_at || null, you: u.owner_id === admin.owner_id })), invites: invites.map(i => ({ email: i.email, expiresAt: i.expires_at })) });
}
/** Convida um salão novo. Com e-mail configurado, o link vai por e-mail; sem, volta aqui para a titular repassar. */
async function invite(request, db, env, admin, input, fetcher) {
  const email = cleanEmail(input.email);
  if (!validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400);
  if (await accountByEmail(db, email)) return json({ error: 'Este e-mail já tem uma conta no Hanne.' }, 409);
  if (!await withinLimit(db, 'invite:' + admin.owner_id, 10, 3600000)) return json({ error: 'Muitos convites seguidos. Aguarde um pouco.' }, 429);
  if (mailEnabled(env)) {
    if (await mailLink(request, db, env, 'invite', email, null, fetcher)) return json({ ok: true, sent: true, message: `Convite enviado para ${email}. O link vale 7 dias.` });
  }
  const token = await issueLink(db, 'invite', email);
  return json({ ok: true, sent: false, link: linkURL(request, env, 'invite', token), message: 'Copie o link e envie para a pessoa. Ele vale 7 dias e só pode ser usado uma vez.' });
}
async function cancelInvite(db, input) {
  await db.prepare("DELETE FROM salon_tokens WHERE kind = 'invite' AND email = ?").bind(cleanEmail(input.email)).run();
  return json({ ok: true });
}
/** Desativa (e encerra as sessões) ou reativa um salão. Os dados ficam guardados; nada é apagado. */
async function userAccess(db, admin, input) {
  const account = typeof input.id === 'string' && await accountById(db, input.id);
  if (!account) return json({ error: 'Conta não encontrada.' }, 404);
  if (account.owner_id === admin.owner_id || account.role === 'admin') return json({ error: 'A conta da titular não pode ser desativada.' }, 400);
  const disabled = input.disabled === true ? 1 : 0;
  await db.batch([db.prepare('UPDATE salon_users SET disabled = ? WHERE owner_id = ?').bind(disabled, account.owner_id), ...(disabled ? [db.prepare('DELETE FROM salon_sessions WHERE owner_id = ?').bind(account.owner_id), db.prepare('DELETE FROM salon_tokens WHERE owner_id = ?').bind(account.owner_id)] : [])]);
  return json({ ok: true });
}

export async function handleAuth(request, db, env = {}, fetcher = fetch) {
  try {
    const path = new URL(request.url).pathname.split('/').pop();
    if (request.method === 'GET' && path === 'status') {
      const configured = await hasAccounts(db), account = await sessionAccount(request, db);
      // emailSetup: o primeiro acesso por e-mail só existe quando o e-mail da titular está definido no servidor.
      // O e-mail e o papel da conta só aparecem para quem já está dentro (tela de Configurações).
      return json({ configured, canSetup: setupEnabled(env), emailEnabled: mailEnabled(env), emailSetup: mailEnabled(env) && !!ownerEmail(env), signedIn: !!account, ...(account ? { email: account.email, role: account.role } : {}) });
    }
    if (request.method === 'GET' && path === 'users') {
      const account = await sessionAccount(request, db);
      if (!account) return json({ error: 'Entre na conta da Hanne.' }, 401);
      if (account.role !== 'admin') return json({ error: 'Só a titular gerencia os salões.' }, 403);
      return listUsers(db, account);
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
    if (path === 'confirm-email') return confirmEmail(request, db, input);
    if (path === 'change-password') return changePassword(request, db, input);
    if (path === 'change-email') return changeEmail(request, db, env, input, fetcher);
    if (['invite', 'cancel-invite', 'user-access'].includes(path)) {
      const admin = await sessionAccount(request, db);
      if (!admin) return json({ error: 'Sua sessão terminou. Entre novamente.' }, 401);
      if (admin.role !== 'admin') return json({ error: 'Só a titular gerencia os salões.' }, 403);
      if (path === 'invite') return invite(request, db, env, admin, input, fetcher);
      if (path === 'cancel-invite') return cancelInvite(db, input);
      return userAccess(db, admin, input);
    }

    const { email, password, setupCode } = input, normalized = cleanEmail(email);
    if (!validEmail(normalized) || typeof password !== 'string' || password.length > 200) return json({ error: 'Confira o e-mail e a senha.' }, 400);
    // Login, cadastro e recuperação por código compartilham o limite por IP: o código também não pode ser testado à força.
    const key = path + ':' + clientIP(request);
    if (!await withinLimit(db, key, 10)) return json({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    let ownerId;
    if (path === 'setup' || path === 'reset') {
      if (!setupEnabled(env)) return json({ error: 'O código de configuração ainda não foi definido no servidor.' }, 403);
      if (!await validSetupCode(env, setupCode)) return json({ error: 'Código de configuração incorreto.' }, 403);
      if (password.length < MIN_PASSWORD) return json({ error: `Use uma senha com pelo menos ${MIN_PASSWORD} caracteres.` }, 400);
      if (path === 'setup') {
        if (await hasAccounts(db) || !await createAccount(db, { id: OWNER, email: normalized, password, role: 'admin' })) return json({ error: 'A conta já foi configurada.' }, 409);
        ownerId = OWNER;
      } else {
        // Quem tem o código é quem administra a hospedagem: pode redefinir a senha de qualquer conta pelo e-mail dela.
        if (!await hasAccounts(db)) return json({ error: 'Crie a conta primeiro.' }, 409);
        const account = await accountByEmail(db, normalized);
        if (!account) return json({ error: 'Nenhuma conta com este e-mail.' }, 404);
        await setPassword(db, account.owner_id, password); ownerId = account.owner_id;
        if (account.disabled) { await clearLimit(db, key); return json({ error: 'Senha trocada, mas este salão está desativado pela titular.' }, 403); }
      }
    } else if (path === 'login') {
      const account = await accountByEmail(db, normalized);
      // Mesmo trabalho de derivação com ou sem conta, para o tempo de resposta não revelar quais e-mails existem.
      const computed = await derive(password, account?.salt || 'unconfigured-salon');
      if (!account || !timingEqual(computed, account.password_hash)) return json({ error: 'E-mail ou senha incorretos.' }, 401);
      if (account.disabled) return json({ error: 'Este acesso foi desativado pela titular do Hanne.' }, 403);
      ownerId = account.owner_id;
    } else return json({ error: 'Caminho não encontrado.' }, 404);
    await clearLimit(db, key);
    return openSession(db, ownerId);
  } catch { return json({ error: 'Não foi possível acessar a conta. Tente novamente.' }, 503); }
}
