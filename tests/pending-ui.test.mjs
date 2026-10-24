/** Teste de renderização com DOM mínimo e API simulada. Verifica contadores de pendências e filtros, sem navegador real. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleState } from '../public/examples.js';
const listeners = {}, app = { innerHTML: '' }, overlay = { innerHTML: '' }, data = exampleState();
globalThis.document = { getElementById: id => id === 'app' ? app : id === 'overlay-root' ? overlay : null, addEventListener: (name, fn) => { (listeners[name] ??= []).push(fn); } };
globalThis.window = { scrollTo() { }, addEventListener() { } };
globalThis.location = { search: '?dados=exemplo' };
globalThis.localStorage = { getItem: () => null };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ state: data, revision: 0, dataset: 'example' }) });
await import('../public/app.js');
await new Promise(r => setTimeout(r, 0));
const click = async (dataset) => { const b = { dataset }; for (const fn of listeners.click)
    await fn({ target: { closest: selector => selector === '[data-action]' ? b : null } }); };
test('painel recupera atendimentos pendentes sem misturar confirmações de agenda', async () => { assert.match(app.innerHTML, /data-indicator="pending-conversations">5</); assert.match(app.innerHTML, /data-indicator="unconfirmed-appointments">1</); assert.ok(app.innerHTML.indexOf('Atendimentos pendentes') < app.innerHTML.indexOf('Recebido no período')); await click({ action: 'v4-open-pending' }); assert.match(app.innerHTML, /<option value="open" selected>Pendentes<\/option>/); assert.match(app.innerHTML, /Atendimentos pendentes/); assert.doesNotMatch(app.innerHTML, /<button class="inbox-item[^>]*data-id="v6"/); });
test('contador diminui após resolução e mostra zero sem esconder o indicador', async () => { data.conversations[0].status = 'resolved'; await click({ action: 'nav', page: 'dashboard' }); assert.match(app.innerHTML, /data-indicator="pending-conversations">4</); for (const c of data.conversations)
    c.status = 'resolved'; for (const a of data.appointments)
    if (a.status === 'pending')
        a.status = 'confirmed'; await click({ action: 'nav', page: 'dashboard' }); assert.match(app.innerHTML, /data-indicator="pending-conversations">0</); assert.match(app.innerHTML, /data-indicator="unconfirmed-appointments">0</); });

// A mudança de mês consulta registros; nunca apaga nem recria atendimentos.
test('procedimentos começam em Hoje e mês/histórico preservam dados e paginação', async () => {
    const before = structuredClone(data.records);
    await click({ action: 'nav', page: 'services' });
    assert.match(app.innerHTML, /Data dos procedimentos/);
    assert.match(app.innerHTML, /data-action="v7-day" aria-pressed="true"/);
    assert.equal((app.innerHTML.match(/data-record-id=/g) || []).length, 0);
    assert.match(app.innerHTML, /Nenhum procedimento neste período/);
    await click({ action: 'v7-month' });
    assert.match(app.innerHTML, /Mês dos procedimentos/);
    assert.equal((app.innerHTML.match(/data-record-id=/g) || []).length, 10);
    assert.match(app.innerHTML, /1–10 de 12 visitas/);
    await click({ action: 'v7-route', route: JSON.stringify({ page: 'services', mode: 'all', p: 2 }) });
    assert.equal((app.innerHTML.match(/data-record-id=/g) || []).length, 2);
    assert.match(app.innerHTML, /11–12 de 12 visitas/);
    for (const fn of listeners.change) await fn({ target: { dataset: { change: 'v6-records-month' }, value: '2000-01' } });
    assert.match(app.innerHTML, /Nenhum procedimento neste período/);
    assert.match(app.innerHTML, /0–0 de 0 visitas/);
    await click({ action: 'v6-all-records' });
    assert.match(app.innerHTML, /Resultados acumulados/);
    assert.match(app.innerHTML, /1–10 de 12 visitas/);
    assert.deepEqual(data.records, before);
});

test('atalhos filtram as visitas correspondentes e não alteram registros financeiros', async () => {
    const before = structuredClone({ records: data.records, bills: data.bills, payments: data.payments, movements: data.movements });
    await click({ action: 'v7-route', route: JSON.stringify({ page: 'services', mode: 'all', service: 's1' }) });
    assert.match(app.innerHTML, /Filtrando: Corte/);
    assert.equal((app.innerHTML.match(/data-record-id=/g) || []).length, 5);
    assert.match(app.innerHTML, /Ver cobrança e pagamentos de/);
    assert.match(app.innerHTML, /data-action="v7-clear-record-filters"/);
    await click({ action: 'v7-clear-record-filters' });
    assert.doesNotMatch(app.innerHTML, /Filtrando:/);
    await click({ action: 'v7-route', route: JSON.stringify({ page: 'finance', tab: 'cards', scope: 'open' }) });
    assert.match(app.innerHTML, /Somente valores em aberto/);
    assert.match(app.innerHTML, /installment/);
    await click({ action: 'v7-route', route: JSON.stringify({ page: 'finance', tab: 'history', scope: 'cash' }) });
    assert.match(app.innerHTML, /Entradas e saídas que compõem/);
    assert.deepEqual({ records: data.records, bills: data.bills, payments: data.payments, movements: data.movements }, before);
});
test('as páginas principais explicam suas ações dentro da própria interface', async () => {
    for (const page of ['dashboard', 'agenda', 'clients', 'conversations', 'services', 'finance', 'inventory', 'quotes', 'tasks', 'setup', 'settings']) {
        await click({ action: 'nav', page });
        assert.match(app.innerHTML, /Como usar esta tela/, page);
    }
});
