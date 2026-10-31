/** Cabeçalhos das páginas: CSP sem script inline, sem iframe de terceiros, sem vazar o link de acesso; HSTS só em HTTPS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageHeaders, CSP } from '../lib/security-headers.mjs';

test('CSP bloqueia script inline, plugins e iframes; HSTS só em HTTPS', () => {
  for (const rule of ["script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'"]) assert.ok(CSP.includes(rule), rule);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(CSP));
  const https = pageHeaders(new Request('https://hanne.test/login')), local = pageHeaders(new Request('http://localhost:8787/login'));
  assert.equal(https['Referrer-Policy'], 'no-referrer');
  assert.equal(https['X-Frame-Options'], 'DENY');
  assert.ok(https['Strict-Transport-Security']);
  assert.equal(local['Strict-Transport-Security'], undefined);
});

test('as páginas não têm script inline (a CSP bloquearia)', () => {
  for (const file of ['../app/route.ts', '../app/login/route.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/.test(source), false, file);
    assert.match(source, /pageHeaders\(request\)/, file);
  }
});
