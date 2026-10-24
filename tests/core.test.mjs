/** Testes dos utilitários de agenda, datas e CSV. Casos de conflito incluem intervalos e compromissos cancelados. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentConflict, balanceFor, receivedFor, parseCSV, csvCell, dayOffset, clock, minutes, demoState } from '../public/core.js';
test('reserva duração e intervalo; aceita fronteira exata', () => {
    const list = [{ id: 'a', date: '2026-10-19', time: '09:00', duration: 60, buffer: 15, status: 'confirmed' }];
    assert.equal(appointmentConflict(list, { date: '2026-10-19', time: '10:00', duration: 60, buffer: 0 })?.id, 'a');
    assert.equal(appointmentConflict(list, { date: '2026-10-19', time: '10:15', duration: 60, buffer: 0 }), undefined);
    assert.equal(appointmentConflict(list, { date: '2026-10-19', time: '08:00', duration: 45, buffer: 15 }), undefined);
    assert.equal(appointmentConflict(list, { date: '2026-10-19', time: '09:30', duration: 60, buffer: 15 }, 'a'), undefined);
    assert.equal(appointmentConflict(list, { date: '2026-10-20', time: '09:00', duration: 60, buffer: 0 }), undefined);
});
test('bloqueios reservam horário; cancelamentos e faltas liberam', () => {
    const candidate = { date: '2026-10-19', time: '12:00', duration: 60, buffer: 0 };
    for (const status of ['blocked', 'confirmed', 'pending', 'completed'])
        assert.ok(appointmentConflict([{ id: 'a', ...candidate, status }], candidate));
    for (const status of ['cancelled', 'absent'])
        assert.equal(appointmentConflict([{ id: 'a', ...candidate, status }], candidate), undefined);
});
test('sinais são parte do recebido e saldos usam centavos', () => {
    const bill = { id: 'b', total: 100.3 }, payments = [{ billId: 'b', amount: 20.1, kind: 'Sinal' }, { billId: 'b', amount: 30.2 }, { billId: 'other', amount: 200 }];
    assert.equal(receivedFor(bill, payments), 50.3);
    assert.equal(balanceFor(bill, payments), 50);
    assert.equal(balanceFor(bill, [...payments, { billId: 'b', amount: 50 }]), 0);
});
test('CSV preserva aspas, quebras em campos e separadores escapados', () => {
    assert.deepEqual(parseCSV('nome;telefone\r\n"Ana; Silva";"41 90000-0000"\r\n'), [['nome', 'telefone'], ['Ana; Silva', '41 90000-0000']]);
    assert.deepEqual(parseCSV('a,b\n"texto, com vírgula","linha 1\nlinha 2"'), [['a', 'b'], ['texto, com vírgula', 'linha 1\nlinha 2']]);
    assert.deepEqual(parseCSV('"Ana ""C.""";ok'), [['Ana "C."', 'ok']]);
    assert.throws(() => parseCSV('"sem fechamento'), /aspas/);
    assert.equal(csvCell('=SUM(1)'), '"\'=SUM(1)"');
});
test('intervalos de datas e horários funcionam na virada de mês', () => {
    assert.equal(dayOffset(1, '2026-10-31'), '2026-11-01');
    assert.equal(dayOffset(-1, '2026-03-01'), '2026-02-28');
    assert.equal(clock(minutes('09:45') + 60), '10:45');
});
test('a demonstração referencia clientes e serviços existentes', () => {
    const s = demoState();
    for (const a of s.appointments) {
        if (a.clientId)
            assert.ok(s.clients.some(c => c.id === a.clientId));
        if (a.serviceId)
            assert.ok(s.services.some(x => x.id === a.serviceId));
    }
    for (const p of s.payments)
        assert.ok(s.bills.some(b => b.id === p.billId));
    for (const a of s.appointments)
        assert.equal(appointmentConflict(s.appointments, a, a.id), undefined);
});
