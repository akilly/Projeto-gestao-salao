/** Adaptador HTTP oficial YCloud v2. Não registra payloads nem chaves em logs. */
import { API, ChannelError } from './whatsapp-domain.mjs';
export async function ycloud(key, path, options = {}, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(API + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(18000), headers: { 'X-API-Key': key, ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  } catch { throw new ChannelError('O provedor não confirmou a operação. Confira o estado antes de tentar de novo.', 502, 'uncertain'); }
  let body; try { body = await response.json(); } catch { throw new ChannelError('Resposta inesperada do provedor. Confira novamente.', 502, 'uncertain'); }
  if (!response.ok) {
    const code = String(body.error?.code || response.status).slice(0, 60);
    throw new ChannelError(response.status === 401 || response.status === 403 ? 'A chave não autoriza esta operação. Confira o acesso no YCloud.' : `YCloud recusou a operação (código ${code.replace(/[^\w.-]/g,'')}). Confira o número, o arquivo e a janela de resposta.`, 502, response.status >= 500 ? 'uncertain' : 'rejected');
  }
  return body;
}
