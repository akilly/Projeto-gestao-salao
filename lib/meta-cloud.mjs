/** Adaptador oficial Meta Cloud API. Token só segue em Authorization, nunca em URL. */
import { ChannelError, EVENTS, phone } from './whatsapp-domain.mjs';
export const GRAPH = 'https://graph.facebook.com/v25.0';
const encoder = new TextEncoder();
export const numericID = value => /^\d{5,30}$/.test(String(value || ''));
/** Códigos do transporte e dos status assíncronos usam a mesma orientação. */
export function metaErrorReason(code){
  return code===190?'O token da Meta expirou ou é inválido. Gere um novo em Configuração da API.':code===131030?'Cadastre e confirme este telefone como destinatário de teste no painel da Meta.':code===131047?'A janela de resposta terminou. Aguarde uma nova mensagem da cliente.':code===10||code===200||code===131005?'O token não tem acesso ao WhatsApp escolhido. Confira as permissões e os ativos no painel da Meta.':code===100?'Confira os IDs da conta WhatsApp e do número; eles são diferentes do telefone com DDD.':code===131053?'A Meta recusou o arquivo. Confira formato, codec e tamanho antes de tentar novamente.':`A Meta recusou a operação (código ${code}). Confira a configuração no painel da Meta.`;
}
/** Respostas de erro viram orientações seguras, sem refletir tokens/payloads da Meta. */
export async function metaRequest(token,path,options={},fetcher=fetch) {
  if(!/^\/\d{5,30}(?:\/(?:phone_numbers|subscribed_apps|messages|media))?(?:\?[\w=,%&._-]+)?$/.test(path))throw new ChannelError('Identificador da Meta inválido.');
  let response;
  try {response=await fetcher(GRAPH+path,{...options,redirect:'error',signal:AbortSignal.timeout(18000),headers:{Authorization:'Bearer '+token,...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers}});}
  catch{throw new ChannelError('A Meta não confirmou a operação. Confira a tentativa antes de reenviar.',502,'uncertain');}
  let data;try{data=await response.json();}catch{throw new ChannelError('A Meta retornou uma resposta incompleta. Atualize para conferir.',502,'uncertain');}
  if(!response.ok||data.error){
    const code=Number(data.error?.code)||response.status;
    const reason=metaErrorReason(code);
    throw new ChannelError(reason,502,response.status>=500?'uncertain':'rejected');
  }
  return data;
}
/** A URL de download é obtida por ID a cada acesso e tem allowlist estrita. */
export function safeMetaMediaURL(value){try{const u=new URL(value);return u.origin==='https://lookaside.fbsbx.com'&&!u.username&&!u.password&&u.pathname==='/whatsapp_business/attachments/'?u.href:null;}catch{return null;}}
/** Assinatura oficial sobre os bytes originais. Meta não envia timestamp no header. */
export async function verifyMetaSignature(raw,header,appSecret){
  const match=/^sha256=([a-f\d]{64})$/i.exec(header||'');if(!match)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(appSecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('HMAC',key,Uint8Array.from(match[1].match(/../g),x=>parseInt(x,16)),raw);
}
const timestamp=value=>/^\d{9,12}$/.test(String(value))&&Number.isFinite(Number(value)*1000)?new Date(Number(value)*1000).toISOString():null;
const userID=value=>/^US\.[\w.]{1,100}$/.test(String(value||''))?value:undefined;
/** Traduz envelopes Meta para o contrato interno já usado pela caixa e seus testes.
 * Ignora outras contas/números do mesmo app, sem misturar contatos entre titulares.
 */
export async function normalizeMetaEvents(payload,c){
  if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))throw new ChannelError('Evento da Meta inválido.');
  const out=[];
  for(const entry of payload.entry){
    if(String(entry.id)!==c.waba_id)continue;
    for(const change of entry.changes||[]){
      const v=change.value;
      if(!v||String(v.metadata?.phone_number_id)!==c.phone_id)continue;
      const profile=v.contacts?.[0]?.profile||{};
      for(const m of v.messages||[]){
        if(typeof m.id!=='string'||m.id.length>512||!timestamp(m.timestamp))throw new ChannelError('Mensagem da Meta incompleta.');
        const media=m[m.type],at=timestamp(m.timestamp);
        const message={id:m.id,from:phone(m.from),fromUserId:userID(m.from_user_id)||userID(m.from),to:c.phone,wabaId:c.waba_id,type:m.type,text:m.text,sendTime:at,customerProfile:{name:profile.name,username:profile.username}};
        if(['image','audio'].includes(m.type)&&numericID(media?.id))message[m.type]={...media,mediaRef:'meta:'+media.id};
        out.push({id:'in:'+m.id,type:EVENTS[0],whatsappInboundMessage:message});
      }
      for(const s of v.statuses||[]){
        if(typeof s.id!=='string'||s.id.length>512||!timestamp(s.timestamp))throw new ChannelError('Status da Meta incompleto.');
        out.push({id:'status:'+s.id+':'+s.status+':'+s.timestamp,type:EVENTS[1],whatsappMessage:{id:s.id,from:c.phone,to:phone(s.recipient_id),recipientUserId:userID(s.recipient_user_id),wabaId:c.waba_id,status:s.status,errorCode:Number(s.errors?.[0]?.code)||null,externalId:s.biz_opaque_callback_data}});
      }
    }
  }
  if(out.length>100)throw new ChannelError('Evento muito grande.',413);
  // Event ID por hash não trunca wamid e evita colisões no índice de deduplicação.
  for(const e of out){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(e.id));e.id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
  return out;
}
