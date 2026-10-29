/** Regras compartilhadas de cadastro e reserva. As duas entidades são preparadas antes de trocar o estado. */
import { appointmentConflicts, minutes } from './core.js';
import { validCalendarDate } from './navigation.js';
import { validateState } from './domain.js';

/** Compara telefones brasileiros com/sem +55, sem unir cadastros nem alterar o número informado. */
export function phoneKey(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
}

/** Encontra um possível cadastro existente para a pessoa conferir manualmente. */
export function matchingClient(clients, phone, ignoreId = '') {
    const key = phoneKey(phone);
    return key.length >= 10 ? clients.find(c => c.id !== ignoreId && phoneKey(c.phone) === key) : undefined;
}

/** Mesma validação de contato no cadastro completo e no cadastro durante um agendamento. */
export function validateClientContact(input, clients, ignoreId = '') {
    const name = String(input.name || '').trim(), phone = String(input.phone || '').trim(), digits = phone.replace(/\D/g, '');
    if (!name || name.length > 100) throw Error('Informe o nome da cliente, com até 100 caracteres.');
    if (digits.length < 10 || digits.length > 15) throw Error('Confira o telefone, incluindo o DDD.');
    const match = matchingClient(clients, phone, ignoreId);
    if (match) throw Error(`Este telefone já aparece em ${match.name}. Confira a identidade e use o cadastro existente; os registros não serão unidos automaticamente.`);
    return { name, phone };
}

/** Mantém expediente, folgas e conflitos iguais em criação, remarcação e importação. */
/** Sobreposição só é aceita com a confirmação explícita da profissional (allowOverlap). O erro leva os horários em conflito para a tela pedir essa confirmação. */
export function overlapError(state, hits) {
    const name = h => h.status === 'blocked' ? (h.label || 'Bloqueio de horário') : state.clients.find(c => c.id === h.clientId)?.name || 'outro atendimento';
    const err = Error(hits.length === 1 ? `Já existe ${name(hits[0])} às ${hits[0].time} nesse horário. Confirme abaixo se quer manter os dois.` : `Já existem ${hits.length} atendimentos nesse horário. Confirme abaixo se quer manter todos.`);
    err.overlap = hits.map(h => ({ id: h.id, name: name(h), service: h.status === 'blocked' ? 'Bloqueio' : state.services.find(s => s.id === h.serviceId)?.name || '', time: h.time, end: h.duration ? `${String(Math.floor((minutes(h.time) + h.duration) / 60)).padStart(2, '0')}:${String((minutes(h.time) + h.duration) % 60).padStart(2, '0')}` : '' }));
    return err;
}
export function validateBookingSlot(state, candidate, ignoreId, { allowOverlap = false } = {}) {
    if (!validCalendarDate(candidate.date)) throw Error('Informe uma data válida.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.time)) throw Error('Informe um horário válido.');
    if (!Number.isFinite(candidate.duration) || candidate.duration < 15 || candidate.duration > 600 || !Number.isFinite(candidate.buffer) || candidate.buffer < 0 || candidate.buffer > 120) throw Error('Confira a duração e o intervalo.');
    if (state.settings.closedDays.includes(new Date(candidate.date + 'T12:00:00Z').getUTCDay())) throw Error('Esta data é um dia de folga. Ajuste a rotina nas configurações ou escolha outro dia.');
    if (minutes(candidate.time) < minutes(state.settings.open) || minutes(candidate.time) + candidate.duration + candidate.buffer > minutes(state.settings.close)) throw Error('O atendimento e seu intervalo precisam caber no horário de funcionamento.');
    const hits = appointmentConflicts(state.appointments, candidate, ignoreId);
    if (hits.length && !(allowOverlap || candidate.allowOverlap)) throw overlapError(state, hits);
}

/** Cria cliente opcional e agendamento no mesmo snapshot; falha não deixa um cadastro órfão. */
export function createBooking(state, appointment, { appointmentId, clientId, contact = null } = {}) {
    validateBookingSlot(state, appointment, undefined, { allowOverlap: appointment.allowOverlap === true });
    const next = structuredClone(state);
    let createdClient = null;
    if (contact) {
        const values = validateClientContact(contact, state.clients);
        createdClient = { id: clientId, ...values, status: contact.status || 'temporary', color: ['rose', 'olive', 'sand', 'lilac'][state.clients.length % 4], note: '', alert: '' };
        next.clients.push(createdClient);
    }
    const entry = { ...appointment, id: appointmentId, ...(createdClient ? { clientId: createdClient.id } : {}) };
    if (entry.status !== 'blocked' && (!next.clients.some(c => c.id === entry.clientId) || !next.services.some(s => s.id === entry.serviceId))) throw Error('Escolha uma cliente e um serviço válidos.');
    next.appointments.push(entry);
    validateState(next, state);
    return { state: next, appointment: entry, createdClient };
}
