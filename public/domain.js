import { deletionBlock, removableCollections } from './deletion.js';
/**
 * Regras de negócio compartilhadas entre navegador e API. Valores monetários são arredondados em centavos; quantidades em três casas. null em custo ou taxa significa informação pendente, nunca zero presumido.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { demoState, localDate, dayOffset, appointmentConflict } from './core.js';
/**
 * cents — Converte reais em centavos inteiros para arredondamento monetário.
 */
/**
 * amount — Converte centavos inteiros em reais.
 */
/**
 * qty — Arredonda quantidade de produto para três casas decimais.
 */
export const cents = n => Math.round(Number(n) * 100), amount = n => n / 100, qty = n => Math.round(Number(n) * 1000) / 1000;
// Meios de recebimento suportados pela operação atual.
export const METHODS = ['Pix', 'Transferência', 'Cartão de débito', 'Cartão de crédito'];
/**
 * cardMethod — Identifica métodos que geram agenda de repasses da operadora.
 */
export const cardMethod = m => m === 'Cartão de débito' || m === 'Cartão de crédito';
/**
 * blankState — Cria estado schema 2 sem histórico de negócio; inclui sugestões editáveis de serviços.
 */
export function blankState() { return { schema: 2, focus: false, settings: { name: 'Hanne', open: '09:00', close: '19:00', closedDays: [0], responseMinutes: 60, notifications: true, cutoff: '', spaceAmount: null, spaceDueDay: 10 }, clients: [], services: demoState().services, appointments: [], conversations: [], quotes: [], bills: [], payments: [], installments: [], records: [], tasks: [], products: [], movements: [], expenses: [], audit: [] }; }
/**
 * plusMonths — Soma meses preservando o dia quando possível e limitando ao último dia do mês de destino.
 */
export function plusMonths(date, n) { const [y, m, d] = date.split('-').map(Number), f = new Date(y, m - 1 + n, 1, 12), last = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate(); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; }
/**
 * splitCents — Divide valor em parcelas sem perder centavos, distribuindo o resto nas primeiras parcelas.
 */
export function splitCents(value, count) { const total = cents(value), base = Math.floor(total / count), rest = total % count; return Array.from({ length: count }, (_, i) => amount(base + (i < rest ? 1 : 0))); }
/**
 * stockOf — Reconstitui saldo e custo médio ponderado na ordem dos movimentos. Custo desconhecido permanece null até valoração ou renovação integral do estoque.
 */
export function stockOf(state, id) {
    let quantity = 0, unitCost = null;
    for (const m of state.movements.filter(x => x.productId === id)) {
        if (m.type === 'valuation') {
            unitCost = m.unitCost;
            continue;
        }
        if (m.quantity > 0) {
            if (quantity === 0)
                unitCost = m.unitCost;
            else if (unitCost !== null && m.unitCost !== null)
                unitCost = (quantity * unitCost + m.quantity * m.unitCost) / (quantity + m.quantity);
            else
                unitCost = null;
        }
        quantity = qty(quantity + m.quantity);
        if (quantity === 0)
            unitCost = null;
    }
    return { quantity, unitCost };
}
/**
 * billPaid — Soma pagamentos aceitos da cobrança; cartão reduz dívida da cliente antes do repasse. Sinal retido não é pagamento aplicado.
 */
export const billPaid = (s, id) => amount(s.payments.filter(p => p.billId === id && p.depositStatus !== 'retained').reduce((sum, p) => sum + cents(p.amount), 0));
/**
 * billBalance — Calcula o saldo devedor da cliente em centavos, sem valores negativos.
 */
export const billBalance = (s, b) => amount(Math.max(0, cents(b.total) - cents(billPaid(s, b.id))));
/**
 * availableDeposits — Seleciona sinais disponíveis da cliente que ainda não foram aplicados a uma cobrança.
 */
export const availableDeposits = (s, id) => s.payments.filter(p => p.kind === 'Sinal' && p.clientId === id && !p.billId && p.depositStatus === 'available');
/**
 * paymentEntries — Constrói pagamento e parcelas, sem alterar o estado recebido. Aceita de 1 a 24 parcelas, débito apenas uma; taxa null significa desconhecida.
 */
export function paymentEntries(s, { id, clientId, billId = null, value, method, kind = 'Pagamento', date, opening = false, appointmentId = null, count = 1, firstDue, feeTotal = null }) {
    if (!METHODS.includes(method) || cents(value) <= 0)
        throw Error('Confira método e valor do pagamento.');
    const payment = { id, clientId, billId, amount: amount(cents(value)), method, kind, date, isOpening: opening, appointmentId, depositStatus: kind === 'Sinal' ? 'available' : null }, installments = [];
    if (cardMethod(method)) {
        if (!Number.isInteger(count) || count < 1 || count > 24)
            throw Error('Use entre 1 e 24 parcelas.');
        if (method === 'Cartão de débito' && count !== 1)
            throw Error('Débito tem um único repasse.');
        const values = splitCents(value, count), fees = feeTotal === null ? values.map(() => null) : splitCents(feeTotal, count);
        values.forEach((gross, i) => installments.push({ id: `${id}-p${i + 1}`, paymentId: id, number: i + 1, count, gross, fee: fees[i], due: plusMonths(firstDue || date, i), receivedDate: null, receivedNet: null, isOpening: opening }));
    }
    return { payment, installments };
}
/**
 * periodOf — Obtém limites inclusivos do mês ou de todo o histórico quando não há mês.
 */
export function periodOf(month) {
    if (!month)
        return { from: '0000-01-01', to: '9999-12-31' };
    return { from: month + '-01', to: dayOffset(-1, plusMonths(month + '-01', 1)) };
}
/**
 * metrics — Calcula caixa por recebimento efetivo e despesa paga; separa preço dos atendimentos, dívida das clientes, cartões pendentes e custo de consumo. Pendências abrangem todo o histórico.
 */
export function metrics(s, from, to) {
    const inside = d => d && d >= from && d <= to, records = s.records.filter(r => inside(r.date)), direct = s.payments.filter(p => !p.isOpening && !cardMethod(p.method) && inside(p.date)), settled = s.installments.filter(i => i.receivedDate && inside(i.receivedDate)), expenses = s.expenses.filter(e => e.paidDate && inside(e.paidDate)), directCash = direct.reduce((sum, p) => sum + cents(p.amount), 0), cardCash = settled.reduce((sum, i) => sum + cents(i.receivedNet), 0), out = expenses.reduce((sum, e) => sum + cents(e.amount), 0), counts = new Map();
    for (const r of records)
        for (const id of r.serviceIds || [r.serviceId])
            counts.set(id, (counts.get(id) || 0) + 1);
    const ranked = [...counts].map(([id, count]) => ({ id, name: s.services.find(x => x.id === id)?.name || 'Serviço', count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)), pending = s.installments.filter(i => !i.receivedDate), consumption = s.movements.filter(m => m.type === 'consumption' && inside(m.date)), incomplete = consumption.filter(m => m.unitCost === null).length;
    return { records: records.length, serviceValue: amount(records.reduce((sum, r) => sum + cents(r.total || 0), 0)), received: amount(directCash + cardCash), directCash: amount(directCash), cardCash: amount(cardCash), expenses: amount(out), cashResult: amount(directCash + cardCash - out), clientPending: amount(s.bills.filter(b => !b.cancelled).reduce((sum, b) => sum + cents(billBalance(s, b)), 0)), cardPendingGross: amount(pending.reduce((sum, i) => sum + cents(i.gross), 0)), cardPendingNet: pending.some(i => i.fee === null) ? null : amount(pending.reduce((sum, i) => sum + cents(i.gross) - cents(i.fee), 0)), productCost: incomplete ? null : amount(consumption.reduce((sum, m) => sum + cents(-m.quantity * m.unitCost), 0)), incomplete, ranked, unusedDeposits: amount(s.payments.filter(p => p.kind === 'Sinal' && p.depositStatus === 'available' && !p.billId).reduce((sum, p) => sum + cents(p.amount), 0)) };
}
/**
 * closeAttendance — Cria uma cópia e conclui atendimento, consumo, cobrança, sinais e pagamento juntos. Qualquer erro descarta a cópia e preserva o estado original.
 */
export function closeAttendance(state, data) {
    const next = structuredClone(state), { id, date, clientId, serviceIds, total, consumption, appointmentId = null, depositIds = [], payment = null, noProducts = false } = data;
    if (!next.settings.cutoff)
        throw Error('Defina a data de início em “Preparar operação”.');
    if (date < next.settings.cutoff || date > localDate())
        throw Error('Use uma data entre o início da operação e hoje.');
    if (!next.clients.some(c => c.id === clientId) || !serviceIds.length || serviceIds.some(id => !next.services.some(s => s.id === id)))
        throw Error('Selecione cliente e serviços válidos.');
    if (!Number.isFinite(total) || cents(total) <= 0)
        throw Error('Informe o preço total combinado.');
    const a = next.appointments.find(a => a.id === appointmentId);
    if (appointmentId && (!a || a.clientId !== clientId || a.date !== date || ['cancelled', 'absent', 'blocked', 'completed'].includes(a.status) || next.records.some(r => r.appointmentId === appointmentId)))
        throw Error('Este agendamento não está disponível para conclusão.');
    if (!consumption.length && !noProducts)
        throw Error('Registre produtos ou confirme que não houve consumo.'); // Cada produto só pode aparecer uma vez; a saída preserva o custo conhecido naquele instante.
    const seen = new Set();
    for (const line of consumption) {
        if (seen.has(line.productId))
            throw Error('Informe cada produto uma única vez.');
        seen.add(line.productId);
        const p = next.products.find(p => p.id === line.productId), stock = stockOf(next, line.productId);
        if (!p || !Number.isFinite(line.quantity) || qty(line.quantity) <= 0 || qty(line.quantity) > stock.quantity)
            throw Error('Consumo inválido ou maior que o estoque disponível.');
        const last = next.movements.filter(m => m.productId === p.id).at(-1);
        if (last && date < last.date)
            throw Error(`O consumo de ${p.name} precisa ser na data do último movimento ou depois.`);
        next.movements.push({ id: `${id}-${p.id}`, productId: p.id, recordId: id, date, type: 'consumption', quantity: -qty(line.quantity), unitCost: stock.unitCost, note: 'Consumo confirmado no atendimento' });
    } // Aplicar sinal vincula um recebimento existente à cobrança, sem receber o dinheiro novamente.
    const selected = depositIds.map(id => availableDeposits(next, clientId).find(p => p.id === id));
    if (selected.some(p => !p))
        throw Error('Um dos sinais já não está disponível.');
    const deposits = selected.reduce((sum, p) => sum + cents(p.amount), 0);
    if (deposits > cents(total))
        throw Error('Os sinais ultrapassam o valor do atendimento.');
    const billId = id + '-bill';
    next.bills.push({ id: billId, clientId, description: serviceIds.map(id => next.services.find(s => s.id === id).name).join(' + '), total: amount(cents(total)), date, due: data.due || date, isOpening: false, recordId: id });
    for (const p of selected) {
        p.billId = billId;
        p.depositStatus = 'applied';
    }
    if (payment && cents(payment.value) > 0) {
        if (cents(payment.value) > cents(total) - deposits)
            throw Error('O pagamento supera o saldo restante.');
        const parts = paymentEntries(next, { ...payment, id: id + '-payment', clientId, billId, date });
        next.payments.push(parts.payment);
        next.installments.push(...parts.installments);
    }
    next.records.push({ id, clientId, serviceId: serviceIds[0], serviceIds: [...new Set(serviceIds)], date, total: amount(cents(total)), billId, appointmentId, noProducts, formula: data.formula || '', products: consumption.map(c => next.products.find(p => p.id === c.productId)?.name).join(', '), notes: data.notes || '', followup: data.followup || '' });
    if (a)
        a.status = 'completed';
    return next;
}
/**
 * retainDeposit — Cria uma cópia para reter sinal disponível e cancelar agenda ativa vinculada com consentimento explícito. Não gera nova entrada de caixa.
 */
export function retainDeposit(state, { id, reason, confirmed = false, cancelAppointment = false }) {
    const next = structuredClone(state), p = next.payments.find(p => p.id === id), note = String(reason || '').trim();
    if (!confirmed)
        throw Error('Confirme a decisão de reter o sinal.');
    if (!p || p.kind !== 'Sinal' || p.depositStatus !== 'available' || p.billId)
        throw Error('Este sinal não está disponível para retenção.');
    if (!note || note.length > 500)
        throw Error('Informe o motivo do cancelamento, com até 500 caracteres.');
    const a = p.appointmentId ? next.appointments.find(a => a.id === p.appointmentId) : null;
    if (p.appointmentId && !a)
        throw Error('O agendamento vinculado não foi encontrado. Confira o vínculo antes de continuar.');
    if (a) {
        if (a.clientId !== p.clientId)
            throw Error('O sinal e o agendamento pertencem a clientes diferentes.');
        if (!['confirmed', 'pending', 'cancelled'].includes(a.status))
            throw Error('Este agendamento não pode ser cancelado por esta ação. Confira se já foi concluído ou registrado como falta.');
        if (a.status !== 'cancelled') {
            if (!cancelAppointment)
                throw Error('Confirme também o cancelamento do agendamento vinculado.');
            a.status = 'cancelled';
            a.cancelledAt = new Date().toISOString();
            a.cancellationReason = note;
        }
    }
    p.depositStatus = 'retained';
    p.retainedDate = localDate();
    p.retentionReason = note;
    return next;
}
/**
 * validateState — Valida estrutura, referências, valores, datas, estoque cronológico e imutabilidade do histórico confirmado. Lança erro no primeiro problema; usada no cliente e no servidor.
 */
export function validateState(s, previous = null) {
    const fail = t => { throw Error(t); };
    if (!s || s.schema !== 2)
        fail('Formato incompatível.');
    // Limita tamanho das coleções e exige identificadores únicos dentro de cada entidade.
    const keys = ['clients', 'services', 'appointments', 'conversations', 'quotes', 'bills', 'payments', 'installments', 'records', 'tasks', 'products', 'movements', 'expenses'];
    for (const k of keys) {
        if (!Array.isArray(s[k]) || s[k].length > 10000)
            fail('Limite ou formato inválido: ' + k);
        const ids = new Set();
        for (const x of s[k]) {
            if (!x || typeof x.id !== 'string' || x.id.length > 100 || ids.has(x.id))
                fail('Identificador inválido ou duplicado.');
            ids.add(x.id);
        }
    }
    const has = (k, id) => s[k].some(x => x.id === id), positive = n => Number.isFinite(n) && n > 0 && n <= 10000000, nonnegative = n => Number.isFinite(n) && n >= 0 && n <= 10000000, date = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T12:00:00Z')) && new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
    if (!s.settings || typeof s.settings.name !== 'string' || !s.settings.name.trim() || s.settings.name.length > 100 || !/^\d{2}:\d{2}$/.test(s.settings.open) || !/^\d{2}:\d{2}$/.test(s.settings.close) || s.settings.open >= s.settings.close || !Array.isArray(s.settings.closedDays) || s.settings.closedDays.some(d => !Number.isInteger(d) || d < 0 || d > 6))
        fail('Configurações inválidas.');
    if (s.settings.cutoff && (!date(s.settings.cutoff) || s.settings.cutoff > localDate()))
        fail('Data de início inválida.');
    if (previous?.settings.cutoff && s.settings.cutoff !== previous.settings.cutoff)
        fail('A data de início confirmada não pode ser alterada nesta versão.');
    if ((s.bills.length || s.payments.length || s.records.length || s.products.length || s.expenses.length) && !s.settings.cutoff)
        fail('Confirme a data de início antes de registrar a operação.');
    if (s.settings.spaceAmount !== null && (!positive(s.settings.spaceAmount)))
        fail('Valor do espaço inválido.');
    if (!Number.isInteger(s.settings.spaceDueDay) || s.settings.spaceDueDay < 1 || s.settings.spaceDueDay > 28)
        fail('Dia de vencimento inválido.');
    for (const c of s.clients)
        if (!c.name?.trim() || typeof c.phone !== 'string' || c.name.length > 100 || c.phone.replace(/\D/g, '').length < 10 || c.phone.replace(/\D/g, '').length > 15 || !['temporary', 'permanent'].includes(c.status))
            fail('Cliente inválido.');
    for (const c of s.clients)
        if (c.waLog !== undefined && (!Array.isArray(c.waLog) || c.waLog.length > 20 || c.waLog.some(m => !m || typeof m.at !== 'string' || m.at.length > 40 || typeof m.text !== 'string' || m.text.length > 1000 || (m.context !== undefined && (typeof m.context !== 'string' || m.context.length > 300)))))
            fail('Histórico de mensagens inválido.');
    for (const x of s.services)
        if (!x.name?.trim() || !positive(x.duration) || !nonnegative(x.buffer))
            fail('Serviço inválido.');
    for (const b of s.bills) {
        if (!has('clients', b.clientId) || !positive(b.total) || !date(b.date) || !date(b.due))
            fail('Lançamento inválido.');
        if (cents(billPaid(s, b.id)) > cents(b.total))
            fail('Um recebimento excede o lançamento.');
    }
    for (const p of s.payments) {
        if (!has('clients', p.clientId) || !positive(p.amount) || !date(p.date) || (!METHODS.includes(p.method) && p.method !== 'Saldo anterior') || (p.billId && (!has('bills', p.billId) || s.bills.find(b => b.id === p.billId).clientId !== p.clientId)))
            fail('Recebimento inválido.');
        if (cardMethod(p.method) && !p.isOpening && s.installments.filter(i => i.paymentId === p.id).reduce((sum, i) => sum + cents(i.gross), 0) !== cents(p.amount))
            fail('As parcelas não correspondem ao cartão.');
        if (p.depositStatus === 'retained') {
            if (p.billId)
                fail('Sinal retido não pode ser aplicado.');
            if (p.kind !== 'Sinal' || !p.retentionReason?.trim() || !date(p.retainedDate))
                fail('Confirme o motivo e a data da retenção.');
            if (p.appointmentId) {
                const linked = s.appointments.find(a => a.id === p.appointmentId);
                if (!linked || linked.clientId !== p.clientId || linked.status !== 'cancelled')
                    fail('A retenção exige o cancelamento confirmado do agendamento vinculado.');
            }
        }
    }
    for (const i of s.installments)
        if (!has('payments', i.paymentId) || !positive(i.gross) || !date(i.due) || (i.fee !== null && (!nonnegative(i.fee) || cents(i.fee) > cents(i.gross))) || (i.receivedDate && (!date(i.receivedDate) || i.receivedDate > localDate() || !nonnegative(i.receivedNet) || cents(i.receivedNet) > cents(i.gross) || i.fee === null || cents(i.receivedNet) + cents(i.fee) !== cents(i.gross))))
            fail('Parcela inválida.');
    for (const p of s.products)
        if (!p.name?.trim() || !['g', 'ml', 'un'].includes(p.unit) || !positive(p.packageSize) || !nonnegative(p.minimum))
            fail('Produto inválido.');
    // Reproduz o livro de estoque em ordem cronológica e confere o custo de cada saída.
    const stocks = new Map(), dates = new Map(), costs = new Map();
    for (const m of s.movements) {
        if (!has('products', m.productId) || !date(m.date) || !Number.isFinite(m.quantity) || Math.abs(m.quantity) > 10000000 || !['opening', 'purchase', 'consumption', 'loss', 'valuation'].includes(m.type) || (m.unitCost !== null && !nonnegative(m.unitCost)))
            fail('Movimento inválido.');
        if (dates.has(m.productId) && m.date < dates.get(m.productId))
            fail('Estoque fora da ordem cronológica.');
        dates.set(m.productId, m.date);
        if (['consumption', 'loss'].includes(m.type) && m.quantity >= 0)
            fail('Saída inválida.');
        if (['opening', 'purchase'].includes(m.type) && m.quantity < 0)
            fail('Entrada inválida.');
        if (m.type === 'valuation' && (m.quantity !== 0 || m.unitCost === null))
            fail('Valoração inválida.');
        const before = stocks.get(m.productId) || 0, priorCost = costs.get(m.productId) ?? null;
        if (['consumption', 'loss'].includes(m.type) && (m.unitCost === null ? priorCost !== null : priorCost === null || Math.abs(m.unitCost - priorCost) > 0.00000001))
            fail('O custo do movimento não corresponde ao estoque.');
        let nextCost = priorCost;
        if (m.type === 'valuation')
            nextCost = m.unitCost;
        else if (m.quantity > 0)
            nextCost = before === 0 ? m.unitCost : priorCost === null || m.unitCost === null ? null : (before * priorCost + m.quantity * m.unitCost) / (before + m.quantity);
        const after = qty(before + m.quantity);
        if (after === 0 && m.type !== 'valuation')
            nextCost = null;
        costs.set(m.productId, nextCost);
        if (after < 0)
            fail('Estoque negativo.');
        stocks.set(m.productId, after);
        if (m.type === 'consumption' && !has('records', m.recordId))
            fail('Consumo sem atendimento.');
    }
    for (const r of s.records) {
        if (!has('clients', r.clientId) || !date(r.date) || r.date > localDate() || !positive(r.total) || !Array.isArray(r.serviceIds) || !r.serviceIds.length || new Set(r.serviceIds).size !== r.serviceIds.length || r.serviceIds.some(id => !has('services', id)) || !has('bills', r.billId) || s.bills.find(b => b.id === r.billId).clientId !== r.clientId || cents(s.bills.find(b => b.id === r.billId).total) !== cents(r.total))
            fail('Atendimento realizado inválido.');
        if (!r.noProducts && !s.movements.some(m => m.recordId === r.id && m.type === 'consumption'))
            fail('Consumo não confirmado.');
    }
    for (const e of s.expenses)
        if (!positive(e.amount) || !date(e.date) || !date(e.due) || !['space', 'products', 'disposables'].includes(e.category) || (e.paidDate && (!date(e.paidDate) || e.paidDate > localDate())))
            fail('Despesa inválida.');
    for (const a of s.appointments) {
        if (!date(a.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time) || !positive(a.duration) || !nonnegative(a.buffer) || (a.clientId && !has('clients', a.clientId)) || (a.serviceId && !has('services', a.serviceId)))
            fail('Agendamento inválido.');
        if (appointmentConflict(s.appointments, a, a.id) && !['cancelled', 'absent'].includes(a.status))
            fail('Conflito entre agendamentos.');
    }
    if (previous) for (const collection of removableCollections) for (const old of previous[collection]) {
        if (!s[collection].some(x => x.id === old.id)) {
            const issue = deletionBlock(previous, collection, old.id);
            if (issue) fail(issue);
        }
    }
    // Compara com a versão confirmada para proteger histórico e repasses já liquidados.
    if (previous)
        for (const key of ['movements', 'payments', 'installments', 'records', 'bills', 'expenses'])
            for (const old of previous[key]) {
                const fresh = s[key].find(x => x.id === old.id);
                if (!fresh)
                    fail('Registros financeiros e de estoque não podem ser excluídos.');
                // Correções permitidas: o livro de estoque e os saldos acima são recalculados e conferidos por inteiro.
                if (key === 'movements' && (['productId', 'type', 'recordId', 'expenseId'].some(k => old[k] !== fresh[k]) || (old.type === 'consumption' && ['quantity', 'unitCost', 'date'].some(k => old[k] !== fresh[k]))))
                    fail('Consumo de atendimento é corrigido pela ficha; exclua o atendimento para refazer o consumo.');
                if (key === 'payments' && (['clientId', 'isOpening', 'kind'].some(k => old[k] !== fresh[k]) || ((cardMethod(old.method) || cardMethod(fresh.method)) && ['amount', 'method', 'date'].some(k => old[k] !== fresh[k]))))
                    fail('Pagamentos no cartão não podem ser alterados. Exclua e registre de novo.');
                if (key === 'records' && ['clientId', 'date', 'billId', 'appointmentId', 'noProducts'].some(k => JSON.stringify(old[k]) !== JSON.stringify(fresh[k])))
                    fail('Cliente, data e consumo do atendimento não podem ser alterados. Exclua e registre de novo.');
                if (key === 'bills' && ['clientId', 'recordId', 'isOpening'].some(k => old[k] !== fresh[k]))
                    fail('A cliente da cobrança não pode ser alterada. Exclua e registre de novo.');
                if (key === 'installments' && old.receivedDate && JSON.stringify(old) !== JSON.stringify(fresh))
                    fail('Repasses confirmados não podem ser sobrescritos.');
            }
    return s;
}
