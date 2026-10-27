import { bridgeURL, bridgeRequest } from './baileys-client.mjs';
/** Canal YCloud por conta: configuração cifrada, caixa persistente e webhook HMAC.
 * Não importa nem altera snapshots, agendamentos, pagamentos ou clientes.
 */
import { ChannelError, EVENTS, phone, peerOf, windowOpen, encrypt, decrypt, verifySignature, validateMedia, mediaMime, safeMediaURL } from './whatsapp-domain.mjs';
import { ycloud } from './ycloud.mjs';
import { metaRequest, metaErrorReason, numericID, safeMetaMediaURL, verifyMetaSignature, normalizeMetaEvents } from './meta-cloud.mjs';
const MAX_BODY = 17 * 1024 * 1024;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
const one = (db, sql, ...args) => stmt(db, sql, ...args).first();
const all = async (db, sql, ...args) => (await stmt(db, sql, ...args).all()).results;
const run = (db, sql, ...args) => stmt(db, sql, ...args).run();
const channel = (db, user) => one(db, 'SELECT * FROM wa_connections WHERE user_id = ?', user);
const cleanMessage = m => ({ id: m.id, direction: m.direction, type: m.type, body: m.body, status: m.status === 'sending' && Date.now() - Date.parse(m.at) > 60000 ? 'uncertain' : m.status, error: m.error, at: m.at, hasMedia: !!m.media });
/** Limita inclusive corpos chunked; não confia só no Content-Length. */
async function readBounded(request, max = MAX_BODY) {
  if (Number(request.headers.get('content-length')) > max) throw new ChannelError('Arquivo ou requisição excedeu o limite.', 413);
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks = []; let length = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); throw new ChannelError('Arquivo ou requisição excedeu o limite.', 413); } chunks.push(value); }
  const result = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
async function bodyJSON(request) { try { return JSON.parse(new TextDecoder().decode(await readBounded(request, 20000))); } catch (e) { if (e instanceof ChannelError) throw e; throw new ChannelError('Dados inválidos. Confira os campos.'); } }
const webhookURL = (request, c) => new URL('/api/whatsapp/webhook/' + c.id, request.url).href;
/** Retorna apenas informações operacionais; nunca valores cifrados ou chaves. */
function publicConnection(c, master) {
  return { available: !!master, connected: c?.status === 'ready', status: c?.status || 'disconnected', phone: c?.phone || '', provider: c?.provider || 'meta', providerStatus: c?.provider_status || '', lastWebhook: c?.last_webhook || null };
}
/** Mostra etapas reais. O verifyToken só verifica callback; não autoriza mensagens. */
async function describeConnection(request,env,c,fetcher=fetch){
  if(c?.provider==='baileys')return describeBaileys(env,c,fetcher);
  const result=publicConnection(c,env.WHATSAPP_ENCRYPTION_KEY);
  if(c?.provider==='meta'&&c.api_key){
    Object.assign(result,{callbackURL:new URL('/api/whatsapp/meta-webhook/'+c.id,request.url).href,verifyToken:c.verify_token?await decrypt(c.verify_token,env.WHATSAPP_ENCRYPTION_KEY,c.user_id):'',phoneId:c.phone_id,wabaId:c.waba_id,webhookVerifiedAt:c.webhook_verified_at,subscribedAt:c.subscribed_at,lastInbound:c.meta_last_inbound,setupError:c.connection_error||'',credentialsVerified:true});
  }
  return result;
}
/** Baileys usa um processo Node externo, HTTPS e assinatura por instalação. */
async function connectBaileys(request,env,user,fetcher,input){
  if(!env.WHATSAPP_ENCRYPTION_KEY)throw new ChannelError('Configuração segura do servidor indisponível.',503);
  const url=bridgeURL(input.bridgeURL),key=String(input.bridgeKey||'');
  if(!/^[a-zA-Z0-9_-]{32,160}$/.test(key))throw new ChannelError('Use a chave do conector com 32 a 160 caracteres.');
  const health=await (await bridgeRequest(url,key,'/health',{},fetcher)).json();
  if(health.service!=='hanne-baileys'||health.version!==1)throw new ChannelError('Este endereço não é um conector Hanne Baileys compatível.');
  const old=await channel(env.DB,user),id=old?.id||crypto.randomUUID(),cipher=await encrypt(key,env.WHATSAPP_ENCRYPTION_KEY,user);
  if(old?.provider==='baileys'&&old.phone_id!==url)throw new ChannelError('Desconecte e solicite a migração para trocar o servidor do conector.',409);
  // Armazena antes de iniciar a sessão: o primeiro evento pode chegar imediatamente.
  await run(env.DB,`INSERT INTO wa_connections (user_id,id,phone,phone_id,waba_id,api_key,webhook_secret,provider,status,provider_status,updated_at)
    VALUES (?,?,?,?,'',?,?,'baileys','pairing','QR_PENDING',?) ON CONFLICT(user_id) DO UPDATE SET phone_id=excluded.phone_id,waba_id='',api_key=excluded.api_key,webhook_secret=excluded.webhook_secret,provider='baileys',status='pairing',provider_status='QR_PENDING',updated_at=excluded.updated_at`,user,id,old?.phone||'pending:'+id,url,cipher,cipher,Date.now());
  const c=await channel(env.DB,user);
  try{await bridgeRequest(url,key,'/session',{method:'POST',body:JSON.stringify({callbackURL:new URL('/api/whatsapp/baileys-webhook/'+id,request.url).href,expectedPhone:c.phone.startsWith('pending:')?'':c.phone,channelId:id})},fetcher);}
  catch{throw new ChannelError('Conector cadastrado, mas a sessão não iniciou. Confira o servidor e tente novamente.',503);}
  return json(await describeBaileys(env,await channel(env.DB,user),fetcher));
}
async function describeBaileys(env,c,fetcher){
  const result=publicConnection(c,env.WHATSAPP_ENCRYPTION_KEY);
  if(!c.api_key||c.status==='disconnected')return result;
  try{
    const key=await decrypt(c.api_key,env.WHATSAPP_ENCRYPTION_KEY,c.user_id),remote=await (await bridgeRequest(c.phone_id,key,'/session',{},fetcher)).json();
    const actual=phone(remote.phone);
    // Não misturar histórico de números diferentes, mesmo após trocar de aparelho.
    if(actual&&!c.phone.startsWith('pending:')&&actual!==c.phone){await run(env.DB,"UPDATE wa_connections SET status='wrong_number' WHERE id=? AND updated_at=?",c.id,c.updated_at);throw new ChannelError('O QR foi lido por outro número. Desconecte esse aparelho e use o número já vinculado.',409);}
    if(actual&&c.phone.startsWith('pending:'))await run(env.DB,'UPDATE wa_connections SET phone=? WHERE id=? AND phone=?',actual,c.id,c.phone);
    const status=remote.status==='ready'&&actual?'ready':remote.status==='pairing'?'pairing':'reconnecting';
    await run(env.DB,"UPDATE wa_connections SET status=?,provider_status=? WHERE id=? AND updated_at=? AND status!='disconnected'",status,status.toUpperCase(),c.id,c.updated_at);
    Object.assign(result,{status,connected:status==='ready',phone:actual||c.phone,qr:remote.qr&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(remote.qr)&&remote.qr.length<100000?remote.qr:null,bridgeURL:c.phone_id});
  }catch(error){result.connected=false;result.setupError=error instanceof ChannelError?error.message:'Conector fora do ar. Verifique se o processo Node está ligado.';}
  return result;
}
async function baileysWebhook(request,env,id){
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  const c=await one(env.DB,'SELECT * FROM wa_connections WHERE id=?',id);
  if(c?.provider!=='baileys'||!c.webhook_secret||c.status==='disconnected')return json({error:'Canal indisponível.'},404);
  const raw=await readBounded(request,1024*1024),key=await decrypt(c.webhook_secret,env.WHATSAPP_ENCRYPTION_KEY,c.user_id);
  if(!await verifySignature(raw,request.headers.get('X-Baileys-Signature'),key))return json({error:'Assinatura inválida.'},401);
  let event;try{event=JSON.parse(new TextDecoder().decode(raw));}catch{throw new ChannelError('Evento inválido.');}
  if(typeof event.id!=='string'||!event.id||event.id.length>200)throw new ChannelError('Evento inválido.');
  // Número de origem deve coincidir; a sessão nunca autoriza trocar o titular implicitamente.
  const sender=phone(event.whatsappInboundMessage?.to||event.whatsappMessage?.from);
  if(!sender||c.phone!==sender)throw new ChannelError('Número diferente do canal confirmado. Atualize a conexão antes de receber.',403);
  return processChannelEvent(env,c,event);
}
/** Registra o callback exclusivo da WABA. Falha mantém etapas e orientação de ajuste manual. */
async function subscribeMeta(request,env,c,key,verifyToken,fetcher){
  let issue='',subscribed=null;
  try{
    const callback=new URL('/api/whatsapp/meta-webhook/'+c.id,request.url).href;
    const result=await metaRequest(key,'/'+c.waba_id+'/subscribed_apps',{method:'POST',body:JSON.stringify({override_callback_uri:callback,verify_token:verifyToken})},fetcher);
    if(result.success!==true)throw new ChannelError('A Meta não confirmou a inscrição. Confira a configuração de Webhooks no painel.',502);
    subscribed=new Date().toISOString();
  }catch(e){issue=e instanceof ChannelError?e.message:'Não foi possível confirmar a inscrição. Configure o callback no painel da Meta.';}
  await run(env.DB,"UPDATE wa_connections SET subscribed_at=?,connection_error=?,status=CASE WHEN meta_last_inbound IS NOT NULL THEN 'ready' ELSE ? END WHERE user_id=? AND updated_at=? AND provider='meta' AND status!='disconnected'",subscribed,issue,issue?'needs_webhook':'awaiting_message',c.user_id,c.updated_at);
  return json(await describeConnection(request,env,await channel(env.DB,c.user_id)));
}
/** Verifica token + vínculo WABA/número; não registra nem migra números no Business. */
async function connectMeta(request,env,user,fetcher,input){
  if(!env.WHATSAPP_ENCRYPTION_KEY)throw new ChannelError('A configuração segura do servidor está indisponível.',503);
  const token=String(input.accessToken||'').trim(),secret=String(input.appSecret||'').trim(),phoneId=String(input.phoneId||'').trim(),wabaId=String(input.wabaId||'').trim();
  if(token.length<15||token.length>3000||/[\r\n]/.test(token))throw new ChannelError('Cole o token de acesso do painel WhatsApp → Configuração da API.');
  if(!/^[a-f\d]{32}$/i.test(secret))throw new ChannelError('Cole o Segredo do aplicativo (App secret), encontrado em Configurações do app → Básico.');
  if(!numericID(phoneId)||!numericID(wabaId))throw new ChannelError('Use os IDs numéricos do número e da conta WhatsApp. Não use o telefone com DDD nesses campos.');
  const numbers=await metaRequest(token,'/'+wabaId+'/phone_numbers?fields=id,display_phone_number,verified_name&limit=100',{},fetcher);
  const number=numbers.data?.find(x=>String(x.id)===phoneId),sender=phone(number?.display_phone_number);
  if(!number||!sender)throw new ChannelError('Este ID do número não pertence à conta WhatsApp informada. Confira os dois IDs no mesmo painel.',422);
  const existing=await channel(env.DB,user);
  if(existing&&existing.phone!==sender&&(await one(env.DB,'SELECT count(*) n FROM wa_messages WHERE channel_id=?',existing.id)).n)throw new ChannelError('Esta conta já possui histórico de outro número. Use o mesmo número para preservar a associação ou configure o teste em outra conta do sistema.',409);
  const id=existing?.id||crypto.randomUUID(),now=Date.now(),verifyToken=crypto.randomUUID()+crypto.randomUUID();
  const values=await Promise.all([encrypt(token,env.WHATSAPP_ENCRYPTION_KEY,user),encrypt(secret,env.WHATSAPP_ENCRYPTION_KEY,user),encrypt(verifyToken,env.WHATSAPP_ENCRYPTION_KEY,user)]);
  let claim;
  try{claim=await run(env.DB,`INSERT INTO wa_connections (user_id,id,phone,phone_id,waba_id,api_key,webhook_secret,verify_token,provider,status,provider_status,updated_at)
    VALUES (?,?,?,?,?,?,?,?,'meta','configuring','API_VERIFIED',?) ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,phone_id=excluded.phone_id,waba_id=excluded.waba_id,api_key=excluded.api_key,webhook_secret=excluded.webhook_secret,verify_token=excluded.verify_token,provider='meta',status='configuring',provider_status='API_VERIFIED',updated_at=excluded.updated_at,webhook_verified_at=NULL,subscribed_at=NULL,meta_last_inbound=NULL,connection_error=NULL,webhook_id=NULL
    WHERE wa_connections.status!='configuring' OR wa_connections.updated_at<?`,user,id,sender,phoneId,wabaId,...values,now,now-120000);}
  catch{throw new ChannelError('Este número já está vinculado a outra conta do sistema.',409);}
  if(!claim.meta.changes)throw new ChannelError('A configuração já está em andamento. Aguarde e atualize.',409);
  return subscribeMeta(request,env,await channel(env.DB,user),token,verifyToken,fetcher);
}
/** Verifica propriedade do número usando a chave antes de persistir a conexão. */
async function connect(request, env, user, fetcher) {
  if (!env.WHATSAPP_ENCRYPTION_KEY) throw new ChannelError('A configuração segura do servidor ainda precisa ser concluída.', 503);
  const input = await bodyJSON(request), sender = phone(input.phoneNumber), key = String(input.apiKey || '').trim();
  if (!sender || !String(input.phoneNumber).trim().startsWith('+')) throw new ChannelError('Informe o número com +, país e DDD. Exemplo: +5511999999999.');
  if (key.length < 12 || key.length > 500 || /[\r\n]/.test(key)) throw new ChannelError('Informe a chave de API gerada no YCloud.');
  const existing = await channel(env.DB, user);
  if(existing?.provider==='meta')throw new ChannelError('Use a configuração direta da Meta para esta conexão.',409);
  if (existing && existing.phone !== sender) throw new ChannelError('Esta conta já possui histórico de outro número. Solicite a migração antes de trocar o número.', 409);
  const numbers = await ycloud(key, '/whatsapp/phoneNumbers?limit=100', {}, fetcher);
  const number = numbers.items?.find(x => phone(x.phoneNumber) === sender);
  if (!number || number.status !== 'CONNECTED') throw new ChannelError('Vincule este número no YCloud por QR Code e aguarde o status Connected antes de continuar.', 422);
  const id = existing?.id || crypto.randomUUID(), now = Date.now(), cipher = await encrypt(key, env.WHATSAPP_ENCRYPTION_KEY, user);
  // Lock temporário impede dois cliques/abas de criarem webhooks simultâneos.
  let claim;
  try { claim = await run(env.DB, `INSERT INTO wa_connections (user_id,id,phone,phone_id,waba_id,api_key,status,provider_status,updated_at) VALUES (?,?,?,?,?,?,'configuring',?,?)
    ON CONFLICT(user_id) DO UPDATE SET api_key=excluded.api_key,phone_id=excluded.phone_id,waba_id=excluded.waba_id,status='configuring',provider_status=excluded.provider_status,updated_at=excluded.updated_at
    WHERE wa_connections.status != 'configuring' OR wa_connections.updated_at < ?`, user,id,sender,String(number.id),String(number.wabaId),cipher,number.status,now,now-120000); }
  catch { throw new ChannelError('Este número já está vinculado a outra conta do sistema.', 409); }
  if (!claim.meta.changes) throw new ChannelError('A conexão já está sendo configurada. Aguarde e atualize.', 409);
  try {
    const url = webhookURL(request, { id });
    const list = await ycloud(key, '/webhookEndpoints?limit=100', {}, fetcher);
    let hook = list.items?.find(x => x.url === url);
    // Busca por URL torna a retomada segura após timeout da criação no provedor.
    if (hook) hook = await ycloud(key, '/webhookEndpoints/' + encodeURIComponent(hook.id), {}, fetcher);
    else hook = await ycloud(key, '/webhookEndpoints', { method:'POST', body:JSON.stringify({ url, enabledEvents:EVENTS, status:'active', description:'Atendimentos Hanne' }) }, fetcher);
    if (!hook.secret || !hook.id || hook.url !== url || hook.status !== 'active' || !EVENTS.every(x => hook.enabledEvents?.includes(x))) throw new ChannelError('Confira o webhook Atendimentos Hanne no YCloud: precisa estar ativo com os três eventos de mensagens.', 422);
    await run(env.DB, "UPDATE wa_connections SET webhook_id=?,webhook_secret=?,status='ready',updated_at=? WHERE user_id=? AND updated_at=?", hook.id,await encrypt(hook.secret,env.WHATSAPP_ENCRYPTION_KEY,user),Date.now(),user,now);
    return json(publicConnection(await channel(env.DB,user),env.WHATSAPP_ENCRYPTION_KEY));
  } catch (error) {
    await run(env.DB, "UPDATE wa_connections SET status='setup_error' WHERE user_id=? AND updated_at=?",user,now);
    throw error;
  }
}
/** Envio só para uma conversa recebida e ainda dentro da janela de 24h. */
async function send(request, env, c, user, fetcher) {
  if (c?.status !== 'ready') throw new ChannelError('Conecte o WhatsApp antes de enviar.',409);
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new ChannelError('Envie a resposta pelo formulário da conversa.');
  const bytes = await readBounded(request);
  const form = await new Request(request.url,{ method:'POST',headers:{'Content-Type':request.headers.get('content-type') || ''},body:bytes }).formData();
  const threadId = String(form.get('threadId') || ''), requestId = String(form.get('requestId') || ''), text = String(form.get('text') || '').trim(), file = form.get('file');
  if (!/^[\w-]{16,100}$/.test(requestId) || text.length > 4096 || (!text && !file)) throw new ChannelError('Escreva uma mensagem ou escolha um arquivo. Texto: até 4.096 caracteres.');
  const thread = await one(env.DB,'SELECT * FROM wa_threads WHERE id=? AND channel_id=?',threadId,c.id);
  if (!thread) throw new ChannelError('Conversa não encontrada.',404);
  const type = file ? await validateMedia(file) : 'text';
  if (type === 'audio' && text) throw new ChannelError('Envie o áudio sem legenda; o texto pode ser enviado separadamente.');
  if (type === 'image' && text.length > 1024) throw new ChannelError('A legenda da imagem deve ter até 1.024 caracteres.');
  const payload = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([threadId,text,type,file?.name,file?.size, file ? btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())))) : '']))));
  const fingerprint = Array.from(payload,x=>x.toString(16).padStart(2,'0')).join('');
  const previous = await one(env.DB,'SELECT * FROM wa_messages WHERE channel_id=? AND request_id=?',c.id,requestId);
  if (previous) { if (previous.fingerprint !== fingerprint) throw new ChannelError('Esta tentativa já pertence a outra mensagem.',409); return json({ message:cleanMessage(previous), duplicate:true }); }
  if (c.provider!=='baileys' && !windowOpen(thread.last_inbound)) throw new ChannelError('O prazo de 24 horas terminou. Aguarde uma nova mensagem da cliente ou responda no aplicativo WhatsApp Business.',422,'window_closed');
  const id = crypto.randomUUID(), at = new Date().toISOString();
  const claimed = await run(env.DB,"INSERT OR IGNORE INTO wa_messages (id,channel_id,thread_id,request_id,fingerprint,direction,type,body,status,at) VALUES (?,?,?,?,?,'out',?,?,'sending',?)",id,c.id,threadId,requestId,fingerprint,type,text,at);
  if (!claimed.meta.changes) {
    const duplicate = await one(env.DB,'SELECT * FROM wa_messages WHERE channel_id=? AND request_id=?',c.id,requestId);
    if (duplicate.fingerprint !== fingerprint) throw new ChannelError('Esta tentativa já pertence a outra mensagem.',409);
    return json({message:cleanMessage(duplicate),duplicate:true});
  }
  let dispatching = false;
  try {
    const key = await decrypt(c.api_key,env.WHATSAPP_ENCRYPTION_KEY,user);
    let media;
    if(c.provider==='baileys'){
      const upload=new FormData();upload.set('requestId',requestId);upload.set('to',thread.peer);upload.set('text',text);if(file)upload.set('file',file,file.name);
      dispatching=true;
      const sent=await (await bridgeRequest(c.phone_id,key,'/send',{method:'POST',body:upload},fetcher)).json();
      if(!sent.id||sent.status==='uncertain')throw new ChannelError('Envio sem confirmação. Confira a conversa antes de reenviar.',502,'uncertain');
      await run(env.DB,"UPDATE wa_messages SET provider_id=?,status=CASE WHEN status IN ('sending','uncertain') THEN 'accepted' ELSE status END WHERE id=?",sent.id,id);
      await run(env.DB,'UPDATE wa_threads SET last_at=MAX(last_at,?) WHERE id=?',at,threadId);
      return json({message:cleanMessage(await one(env.DB,'SELECT * FROM wa_messages WHERE id=?',id))});
    }
    if (file) {
      const upload = new FormData(); upload.set('file',new File([file],file.name,{type:mediaMime(file.type)}),file.name);
      if(c.provider==='meta'){
        upload.set('messaging_product','whatsapp');upload.set('type',mediaMime(file.type));
        media=await metaRequest(key,'/'+c.phone_id+'/media',{method:'POST',body:upload},fetcher);
      }else media = await ycloud(key,'/whatsapp/media/'+encodeURIComponent(c.phone)+'/upload',{method:'POST',body:upload},fetcher);
      if (!media.id) throw new ChannelError('O provedor não confirmou o arquivo. Confira a conversa.',502,'uncertain');
    }
    // Upload pode levar tempo; verifica novamente imediatamente antes do despacho.
    const fresh = await channel(env.DB,user);
    if (fresh?.status !== 'ready' || fresh.updated_at !== c.updated_at || !windowOpen((await one(env.DB,'SELECT last_inbound FROM wa_threads WHERE id=?',threadId)).last_inbound)) throw new ChannelError('A conexão ou o prazo mudou. Atualize a conversa.',409,'rejected');
    const data = { ...(c.provider==='meta'?{messaging_product:'whatsapp',recipient_type:'individual',biz_opaque_callback_data:requestId}:{from:c.phone,externalId:requestId}), ...(thread.peer.startsWith('US.') ? {recipient:thread.peer} : {to:thread.peer}), type, [type]:type === 'text' ? {body:text} : {id:String(media.id),...(type === 'image' && text ? {caption:text} : {})} };
    dispatching = true;
    const response = c.provider==='meta'?await metaRequest(key,'/'+c.phone_id+'/messages',{method:'POST',body:JSON.stringify(data)},fetcher):await ycloud(key,'/whatsapp/messages/sendDirectly',{method:'POST',body:JSON.stringify(data)},fetcher);
    const sent=c.provider==='meta'?{id:response.messages?.[0]?.id}:response;
    if (!sent.id) throw new ChannelError('O envio ficou sem confirmação. Atualize a conversa antes de decidir reenviar.',502,'uncertain');
    await run(env.DB,"UPDATE wa_messages SET provider_id=?,status=CASE WHEN status IN ('sending','uncertain') THEN ? ELSE status END,error=? WHERE id=?",String(sent.id),sent.status === 'failed' ? 'failed' : 'accepted',sent.status === 'failed' ? 'O provedor recusou a mensagem. Confira o painel do provedor.' : null,id);
    await run(env.DB,'UPDATE wa_threads SET last_at=MAX(last_at,?) WHERE id=?',at,threadId);
  } catch (error) {
    const uncertain = dispatching && (!(error instanceof ChannelError) || error.code === 'uncertain');
    await run(env.DB,"UPDATE wa_messages SET status=?,error=? WHERE id=? AND status IN ('sending','uncertain')",uncertain?'uncertain':'failed',uncertain?'Sem confirmação. Confira o histórico e o painel do provedor antes de reenviar.':error.message,id);
  }
  return json({message:cleanMessage(await one(env.DB,'SELECT * FROM wa_messages WHERE id=?',id))});
}
/** Verifica assinatura antes do JSON; todos os efeitos e a deduplicação são atômicos. */
async function webhook(request, env, id) {
  if (request.method !== 'POST') return json({error:'Método não permitido.'},405);
  const c = await one(env.DB,'SELECT * FROM wa_connections WHERE id=?',id);
  if (!c?.webhook_secret || c.provider==='meta' || c.status !== 'ready' || !env.WHATSAPP_ENCRYPTION_KEY) return json({error:'Canal indisponível.'},404);
  const raw = await readBounded(request,1024*1024), secret = await decrypt(c.webhook_secret,env.WHATSAPP_ENCRYPTION_KEY,c.user_id);
  if (!await verifySignature(raw,request.headers.get('YCloud-Signature'),secret)) return json({error:'Assinatura inválida.'},401);
  let event; try { event=JSON.parse(new TextDecoder().decode(raw)); } catch { throw new ChannelError('Evento inválido.'); }
  if (typeof event.id !== 'string' || event.id.length > 200 || !event.id || typeof event.type !== 'string') throw new ChannelError('Evento inválido.');
  return processChannelEvent(env,c,event);
}
/** Evento autenticado e normalizado. Compartilha atomicidade e regras entre provedores. */
async function processChannelEvent(env,c,event){
  const eventId = c.id + ':' + event.id, now = new Date().toISOString(), sqls = [], guard = 'NOT EXISTS (SELECT 1 FROM wa_events WHERE id=?)';
  const inbound = event.type === EVENTS[0], echo = event.type === EVENTS[2], m = inbound ? event.whatsappInboundMessage : event.whatsappMessage;
  if (EVENTS.includes(event.type) && m) {
    if (phone(inbound ? m.to : m.from) !== c.phone || (m.wabaId && String(m.wabaId) !== c.waba_id)) throw new ChannelError('Evento de outro número.',403);
    const peer = peerOf(m,inbound), providerId = String(m.id || '').slice(0,512);
    if (!providerId) throw new ChannelError('Mensagem sem identificador.');
    if ((inbound || echo) && peer) {
      const existing = await one(env.DB,'SELECT id FROM wa_threads WHERE channel_id=? AND peer=?',c.id,peer);
      // ID determinístico evita duas threads em notificações simultâneas do mesmo contato.
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.id+':'+peer));
      const threadId = existing?.id || Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      const at = Number.isFinite(Date.parse(m.sendTime)) ? new Date(Math.min(Date.parse(m.sendTime),Date.now())).toISOString() : now;
      const serviceMessage = inbound && m.type !== 'system';
      const name = String(m.customerProfile?.name || m.customerProfile?.username || peer).slice(0,120);
      const type = ['text','image','audio'].includes(m.type) ? m.type : 'unsupported';
      const body = String(m.text?.body || m.image?.caption || (type === 'unsupported' ? 'Mensagem de outro formato. Consulte no WhatsApp Business.' : '')).slice(0,10000);
      const media = c.provider==='baileys'&&/^baileys:[a-zA-Z0-9_-]{16,100}$/.test(m[type]?.mediaRef||'')?m[type].mediaRef:c.provider==='meta'&&/^meta:\d{5,30}$/.test(m[type]?.mediaRef||'')?m[type].mediaRef:safeMediaURL(m[type]?.link);
      sqls.push(stmt(env.DB,`INSERT INTO wa_threads (id,channel_id,peer,name,last_inbound,last_at,resolved) SELECT ?,?,?,?,?,?,0 WHERE ${guard}
        ON CONFLICT(channel_id,peer) DO UPDATE SET name=excluded.name,last_inbound=CASE WHEN excluded.last_inbound IS NULL THEN wa_threads.last_inbound ELSE MAX(COALESCE(wa_threads.last_inbound,''),excluded.last_inbound) END,last_at=MAX(wa_threads.last_at,excluded.last_at),resolved=CASE WHEN ?=1 AND excluded.last_at >= wa_threads.last_at THEN 0 ELSE wa_threads.resolved END`,threadId,c.id,peer,name,serviceMessage?at:null,at,eventId,serviceMessage?1:0));
      sqls.push(stmt(env.DB,`INSERT OR IGNORE INTO wa_messages (id,channel_id,thread_id,provider_id,direction,type,body,media,status,at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard}`,crypto.randomUUID(),c.id,threadId,providerId,inbound?'in':'out',type,body,media,inbound?'received':'sent',at,eventId));
    } else if (event.type === EVENTS[1]) {
      const status = ['sent','delivered','read','failed'].includes(m.status) ? m.status : 'accepted';
      const failure=c.provider==='meta'&&m.errorCode?metaErrorReason(m.errorCode):'Envio recusado pelo WhatsApp. Confira o painel do provedor antes de enviar outra mensagem.';
      // SQL resolve ordem concorrente; read/delivered nunca regridem para sent/failed.
      sqls.push(stmt(env.DB,`UPDATE wa_messages SET provider_id=?, status=CASE WHEN status='read' THEN 'read' WHEN status='delivered' AND ?!='read' THEN 'delivered' WHEN status='failed' AND ? NOT IN ('read','delivered') THEN 'failed' ELSE ? END,error=CASE WHEN ?='failed' AND status NOT IN ('read','delivered') THEN ? ELSE NULL END WHERE channel_id=? AND direction='out' AND (provider_id=? OR (request_id=? AND ?!='')) AND ${guard}`,providerId,status,status,status,status,failure,c.id,providerId,String(m.externalId||''),String(m.externalId||''),eventId));
    }
  }
  sqls.push(stmt(env.DB,`UPDATE wa_connections SET last_webhook=? WHERE id=? AND ${guard}`,now,c.id,eventId));
  if(c.provider==='meta'&&inbound&&m.type!=='system'&&peerOf(m,true))sqls.push(stmt(env.DB,`UPDATE wa_connections SET meta_last_inbound=MAX(COALESCE(meta_last_inbound,''),?),status='ready',connection_error=NULL WHERE id=? AND provider='meta' AND status!='disconnected' AND ${guard}`,now,c.id,eventId));
  sqls.push(stmt(env.DB,'INSERT OR IGNORE INTO wa_events (id,channel_id,at) VALUES (?,?,?)',eventId,c.id,now));
  await env.DB.batch(sqls);
  return json({received:true});
}
/** Handshake oficial GET e recepção POST com X-Hub-Signature-256. */
async function metaWebhook(request,env,id){
  const c=await one(env.DB,'SELECT * FROM wa_connections WHERE id=?',id);
  if(c?.provider!=='meta'||!c.webhook_secret||!c.verify_token||c.status==='disconnected'||!env.WHATSAPP_ENCRYPTION_KEY)return json({error:'Canal indisponível.'},404);
  if(request.method==='GET'){
    const query=new URL(request.url).searchParams,verify=await decrypt(c.verify_token,env.WHATSAPP_ENCRYPTION_KEY,c.user_id),challenge=query.get('hub.challenge');
    if(query.get('hub.mode')!=='subscribe'||query.get('hub.verify_token')!==verify||!challenge||challenge.length>1000)return json({error:'Verificação inválida.'},403);
    await run(env.DB,"UPDATE wa_connections SET webhook_verified_at=? WHERE id=? AND status!='disconnected'",new Date().toISOString(),c.id);
    return new Response(challenge,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(request.method!=='POST')return json({error:'Método não permitido.'},405);
  const raw=await readBounded(request,1024*1024),secret=await decrypt(c.webhook_secret,env.WHATSAPP_ENCRYPTION_KEY,c.user_id);
  if(!await verifyMetaSignature(raw,request.headers.get('X-Hub-Signature-256'),secret))return json({error:'Assinatura inválida.'},401);
  let payload;try{payload=JSON.parse(new TextDecoder().decode(raw));}catch{throw new ChannelError('Evento da Meta inválido.');}
  const events=await normalizeMetaEvents(payload,c);
  for(const event of events)await processChannelEvent(env,c,event);
  return json({received:true});
}
/** Caminhos de webhook dos provedores: o caminho inteiro precisa coincidir, sem prefixos que levem a outras rotas. */
export const isWebhookPath = pathname => /^\/api\/whatsapp\/(webhook|meta-webhook|baileys-webhook)\/[^/]+$/.test(pathname);
/** Único despachante. Autorização da conta é exigida em cada consulta e mutação. */
export async function handleWhatsApp(request, env, fetcher = fetch) {
  try {
    if (!env.DB) return json({error:'Armazenamento indisponível.'},503);
    const path = new URL(request.url).pathname.replace(/^\/api\/whatsapp\//,'').split('/');
    if (path[0] === 'webhook' && path.length === 2) return await webhook(request,env,path[1]);
    if(path[0]==='baileys-webhook'&&path.length===2)return await baileysWebhook(request,env,path[1]);
    if(path[0]==='meta-webhook'&&path.length===2)return await metaWebhook(request,env,path[1]);
    const user = request.headers.get('oai-authenticated-user-id');
    if (!user) return json({error:'Sua sessão terminou. Entre novamente para continuar.'},401);
    if (request.method !== 'GET' && (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('X-Atelier-Dataset') === 'example')) return json({error:'Operação não permitida nesta origem ou demonstração.'},403);
    if(path[0]==='connection'&&path.length===1&&request.method==='POST'){
      const input=await bodyJSON(request.clone());
      if(input.provider==='baileys')return await connectBaileys(request,env,user,fetcher,input.managed?{bridgeURL:env.BAILEYS_BRIDGE_URL,bridgeKey:env.BAILEYS_BRIDGE_KEY}:input);
      return input.provider==='meta'?await connectMeta(request,env,user,fetcher,input):await connect(request,env,user,fetcher);
    }
    const c = await channel(env.DB,user);
    if (path[0] === 'connection' && request.method === 'GET') return json({...await describeConnection(request,env,c,fetcher),managedAvailable:!!(env.BAILEYS_BRIDGE_URL&&env.BAILEYS_BRIDGE_KEY)});
    if(path[0]==='connection'&&path[1]==='retry'&&request.method==='POST'){
      if(c?.provider==='baileys'&&c.api_key&&c.status!=='disconnected'){
        const key=await decrypt(c.api_key,env.WHATSAPP_ENCRYPTION_KEY,user);
        await bridgeRequest(c.phone_id,key,'/session',{method:'POST',body:JSON.stringify({callbackURL:new URL('/api/whatsapp/baileys-webhook/'+c.id,request.url).href,expectedPhone:c.phone.startsWith('pending:')?'':c.phone,channelId:c.id})},fetcher);
        return json(await describeBaileys(env,c,fetcher));
      }
      if(c?.provider!=='meta'||!c.api_key||c.status==='disconnected')throw new ChannelError('Informe as credenciais da Meta primeiro.',409);
      const key=await decrypt(c.api_key,env.WHATSAPP_ENCRYPTION_KEY,user),verify=await decrypt(c.verify_token,env.WHATSAPP_ENCRYPTION_KEY,user);
      return await subscribeMeta(request,env,c,key,verify,fetcher);
    }
    if (path[0] === 'connection' && request.method === 'DELETE') {
      if(c?.provider==='baileys'&&c.api_key){const key=await decrypt(c.api_key,env.WHATSAPP_ENCRYPTION_KEY,user);await bridgeRequest(c.phone_id,key,'/session',{method:'DELETE'},fetcher);}
      // Desconexão local imediata. Não revoga o número nem encerra o app Business.
      await run(env.DB,"UPDATE wa_connections SET api_key=NULL,webhook_secret=NULL,verify_token=NULL,status='disconnected',updated_at=? WHERE user_id=?",Date.now(),user);
      return json({disconnected:true});
    }
    if (path[0] === 'threads' && request.method === 'GET') {
      const before = new URL(request.url).searchParams.get('before') || '9999';
      const threads = c ? await all(env.DB,'SELECT * FROM wa_threads WHERE channel_id=? AND (last_at || id) < ? ORDER BY last_at DESC,id DESC LIMIT 101',c.id,before) : [];
      const pending = c ? (await one(env.DB,'SELECT count(*) n FROM wa_threads WHERE channel_id=? AND resolved=0',c.id)).n : 0;
      return json({threads:threads.slice(0,100),pending,older:threads.length > 100 ? threads[99].last_at+threads[99].id : null});
    }
    if (['erase-thread','erase-message'].includes(path[0]) && path[1] && request.method==='DELETE') {
      const input=await bodyJSON(request);if(input.confirmed!==true)throw new ChannelError('Confirme a exclusão.');
      if(!c)throw new ChannelError('Conexão não encontrada.',404);
      const isThread=path[0]==='erase-thread', item=await one(env.DB,isThread?'SELECT * FROM wa_threads WHERE id=? AND channel_id=?':"SELECT * FROM wa_messages WHERE id=? AND channel_id=? AND type != 'deleted'",path[1],c.id);
      if(!item)throw new ChannelError('Registro não encontrado.',404);
      const active=await one(env.DB,`SELECT count(*) n FROM wa_messages WHERE ${isThread?'thread_id':'id'}=? AND channel_id=? AND status IN ('sending','uncertain')`,path[1],c.id);
      if(active.n)throw new ChannelError('Confira primeiro o envio sem confirmação para evitar duplicação. Depois você poderá excluir.',409);
      // Apaga conteúdo local; guarda só IDs técnicos para não repetir um envio ou evento.
      const redact=stmt(env.DB,`UPDATE wa_messages SET body='',media=NULL,error=NULL,type='deleted'${isThread?",thread_id=''":''} WHERE ${isThread?'thread_id':'id'}=? AND channel_id=?`,path[1],c.id);
      await env.DB.batch(isThread?[redact,stmt(env.DB,'DELETE FROM wa_threads WHERE id=? AND channel_id=?',path[1],c.id)]:[redact]);
      return json({deleted:true});
    }
    if (path[0] === 'send' && request.method === 'POST') return await send(request,env,c,user,fetcher);
    if (path[0] === 'thread' && path[1]) {
      const thread = c && await one(env.DB,'SELECT * FROM wa_threads WHERE id=? AND channel_id=?',path[1],c.id);
      if (!thread) return json({error:'Conversa não encontrada.'},404);
      if (request.method === 'POST') { const input=await bodyJSON(request); if (typeof input.resolved !== 'boolean') throw new ChannelError('Situação inválida.'); await run(env.DB,'UPDATE wa_threads SET resolved=? WHERE id=? AND channel_id=?',input.resolved?1:0,thread.id,c.id); return json({saved:true}); }
      if (request.method === 'GET') {
        const before = new URL(request.url).searchParams.get('before') || '9999';
        const messages = await all(env.DB,"SELECT * FROM wa_messages WHERE thread_id=? AND channel_id=? AND type != 'deleted' AND (at || id) < ? ORDER BY at DESC,id DESC LIMIT 51",thread.id,c.id,before);
        return json({thread,canReply:c.status === 'ready' && (c.provider==='baileys'||windowOpen(thread.last_inbound)),messages:messages.slice(0,50).reverse().map(cleanMessage),older:messages.length > 50 ? messages[49].at+messages[49].id : null});
      }
    }
    if (path[0] === 'media' && path[1] && request.method === 'GET') {
      const message = c && await one(env.DB,'SELECT * FROM wa_messages WHERE id=? AND channel_id=?',path[1],c.id);
      if(!message||!c.api_key||!['image','audio'].includes(message.type))return json({error:'Arquivo indisponível. Consulte a conversa no WhatsApp.'},404);
      const key=await decrypt(c.api_key,env.WHATSAPP_ENCRYPTION_KEY,user);
      let url,headers;
      if(c.provider==='baileys'){
        if(!/^baileys:[a-zA-Z0-9_-]{16,100}$/.test(message.media||''))return json({error:'Arquivo indisponível.'},410);
        const remote=await bridgeRequest(c.phone_id,key,'/media/'+message.media.slice(8),{},fetcher);
        const mime=remote.headers.get('content-type')?.split(';')[0]||'';
        if(!['image/jpeg','image/png','audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg'].includes(mime))throw new ChannelError('Formato inválido.',415);
        return new Response(await readBounded(remote,16*1024*1024),{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
      }
      if(c.provider==='meta'){
        if(!/^meta:\d{5,30}$/.test(message.media||''))return json({error:'Arquivo da conexão anterior indisponível. Consulte a conversa no WhatsApp.'},410);
        const media=await metaRequest(key,'/'+message.media.slice(5)+'?phone_number_id='+c.phone_id,{},fetcher);
        url=safeMetaMediaURL(media.url);headers={Authorization:'Bearer '+key};
      }else{url=safeMediaURL(message.media);headers={'X-API-Key':key};}
      if(!url)return json({error:'Endereço de arquivo não permitido.'},415);
      const response = await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(18000)});
      if (!response.ok) return json({error:'Arquivo expirado ou indisponível no provedor. Consulte no WhatsApp Business.'},410);
      const mime = response.headers.get('content-type')?.split(';')[0] || '';
      if (!(message.type === 'image' ? ['image/jpeg','image/png'] : ['audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg']).includes(mime)) return json({error:'Formato do arquivo não permitido.'},415);
      const bytes = await readBounded(response,16*1024*1024);
      return new Response(bytes,{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'}});
    }
    return json({error:'Operação não encontrada.'},404);
  } catch (error) {
    return json({error:error instanceof ChannelError ? error.message : 'Não foi possível concluir. Atualize o estado antes de tentar novamente.',code:error instanceof ChannelError ? error.code : 'unavailable'},error instanceof ChannelError ? error.status : 503);
  }
}
