/** Cadastro na agenda: duas entidades confirmadas juntas, sem alterar o estado de entrada em falhas. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { blankState } from '../public/domain.js';
import { createBooking, matchingClient, phoneKey, validateClientContact } from '../public/booking.js';

function fixture() {
    const state = blankState();
    state.clients = [{ id: 'c1', name: 'Ana', phone: '(41) 99999-0001', status: 'permanent', color: 'rose', note: '', alert: '' }];
    state.services = [{ id: 's1', name: 'Corte', duration: 60, buffer: 15 }];
    state.settings.closedDays = [0];
    return state;
}
const appointment = { clientId: 'c1', serviceId: 's1', date: '2026-10-21', time: '10:00', duration: 60, buffer: 15, status: 'confirmed', note: 'Manter observação' };

test('nova cliente e agendamento são preparados juntos e com vínculo válido', () => {
    const state = fixture(), before = structuredClone(state);
    const result = createBooking(state, appointment, { appointmentId: 'a1', clientId: 'c2', contact: { name: '  Bruna  ', phone: '(41) 99999-0002', status: 'temporary' } });
    assert.equal(result.state.clients.length, 2);
    assert.equal(result.state.appointments.length, 1);
    assert.equal(result.createdClient.name, 'Bruna');
    assert.equal(result.appointment.clientId, 'c2');
    assert.equal(result.appointment.note, 'Manter observação');
    assert.equal(result.createdClient.status, 'temporary');
    assert.deepEqual(state, before);
});

test('cliente existente agenda sem criar um segundo cadastro', () => {
    const state = fixture();
    const result = createBooking(state, appointment, { appointmentId: 'a1' });
    assert.equal(result.state.clients.length, 1);
    assert.equal(result.createdClient, null);
    assert.equal(result.appointment.clientId, 'c1');
});

test('conflito não deixa cliente nem agendamento parcial no estado original', () => {
    const state = fixture(); state.appointments = [{ ...appointment, id: 'existing' }];
    const before = structuredClone(state);
    assert.throws(() => createBooking(state, appointment, { appointmentId: 'a1', clientId: 'c2', contact: { name: 'Bruna', phone: '41999990002' } }), /Conflito/);
    assert.deepEqual(state, before);
});

test('mesmo telefone com DDI sugere identidade existente e impede duplicação silenciosa', () => {
    const state = fixture(), before = structuredClone(state);
    assert.equal(phoneKey('+55 (41) 99999-0001'), '41999990001');
    assert.equal(matchingClient(state.clients, '+55 (41) 99999-0001').id, 'c1');
    assert.throws(() => createBooking(state, appointment, { appointmentId: 'a1', clientId: 'c2', contact: { name: 'Ana', phone: '+55 (41) 99999-0001' } }), /já aparece em Ana/);
    assert.deepEqual(state, before);
    assert.doesNotThrow(() => validateClientContact(state.clients[0], state.clients, 'c1'));
});

test('dados inválidos e dia de folga não criam registros', () => {
    const state = fixture(), before = structuredClone(state);
    assert.throws(() => validateClientContact({ name: '', phone: '41999990002' }, state.clients), /nome/);
    assert.throws(() => validateClientContact({ name: 'Bruna', phone: '123' }, state.clients), /DDD/);
    assert.throws(() => createBooking(state, { ...appointment, date: '2026-10-25' }, { appointmentId: 'a1' }), /folga/);
    assert.throws(() => createBooking(state, { ...appointment, date: '2026-02-30' }, { appointmentId: 'a1' }), /data válida/);
    assert.throws(() => createBooking(state, { ...appointment, clientId: 'missing' }, { appointmentId: 'a1' }), /cliente e um serviço/);
    assert.deepEqual(state, before);
});

test('bloqueio continua possível sem cliente e sem novo cadastro', () => {
    const state = fixture();
    const result = createBooking(state, { ...appointment, clientId: null, serviceId: null, status: 'blocked', label: 'Almoço' }, { appointmentId: 'block1' });
    assert.equal(result.state.clients.length, 1);
    assert.equal(result.appointment.status, 'blocked');
});
