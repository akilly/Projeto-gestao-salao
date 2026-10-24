/** Smoke HTTP real do conector; não inicia socket nem envia mensagem ao WhatsApp. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
test('servidor Node inicia, exige chave, não expõe QR e recusa callback externo',async()=>{
  const data=await mkdtemp(join(tmpdir(),'hanne-baileys-test-'));
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const token='test-only-123456789012345678901234567890',child=spawn(process.execPath,['server.mjs'],{cwd:new URL('./',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:data,BRIDGE_KEY:token,SITE_ORIGIN:'https://hanne.test'},stdio:'ignore'});
  try{
    const origin='http://127.0.0.1:'+port;let ready=false;
    for(let n=0;n<60;n++){try{const response=await fetch(origin+'/health');if(response.status===401){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(ready,'conector não iniciou');
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    assert.equal((await fetch(origin+'/session')).status,401);
    assert.deepEqual(await (await fetch(origin+'/health',{headers})).json(),{service:'hanne-baileys',version:1});
    assert.deepEqual(await (await fetch(origin+'/session',{headers})).json(),{status:'disconnected',phone:'',qr:null});
    const external=await fetch(origin+'/session',{method:'POST',headers,body:JSON.stringify({callbackURL:'https://evil.example.com/steal',channelId:'test'})});assert.equal(external.status,400);
    assert.equal((await fetch(origin+'/session',{headers,method:'DELETE'})).status,200);
  }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(data,{recursive:true,force:true});}
});
