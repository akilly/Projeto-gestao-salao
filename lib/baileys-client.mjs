/** Transporte HTTPS para o processo Node Baileys. Segredos nunca chegam ao navegador. */
import { ChannelError } from './whatsapp-domain.mjs';
export function bridgeURL(value) {
  let url;
  try { url = new URL(value); } catch { throw new ChannelError('Informe o endereço HTTPS do conector Baileys.'); }
  // Endpoint é administrado pelo titular; bloquear IPs literais, rede local e credenciais.
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/' || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(url.hostname) || /(?:^|\.)(localhost|local|internal|test|invalid)$/i.test(url.hostname)) throw new ChannelError('Use um domínio HTTPS público, sem caminho, porta ou credenciais.');
  return url.origin;
}
export async function bridgeRequest(url, token, path, options = {}, fetcher = fetch) {
  const response = await fetcher(bridgeURL(url) + path, { ...options, headers: { Authorization: 'Bearer ' + token, ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }, redirect: 'error', signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new ChannelError(response.status === 401 ? 'A chave do conector não foi aceita.' : 'O conector não confirmou a operação. Confira sua conexão.', 502, response.status >= 500 ? 'uncertain' : 'rejected');
  return response;
}
