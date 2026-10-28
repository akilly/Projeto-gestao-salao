/** Dados dos gráficos do Financeiro batem com os indicadores e com os registros. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleState } from '../public/examples.js';
import { metrics, periodOf } from '../public/domain.js';
import { lastMonths, monthlyFlow, receivedByMethod, revenueByService, expensesByCategory, niceMax, barList, flowChart } from '../public/finance-charts.js';

const month = new Date().toISOString().slice(0, 7);

test('meses em ordem e virada de ano', () => {
    assert.deepEqual(lastMonths('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
});

test('fluxo mensal usa exatamente os números dos indicadores', () => {
    const s = exampleState(), rows = monthlyFlow(s, month, 6), { from, to } = periodOf(month), m = metrics(s, from, to);
    assert.equal(rows.length, 6);
    assert.equal(rows.at(-1).received, m.received);
    assert.equal(rows.at(-1).expenses, m.expenses);
    assert.equal(rows.at(-1).result, m.cashResult);
});

test('recebido por forma soma o mesmo que o recebido do período', () => {
    const s = exampleState(), { from, to } = periodOf(month), sum = receivedByMethod(s, from, to).reduce((a, r) => a + r.value, 0);
    assert.ok(Math.abs(sum - metrics(s, from, to).received) < 0.01);
});

test('serviços dividem o preço da visita e somam o valor dos atendimentos', () => {
    const s = exampleState(), { from, to } = periodOf(month), rows = revenueByService(s, from, to, 50);
    assert.ok(Math.abs(rows.reduce((a, r) => a + r.value, 0) - metrics(s, from, to).serviceValue) < 0.05);
    const folded = revenueByService(s, from, to, 2);
    assert.ok(folded.length <= 2);
});

test('despesas por categoria só contam as pagas no período', () => {
    const s = exampleState(), { from, to } = periodOf(month);
    const sum = expensesByCategory(s, from, to).reduce((a, r) => a + r.value, 0);
    assert.ok(Math.abs(sum - metrics(s, from, to).expenses) < 0.01);
});

test('eixo arredondado e gráficos vazios explicam a ausência', () => {
    assert.equal(niceMax(830), 1000); assert.equal(niceMax(0), 100); assert.equal(niceMax(41), 80);
    const ctx = { esc: x => String(x), money: v => 'R$ ' + v, monthLabel: m => m };
    assert.match(barList([], ctx), /Sem registros/);
    assert.match(flowChart([{ month, received: 0, expenses: 0, result: 0 }], ctx), /Sem recebimentos/);
});
