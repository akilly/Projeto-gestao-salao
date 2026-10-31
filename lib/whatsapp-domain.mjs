/** Regras puras do canal: telefone, janela de serviço, cifragem e formatos de mídia. Sem financeiro.
 * EVENTS é o formato interno normalizado de eventos (Meta e Baileys são convertidos para ele). */
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
/** Janela de 24 h da API oficial: responder só até 24 h após a última mensagem da cliente. */
export function windowOpen(lastInbound, now = Date.now()) {
  const at = Date.parse(lastInbound || '');
  return Number.isFinite(at) && at <= now && now - at < 86400000;
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
