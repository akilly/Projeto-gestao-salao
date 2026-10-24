/**
 * Demonstração editável identificada por datasetKind example. Usa as mesmas regras da operação, mas é persistida em chave distinta da base real. Datas são relativas ao dia da primeira geração não persistida.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { demoState, localDate, dayOffset } from './core.js';
import { blankState, closeAttendance, paymentEntries, stockOf, cents, amount, validateState } from './domain.js';
// Seed used exclusively in the authenticated demonstration dataset.
/**
 * exampleState — Constrói demonstração isolada com clientes, estoque, atendimentos, sinais e cartões coerentes com as mesmas regras de domínio; valida o resultado antes de retornar.
 */
export function exampleState() {
    const today = localDate(), d = n => dayOffset(n, today), old = demoState();
    let s = blankState();
    s.datasetKind = 'example';
    s.settings = { ...s.settings, cutoff: d(-45), spaceAmount: 980, spaceDueDay: 10, closedDays: [] };
    s.clients = old.clients;
    s.clients.push({ id: 'c8', name: 'Sofia Oliveira', phone: '(41) 90000-0008', status: 'permanent', color: 'olive', note: 'Cadastro fictício para explorar o painel.', alert: '' });
    s.conversations = old.conversations;
    s.quotes = old.quotes;
    s.tasks = old.tasks;
    const products = [
        ['ex-shampoo', 'Shampoo de uso profissional', 'Marca exemplo', 'ml', 5000, 3200, 500, 0.036],
        ['ex-mask', 'Máscara de tratamento', 'Marca exemplo', 'g', 1000, 850, 150, 0.12],
        ['ex-color', 'Coloração · tom demonstrativo', 'Marca exemplo', 'g', 60, 300, 60, 0.7],
        ['ex-oxidant', 'Oxidante de uso profissional', 'Marca exemplo', 'ml', 1000, 650, 200, 0.045],
        ['ex-powder', 'Pó para iluminação', 'Marca exemplo', 'g', 500, 350, 260, 0.18],
        ['ex-finish', 'Finalizador', 'Marca exemplo', 'ml', 200, 90, 20, 0.25],
        ['ex-thermal', 'Protetor térmico', 'Marca exemplo', 'ml', 200, 75, 25, 0.3],
        ['ex-leavein', 'Leave-in · custo a conferir', 'Marca exemplo', 'ml', 150, 90, 20, null]
    ];
    for (const [id, name, brand, unit, packageSize, quantity, minimum, unitCost] of products) {
        s.products.push({ id, name, brand, unit, packageSize, minimum });
        s.movements.push({ id: id + '-initial', productId: id, type: 'opening', date: d(-45), quantity, unitCost, note: 'Saldo inicial fictício' });
    }
    s.movements.push({ id: 'ex-buy-shampoo', productId: 'ex-shampoo', type: 'purchase', date: d(-13), quantity: 5000, unitCost: 0.036, expenseId: 'ex-exp-buy-shampoo', note: 'Compra de exemplo' });
    s.expenses.push({ id: 'ex-exp-buy-shampoo', category: 'products', description: 'Compra de shampoo · exemplo', amount: 180, date: d(-13), due: d(-6), paidDate: d(-6), isOpening: false });
    s.movements.push({ id: 'ex-buy-color', productId: 'ex-color', type: 'purchase', date: d(-13), quantity: 120, unitCost: 0.7, expenseId: 'ex-exp-buy-color', note: 'Compra de exemplo' });
    s.expenses.push({ id: 'ex-exp-buy-color', category: 'products', description: 'Compra de coloração · exemplo', amount: 84, date: d(-13), due: d(-3), paidDate: d(-3), isOpening: false });
    s.bills.push({ id: 'ex-old-debt', clientId: 'c5', description: 'Saldo anterior · exemplo', total: 120, date: d(-45), due: d(-2), isOpening: true });
    s.payments.push({ id: 'ex-opening-signal', clientId: 'c1', billId: null, amount: 80, method: 'Saldo anterior', kind: 'Sinal', date: d(-46), isOpening: true, depositStatus: 'available' });
    const visits = [
        ['c1', ['s2', 's5'], 260, 'Pix'], ['c2', ['s1'], 110, 'Pix'], ['c4', ['s3', 's4'], 480, 'Cartão de crédito'], ['c6', ['s1', 's5'], 160, 'Transferência'],
        ['c5', ['s2', 's4'], 310, 'Cartão de crédito'], ['c8', ['s1'], 110, 'Pix'], ['c2', ['s4', 's5'], 185, 'Cartão de débito'], ['c4', ['s1'], 120, 'Pix'],
        ['c1', ['s3', 's5'], 520, 'Cartão de crédito'], ['c6', ['s2', 's5'], 270, 'Pix'], ['c8', ['s1', 's4'], 210, 'Transferência'], ['c5', ['s5'], 80, 'Pix']
    ];
    visits.forEach(([clientId, serviceIds, total, method], i) => {
        const date = d(i - 12), consumption = [{ productId: 'ex-shampoo', quantity: 18 }, { productId: 'ex-finish', quantity: 3 }];
        if (serviceIds.includes('s2'))
            consumption.push({ productId: 'ex-color', quantity: 45 }, { productId: 'ex-oxidant', quantity: 60 });
        if (serviceIds.includes('s3'))
            consumption.push({ productId: 'ex-powder', quantity: 60 }, { productId: 'ex-oxidant', quantity: 90 });
        if (serviceIds.includes('s4'))
            consumption.push({ productId: 'ex-mask', quantity: 30 });
        if (serviceIds.includes('s5'))
            consumption.push({ productId: 'ex-thermal', quantity: 4 });
        const value = total - (i === 0 ? 80 : i === 9 ? 90 : 0), feeTotal = method.includes('Cartão') ? (i === 8 ? null : amount(cents(value * 0.035))) : null;
        s = closeAttendance(s, { id: 'ex-visit-' + i, clientId, date, serviceIds, total, consumption, depositIds: i === 0 ? ['ex-opening-signal'] : [], formula: serviceIds.includes('s2') || serviceIds.includes('s3') ? 'Fórmula fictícia · sem orientação técnica real' : '', notes: 'Atendimento fictício para demonstrar os indicadores.', followup: i === 8 ? d(3) : i === 9 ? d(7) : '', payment: { value, method, count: method === 'Cartão de crédito' ? 3 : 1, firstDue: dayOffset(2, date), feeTotal } });
    });
    // Realized card settlements are distinct from card sales, including an overdue example.
    s.installments.forEach((i, index) => {
        if (i.due <= today && index % 4 !== 0) {
            i.receivedDate = i.due;
            i.fee = i.fee === null ? amount(cents(i.gross * 0.035)) : i.fee;
            i.receivedNet = amount(cents(i.gross) - cents(i.fee));
        }
    });
    const future = paymentEntries(s, { id: 'ex-future-signal', clientId: 'c6', value: 100, method: 'Pix', kind: 'Sinal', date: d(-1), appointmentId: 'ex-future-appointment' });
    s.payments.push(future.payment);
    s.payments.push({ id: 'ex-old-available-signal', clientId: 'c7', billId: null, amount: 60, method: 'Saldo anterior', kind: 'Sinal', date: d(-46), isOpening: true, depositStatus: 'available' });
    s.payments.push({ ...paymentEntries(s, { id: 'ex-retained-signal', clientId: 'c3', value: 40, method: 'Pix', kind: 'Sinal', date: d(-5) }).payment, depositStatus: 'retained', retainedDate: d(-4), retentionReason: 'Cancelamento fictício confirmado pela profissional.' });
    s.expenses.push({ id: 'ex-space', category: 'space', description: 'Espaço compartilhado · exemplo', amount: 980, date: d(-8), due: d(-4), paidDate: d(-4), isOpening: false, recurringMonth: today.slice(0, 7) });
    s.expenses.push({ id: 'ex-disposable', category: 'disposables', description: 'Luvas e materiais descartáveis · exemplo', amount: 62.5, date: d(-2), due: d(-2), paidDate: d(-2), isOpening: false });
    s.expenses.push({ id: 'ex-old-space', category: 'space', description: 'Conta anterior do espaço · exemplo', amount: 180, date: d(-46), due: d(2), paidDate: null, isOpening: true });
    s.expenses.push({ id: 'ex-pending-supplies', category: 'disposables', description: 'Reposição de materiais · exemplo', amount: 48, date: d(-1), due: d(5), paidDate: null, isOpening: false });
    s.movements.push({ id: 'ex-loss', productId: 'ex-thermal', type: 'loss', date: d(-1), quantity: -5, unitCost: stockOf(s, 'ex-thermal').unitCost, note: 'Perda fictícia para testar o histórico' });
    s.appointments = [
        { id: 'ex-a1', clientId: 'c2', serviceId: 's1', date: today, time: '09:00', duration: 60, buffer: 15, status: 'confirmed', note: 'Agendamento fictício' },
        { id: 'ex-a2', clientId: 'c4', serviceId: 's2', date: today, time: '10:30', duration: 120, buffer: 15, status: 'confirmed', note: 'Agendamento fictício' },
        { id: 'ex-pause', clientId: null, serviceId: null, label: 'Intervalo · exemplo', date: today, time: '12:45', duration: 45, buffer: 0, status: 'blocked', note: 'Bloqueio de exemplo' },
        { id: 'ex-a3', clientId: 'c8', serviceId: 's2', date: today, time: '14:00', duration: 120, buffer: 15, status: 'pending', note: 'A confirmar · exemplo' },
        { id: 'ex-a4', clientId: 'c5', serviceId: 's5', date: today, time: '16:30', duration: 45, buffer: 15, status: 'confirmed', note: 'Agendamento fictício' },
        { id: 'ex-future-appointment', clientId: 'c6', serviceId: 's3', date: d(1), time: '14:00', duration: 180, buffer: 30, status: 'confirmed', note: 'Sinal fictício associado a este atendimento' }
    ];
    s.audit = [{ id: 'ex-audit', at: new Date().toISOString(), action: 'Dados fictícios carregados para exploração', before: '', after: 'Exemplos separados da operação real', by: 'Ambiente de demonstração' }];
    validateState(s);
    return s;
}
