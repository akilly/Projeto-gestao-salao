/** Exercita a virada mensal, a atribuição do preço por conjunto e as automações sem efeitos implícitos. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceSummary, rollMonth, previousConsumption, ensureSpaceExpense } from '../public/routine.js';
import { blankState, metrics, validateState } from '../public/domain.js';
import { exampleState } from '../public/examples.js';
import { localDate, dayOffset } from '../public/core.js';

test('meses são apenas filtros; preço pertence ao conjunto e cada procedimento é contado', () => {
    const s = blankState();
    s.records = [
        { id: 'old', date: '2025-12-31', serviceIds: ['s1'], total: 50.05 },
        { id: 'a', date: '2026-01-01', serviceIds: ['s1', 's2'], total: 100.10 },
        { id: 'b', date: '2026-01-31', serviceIds: ['s2', 's1'], total: 150.20 }
    ];
    const original = structuredClone(s), month = attendanceSummary(s, '2026-01'), all = attendanceSummary(s);
    assert.deepEqual(month.records.map(r => r.id), ['b', 'a']);
    assert.equal(month.total, 250.30);
    assert.equal(month.procedures, 4);
    assert.equal(month.combinations.length, 1);
    assert.equal(month.combinations[0].count, 2);
    assert.equal(month.combinations[0].total, 250.30);
    assert.deepEqual(month.ranked.map(r => r.count), [2, 2]);
    assert.equal(all.total, 300.35);
    assert.equal(all.combinations.reduce((sum, g) => sum + Math.round(g.total * 100), 0), 30035);
    assert.equal(attendanceSummary(s, '2026-02').records.length, 0);
    assert.equal(attendanceSummary(s, '2025-12').total, 50.05);
    assert.deepEqual(s, original);
});

test('virada do ano acompanha o mês atual e preserva consultas antigas ou completas', () => {
    assert.equal(rollMonth('2026-12', '2026-12', '2027-01'), '2027-01');
    assert.equal(rollMonth('2026-10', '2026-12', '2027-01'), '2026-10');
    assert.equal(rollMonth('', '2026-12', '2027-01'), '');
});

test('referência exige mesma cliente e conjunto, respeita data e não altera estoque', () => {
    const s = exampleState(), r = s.records.find(r => r.clientId === 'c2' && r.serviceIds.length === 1);
    const original = structuredClone(s), suggestion = previousConsumption(s, r.clientId, [...r.serviceIds].reverse());
    assert.equal(suggestion.recordId, r.id);
    assert.ok(suggestion.items.length > 0);
    assert.ok(suggestion.items.every(i => i.quantity > 0));
    assert.equal(previousConsumption(s, 'inexistente', r.serviceIds), null);
    assert.equal(previousConsumption(s, r.clientId, ['s1', 's2']), null);
    assert.equal(previousConsumption(s, r.clientId, r.serviceIds, dayOffset(-1, r.date)), null);
    assert.deepEqual(s, original);
});

test('referência sinaliza estoque insuficiente e última ficha sem consumo não copia uma anterior', () => {
    const s = exampleState(), r = s.records.find(r => r.clientId === 'c2' && r.serviceIds.length === 1);
    const movement = s.movements.find(m => m.recordId === r.id && m.type === 'consumption');
    s.movements.push({ id: 'test-loss', productId: movement.productId, date: localDate(), quantity: -100000, type: 'loss', unitCost: null });
    assert.equal(previousConsumption(s, r.clientId, r.serviceIds).items.find(i => i.productId === movement.productId).unavailable, true);
    s.records.push({ ...r, id: 'latest-empty', date: localDate(), noProducts: true });
    const reference = previousConsumption(s, r.clientId, r.serviceIds);
    assert.equal(reference.recordId, 'latest-empty');
    assert.deepEqual(reference.items, []);
});

test('conta automática exige configuração e cria somente o mês atual em aberto', () => {
    const s = blankState(), today = localDate();
    assert.equal(ensureSpaceExpense(s).expense, null);
    s.settings.cutoff = dayOffset(-100);
    assert.equal(ensureSpaceExpense(s).expense, null);
    s.settings.spaceAmount = 980;
    const out = ensureSpaceExpense(s), expense = out.expense;
    assert.equal(expense.recurringMonth, today.slice(0, 7));
    assert.equal(expense.amount, 980);
    assert.equal(expense.paidDate, null);
    assert.equal(out.state.expenses.length, 1);
    assert.equal(s.expenses.length, 0);
    assert.equal(ensureSpaceExpense(out.state).expense, null);
    assert.equal(ensureSpaceExpense(out.state).state, out.state);
    assert.equal(metrics(out.state, '0000-01-01', '9999-12-31').expenses, 0);
    validateState(out.state, s);
});

test('conta respeita abertura no meio do mês e preserva conta existente após mudar configuração', () => {
    const s = blankState();
    s.settings = { ...s.settings, cutoff: '2026-08-19', spaceAmount: 900, spaceDueDay: 10 };
    const first = ensureSpaceExpense(s, '2026-08-19');
    assert.equal(first.expense.date, '2026-08-19');
    assert.equal(first.expense.due, '2026-08-10');
    first.state.settings.spaceAmount = 1000;
    assert.equal(ensureSpaceExpense(first.state, '2026-08-31').expense, null);
    const next = ensureSpaceExpense(first.state, '2026-10-01');
    assert.deepEqual(next.state.expenses.map(e => e.recurringMonth), ['2026-08', '2026-10']);
    assert.deepEqual(next.state.expenses.map(e => e.amount), [900, 1000]);
    assert.equal(next.state.expenses.some(e => e.recurringMonth === '2026-09'), false);
});

test('conta manual já criada impede duplicação e histórico financeiro permanece intacto', () => {
    const s = exampleState();
    assert.equal(ensureSpaceExpense(s).expense, null);
    const source = structuredClone(s);
    source.expenses = source.expenses.filter(e => !e.recurringMonth);
    const before = metrics(source, '0000-01-01', '9999-12-31'), out = ensureSpaceExpense(source);
    validateState(out.state, source);
    for (const key of ['records', 'bills', 'payments', 'movements', 'installments']) assert.deepEqual(out.state[key], source[key]);
    assert.deepEqual(metrics(out.state, '0000-01-01', '9999-12-31'), before);
});
