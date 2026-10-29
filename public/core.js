/**
 * Utilitários compartilhados de datas, agenda e CSV, além de fixtures históricas. Regras financeiras atuais pertencem a domain.js.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
/**
 * localDate — Retorna AAAA-MM-DD no fuso America/Sao_Paulo, usado como hoje nas regras do negócio.
 */
export const localDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
/**
 * dayOffset — Soma dias de calendário a uma data ISO usando meio-dia para evitar viradas próximas da meia-noite.
 */
export const dayOffset = (offset, date = localDate()) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/**
 * minutes — Converte HH:MM em minutos desde o início do dia.
 */
export const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
/**
 * clock — Converte minutos em HH:MM para a agenda.
 */
export const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
/**
 * appointmentConflict — Retorna o primeiro compromisso sobreposto na mesma data, incluindo o intervalo; ignora o próprio ID, cancelamentos e faltas.
 */
export function appointmentConflict(items, candidate, ignoreId) {
    return appointmentConflicts(items, candidate, ignoreId)[0];
}
/** Todos os compromissos que se sobrepõem ao candidato (mesma regra de appointmentConflict). */
export function appointmentConflicts(items, candidate, ignoreId) {
    const start = minutes(candidate.time), end = start + Number(candidate.duration) + Number(candidate.buffer || 0);
    return items.filter(a => a.id !== ignoreId && a.date === candidate.date && !['cancelled', 'absent'].includes(a.status) && start < minutes(a.time) + Number(a.duration) + Number(a.buffer || 0) && end > minutes(a.time));
}
/**
 * receivedFor — Soma valores aceitos ligados à cobrança no modelo legado; não mede entrada efetiva de caixa de cartão.
 */
export const receivedFor = (bill, payments) => payments.filter(p => p.billId === bill.id).reduce((s, p) => s + Number(p.amount), 0);
/**
 * balanceFor — Calcula saldo da cobrança no modelo legado, limitado a zero.
 */
export const balanceFor = (bill, payments) => Math.max(0, Math.round((bill.total - receivedFor(bill, payments)) * 100) / 100);
/**
 * parseCSV — Lê CSV separado por vírgula ou ponto e vírgula, preservando delimitadores e quebras em campos entre aspas; rejeita aspas sem fechamento.
 */
export function parseCSV(text) {
    const rows = [];
    let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (quoted && text[i + 1] === '"') {
                value += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if ((ch === ',' || ch === ';') && !quoted) {
            row.push(value);
            value = '';
        }
        else if ((ch === '\n' || ch === '\r') && !quoted) {
            if (ch === '\r' && text[i + 1] === '\n')
                i++;
            row.push(value);
            if (row.some(v => v.trim()))
                rows.push(row);
            row = [];
            value = '';
        }
        else
            value += ch;
    }
    if (quoted)
        throw new Error('Há aspas sem fechamento no arquivo.');
    row.push(value);
    if (row.some(v => v.trim()))
        rows.push(row);
    return rows;
}
/**
 * csvCell — Escapa aspas e neutraliza prefixos de fórmula ao exportar uma célula CSV.
 */
export const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""').replace(/^[=+@\-\t\r]/, "'$&") + '"';
/**
 * demoState — Cria fixtures históricas de demonstração e catálogo inicial; não deve ser gravado diretamente como operação real.
 */
export function demoState() {
    const d = localDate(), past = n => dayOffset(-n, d);
    return { schema: 1, focus: false, settings: { name: 'Hanne', open: '09:00', close: '19:00', closedDays: [0], responseMinutes: 60, notifications: true },
        clients: [
            { id: 'c1', name: 'Mariana Costa', phone: '(41) 90000-0001', status: 'permanent', color: 'rose', note: 'Prefere tons quentes e acabamento natural.', alert: 'Sensibilidade relatada após o último procedimento.', alertDate: past(1) },
            { id: 'c2', name: 'Beatriz Almeida', phone: '(41) 90000-0002', status: 'permanent', color: 'olive', note: 'Prefere atendimento no período da manhã.', alert: '' },
            { id: 'c3', name: 'Camila Ribeiro', phone: '(41) 90000-0003', status: 'temporary', color: 'sand', note: 'Novo contato. Cadastro ainda não confirmado.', alert: '' },
            { id: 'c4', name: 'Juliana Martins', phone: '(41) 90000-0004', status: 'permanent', color: 'lilac', note: 'Gosta de corte com movimento.', alert: '' },
            { id: 'c5', name: 'Fernanda Lima', phone: '(41) 90000-0005', status: 'permanent', color: 'blue', note: 'Manutenção de cor a cada 6 semanas.', alert: '' },
            { id: 'c6', name: 'Ana Clara Souza', phone: '(41) 90000-0006', status: 'permanent', color: 'peach', note: 'Prefere finalizar com ondas suaves.', alert: '' },
            { id: 'c7', name: 'Luiza Santos', phone: '(41) 90000-0007', status: 'temporary', color: 'olive', note: 'Aguardando informações para orçamento.', alert: '' }
        ],
        services: [
            { id: 's1', name: 'Corte & finalização', duration: 60, buffer: 15, description: 'Corte personalizado com lavagem e finalização.', products: 'Shampoo e condicionador profissionais', before: 'Compartilhar referências do corte desejado.', after: 'Manter os cuidados combinados com a profissional.', required: 'Observações técnicas' },
            { id: 's2', name: 'Coloração', duration: 120, buffer: 15, description: 'Cor personalizada, com avaliação prévia do histórico capilar.', products: 'Coloração e oxidante definidos na avaliação', before: 'Informar procedimentos químicos anteriores.', after: 'Seguir as orientações individuais registradas na ficha.', required: 'Fórmula e cor; produtos utilizados' },
            { id: 's3', name: 'Mechas & iluminação', duration: 180, buffer: 30, description: 'Iluminação e tonalização definidas após avaliação profissional.', products: 'Produtos definidos na avaliação', before: 'Trazer referências e histórico de procedimentos.', after: 'Seguir a rotina de cuidados orientada no atendimento.', required: 'Fórmula e cor; produtos utilizados; observações técnicas' },
            { id: 's4', name: 'Tratamento capilar', duration: 60, buffer: 15, description: 'Ritual de cuidado escolhido conforme avaliação profissional.', products: 'Máscara profissional', before: 'Informar sensibilidades conhecidas.', after: 'Seguir os cuidados indicados pela profissional.', required: 'Produtos utilizados' },
            { id: 's5', name: 'Escova & styling', duration: 45, buffer: 15, description: 'Lavagem, escova e acabamento personalizado.', products: 'Protetor térmico', before: 'Compartilhar o acabamento desejado.', after: 'Evitar umidade imediatamente após a finalização.', required: 'Observações técnicas' }
        ],
        appointments: [
            { id: 'a1', clientId: 'c2', serviceId: 's1', date: d, time: '09:00', duration: 60, buffer: 15, status: 'confirmed', note: '' },
            { id: 'a2', clientId: 'c4', serviceId: 's2', date: d, time: '10:30', duration: 120, buffer: 15, status: 'confirmed', note: 'Conferir fórmula da última visita.' },
            { id: 'a3', clientId: null, serviceId: null, label: 'Pausa para respirar', date: d, time: '12:45', duration: 45, buffer: 0, status: 'blocked', note: 'Almoço' },
            { id: 'a4', clientId: 'c6', serviceId: 's3', date: d, time: '14:00', duration: 180, buffer: 30, status: 'confirmed', note: 'Avaliação presencial antes do procedimento.' },
            { id: 'a5', clientId: 'c5', serviceId: 's5', date: d, time: '17:30', duration: 45, buffer: 15, status: 'pending', note: '' },
            { id: 'a6', clientId: 'c1', serviceId: 's4', date: dayOffset(1, d), time: '10:00', duration: 60, buffer: 15, status: 'confirmed', note: '' }
        ],
        conversations: [
            { id: 'v1', clientId: 'c1', category: 'Segurança', status: 'open', time: '08:43', unread: true, summary: 'Mariana relatou sensibilidade após o procedimento de ontem. Precisa de avaliação direta da profissional.', messages: [{ text: 'Oi, Hanne! Senti sensibilidade no couro cabeludo depois do procedimento de ontem. Você pode falar comigo?', time: '08:43', type: 'incoming' }], draft: 'Oi, Mariana. Recebi seu relato e vou avaliar a situação com você. Pode me contar quando começou e como está agora?' },
            { id: 'v2', clientId: 'c3', category: 'Orçamento', status: 'open', time: '08:35', unread: true, summary: 'Camila quer iluminar o cabelo. Ainda faltam o histórico químico e as referências para avaliação.', messages: [{ text: 'Bom dia! Queria saber mais sobre mechas e iluminação 😊', time: '08:34', type: 'incoming' }, { text: 'Você consegue me passar um orçamento?', time: '08:35', type: 'incoming' }], draft: 'Oi, Camila! Para eu avaliar seu pedido, você pode me contar quais procedimentos já fez no cabelo e enviar uma foto atual e suas referências?' },
            { id: 'v3', clientId: 'c4', category: 'Agendamento urgente', status: 'open', time: '08:22', unread: false, summary: 'Juliana pede conferência do horário de hoje. O compromisso continua registrado às 10h30.', messages: [{ text: 'Hanne, pode conferir meu horário de hoje? Acho que anotei errado.', time: '08:22', type: 'incoming' }], draft: 'Oi, Juliana! Vou conferir seu agendamento e já te retorno.' },
            { id: 'v4', clientId: 'c5', category: 'Pós-procedimento', status: 'open', time: '08:10', unread: false, summary: 'Fernanda pediu para relembrar os cuidados combinados na última visita.', messages: [{ text: 'Bom dia! Você pode me lembrar dos cuidados que combinamos na última visita?', time: '08:10', type: 'incoming' }], draft: 'Oi, Fernanda! Vou consultar sua ficha para retomar os cuidados que combinamos.' },
            { id: 'v5', clientId: 'c7', category: 'Orçamento', status: 'waiting', time: 'Ontem', unread: false, summary: 'Luiza deseja um orçamento de coloração. Aguardando mais informações.', messages: [{ text: 'Gostaria de mudar a cor. Como funciona a avaliação?', time: '17:12', type: 'incoming' }], draft: '' },
            { id: 'v6', clientId: 'c2', category: 'Informações gerais', status: 'resolved', time: 'Ontem', unread: false, summary: 'Beatriz recebeu as informações de chegada.', messages: [{ text: 'Obrigada, Hanne! Até amanhã.', time: '18:03', type: 'incoming' }], draft: '' }
        ],
        quotes: [{ id: 'q1', clientId: 'c3', serviceId: 's3', status: 'missing', value: null, date: d, notes: 'Faltam histórico químico e referências.', question: 'Quais procedimentos você já fez no cabelo? Pode enviar uma foto atual e referências?', photos: [] }, { id: 'q2', clientId: 'c7', serviceId: 's2', status: 'review', value: null, date: past(1), notes: 'Avaliar histórico antes de definir o procedimento e o valor.', question: '', photos: [] }, { id: 'q3', clientId: 'c6', serviceId: 's3', status: 'approved', value: 480, date: past(3), notes: 'Proposta avaliada manualmente pela profissional.', question: '', photos: [] }],
        bills: [{ id: 'b1', clientId: 'c6', description: 'Mechas & iluminação', total: 480, date: d, due: d }, { id: 'b2', clientId: 'c4', description: 'Coloração', total: 220, date: d, due: d }, { id: 'b3', clientId: 'c2', description: 'Corte & finalização', total: 110, date: d, due: d }, { id: 'b4', clientId: 'c5', description: 'Tratamento capilar', total: 140, date: past(4), due: past(2) }],
        payments: [{ id: 'p1', billId: 'b1', amount: 100, date: past(2), method: 'Pix', kind: 'Sinal' }, { id: 'p2', billId: 'b3', amount: 110, date: d, method: 'Pix', kind: 'Pagamento' }, { id: 'p3', billId: 'b4', amount: 80, date: past(4), method: 'Cartão de crédito', kind: 'Pagamento' }],
        records: [{ id: 'r1', clientId: 'c1', serviceId: 's2', date: past(1), formula: '7.3 + 7.0 · oxidante 20 vol.', products: 'Coloração profissional', notes: 'Fórmula fictícia, apenas para demonstração.', followup: dayOffset(1, d) }, { id: 'r2', clientId: 'c5', serviceId: 's2', date: past(35), formula: '6.0 + 6.7', products: 'Coloração profissional', notes: 'Cliente satisfeita com a cor.', followup: d }, { id: 'r3', clientId: 'c4', serviceId: 's1', date: past(40), formula: '', products: 'Shampoo e finalizador', notes: 'Camadas longas, preservando o comprimento.', followup: dayOffset(5, d) }],
        tasks: [{ id: 't1', title: 'Avaliar relato da Mariana', area: 'Atendimento', priority: 'Alta', due: d, done: false, clientId: 'c1' }, { id: 't2', title: 'Revisar orçamento da Camila', area: 'Atendimento', priority: 'Média', due: d, done: false, clientId: 'c3' }, { id: 't3', title: 'Acompanhar manutenção da Fernanda', area: 'Clientes', priority: 'Média', due: d, done: false, clientId: 'c5' }, { id: 't4', title: 'Conferir saldo pendente do tratamento', area: 'Financeiro', priority: 'Baixa', due: past(1), done: false, clientId: 'c5' }], audit: [] };
}
