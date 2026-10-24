/** Consultas não podem excluir histórico, duplicar valores do conjunto ou abrir operações pela URL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationHref, parseDestination, recordsForView, recordPage, validCalendarDate } from '../public/navigation.js';
import { attendanceSummary } from '../public/routine.js';

const records = [
    { id: 'a', date: '2026-09-30', clientId: 'c1', serviceIds: ['s1', 's2'], total: 200 },
    { id: 'b', date: '2026-10-01', clientId: 'c1', serviceIds: ['s2', 's1'], total: 180 },
    { id: 'c', date: '2026-10-02', clientId: 'c2', serviceIds: ['s1'], total: 90 }
];
const state = { records, services: [{ id: 's1', name: 'Corte' }, { id: 's2', name: 'Cor' }] };

test('dia, mês e histórico consultam a mesma base sem mutação', () => {
    const before = structuredClone(state);
    assert.deepEqual(recordsForView(state, { date: '2026-10-01' }).map(r => r.id), ['b']);
    assert.deepEqual(recordsForView(state, { mode: 'month', month: '2026-10' }).map(r => r.id), ['c', 'b']);
    assert.equal(recordsForView(state, { mode: 'all' }).length, 3);
    assert.deepEqual(state, before);
});

test('serviço conta participação e conjunto exige a combinação exata, sem ratear preço', () => {
    assert.equal(recordsForView(state, { mode: 'all', service: 's1' }).length, 3);
    assert.deepEqual(recordsForView(state, { mode: 'all', set: 's1,s2' }).map(r => r.id), ['b', 'a']);
    assert.equal(recordsForView(state, { mode: 'all', client: 'c2', service: 's2' }).length, 0);
    const summary = attendanceSummary(state, { mode: 'month', month: '2026-10' });
    assert.equal(summary.procedures, 3);
    assert.equal(summary.total, 270);
});

test('destinos descartam parâmetros externos e aceitam só datas civis válidas', () => {
    const href = destinationHref({ page: 'finance', bill: 'b&x', amount: '100', name: 'Contato' });
    assert.equal(href, '#page=finance&bill=b%26x');
    assert.equal(parseDestination(href).bill, 'b&x');
    assert.equal(parseDestination(destinationHref({ page: 'finance', month: '', tab: 'history' })).month, '');
    assert.equal(parseDestination('#page=externo'), null);
    const invalid = parseDestination('#page=services&mode=invalid&date=2026-02-30&month=2026-13&p=-1');
    assert.equal(invalid.mode, 'day'); assert.equal(invalid.p, 1);
    assert.equal(invalid.date, undefined); assert.equal(invalid.month, undefined);
    assert.equal(validCalendarDate('2024-02-29'), true);
    assert.equal(validCalendarDate('2026-02-29'), false);
});

test('paginação lida com limites, vazio e página reduzida por filtros', () => {
    assert.deepEqual(recordPage([], 100), { page: 1, pages: 1, total: 0, start: 0, end: 0, rows: [] });
    const page = recordPage(Array.from({ length: 23 }, (_, i) => i), 999);
    assert.equal(page.page, 3); assert.equal(page.start, 21); assert.equal(page.end, 23);
    assert.deepEqual(page.rows, [20, 21, 22]);
    assert.equal(recordPage(records, -1).page, 1);
});
