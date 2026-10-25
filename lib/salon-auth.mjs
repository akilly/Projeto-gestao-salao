/** Conta única do salão. Senha derivada por PBKDF2 e sessões opacas revogáveis no servidor. */
const OWNER = '09ae2a95-650c-4113-8388-7df822b1c7e9';
// O ID autenticado é específico deste Site e não coincide com o ID da conta.
const OWNER_EMAIL = 'joaomarinho0404@gmail.com';
const isOwner = request => Boolean(request.headers.get('oai-authenticated-user-id')) && request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase() === OWNER_EMAIL;
const cookieName='__Host-hanne-session';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(value){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));}
export async function derive(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
export function timingEqual(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export async function credential(db){return db.prepare('SELECT * FROM salon_credentials WHERE id = 1').first();}
export async function salonIdentity(request,db){
  const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(token&&/^[a-f0-9]{64}$/.test(token)){
    const session=await db.prepare('SELECT owner_id FROM salon_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token),Date.now()).first();
    if(session)return session.owner_id;
  }
  // O login da plataforma só dá acesso inicial enquanto a titular não configurou a conta.
  if(isOwner(request) && !await credential(db)) return OWNER;
  return null;
}
export async function authorizeRequest(request,db){
  const user=await salonIdentity(request,db);if(!user)return null;
  const headers=new Headers(request.headers);headers.set('oai-authenticated-user-id',user);
  // Vinext pode encaminhar um NextRequest de outro contexto. O runtime Worker
  // não aceita esse objeto como argumento do construtor Request.
  const init={method:request.method,headers,redirect:request.redirect,signal:request.signal};
  if(request.method!=='GET'&&request.method!=='HEAD'){
    init.body=request.body;
    init.duplex='half';
  }
  return new Request(request.url,init);
}
export async function handleAuth(request,db){
 try{
  const path=new URL(request.url).pathname.split('/').pop();
  if(request.method==='GET'&&path==='status')return json({configured:!!await credential(db),canSetup:isOwner(request),signedIn:!!await salonIdentity(request,db)});
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem não autorizada.'},403);
  if(path==='logout'){
    const raw=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
    await db.prepare('DELETE FROM salon_sessions WHERE token_hash = ?').bind(await digest(raw)).run();
    return json({ok:true},200,{'Set-Cookie':cookieName+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
  }
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato inválido.'},415);
  const raw=await request.text();if(raw.length>4000)return json({error:'Dados excessivos.'},413);
  const {email,password}=JSON.parse(raw), normalized=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)||typeof password!=='string'||password.length>200)return json({error:'Confira o e-mail e a senha.'},400);
  let account=await credential(db);
  if(path==='setup'||path==='reset'){
    if(!isOwner(request))return json({error:'Somente a titular pode configurar a conta.'},403);
    if(account&&path==='setup')return json({error:'A conta já foi configurada.'},409);
    if(!account&&path==='reset')return json({error:'Crie a conta primeiro.'},409);
    if(password.length<12)return json({error:'Use uma senha com pelo menos 12 caracteres.'},400);
    const salt=hex(crypto.getRandomValues(new Uint8Array(24))),hash=await derive(password,salt);
    if(path==='reset'){await db.batch([db.prepare('UPDATE salon_credentials SET email=?,salt=?,password_hash=? WHERE id=1').bind(normalized,salt,hash),db.prepare('DELETE FROM salon_sessions').bind()]);}
    const result=path==='reset'?{meta:{changes:1}}:await db.prepare('INSERT OR IGNORE INTO salon_credentials (id,owner_id,email,salt,password_hash) VALUES (1,?,?,?,?)').bind(OWNER,normalized,salt,hash).run();
    if(result.meta.changes!==1)return json({error:'A conta já foi configurada.'},409);
  }else if(path==='login'){
    const ip=request.headers.get('cf-connecting-ip')||'shared',bucket=await digest(ip),now=Date.now();
    await db.prepare('INSERT INTO salon_login_limits (bucket,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN reset_at < ? THEN 1 ELSE attempts+1 END, reset_at=CASE WHEN reset_at < ? THEN excluded.reset_at ELSE reset_at END').bind(bucket,now+900000,now,now).run();
    const attempts=await db.prepare('SELECT attempts FROM salon_login_limits WHERE bucket = ?').bind(bucket).first();
    if(attempts.attempts>10)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
    const computed=await derive(password,account?.salt||'unconfigured-salon');
    if(!account||!timingEqual(normalized,account.email)||!timingEqual(computed,account.password_hash))return json({error:'E-mail ou senha incorretos.'},401);
    await db.prepare('DELETE FROM salon_login_limits WHERE bucket = ?').bind(bucket).run();
  }else return json({error:'Caminho não encontrado.'},404);
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+43200000;
  await db.batch([db.prepare('DELETE FROM salon_sessions WHERE expires_at < ?').bind(Date.now()),db.prepare('INSERT INTO salon_sessions (token_hash,owner_id,expires_at) VALUES (?,?,?)').bind(await digest(token),OWNER,expires)]);
  return json({ok:true},200,{'Set-Cookie':cookieName+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200'});
 }catch{return json({error:'Não foi possível acessar a conta. Tente novamente.'},503);}
}
