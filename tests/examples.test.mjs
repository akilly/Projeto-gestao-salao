/** Testes de consistência e isolamento das fixtures da demonstração. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { exampleState } from '../public/examples.js';
import { validateState, metrics, stockOf } from '../public/domain.js';
import { localDate } from '../public/core.js';
test('dados fictícios têm vínculos válidos e indicadores consistentes', () => { const s = exampleState(); validateState(s); assert.equal(s.datasetKind, 'example'); assert.equal(s.clients.length, 8); assert.equal(s.records.length, 12); assert.equal(s.products.length, 8); const m = metrics(s, s.settings.cutoff, localDate()); assert.equal(m.records, 12); assert.equal(m.serviceValue, 2815); assert.equal(m.clientPending, 210); assert.equal(m.productCost, 170.7); assert.equal(m.unusedDeposits, 160); assert.ok(m.received > 0); assert.ok(m.expenses > 0); assert.ok(m.cardPendingGross > 0); assert.equal(m.cashResult, Math.round((m.received - m.expenses) * 100) / 100); assert.equal(m.ranked[0].name, 'Escova & styling'); assert.equal(m.ranked[0].count, 6); assert.ok(s.products.some(p => stockOf(s, p.id).quantity <= p.minimum)); });
test('cada base fictícia é uma cópia independente', () => { const a = exampleState(), b = exampleState(); a.clients[0].name = 'Alterado'; a.products.length = 0; assert.notEqual(a.clients[0].name, b.clients[0].name); assert.equal(b.products.length, 8); });
