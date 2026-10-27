/** Serviço dedicado a um único número/conta. HTTPS é terminado no proxy do operador.
 * Nenhuma mensagem é enviada automaticamente: /send corresponde ao clique explícito no ateliê.
 */
import http from 'node:http';
import { mkdir, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import makeWASocket, { useMultiFileAuthState as loadAuthState, DisconnectReason, downloadMediaMessage, normalizeMessageContent, jidNormalizedUser, generateMessageIDV2 } from 'baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import { openStore } from './store.mjs';
const key=process.env.BRIDGE_KEY||'',site=process.env.SITE_ORIGIN||'';
if(!/^[\w-]{32,160}$/.test(key))throw Error('Configure BRIDGE_KEY no arquivo .env.');
// O endereço do ateliê é obrigatório: eventos só seguem para o site configurado pela titular.
if(!/^https:\/\/[^/]+$/.test(site.replace(/\/$/,'')))throw Error('Configure SITE_ORIGIN com o endereço HTTPS do ateliê, por exemplo https://hanne-atelier.SEU-USUARIO.workers.dev.');
const origin=new URL(site).origin;
process.umask(0o077);
const dir=resolve(process.env.DATA_DIR||'./data');await mkdir(join(dir,'media'),{recursive:true,mode:0o700});
const store=openStore(join(dir,'journal.sqlite')),logger=pino({level:'silent'});
let config=store.config(),socket=null,status='disconnected',qr=null,qrUntil=0,starting=false,stopped=false,reconnect=null,deliveryBusy=false;
const phoneOf=jid=>{const number=String(jid||'').split('@')[0].split(':')[0];return /^[1-9]\d{7,14}$/.test(number)?'+'+number:'';};
const ownPhone=()=>phoneOf(socket?.user?.id);
function authorized(request){const actual=Buffer.from(request.headers.authorization||''),expected=Buffer.from('Bearer '+key);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
function event(type,message,id){store.enqueue({id:id||randomUUID(),type,[type==='whatsapp.inbound_message.received'?'whatsappInboundMessage':'whatsappMessage']:message});}
/** Outbox de eventos sobrevive a reinícios; assinatura cobre timestamp e bytes originais. */
async function deliver(){
  if(deliveryBusy||!config||status!=='ready')return;deliveryBusy=true;
  try{for(const row of store.events()){
    const t=Math.floor(Date.now()/1000),signature=createHmac('sha256',key).update(t+'.'+row.body).digest('hex');
    const response=await fetch(config.callbackURL,{method:'POST',headers:{'Content-Type':'application/json','X-Baileys-Signature':`t=${t},s=${signature}`},body:row.body,redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)break;store.delivered(row.id);
  }}catch{/* Mantém o evento para a próxima tentativa, sem registrar conteúdo ou segredos. */}finally{deliveryBusy=false;}
}
async function contactJid(message){
  const original=message.key.remoteJid||'';
  if(original.endsWith('@s.whatsapp.net'))return jidNormalizedUser(original);
  if(original.endsWith('@lid'))return message.key.remoteJidAlt||await socket.signalRepository?.lidMapping?.getPNForLID(original)||'';
  return '';
}
/** Recebe só mensagens novas individuais; não importa grupos, status ou histórico antigo. */
async function receive(message){
  const jid=await contactJid(message),peer=phoneOf(jid),own=ownPhone();if(!peer||!own||!message.message||!message.key.id)return;
  const content=normalizeMessageContent(message.message)||{},image=content.imageMessage,audio=content.audioMessage;
  const type=image?'image':audio?'audio':content.conversation||content.extendedTextMessage?'text':'unsupported';
  const text=content.conversation||content.extendedTextMessage?.text||image?.caption||'';
  let mediaRef;
  if(image||audio)try{
    const bytes=await downloadMediaMessage(message,'buffer',{}, {logger,reuploadRequest:socket.updateMediaMessage});
    const mime=String((image||audio).mimetype||'').split(';')[0];
    if(bytes.length<=(image?5:16)*1024*1024&&['image/jpeg','image/png','audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg'].includes(mime)){
      const id=randomUUID();await writeFile(join(dir,'media',id),bytes);await writeFile(join(dir,'media',id+'.json'),JSON.stringify({mime}));mediaRef='baileys:'+id;
    }
  }catch{/* A mensagem permanece consultável no celular se o anexo não puder ser baixado. */}
  const outgoing=!!message.key.fromMe;
  if(outgoing&&store.db.prepare('SELECT id FROM sends WHERE provider_id=?').get(message.key.id))return;
  event(outgoing?'whatsapp.smb.message.echoes':'whatsapp.inbound_message.received',{
    id:message.key.id,from:outgoing?own:peer,to:outgoing?peer:own,type,
    text:{body:text},...(mediaRef?{[type]:{mediaRef,caption:image?.caption||''}}:{}),
    sendTime:new Date(Number(message.messageTimestamp||Date.now()/1000)*1000).toISOString(),customerProfile:{name:outgoing?peer:message.pushName||peer}
  },(outgoing?'out:':'in:')+message.key.id);
}
/** Um único socket por diretório; reconexão é limitada por espera e interrompida no logout. */
async function start(){
  if(starting||!config||stopped)return;starting=true;
  try{
    const {state,saveCreds}=await loadAuthState(join(dir,'auth'));
    socket=makeWASocket({auth:state,logger,syncFullHistory:false,markOnlineOnConnect:false,shouldIgnoreJid:jid=>jid.endsWith('@g.us')||jid==='status@broadcast'});
    const own=socket;status='reconnecting';
    own.ev.on('creds.update',saveCreds);
    own.ev.on('connection.update',async update=>{
      if(socket!==own||stopped)return;
      if(update.qr){qr=await QRCode.toDataURL(update.qr,{width:280,margin:3});qrUntil=Date.now()+55000;status='pairing';}
      if(update.connection==='open'){
        if(config.expectedPhone&&ownPhone()!==config.expectedPhone){status='wrong_number';qr=null;await own.logout();return;}
        if(!config.expectedPhone){config.expectedPhone=ownPhone();store.config(config);}
        status='ready';qr=null;qrUntil=0;
      }
      if(update.connection==='close'){
        qr=null;status='disconnected';
        if(update.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut&&!stopped){clearTimeout(reconnect);reconnect=setTimeout(()=>{starting=false;void start();},5000);}
      }
    });
    own.ev.on('messages.upsert',update=>{if(update.type==='notify')for(const message of update.messages)void receive(message).catch(()=>{});});
    own.ev.on('messages.update',updates=>{for(const {key:messageKey,update} of updates){const statuses={2:'sent',3:'delivered',4:'read',5:'read'};if(messageKey.fromMe&&statuses[update.status])event('whatsapp.message.updated',{id:messageKey.id,from:ownPhone(),status:statuses[update.status],externalId:store.db.prepare('SELECT id FROM sends WHERE provider_id=?').get(messageKey.id)?.id||''},'status:'+messageKey.id+':'+update.status);}});
  }finally{starting=false;}
}
async function bodyOf(request){let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>17*1024*1024){const error=Error('Arquivo muito grande.');error.status=413;throw error;}chunks.push(chunk);}return Buffer.concat(chunks);}
const json=(response,data,statusCode=200)=>{response.writeHead(statusCode,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(data));};
const server=http.createServer(async(request,response)=>{
  if(!authorized(request))return json(response,{error:'Acesso negado.'},401);
  try{
    const path=new URL(request.url,'http://localhost').pathname;
    if(path==='/health'&&request.method==='GET')return json(response,{service:'hanne-baileys',version:1});
    if(path==='/session'&&request.method==='GET')return json(response,{status,phone:ownPhone(),qr:Date.now()<qrUntil?qr:null});
    if(path==='/session'&&request.method==='POST'){
      const input=JSON.parse((await bodyOf(request)).toString()),url=new URL(input.callbackURL);
      if(url.origin!==origin||!/^\/api\/whatsapp\/baileys-webhook\/[\w-]{16,100}$/.test(url.pathname)||url.search||url.hash||url.username||url.password)return json(response,{error:'Destino não autorizado.'},400);
      if(config&&config.channelId!==input.channelId)return json(response,{error:'Este conector já pertence a outra conta.'},409);
      config={callbackURL:url.href,channelId:input.channelId,expectedPhone:config?.expectedPhone||input.expectedPhone||''};store.config(config);stopped=false;
      if(!socket||status==='disconnected')await start();return json(response,{started:true});
    }
    if(path==='/session'&&request.method==='DELETE'){
      stopped=true;clearTimeout(reconnect);status='disconnected';qr=null;
      try{await socket?.logout();}finally{socket=null;config=null;store.config(null);await rm(join(dir,'auth'),{recursive:true,force:true});store.db.exec('DELETE FROM events;');}
      return json(response,{disconnected:true});
    }
    if(path.startsWith('/media/')&&request.method==='GET'){
      const id=path.slice(7);if(!/^[\w-]{16,100}$/.test(id))return json(response,{error:'Arquivo inválido.'},400);
      const metadata=JSON.parse(await readFile(join(dir,'media',id+'.json'),'utf8')),bytes=await readFile(join(dir,'media',id));response.writeHead(200,{'Content-Type':metadata.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return response.end(bytes);
    }
    if(path==='/send'&&request.method==='POST'){
      const raw=await bodyOf(request),form=await new Request('http://localhost',{method:'POST',headers:{'Content-Type':request.headers['content-type']||''},body:raw}).formData();
      const id=String(form.get('requestId')||''),peer=String(form.get('to')||''),text=String(form.get('text')||''),file=form.get('file');
      if(!/^[\w-]{16,100}$/.test(id)||!/^\+[1-9]\d{7,14}$/.test(peer)||text.length>4096||(!text&&!file))return json(response,{error:'Mensagem inválida.'},400);
      const bytes=file?Buffer.from(await file.arrayBuffer()):null;
      const fingerprint=createHash('sha256').update(JSON.stringify([peer,text,file?.type||''])).update(bytes||'').digest('hex');
      // Verificação e claim ocorrem sem await intermediário antes do efeito externo.
      const previous=store.db.prepare('SELECT * FROM sends WHERE id=?').get(id);
      if(previous){if(previous.fingerprint!==fingerprint)return json(response,{error:'Tentativa divergente.'},409);return json(response,{id:previous.provider_id,status:previous.status});}
      if(status!=='ready')return json(response,{error:'WhatsApp desconectado.'},409);
      const mime=file?.type||'',image=mime.startsWith('image/');
      if(file&&(!['image/jpeg','image/png','audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg'].includes(mime)||bytes.length>(image?5:16)*1024*1024||(!image&&text)))return json(response,{error:'Arquivo inválido.'},400);
      store.claim(id,fingerprint);
      const messageId=generateMessageIDV2(socket.user?.id);
      store.db.prepare('UPDATE sends SET provider_id=? WHERE id=?').run(messageId,id);
      try{
        const content=file?(image?{image:bytes,caption:text,mimetype:mime}:{audio:bytes,mimetype:mime}):{text};
        const sent=await socket.sendMessage(peer.slice(1)+'@s.whatsapp.net',content,{messageId});
        if(!sent?.key?.id)throw Error();store.accepted(id,sent.key.id);return json(response,{id:sent.key.id,status:'accepted'});
      }catch{return json(response,{id:null,status:'uncertain'});}
    }
    return json(response,{error:'Operação não encontrada.'},404);
  }catch{return json(response,{error:'Não foi possível concluir a operação.'},503);}
});
server.requestTimeout=60000;server.listen(Number(process.env.PORT||3100),'127.0.0.1');
setInterval(()=>void deliver(),3000);
// Anexos ficam disponíveis por até 30 dias no conector; a conversa não é apagada.
setInterval(async()=>{try{for(const file of await readdir(join(dir,'media'))){const path=join(dir,'media',file);if(Date.now()-(await stat(path)).mtimeMs>30*86400000)await rm(path,{force:true});}}catch{}},3600000);
if(config)void start();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;clearTimeout(reconnect);socket?.end(undefined);server.close();process.exit(0);});
