import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleAuth,salonIdentity,authorizeRequest,derive,timingEqual} from '../lib/salon-auth.mjs';
import {isWebhookPath} from '../lib/whatsapp-handler.mjs';
const owner='09ae2a95-650c-4113-8388-7df822b1c7e9',origin='https://hanne.test',env={SETUP_TOKEN:'codigo-de-configuracao-123'};
// Cabeçalhos de plataforma enviados pelo cliente nunca podem conceder acesso fora da hospedagem original.
const spoofed={'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'qualquer@exemplo.com'};
function database(){const sql=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));return {sql,prepare(query){return {bind(...args){return {query,args,async first(){return sql.prepare(query).get(...args);},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};},async first(){return sql.prepare(query).get();},async all(){return {results:sql.prepare(query).all()};}};},async batch(ss){sql.exec('BEGIN');try{const r=ss.map(s=>({meta:{changes:Number(sql.prepare(s.query).run(...s.args).changes)}}));sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
const req=(path,body={},headers={})=>new Request(origin+'/api/auth/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const credentials={email:'hanne@example.com',password:'senha-segura-1234'},withCode={...credentials,setupCode:env.SETUP_TOKEN};
test('cadastro exige código, senha não é armazenada em claro e sessão expira',async()=>{const db=database();assert.equal((await handleAuth(req('setup',credentials,spoofed),db,env)).status,403);assert.equal((await handleAuth(req('setup',{...credentials,setupCode:'errado'}),db,env)).status,403);assert.equal((await handleAuth(req('setup',withCode),db,{})).status,403);assert.equal((await handleAuth(req('setup',{...withCode,password:'curta'}),db,env)).status,400);const response=await handleAuth(req('setup',withCode),db,env);assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);assert.notEqual(db.sql.prepare('SELECT password_hash FROM salon_users').get().password_hash,credentials.password);const request=new Request(origin,{headers:{cookie}});assert.equal(await salonIdentity(request,db),owner);assert.equal(await salonIdentity(new Request(origin,{headers:spoofed}),db),null);const authorized=await authorizeRequest(request,db);assert.equal(authorized.headers.get('oai-authenticated-user-id'),owner);const wrapped={url:origin+'/api/state',method:'POST',headers:new Headers({cookie}),redirect:'follow',signal:undefined,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"ok":true}'));c.close();}})};const forwarded=await authorizeRequest(wrapped,db);assert.equal(await forwarded.text(),'{"ok":true}');db.sql.prepare('UPDATE salon_sessions SET expires_at=0').run();assert.equal(await salonIdentity(request,db),null);assert.equal((await handleAuth(req('setup',withCode),db,env)).status,409);});
test('sem conta configurada, cabeçalhos da plataforma não dão acesso',async()=>{const db=database();assert.equal(await salonIdentity(new Request(origin,{headers:spoofed}),db),null);assert.equal(await authorizeRequest(new Request(origin,{headers:spoofed}),db),null);const status=await (await handleAuth(new Request(origin+'/api/auth/status'),db,env)).json();assert.deepEqual(status,{configured:false,canSetup:true,emailEnabled:false,emailSetup:false,signedIn:false});assert.equal((await (await handleAuth(new Request(origin+'/api/auth/status'),db,{SETUP_TOKEN:'curto'})).json()).canSetup,false);});
test('login incorreto, origem externa, JSON inválido, revogação e limite de tentativas',async()=>{const db=database();await handleAuth(req('setup',withCode),db,env);assert.equal((await handleAuth(req('login',credentials,{Origin:'https://outro.test'}),db,env)).status,403);assert.equal((await handleAuth(new Request(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{'}),db,env)).status,400);assert.equal((await handleAuth(req('login',{...credentials,password:'errada'}),db,env)).status,401);const login=await handleAuth(req('login',credentials),db,env);assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.equal((await handleAuth(req('logout',{}, {cookie}),db,env)).status,200);assert.equal(await salonIdentity(new Request(origin,{headers:{cookie}}),db),null);for(let i=0;i<10;i++)await handleAuth(req('login',{...credentials,password:'errada'}),db,env);assert.equal((await handleAuth(req('login',credentials),db,env)).status,429);});
test('tentativas de código de configuração também são limitadas',async()=>{const db=database();await handleAuth(req('setup',withCode),db,env);for(let i=0;i<10;i++)await handleAuth(req('reset',{...credentials,setupCode:'chute-'+i}),db,env);assert.equal((await handleAuth(req('reset',withCode),db,env)).status,429);});
test('hash usa sal e comparação não aceita comprimentos diferentes',async()=>{assert.notEqual(await derive('senha','salt-a'),await derive('senha','salt-b'));assert.equal(timingEqual('a','aa'),false);});
test('recuperação exige código e revoga sessões anteriores',async()=>{const db=database();const first=await handleAuth(req('setup',withCode),db,env),cookie=first.headers.get('set-cookie');assert.equal((await handleAuth(req('reset',credentials,spoofed),db,env)).status,403);const reset=await handleAuth(req('reset',{...withCode,password:'nova-senha-segura-123'}),db,env);assert.equal(reset.status,200);assert.equal(await salonIdentity(new Request(origin,{headers:{cookie}}),db),null);assert.equal((await handleAuth(req('login',credentials),db,env)).status,401);});
test('somente o caminho exato de webhook dispensa a sessão',()=>{assert.equal(isWebhookPath('/api/whatsapp/webhook/abc'),false);assert.equal(isWebhookPath('/api/whatsapp/meta-webhook/abc'),true);assert.equal(isWebhookPath('/api/whatsapp/threads/api/whatsapp/webhook/abc'),false);assert.equal(isWebhookPath('/api/whatsapp/send/x/api/whatsapp/baileys-webhook/abc'),false);assert.equal(isWebhookPath('/api/whatsapp/meta-webhook/abc/extra'),false);});

/* ---------- Links por e-mail (Brevo simulado) ---------- */
const mailEnv={BREVO_API_KEY:'xkeysib-teste-0123456789abcdef',MAIL_FROM:'ateliê@exemplo.com'.replace('ê','e'),OWNER_EMAIL:'Hanne@Example.com',APP_ORIGIN:'https://hanne.test'};
function brevo(status=201){const sent=[];return {sent,fetcher:async(url,options)=>{assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(options.headers['api-key'],mailEnv.BREVO_API_KEY);sent.push(JSON.parse(options.body));return new Response('{}',{status});}};}
const linkOf=mail=>/acesso=([a-f0-9]{64})/.exec(mail.htmlContent)[1];
test('primeiro acesso por e-mail: só o e-mail da titular recebe, resposta igual para qualquer e-mail',async()=>{const db=database(),b=brevo();
  const status=await (await handleAuth(new Request(origin+'/api/auth/status'),db,mailEnv)).json();assert.equal(status.emailSetup,true);
  const other=await handleAuth(req('request-link',{email:'outra@exemplo.com',purpose:'setup'}),db,mailEnv,b.fetcher),own=await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'setup'}),db,mailEnv,b.fetcher);
  assert.equal(other.status,200);assert.deepEqual(await other.json(),await own.json());assert.equal(b.sent.length,1);assert.equal(b.sent[0].to[0].email,'hanne@example.com');assert.match(b.sent[0].htmlContent,/https:\/\/hanne\.test\/login\?acesso=/);
  assert.equal(db.sql.prepare('SELECT token_hash FROM salon_tokens').get().token_hash.length,64,'guarda só o hash');assert.equal(b.sent[0].htmlContent.includes(db.sql.prepare('SELECT token_hash FROM salon_tokens').get().token_hash),false);assert.equal(b.sent[0].textContent,undefined,'um único tipo de corpo');
  const token=linkOf(b.sent[0]);assert.equal((await handleAuth(req('complete',{token,password:'curta'}),db,mailEnv)).status,400);
  const done=await handleAuth(req('complete',{token,password:'senha-nova-segura-1'}),db,mailEnv);assert.equal(done.status,200);assert.match(done.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await handleAuth(req('complete',{token,password:'senha-nova-segura-2'}),db,mailEnv)).status,410,'link de uso único');
  assert.equal((await handleAuth(req('login',{email:'hanne@example.com',password:'senha-nova-segura-1'}),db,mailEnv)).status,200);
  assert.equal((await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'setup'}),db,mailEnv,b.fetcher)).status,200);assert.equal(b.sent.length,1,'com conta criada, não envia link de primeiro acesso');});
test('esqueci a senha: link de 30 min, só o mais recente vale e encerra as sessões',async()=>{const db=database(),b=brevo();const first=await handleAuth(req('setup',withCode),db,env);const cookie=first.headers.get('set-cookie').split(';')[0];
  await handleAuth(req('request-link',{email:'HANNE@example.com ',purpose:'reset'}),db,mailEnv,b.fetcher);assert.equal(b.sent.length,1);assert.match(b.sent[0].htmlContent,/30 minutos/);
  await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'reset'}),db,mailEnv,b.fetcher);assert.equal(b.sent.length,1,'no máximo um e-mail por minuto');
  db.sql.prepare('UPDATE salon_tokens SET created_at=created_at-120000').run();await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'reset'}),db,mailEnv,b.fetcher);assert.equal(b.sent.length,2);
  assert.equal((await handleAuth(req('complete',{token:linkOf(b.sent[0]),password:'outra-senha-segura-1'}),db,mailEnv)).status,410,'link antigo deixa de valer');
  assert.equal((await handleAuth(req('complete',{token:linkOf(b.sent[1]),password:'outra-senha-segura-1'}),db,mailEnv)).status,200);
  assert.equal(await salonIdentity(new Request(origin,{headers:{cookie}}),db),null,'sessões antigas encerradas');assert.equal((await handleAuth(req('login',credentials),db,env)).status,401);});
test('link expirado, Brevo fora do ar, sem configuração e limite de pedidos',async()=>{const db=database();await handleAuth(req('setup',withCode),db,env);const b=brevo();
  await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'reset'}),db,mailEnv,b.fetcher);db.sql.prepare('UPDATE salon_tokens SET expires_at=1').run();assert.equal((await handleAuth(req('complete',{token:linkOf(b.sent[0]),password:'outra-senha-segura-1'}),db,mailEnv)).status,410);
  const down=brevo(500);db.sql.prepare('DELETE FROM salon_tokens').run();const r=await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'reset'}),db,mailEnv,down.fetcher);assert.equal(r.status,200);assert.equal(db.sql.prepare('SELECT count(*) n FROM salon_tokens').get().n,0,'falha no envio não deixa link válido');
  assert.equal((await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'reset'}),db,env)).status,503);
  const limited=database();let last;for(let i=0;i<6;i++)last=await handleAuth(req('request-link',{email:'x'+i+'@exemplo.com',purpose:'reset'}),limited,mailEnv,brevo().fetcher);assert.equal(last.status,429);
  assert.equal((await handleAuth(req('complete',{token:'../../x',password:'outra-senha-segura-1'}),db,mailEnv)).status,400);assert.equal((await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'reset'},{Origin:'https://evil.test'}),db,mailEnv)).status,403);});
test('APP_ORIGIN inválido cai na origem da requisição; e-mail escapa o link',async()=>{const db=database(),b=brevo();await handleAuth(req('request-link',{email:'hanne@example.com',purpose:'setup'}),db,{...mailEnv,APP_ORIGIN:'http://evil.test'},b.fetcher);assert.match(b.sent[0].htmlContent,/https:\/\/hanne\.test\/login\?acesso=/);});

test('trocar senha exige sessão e a senha atual, encerra as outras sessões e mantém esta',async()=>{const db=database();const first=await handleAuth(req('setup',withCode),db,env),cookie=first.headers.get('set-cookie').split(';')[0];const other=(await handleAuth(req('login',credentials),db,env)).headers.get('set-cookie').split(';')[0];
  assert.equal((await handleAuth(req('change-password',{currentPassword:credentials.password,newPassword:'nova-senha-segura-9'}),db,env)).status,401,'sem sessão');
  assert.equal((await handleAuth(req('change-password',{currentPassword:'errada',newPassword:'nova-senha-segura-9'},{cookie}),db,env)).status,403);
  assert.equal((await handleAuth(req('change-password',{currentPassword:credentials.password,newPassword:'curta'},{cookie}),db,env)).status,400);
  assert.equal((await handleAuth(req('change-password',{currentPassword:credentials.password,newPassword:credentials.password},{cookie}),db,env)).status,400);
  const changed=await handleAuth(req('change-password',{currentPassword:credentials.password,newPassword:'nova-senha-segura-9'},{cookie}),db,env);assert.equal(changed.status,200);
  const renewed=changed.headers.get('set-cookie').split(';')[0];assert.ok(await salonIdentity(new Request(origin,{headers:{cookie:renewed}}),db));
  assert.equal(await salonIdentity(new Request(origin,{headers:{cookie:other}}),db),null,'outro aparelho saiu');assert.equal(await salonIdentity(new Request(origin,{headers:{cookie}}),db),null);
  assert.equal((await handleAuth(req('login',credentials),db,env)).status,401);assert.equal((await handleAuth(req('login',{...credentials,password:'nova-senha-segura-9'}),db,env)).status,200);
  const status=await (await handleAuth(new Request(origin+'/api/auth/status',{headers:{cookie:renewed}}),db,env)).json();assert.equal(status.email,'hanne@example.com');
  assert.equal((await (await handleAuth(new Request(origin+'/api/auth/status'),db,env)).json()).email,undefined,'sem sessão não mostra o e-mail');});

/* ---------- Vários salões, convites e troca de e-mail ---------- */
const cookieOf=response=>response.headers.get('set-cookie').split(';')[0];
const get=(path,cookie)=>new Request(origin+'/api/auth/'+path,{headers:cookie?{cookie}:{}});
async function titular(db,e=env){const r=await handleAuth(req('setup',withCode),db,e);assert.equal(r.status,200);return cookieOf(r);}
const memberPassword='senha-do-salao-2-99';

test('convite sem e-mail: link volta para a titular e cria um salão com dados separados',async()=>{const db=database(),admin=await titular(db);
  assert.equal((await (await handleAuth(get('status',admin),db,env)).json()).role,'admin');
  assert.equal((await handleAuth(req('invite',{email:'salao2@exemplo.com'}),db,env)).status,401,'convite exige sessão');
  assert.equal((await handleAuth(req('invite',{email:credentials.email},{cookie:admin}),db,env)).status,409,'e-mail já cadastrado');
  const invited=await (await handleAuth(req('invite',{email:'Salao2@Exemplo.com'},{cookie:admin}),db,env)).json();
  assert.equal(invited.sent,false);const token=/acesso=([a-f0-9]{64})/.exec(invited.link)[1];
  const list=await (await handleAuth(get('users',admin),db,env)).json();assert.deepEqual(list.invites.map(i=>i.email),['salao2@exemplo.com']);
  const done=await handleAuth(req('complete',{token,password:memberPassword}),db,env);assert.equal(done.status,200);const member=cookieOf(done);
  const memberId=await salonIdentity(new Request(origin,{headers:{cookie:member}}),db);assert.ok(memberId);assert.notEqual(memberId,owner,'outro owner_id: outros registros');
  assert.equal((await (await authorizeRequest(new Request(origin,{headers:{cookie:member}}),db)).headers.get('oai-authenticated-user-id')),memberId);
  assert.equal((await handleAuth(req('complete',{token,password:memberPassword}),db,env)).status,410,'link de uso único');
  assert.equal((await (await handleAuth(get('status',member),db,env)).json()).role,'member');
  assert.equal((await handleAuth(get('users',member),db,env)).status,403,'só a titular lista');
  assert.equal((await handleAuth(req('invite',{email:'outra@exemplo.com'},{cookie:member}),db,env)).status,403,'só a titular convida');
  assert.equal((await handleAuth(req('login',{email:'salao2@exemplo.com',password:memberPassword}),db,env)).status,200);
  const after=await (await handleAuth(get('users',admin),db,env)).json();assert.deepEqual(after.users.map(u=>[u.email,u.role]),[[credentials.email,'admin'],['salao2@exemplo.com','member']]);assert.equal(after.invites.length,0);});

test('convite por e-mail, cancelamento e desativação do salão',async()=>{const db=database(),b=brevo(),admin=await titular(db,{...env,...mailEnv});const e={...env,...mailEnv};
  const sent=await (await handleAuth(req('invite',{email:'salao3@exemplo.com'},{cookie:admin}),db,e,b.fetcher)).json();assert.equal(sent.sent,true);assert.equal(sent.link,undefined,'link não volta quando vai por e-mail');
  assert.equal(b.sent.length,1);assert.match(b.sent[0].subject,/acesso ao Hanne/);assert.match(b.sent[0].htmlContent,/7 dias/);
  assert.equal((await handleAuth(req('cancel-invite',{email:'salao3@exemplo.com'},{cookie:admin}),db,e)).status,200);
  assert.equal((await handleAuth(req('complete',{token:linkOf(b.sent[0]),password:memberPassword}),db,e)).status,410,'convite cancelado');
  await handleAuth(req('invite',{email:'salao3@exemplo.com'},{cookie:admin}),db,e,b.fetcher);const member=cookieOf(await handleAuth(req('complete',{token:linkOf(b.sent[1]),password:memberPassword}),db,e));
  const {users}=await (await handleAuth(get('users',admin),db,e)).json(),target=users.find(u=>u.role==='member'),self=users.find(u=>u.you);
  assert.equal((await handleAuth(req('user-access',{id:self.id,disabled:true},{cookie:admin}),db,e)).status,400,'titular não se desativa');
  assert.equal((await handleAuth(req('user-access',{id:target.id,disabled:true},{cookie:member}),db,e)).status,403);
  assert.equal((await handleAuth(req('user-access',{id:target.id,disabled:true},{cookie:admin}),db,e)).status,200);
  assert.equal(await salonIdentity(new Request(origin,{headers:{cookie:member}}),db),null,'sessão encerrada');
  assert.equal((await handleAuth(req('login',{email:'salao3@exemplo.com',password:memberPassword}),db,e)).status,403);
  const before=b.sent.length;await handleAuth(req('request-link',{email:'salao3@exemplo.com',purpose:'reset'}),db,e,b.fetcher);assert.equal(b.sent.length,before,'desativado não recebe link');
  assert.equal((await handleAuth(req('user-access',{id:target.id,disabled:false},{cookie:admin}),db,e)).status,200);
  assert.equal((await handleAuth(req('login',{email:'salao3@exemplo.com',password:memberPassword}),db,e)).status,200);
  // "Esqueci a senha" de um salão troca só a senha dele.
  await handleAuth(req('request-link',{email:'salao3@exemplo.com',purpose:'reset'}),db,e,b.fetcher);const reset=b.sent.at(-1);assert.equal(reset.to[0].email,'salao3@exemplo.com');
  assert.equal((await handleAuth(req('complete',{token:linkOf(reset),password:'outra-senha-do-salao'}),db,e)).status,200);
  assert.equal((await handleAuth(req('login',{email:'salao3@exemplo.com',password:'outra-senha-do-salao'}),db,e)).status,200);
  assert.equal((await handleAuth(req('login',credentials),db,e)).status,200,'titular não muda');});

test('troca de e-mail: sem envio configurado muda na hora; exige senha e e-mail livre',async()=>{const db=database(),admin=await titular(db);
  await handleAuth(req('invite',{email:'ocupado@exemplo.com'},{cookie:admin}),db,env).then(r=>r.json()).then(({link})=>handleAuth(req('complete',{token:/acesso=(\w+)/.exec(link)[1],password:memberPassword}),db,env));
  assert.equal((await handleAuth(req('change-email',{newEmail:'nova@exemplo.com',password:'errada'},{cookie:admin}),db,env)).status,403);
  assert.equal((await handleAuth(req('change-email',{newEmail:'ocupado@exemplo.com',password:credentials.password},{cookie:admin}),db,env)).status,409);
  assert.equal((await handleAuth(req('change-email',{newEmail:'invalido',password:credentials.password},{cookie:admin}),db,env)).status,400);
  const changed=await (await handleAuth(req('change-email',{newEmail:'Nova@Exemplo.com',password:credentials.password},{cookie:admin}),db,env)).json();assert.equal(changed.pending,false);assert.equal(changed.email,'nova@exemplo.com');
  assert.equal((await handleAuth(req('login',credentials),db,env)).status,401);assert.equal((await handleAuth(req('login',{...credentials,email:'nova@exemplo.com'}),db,env)).status,200);
  assert.ok(await salonIdentity(new Request(origin,{headers:{cookie:admin}}),db),'continua conectada');});

test('troca de e-mail com envio configurado: só muda depois do link enviado ao novo endereço',async()=>{const db=database(),b=brevo(),e={...env,...mailEnv},admin=await titular(db,e);
  const pending=await (await handleAuth(req('change-email',{newEmail:'nova@exemplo.com',password:credentials.password},{cookie:admin}),db,e,b.fetcher)).json();assert.equal(pending.pending,true);
  assert.equal(b.sent[0].to[0].email,'nova@exemplo.com');assert.match(b.sent[0].htmlContent,/login\?email=[a-f0-9]{64}/);
  assert.equal((await handleAuth(req('login',credentials),db,e)).status,200,'ainda vale o e-mail antigo');
  const token=/email=([a-f0-9]{64})/.exec(b.sent[0].htmlContent)[1];
  assert.equal((await handleAuth(req('complete',{token,password:'qualquer-senha-123'}),db,e)).status,410,'link de e-mail não define senha');
  const ok=await handleAuth(req('confirm-email',{token}),db,e);assert.equal(ok.status,200);assert.equal(ok.headers.get('set-cookie'),null,'não abre sessão');
  assert.equal((await handleAuth(req('confirm-email',{token}),db,e)).status,410);
  assert.equal((await handleAuth(req('login',credentials),db,e)).status,401);assert.equal((await handleAuth(req('login',{...credentials,email:'nova@exemplo.com'}),db,e)).status,200);});

test('migração: a conta única existente vira a titular com o mesmo owner_id',async()=>{const sql=new DatabaseSync(':memory:'),files=readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort(),run=f=>sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
  for(const f of files.filter(f=>f<'0007'))run(f);sql.prepare('INSERT INTO salon_credentials (id,owner_id,email,salt,password_hash) VALUES (1,?,?,?,?)').run(owner,' Hanne@Example.com ','sal','hash');
  for(const f of files.filter(f=>f>='0007'))run(f);assert.deepEqual({...sql.prepare('SELECT owner_id,email,role,disabled FROM salon_users').get()},{owner_id:owner,email:'hanne@example.com',role:'admin',disabled:0});});
