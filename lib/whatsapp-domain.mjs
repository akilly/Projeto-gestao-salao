/** Regras puras do canal: janela de serviço, assinatura e formatos. Sem financeiro. */
export const API = 'https://api.ycloud.com/v2';
export const EVENTS = ['whatsapp.inbound_message.received', 'whatsapp.message.updated', 'whatsapp.smb.message.echoes'];
export class ChannelError extends Error {
  constructor(message, status = 400, code = 'invalid') { super(message); this.status = status; this.code = code; }
}
/** Normaliza números internacionais sem tentar adivinhar país ou DDD. */
export function phone(value) {
  const v = String(value || '').replace(/[\s().-]/g, '');
  return /^\+?[1-9]\d{7,14}$/.test(v) ? '+' + v.replace(/^\+/, '') : '';
}
/** BSUID permanece opaco; nunca é convertido ou unido a uma cliente automaticamente. */
export function peerOf(message, inbound = true) {
  const number = phone(inbound ? message.from : message.to);
  const bsuid = inbound ? message.fromUserId : message.recipientUserId || message.toUserId;
  return number || (/^US\.[\w.]{1,100}$/.test(bsuid || '') ? bsuid : '');
}
export function windowOpen(lastInbound, now = Date.now()) {
  const at = Date.parse(lastInbound || '');
  return Number.isFinite(at) && at <= now && now - at < 86400000;
}
/** Status final não regride quando notificações chegam fora de ordem. */
export function nextStatus(previous, incoming) {
  const rank = { sending: 0, uncertain: 0, accepted: 1, sent: 2, delivered: 3, read: 4, failed: 2 };
  if (!(incoming in rank)) return previous;
  if (previous === 'failed') return incoming === 'delivered' || incoming === 'read' ? incoming : previous;
  return (rank[incoming] >= (rank[previous] ?? -1)) ? incoming : previous;
}
const encoder = new TextEncoder();
const bytes64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const base64 = b => btoa(String.fromCharCode(...b));
/** AES-GCM com AAD da conta impede reutilização de um segredo em outra conta. */
export async function encrypt(value, master, owner) {
  const key = await crypto.subtle.importKey('raw', bytes64(master), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(owner) }, key, encoder.encode(value));
  return base64(iv) + '.' + base64(new Uint8Array(data));
}
export async function decrypt(value, master, owner) {
  const [iv, data] = value.split('.');
  const key = await crypto.subtle.importKey('raw', bytes64(master), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes64(iv), additionalData: encoder.encode(owner) }, key, bytes64(data)));
}
/** HMAC sobre bytes originais; tolerância de 5 min e comparação por Web Crypto. */
export async function verifySignature(raw, header, secret, now = Date.now()) {
  const parts = String(header || '').split(',').map(x => x.trim().split('='));
  const times = parts.filter(x => x[0] === 't'), signatures = parts.filter(x => x[0] === 's');
  if (times.length !== 1 || !/^\d{1,12}$/.test(times[0][1]) || Math.abs(now / 1000 - Number(times[0][1])) > 300) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const prefix = encoder.encode(times[0][1] + '.'), data = new Uint8Array(prefix.length + raw.length);
  data.set(prefix); data.set(raw, prefix.length);
  for (const [, signature] of signatures) {
    if (/^[a-f\d]{64}$/i.test(signature) && await crypto.subtle.verify('HMAC', key, Uint8Array.from(signature.match(/../g), x => parseInt(x, 16)), data)) return true;
  }
  return false;
}
/** Normaliza aliases usados por seletores de arquivo no celular. Não converte codecs. */
export const mediaMime = value => ({'audio/x-m4a':'audio/mp4','audio/m4a':'audio/mp4','audio/mp3':'audio/mpeg','audio/x-aac':'audio/aac'}[String(value).toLowerCase().split(';')[0]] || String(value).toLowerCase().split(';')[0]);
/** Valida MIME, tamanho e assinatura binária antes de enviar mídia ao provedor. */
export async function validateMedia(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new ChannelError('Escolha um arquivo com conteúdo.');
  const type = mediaMime(file.type);
  const image = ['image/jpeg', 'image/png'].includes(type);
  const audio = ['audio/aac', 'audio/amr', 'audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(type);
  if (!image && !audio) throw new ChannelError('Use JPEG/PNG ou áudio MP3, M4A, AAC, AMR ou OGG Opus mono.');
  if (file.size > (image ? 5 : 16) * 1024 * 1024) throw new ChannelError(image ? 'Imagem: limite de 5 MB.' : 'Áudio: limite de 16 MB.', 413);
  const b = new Uint8Array(await file.slice(0, 128).arrayBuffer()), ascii = new TextDecoder('latin1').decode(b);
  const valid = type === 'image/jpeg' ? b[0] === 255 && b[1] === 216 && b[2] === 255
    : type === 'image/png' ? [137,80,78,71,13,10,26,10].every((x,i) => b[i] === x)
    : type === 'audio/ogg' ? ascii.startsWith('OggS') && ascii.includes('OpusHead') && b[ascii.indexOf('OpusHead') + 9] === 1
    : type === 'audio/amr' ? ascii.startsWith('#!AMR')
    : type === 'audio/mp4' ? ascii.slice(4,8) === 'ftyp'
    : type === 'audio/mpeg' ? ascii.startsWith('ID3') || (b[0] === 255 && (b[1] & 224) === 224)
    : b[0] === 255 && (b[1] & 246) === 240;
  if (!valid) throw new ChannelError('O conteúdo não corresponde ao formato escolhido. OGG precisa ser Opus mono.');
  return image ? 'image' : 'audio';
}
/** Somente o endpoint de mídia do provedor pode receber a chave de API. Sem redirects. */
export function safeMediaURL(value) {
  try { const u = new URL(value); return u.origin === 'https://api.ycloud.com' && !u.username && !u.password && /^\/v2\/whatsapp\/media\/download\/[\w-]+$/.test(u.pathname) ? u.href : null; } catch { return null; }
}
