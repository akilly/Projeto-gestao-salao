/** Destinos de consulta. A URL transporta IDs e filtros, nunca nomes, telefones ou operações de pagamento. */
import { localDate } from './core.js';

const pages = ['dashboard', 'agenda', 'clients', 'conversations', 'finance', 'inventory', 'services', 'quotes', 'tasks', 'settings', 'setup'];
const keys = ['page', 'mode', 'date', 'month', 'service', 'set', 'client', 'record', 'appointment', 'bill', 'payment', 'expense', 'installment', 'product', 'tab', 'status', 'scope', 'movement', 'scroll', 'p'];

/** URL interna compatível com nova aba, atualização da página e histórico do navegador. */
export function destinationHref(target) {
    const params = new URLSearchParams();
    for (const key of keys) if (target[key] !== undefined && target[key] !== null && target[key] !== '') params.set(key, String(target[key]));
    // Vazio significa todo o período; mantenha esse significado ao recarregar ou abrir outra aba.
    if (target.month === '') params.set('period', 'all');
    return '#' + params.toString();
}

/** Lê apenas destinos conhecidos; filtros inválidos não ampliam a consulta por acidente. */
export function parseDestination(hash = '') {
    const params = new URLSearchParams(hash.replace(/^#/, '')), target = {};
    if (!pages.includes(params.get('page'))) return null;
    for (const key of keys) if (params.has(key)) target[key] = params.get(key).slice(0, 250);
    if (target.mode && !['day', 'month', 'all'].includes(target.mode)) target.mode = 'day';
    if (target.date && !validCalendarDate(target.date)) delete target.date;
    if (target.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(target.month)) delete target.month;
    if (params.get('period') === 'all') target.month = '';
    target.p = Math.max(1, Math.min(10000, Math.trunc(Number(target.p)) || 1));
    return target;
}

/** Datas de negócio são datas civis de Brasília; não são instantes convertidos de UTC. */
export function validCalendarDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}

/** Consulta de registros, sem mutação, compartilhada pela lista e pelos indicadores que abrem essa lista. */
export function recordsForView(state, filter = {}) {
    const mode = filter.mode || 'day', date = filter.date || localDate(), month = filter.month || date.slice(0, 7);
    const set = filter.set ? String(filter.set).split(',').filter(Boolean).sort().join(',') : '';
    return state.records.filter(record => {
        const ids = record.serviceIds || [record.serviceId];
        return (mode === 'all' || (mode === 'month' ? record.date.slice(0, 7) === month : record.date === date)) &&
            (!filter.service || ids.includes(filter.service)) && (!filter.client || record.clientId === filter.client) &&
            (!set || [...ids].sort().join(',') === set);
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Paginação sobre o snapshot completo recebido da API; nunca simula um total de uma resposta parcial. */
export function recordPage(records, requested = 1, size = 10) {
    const pages = Math.max(1, Math.ceil(records.length / size)), page = Math.max(1, Math.min(pages, Math.trunc(Number(requested)) || 1)), start = (page - 1) * size;
    return { page, pages, total: records.length, start: records.length ? start + 1 : 0, end: Math.min(start + size, records.length), rows: records.slice(start, start + size) };
}
