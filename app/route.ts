/**
 * Entrada HTTP principal autenticada. Entrega HTML e módulos estáticos; a interface de negócio é controlada por public/app.js, e não por uma árvore React de páginas.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { env } from 'cloudflare:workers';
import { salonIdentity } from '../lib/salon-auth.mjs';
import { pageHeaders } from '../lib/security-headers.mjs';
export const dynamic = 'force-dynamic';
/**
 * GET — Autentica o acesso e entrega a página HTML do sistema.
 */
export async function GET(request: Request) {
    const user = await salonIdentity(request, env.DB);
    // salonIdentity só devolve contas existentes e ativas (um salão desativado volta para o login).
    if (!user)
        return Response.redirect(new URL('/login', request.url), 302);
    return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f2f1f7"><meta name="description" content="Gestão de atendimentos, finanças e estoque da Hanne. Agenda, histórico mensal, finanças e estoque em uma rotina simples."><title>Hanne · Gestão do ateliê</title><link rel="icon" href="/favicon.svg"><script src="/theme-boot.js?v=salon-29"></script><link rel="stylesheet" href="/style.css?v=salon-29"><link rel="stylesheet" href="/theme.css?v=salon-29"><link rel="stylesheet" href="/atelier.css?v=salon-29"><link rel="stylesheet" href="/glass.css?v=salon-29"></head><body><div id="app"><main class="boot"><div class="brand-name">hanne.</div><p>Preparando seu espaço privado…</p></main></div><div id="overlay-root"></div><div id="toast" role="status" aria-live="polite"></div><script type="module" src="/app.js?v=salon-29"></script></body></html>`, { headers: pageHeaders(request) });
}
