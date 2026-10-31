/**
 * Cabeçalhos de segurança das páginas HTML (sistema e login).
 * - CSP: só scripts do próprio site (sem inline), sem plugins, sem ser exibido dentro de iframes de outros sites.
 *   Estilos inline continuam permitidos (a interface usa atributos style); fontes do Google liberadas.
 * - Referrer-Policy no-referrer: o link de acesso do e-mail (?acesso=...) nunca vai para outro site.
 * - HSTS só em HTTPS (no computador, http://localhost continua funcionando).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function pageHeaders(request, extra = {}) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CSP,
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...extra,
  };
  if (new URL(request.url).protocol === 'https:') headers['Strict-Transport-Security'] = 'max-age=31536000';
  return headers;
}
