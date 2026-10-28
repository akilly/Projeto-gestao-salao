/** Correções de registros confirmados: permitidas quando os saldos e o estoque continuam íntegros. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleState } from '../public/examples.js';
import { validateState, billPaid, cardMethod } from '../public/domain.js';

const edit = fn => { const before = exampleState(), after = structuredClone(before); fn(after); return () => validateState(after, before); };

test('cobrança: descrição, datas e valor podem ser corrigidos sem ficar abaixo do já pago', () => {
    const s = exampleState(), opening = s.bills.find(b => !b.recordId);
    assert.doesNotThrow(edit(x => { const b = x.bills.find(b => b.id === opening.id); b.description = 'Corrigido'; b.due = b.date; b.total = opening.total + 30; }));
    const paidBill = s.bills.find(b => billPaid(s, b.id) > 0);
    assert.throws(edit(x => { x.bills.find(b => b.id === paidBill.id).total = 0.01; }));
    assert.throws(edit(x => { x.bills.find(b => b.id === opening.id).clientId = s.clients.find(c => c.id !== opening.clientId).id; }), /cliente da cobrança/);
});

test('atendimento: preço e serviços corrigidos junto com a cobrança; cliente e data não', () => {
    const s = exampleState(), r = s.records[0];
    assert.doesNotThrow(edit(x => { const rr = x.records.find(y => y.id === r.id), b = x.bills.find(b => b.id === rr.billId); rr.total = b.total = Math.max(rr.total + 15, billPaid(s, rr.billId)); rr.serviceIds = [x.services[0].id]; rr.serviceId = x.services[0].id; }));
    assert.throws(edit(x => { x.records.find(y => y.id === r.id).total = r.total + 15; }), /inválido/);
    assert.throws(edit(x => { x.records.find(y => y.id === r.id).date = '2020-01-01'; }));
});

test('pagamento: Pix e transferência podem ser corrigidos; cartão não', () => {
    const s = exampleState(), pix = s.payments.find(p => p.method === 'Pix' && p.billId), card = s.payments.find(p => cardMethod(p.method));
    assert.doesNotThrow(edit(x => { const p = x.payments.find(p => p.id === pix.id); p.method = 'Transferência'; p.amount = Math.round((pix.amount - 1) * 100) / 100; }));
    assert.throws(edit(x => { x.payments.find(p => p.id === card.id).amount = card.amount - 1; }), /cartão/);
    assert.throws(edit(x => { x.payments.find(p => p.id === pix.id).method = 'Cartão de crédito'; }), /cartão/);
});

test('estoque: perda e nota corrigíveis; consumo de atendimento não; compra com saídas posteriores é recusada', () => {
    const s = exampleState(), loss = s.movements.find(m => m.type === 'loss'), consumption = s.movements.find(m => m.type === 'consumption'), purchase = s.movements.find(m => m.type === 'purchase');
    assert.doesNotThrow(edit(x => { const m = x.movements.find(m => m.id === loss.id); m.quantity = loss.quantity / 2; m.note = 'corrigido'; }));
    assert.doesNotThrow(edit(x => { x.movements.find(m => m.id === consumption.id).note = 'só a nota'; }));
    assert.throws(edit(x => { x.movements.find(m => m.id === consumption.id).quantity = consumption.quantity * 2; }), /Consumo de atendimento/);
    assert.throws(edit(x => { const m = x.movements.find(m => m.id === purchase.id); m.unitCost = m.unitCost * 3; }), /custo/);
});
