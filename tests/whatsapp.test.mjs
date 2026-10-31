/** Regras comuns do canal de WhatsApp (independentes do provedor). Fluxos completos: meta-cloud.test.mjs e baileys.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { handleWhatsApp } from '../lib/whatsapp-handler.mjs';
import { encrypt,decrypt,windowOpen,validateMedia,peerOf,phone } from '../lib/whatsapp-domain.mjs';
const master=btoa('1'.repeat(32)), origin='https://hanne.test';
function database() {
  const sqlite=new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
  const db={sqlite,prepare(sql){ return {bind(...args){return {sql,args,async first(){return sqlite.prepare(sql).get(...args);},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}};}};},async batch(ss){sqlite.exec('BEGIN IMMEDIATE');try {const r=ss.map(s=>({meta:{changes:Number(sqlite.prepare(s.sql).run(...s.args).changes)}}));sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  return {DB:db,WHATSAPP_ENCRYPTION_KEY:master};
}
const req=(path,method='GET',body=null,user='a',extra={})=>new Request(origin+'/api/whatsapp/'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
test('segredos usam AES-GCM por conta; janela de 24 h não aceita datas futuras',async()=>{const cipher=await encrypt('segredo',master,'a');assert.equal(await decrypt(cipher,master,'a'),'segredo');await assert.rejects(()=>decrypt(cipher,master,'b'));assert.equal(windowOpen(new Date(Date.now()-86400000).toISOString()),false);assert.equal(windowOpen(new Date(Date.now()-60000).toISOString()),true);assert.equal(windowOpen(new Date(Date.now()+10000).toISOString()),false);});
test('APIs exigem identidade e origem; demonstração não envia nem conecta',async()=>{const env=database();assert.equal((await handleWhatsApp(req('connection','GET',null,null),env)).status,401);assert.equal((await handleWhatsApp(req('connection','POST',{},'a',{Origin:'https://evil.test'}),env)).status,403);assert.equal((await handleWhatsApp(req('connection','POST',{},'a',{'X-Atelier-Dataset':'example'}),env)).status,403);assert.equal((await handleWhatsApp(req('connection','GET'),env)).status,200);});
test('provedor desconhecido é recusado sem criar canal',async()=>{const env=database();const r=await handleWhatsApp(req('connection','POST',{provider:'outro',apiKey:'x'.repeat(20)}),env);assert.equal(r.status,400);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM wa_connections').get().n,0);});
test('mídia valida bytes, MIME e limites; telefone e BSUID são normalizados sem adivinhação',async()=>{assert.equal(await validateMedia(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'x.png',{type:'image/png'})),'image');await assert.rejects(()=>validateMedia(new File(['fake'],'x.png',{type:'image/png'})));await assert.rejects(()=>validateMedia(new File(['OggS fake'],'x.ogg',{type:'audio/ogg'})));assert.equal(peerOf({fromUserId:'US.123'}),'US.123');assert.equal(phone('+55 (11) 99999-9999'),'+5511999999999');assert.equal(phone('123'),'');});
