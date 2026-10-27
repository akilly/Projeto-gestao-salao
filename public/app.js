import { validateVisibleControls } from './form-validation.js';
import { deletionPlan, allCollections } from './deletion.js';
/**
 * Interface do ateliê. Fluxo: bootstrap carrega API; render desenha a página; eventos data-action/data-form alteram estado; queueSave/flushSave persistem com revisão. O canal WhatsApp usa APIs próprias e armazenamento separado do financeiro. Valores dos usuários passam por esc antes de compor HTML.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { destinationHref, parseDestination, validCalendarDate, recordPage } from './navigation.js';
import { createBooking, validateClientContact, matchingClient, validateBookingSlot } from './booking.js';
import { detailViews } from './destinations-ui.js';
import { createWhatsAppUI } from './whatsapp.js';
import { attendanceSummary, previousConsumption, ensureSpaceExpense, rollMonth } from './routine.js?v=records-1';
import { preferredTheme, applyTheme } from './theme.js';
import { blankState, stockOf, metrics, periodOf, closeAttendance, paymentEntries, billBalance, billPaid, availableDeposits, cardMethod, METHODS, cents, amount, qty, validateState, retainDeposit } from './domain.js';
import { localDate, dayOffset, minutes, clock, appointmentConflict, balanceFor, receivedFor, parseCSV, csvCell } from './core.js';
// Catálogo SVG local; coordenadas são dados visuais e não regras de negócio.
const icons = { grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z M7 10h9 M7 14h5', calendar: 'M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z M7 3v4 M17 3v4 M3 10h18 M7 14h2 M13 14h3 M7 17h2', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87', scissors: 'M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M6 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M8.1 7.1 21 20 M8.1 16.9 21 4 M12 12h.01', wallet: 'M21 8H5a2 2 0 0 1 0-4h14v4 M3 6v13a2 2 0 0 0 2 2h16V8 M21 12h-6v5h6 M17 14.5h.01', file: 'M14 2H5v20h14V7Z M14 2v6h5 M8 12h8 M8 16h6', checklist: 'M9 5h12 M9 12h12 M9 19h12 M2 4l2 2 3-3 M2 11l2 2 3-3 M2 18l2 2 3-3', settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M10 2h4l1 3 3 1 3-1 2 4-2 3v2l2 3-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-3v-2L1 9l2-4 3 1 3-1Z', help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3 M12 17h.01', search: 'M21 21l-5-5 M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4', plus: 'M12 5v14 M5 12h14', arrow: 'M5 12h14 M14 7l5 5-5 5', chevron: 'm9 5 7 7-7 7', left: 'm15 5-7 7 7 7', down: 'm6 9 6 6 6-6', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 6v6l4 2', moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4', spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z M20 2v4 M18 4h4', shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z M8 12l3 3 5-6', leaf: 'M20 3C9 2 2 6 4 14c2 7 16 7 16-11Z M4 20 16 8', check: 'm5 12 4 4L19 6', download: 'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4', upload: 'M12 16V4 M7 9l5-5 5 5 M4 17v4h16v-4', close: 'm6 6 12 12 M6 18 18 6', edit: 'm15 4 5 5 M4 16l-1 5 5-1L21 7a2.8 2.8 0 0 0-4-4Z', copy: 'M8 8h13v13H8z M16 8V3H3v13h5', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 11v6 M12 7h.01', warning: 'M12 3 1 21h22Z M12 9v5 M12 17h.01', dots: 'M5 12h.01 M12 12h.01 M19 12h.01', menu: 'M3 6h18 M3 12h18 M3 18h18', coffee: 'M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z M17 8h2a3 3 0 0 1 0 6h-2 M7 2v3 M12 2v3', lock: 'M5 10h14v12H5z M8 10V6a4 4 0 0 1 8 0v4', link: 'm10 14 4-4 M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0', image: 'M3 3h18v18H3Z m3 14 4-5 4 4 3-3 4 4 M8 7h.01', heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', print: 'M6 8V2h12v6 M6 17H3V8h18v9h-3 M6 13h12v9H6Z', undo: 'M3 3v6h6 M3 9a9 9 0 1 1 0 6' };
/**
 * icon — Produz o SVG de um ícone do catálogo local, com alternativa para nome desconhecido.
 */
const icon = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n] || icons.file}"/></svg>`;
/**
 * esc — Escapa texto inserido em HTML e atributos para impedir que dados do usuário sejam interpretados como marcação.
 */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/**
 * money — Formata valores em reais para leitura na interface; não realiza cálculo financeiro.
 */
const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/**
 * fmt — Formata uma data ISO ao meio-dia para exibição em português.
 */
const fmt = (v, opts = { day: '2-digit', month: 'short' }) => new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', opts);
/**
 * longDate — Exibe a data por extenso com dia da semana.
 */
const longDate = v => fmt(v, { weekday: 'long', day: 'numeric', month: 'long' });
/**
 * initials — Extrai até duas iniciais do nome para o avatar.
 */
const initials = n => n.split(' ').filter(Boolean).map(x => x[0]).slice(0, 2).join('');
/**
 * uid — Gera um identificador único para um novo registro.
 */
const uid = () => crypto.randomUUID();
// Tema é preferência do dispositivo e não altera o snapshot financeiro.
let theme = applyTheme(preferredTheme(globalThis.localStorage), document.documentElement, null);

/** Alternância explícita com estado acessível para teclado e leitor de tela. */
function themeControl() {
    return `<div class="theme-control" role="group" aria-label="Tema da interface">${[['light', 'sun', 'Claro'], ['dark', 'moon', 'Escuro']].map(([value, symbol, label]) => `<button type="button" data-action="v5-theme" data-theme="${value}" aria-label="Tema ${label.toLowerCase()}" aria-pressed="${theme === value}" class="${theme === value ? 'active' : ''}">${icon(symbol)}<span>${label}</span></button>`).join('')}</div>`;
}

// Seleciona base real ou exemplo a partir da URL e da preferência local, sem copiar registros entre bases.
// Os dados reais são o padrão: a demonstração só abre por escolha explícita, evitando registros reais na base fictícia.
let dataset = 'real';
try {
    const mode = new URLSearchParams(location.search).get('dados'), saved = localStorage.getItem('hanne-data-view');
    dataset = mode === 'reais' ? 'real' : mode === 'exemplo' ? 'example' : saved === 'example' ? 'example' : 'real';
}
catch { }
/**
 * stateURL — Escolhe a API da base real ou da demonstração sem misturar os registros.
 */
const stateURL = () => dataset === 'example' ? '/api/state?dataset=example' : '/api/state';
// Estado de trabalho em memória e controle da revisão confirmada. Em caso de conflito, o rascunho continua em memória para recuperação.
let state = blankState(), revision = 0, confirmedState = structuredClone(state), syncStatus = 'loading', syncError = '', saving = false, savePending = false, lastSavedAt = null, lastSaveMessage = '';
// Filtros e navegação transitórios; não representam registros financeiros.
const ui = { month: localDate().slice(0, 7), financeTab: 'bills', inventoryTab: 'products', page: 'dashboard', dashTab: 'all', date: localDate(), agendaView: 'day', clientFilter: 'all', clientQuery: '', clientView: 'table', convFilter: 'all', conversationId: 'v1', threadOpen: false, quoteFilter: 'all', taskFilter: 'open', financePeriod: 'month', profileTab: 'overview', recordsMode: 'day', recordsDate: localDate(), recordsService: '', recordsSet: '', recordsClient: '', recordsPage: 1, financeScope: '', financeDate: '', financePageIndex: 1, inventoryPageIndex: 1, inventoryScope: '', agendaStatus: '', recordsMonth: localDate().slice(0, 7), serviceTab: 'records', mobile: false };
// WhatsApp compartilha campos, diálogos e feedback, mas não usa a fila financeira.
let whatsappPending = 0;
ui.inboxView = dataset === 'real' ? 'whatsapp' : 'notes';
const whatsapp = createWhatsAppUI({ esc, btn: (...args) => btn(...args), field: (...args) => field(...args), openForm, modal, closeModal, toast, validate: validateVisibleControls,
    isExample: () => dataset === 'example',
    confirmLeaving: proceed => confirmLeaving('Há um rascunho de mensagem. Deseja sair desta tela?', proceed),
    onPending: count => { whatsappPending = count; for (const el of document.querySelectorAll?.('[data-pending-total]') || []) { const total = pendingConvs().length + count; el.textContent = total; el.hidden = !total; } for (const el of document.querySelectorAll?.('[data-wa-pending]') || []) el.textContent = count; for (const el of document.querySelectorAll?.('[data-indicator="pending-conversations"]') || []) el.textContent = pendingConvs().length + count; const trigger = document.querySelector?.('[data-action="v4-open-pending"]'); trigger?.setAttribute('aria-label', `${pendingConvs().length + count} atendimentos pendentes: abrir conversas`); }
});
whatsapp.install();
// O mês anterior serve apenas para acompanhar o calendário sem interromper consultas históricas.
let currentCalendarMonth = localDate().slice(0, 7), currentCalendarDate = localDate();
let currentDetailTarget = null, leaveConfirmation = null, modalOpener = null, modalReturnHref = null;

/** Explica as ações e os conceitos da tela atual, sem exigir a leitura de um manual separado. */
function pageGuide() {
    const guides = {
        dashboard: ['Comece pela agenda e conclua cada visita logo após o atendimento.', [['Rotina do dia', 'Agenda → Concluir → conferir produtos → informar pagamento. Estoque, cobrança e ranking são atualizados juntos.'], ['Pendências', 'Atendimentos pendentes são contatos que precisam de resposta. A confirmar são horários da agenda ainda não confirmados.'], ['Seu dinheiro', 'Recebido é o dinheiro que entrou; resultado de caixa é recebido menos despesas pagas. Os saldos a receber incluem todas as datas.']]],
        agenda: ['Abra a visita e toque em Concluir para aproveitar os dados do agendamento.', [['Agendar', 'Reserva cliente, serviço, duração e intervalo. O sistema verifica conflitos de horário.'], ['Concluir', 'Leva cliente, data e serviço para o fechamento e mantém a duração reservada na agenda. Confira os procedimentos realmente realizados.'], ['Remarcar ou cancelar', 'Altera a agenda. Havendo sinal, confira o destino desse valor no Financeiro.']]],
        services: ['Veja as visitas do dia ou do mês; o histórico inteiro continua alimentando os resultados acumulados.', [['Dia e mês', 'A consulta começa em Hoje. Escolha uma data, Mês inteiro ou Todo o histórico. Trocar o filtro não apaga registros.'], ['Contagem e valores', 'Uma visita com corte e coloração conta uma vez em cada serviço. Seu preço fica no conjunto “corte + coloração”, sem rateio. Valor cobrado é diferente de dinheiro recebido.'], ['Abrir os registros', 'Toque no atendimento para ver a ficha; no total para ver cobrança e pagamentos; na data para abrir a agenda. Ranking e conjuntos abrem as visitas correspondentes.']]],
        finance: ['Confira os valores em aberto e confirme somente os pagamentos que realmente aconteceram.', [['Clientes, sinais e cartões', 'Receber registra o pagamento da cliente. Sinal pode ser aplicado uma vez ao atendimento. Venda no cartão gera repasses previstos; confirme o líquido quando entrar.'], ['Despesas', 'Em aberto é uma conta ainda não paga. A conta fixa do espaço é criada uma vez no mês ao acessar o sistema, após configurar valor e vencimento.'], ['Indicadores', 'O período filtra dinheiro recebido e despesas pagas. Compra de produto é despesa; o custo de consumo é informativo para evitar descontar a mesma compra duas vezes.']]],
        inventory: ['Cadastre o saldo real dos produtos e registre as compras ou perdas quando acontecerem.', [['Saldo inicial', 'Quantidade que já existe, inclusive embalagens abertas. Informe g, ml ou unidades e custo conhecido, sem gerar uma nova compra.'], ['Compra e perda', 'Compra registra entrada e despesa juntas. Perda reduz o estoque. O consumo é baixado ao confirmar um atendimento.'], ['Custo a conferir', 'Significa que falta informação de custo; não é tratado como custo zero.']]],
        clients: ['Abra o nome da cliente para consultar visitas, fichas e valores a receber.', [['Cadastro', 'Mantenha nome e telefone corretos para reaproveitar na agenda. Cadastros temporários precisam de revisão.'], ['Histórico', 'Reúne os atendimentos confirmados da cliente, inclusive os de meses anteriores.'], ['Importação', 'O CSV permite trazer clientes após conferir os campos e as associações.']]],
        conversations: ['Organize os contatos que precisam de resposta e registre o próximo passo.', [['Pendentes', 'Contatos ainda não resolvidos aparecem no contador da tela inicial.'], ['Resolver', 'Conclua o contato quando a demanda tiver sido atendida. Isso não finaliza um serviço da agenda.'], ['WhatsApp e notas', 'WhatsApp recebe e envia após instalar o conector Baileys e ler o QR Code. O conector precisa continuar ligado. Notas internas ficam no sistema. A conversa mostra o status do envio.']]],
        quotes: ['Registre o pedido da cliente e acompanhe a avaliação antes de combinar o atendimento.', [['Informações', 'Confira o que falta, as referências e os detalhes técnicos necessários.'], ['Avaliação', 'Atualize a situação para acompanhar o andamento do orçamento.'], ['Próximo passo', 'Depois de combinar os procedimentos, agende a visita. O preço final será informado no fechamento.']]],
        tasks: ['Use para lembrar atividades que precisam de acompanhamento.', [['Pendente', 'Atividade ainda não concluída. Prazo passado aparece como atraso.'], ['Concluir', 'Marque o círculo quando terminar; a atividade fica disponível no filtro Concluídas.'], ['Responsabilidade', 'As tarefas são lembretes dentro do sistema, sem envio automático de notificações externas.']]],
        setup: ['Configure uma vez e traga somente os saldos que ainda existem.', [['Data de início', 'Define quando começa a nova operação e fica bloqueada após a confirmação.'], ['Conta do espaço', 'Informe o valor fixo e o vencimento. O mês atual será criado em aberto; os próximos serão gerados ao abrir ou retomar o sistema no mês. Meses antigos exigem registro manual.'], ['Abertura', 'Confira estoque, dívidas, sinais, repasses e contas anteriores sem inventar novos recebimentos.']]],
        settings: ['Ajuste o funcionamento e consulte a preparação da operação.', [['Horários', 'Abertura, fechamento e dias de descanso orientam a disponibilidade da agenda.'], ['Preparar operação', 'Define início, valor fixo do espaço e vencimento. Alterar o valor vale para contas futuras; contas já criadas são preservadas.'], ['Seus dados', 'Confira o indicador de sincronização. Os exemplos e os dados reais ficam em bases separadas.']]]
    };
    const guide = guides[ui.page];
    return guide ? `<details class="page-guide"><summary>${icon('help')}<span>Como usar esta tela</span>${icon('down')}</summary><div><p>${esc(guide[0])}</p><dl>${guide[1].map(([title, text]) => `<div><dt>${esc(title)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl></div></details>` : '';
}

/** Atualiza só os filtros em uso e gera a despesa atual sem duplicar nem quitar contas. */
function refreshRoutine() {
    const today = localDate(), month = today.slice(0, 7), dayChanged = today !== currentCalendarDate;
    if (dayChanged) { if (ui.recordsDate === currentCalendarDate) ui.recordsDate = today; currentCalendarDate = today; }
    const changed = month !== currentCalendarMonth;
    if (changed) {
        ui.month = rollMonth(ui.month, currentCalendarMonth, month);
        ui.recordsMonth = rollMonth(ui.recordsMonth, currentCalendarMonth, month);
        currentCalendarMonth = month;
    }
    if (syncStatus === 'saved' && !saving && !savePending) {
        const result = ensureSpaceExpense(state);
        if (result.expense) {
            validateState(result.state, state);
            state = result.state;
            audit('Conta do espaço gerada automaticamente · ' + month);
            persist('Conta do espaço criada em aberto. Confirme o pagamento quando acontecer.');
            // Não reconstrói um formulário enquanto a pessoa preenche um atendimento.
            if (!document.getElementById('dialog')) render();
            return;
        }
    }
    if ((changed || dayChanged) && !document.getElementById('dialog') && syncStatus !== 'loading') render();
}
/**
 * client — Localiza a cliente no estado atual; devolve rótulo de bloqueio quando não há vínculo.
 */
const client = id => state.clients.find(c => c.id === id) || { name: 'Bloqueio de horário', color: 'sand' };
/**
 * service — Localiza o serviço ou os dados padrão de um bloqueio de agenda.
 */
const service = id => state.services.find(s => s.id === id) || { name: 'Bloqueio', duration: 30, buffer: 0 };
/**
 * avatar — Renderiza o avatar com nome e cor escapados.
 */
const avatar = (c, size = '') => `<span class="avatar ${esc(c.color || 'olive')} ${size}" aria-hidden="true">${esc(initials(c.name))}</span>`;
/**
 * pill — Renderiza uma etiqueta visual de texto com indicador opcional.
 */
const pill = (t, color = 'gray', dot = false) => `<span class="pill ${color}">${dot ? '<i class="dot"></i>' : ''}${esc(t)}</span>`;
/**
 * btn — Monta botão com ação delegada por data-action; o conteúdo de texto é definido pelos chamadores.
 */
const btn = (t, action, ic = '', type = 'secondary', extra = '') => `<button type="button" class="btn ${type}" data-action="${action}" ${extra}>${ic ? icon(ic) : ''}${t}</button>`;
/**
 * iconBtn — Monta botão de ícone com nome acessível e atributos auxiliares.
 */
const iconBtn = (n, action, label, extra = '') => { const match = extra.match(/class="([^"]*)"/); return `<button type="button" class="icon-btn ${match?.[1] || ''}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra.replace(/class="[^"]*"/, '')}>${icon(n)}</button>`; };
/**
 * empty — Renderiza uma mensagem de lista vazia.
 */
const empty = (title, text = '', ic = 'leaf') => `<div class="empty">${icon(ic)}<strong>${esc(title)}</strong>${esc(text)}</div>`;
/**
 * pendingConvs — Conta como pendente toda conversa que ainda não está resolvida, inclusive as que aguardam retorno.
 */
const pendingConvs = () => state.conversations.filter(v => v.status !== 'resolved');
/**
 * plural — Concorda o substantivo com a quantidade exibida.
 */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/**
 * overdueItems — Reúne despesas vencidas sem pagamento, cobranças de clientes com saldo após o vencimento e repasses de cartão atrasados.
 */
function overdueItems() {
    const today = localDate();
    const expenses = state.expenses.filter(e => !e.paidDate && e.due && e.due < today);
    const bills = state.bills.filter(b => !b.cancelled && b.due && b.due < today && billBalance(state, b) > 0);
    const card = state.installments.filter(i => !i.receivedDate && i.due && i.due < today);
    return { expenses, bills, card, total: expenses.length + bills.length + card.length };
}
/**
 * overdueRows — Linhas clicáveis das pendências financeiras vencidas, usadas no painel e na central de alertas.
 */
function overdueRows(limit = 6) {
    const o = overdueItems(), rows = [
        ...o.expenses.map(e => [e.due, destinationLink(`${icon('warning')}<span class="grow">${esc(e.description)}<small class="table-sub">Conta vencida em ${fmt(e.due)}</small></span>${pill(money(e.amount), 'red')}`, { page: 'finance', expense: e.id }, 'task-row attention-button')]),
        ...o.bills.map(b => [b.due, destinationLink(`${icon('users')}<span class="grow">${esc(client(b.clientId).name)}<small class="table-sub">${esc(b.description)} · venceu em ${fmt(b.due)}</small></span>${pill(money(billBalance(state, b)), 'orange')}`, { page: 'finance', bill: b.id }, 'task-row attention-button')]),
        ...o.card.map(i => [i.due, destinationLink(`${icon('wallet')}<span class="grow">Repasse do cartão ${i.number}/${i.count}<small class="table-sub">Previsto para ${fmt(i.due)} · confirme o recebimento</small></span>${pill(money(i.gross), 'orange')}`, { page: 'finance', installment: i.id }, 'task-row attention-button')]),
    ].sort((a, b) => a[0].localeCompare(b[0]));
    return rows.slice(0, limit).map(r => r[1]).join('') + (rows.length > limit ? `<p class="small muted">E mais ${plural(rows.length - limit, 'pendência', 'pendências')} no Financeiro.</p>` : '');
}
/**
 * lowStock — Produtos com saldo igual ou abaixo do mínimo configurado.
 */
const lowStock = () => state.products.filter(p => stockOf(state, p.id).quantity <= p.minimum);
/**
 * lowStockRow — Linha de alerta que abre o estoque do produto.
 */
const lowStockRow = p => `<button class="task-row attention-button" data-action="v2-product-detail" data-id="${p.id}">${icon('warning')}<span class="grow">${esc(p.name)}<small class="table-sub">Estoque baixo</small></span>${pill(stockNumber(stockOf(state, p.id).quantity) + ' ' + p.unit, 'red')}</button>`;
/**
 * alertCount — Total exibido no sino: conversas prioritárias, vencidos e estoque baixo.
 */
const alertCount = () => pendingConvs().filter(v => ['Segurança', 'Agendamento urgente', 'Reclamação'].includes(v.category)).length + overdueItems().total + lowStock().length;
/**
 * activeAppts — Seleciona e ordena compromissos do dia, excluindo cancelamentos e faltas.
 */
const activeAppts = (date = ui.date) => state.appointments.filter(a => a.date === date && !['cancelled', 'absent'].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time));
/**
 * categoryColor — Associa a categoria de atendimento a uma cor de prioridade.
 */
const categoryColor = cat => cat === 'Segurança' ? 'red' : cat === 'Agendamento urgente' ? 'orange' : cat === 'Orçamento' ? 'orange' : cat === 'Pós-procedimento' ? 'green' : cat === 'Reclamação' ? 'red' : 'gray';
// Traduções dos estados de agenda para a interface.
const statusLabel = { confirmed: 'Confirmado', pending: 'A confirmar', completed: 'Concluído', cancelled: 'Cancelado', absent: 'Não compareceu', blocked: 'Bloqueio' };
// Traduções dos estados do orçamento.
const quoteLabel = { missing: 'Faltam informações', review: 'Em avaliação', approved: 'Avaliado', closed: 'Encerrado' };
// Temporizador da mensagem de confirmação exibida no navegador.
let toastTimer;
/**
 * toast — Exibe uma confirmação temporária e substitui o temporizador anterior.
 */
function toast(t) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4000); }
/**
 * persist — Solicita gravação do estado atual; a fila central controla validação e concorrência.
 */
function persist(message, form = null) { const accepted = queueSave(message); if (accepted && form?.dataset) form.dataset.dirty = ''; return accepted; }
/**
 * audit — Registra a intenção da alteração para a próxima gravação auditada pelo servidor.
 */
function audit(action, before = '', after = '') { state.audit.unshift({ id: uid(), at: new Date().toISOString(), action, before, after, by: dataset === 'example' ? 'Profissional · demonstração' : 'Profissional' }); state.audit = state.audit.slice(0, 200); }
/**
 * go — Troca a página e reinicia elementos temporários de navegação.
 */
function go(page) { navigateTo({ page }); }

/** Link nativo: nova aba e copiar endereço continuam funcionando; ativação comum usa o roteador local. */
function destinationLink(content, target, classes = 'name-link', label = '') {
    return `<a class="destination-link ${classes}" href="${esc(destinationHref(target))}" data-action="v7-route" data-route="${esc(JSON.stringify(target))}" ${label ? `aria-label="${esc(label)}"` : ''}>${content}</a>`;
}

/** Filtros da lista de procedimentos; nunca inclui valores de formulário ou dados pessoais na URL. */
function recordsDestination(overrides = {}) {
    return { page: 'services', mode: ui.recordsMode, date: ui.recordsDate, month: ui.recordsMonth, service: ui.recordsService, set: ui.recordsSet, client: ui.recordsClient, p: ui.recordsPage, ...overrides };
}

/** Estado de navegação compartilhado para links, atualização de URL e retorno pelo navegador. */
function currentDestination() {
    if (ui.page === 'services') return { ...recordsDestination(), tab: ui.serviceTab };
    if (ui.page === 'finance') return { page: 'finance', tab: ui.financeTab, month: ui.month, date: ui.financeDate, scope: ui.financeScope, p: ui.financePageIndex };
    if (ui.page === 'agenda') return { page: 'agenda', date: ui.date, status: ui.agendaStatus };
    if (ui.page === 'inventory') return { page: 'inventory', tab: ui.inventoryTab, movement: ui.inventoryScope, month: ui.month, p: ui.inventoryPageIndex };
    return { page: ui.page };
}

/** Encaminha a consulta ao proprietário do registro; nenhuma navegação confirma uma operação. */
function openDestinationDetail(target) {
    if (['record', 'bill', 'payment', 'expense', 'installment', 'appointment', 'product'].some(key => target[key]) || target.page === 'clients' && target.client) currentDetailTarget = target;
    const views = detailViews({ state: () => state, esc, money, fmt, link: destinationLink, modal, btn, client, service, billBalance, billPaid, stockNumber });
    if (target.record) return views.record(target.record);
    if (target.bill) return views.bill(target.bill);
    if (target.payment) return views.payment(target.payment);
    if (target.expense) return views.expense(target.expense);
    if (target.installment) return views.installment(target.installment);
    if (target.appointment) {
        const a = state.appointments.find(a => a.id === target.appointment);
        return a ? appointmentDetail(a.id) : views.missing();
    }
    if (target.page === 'clients' && target.client) return state.clients.some(c => c.id === target.client) ? profile(target.client) : views.missing();
    if (target.product) return state.products.some(p => p.id === target.product) ? productDetail(target.product) : views.missing();
}

/** Muda apenas filtros e destino; a fotografia do contexto permite voltar sem perder a consulta. */
function navigateTo(target, { replace = false, restored = null, discarded = false, scrollY = 0 } = {}) {
    if (!target?.page) return;
    if (!discarded && document.querySelector?.('#dialog form')?.dataset.dirty === 'true') {
        confirmLeaving('Há alterações nesta ficha que ainda não foram salvas. Deseja descartá-las para abrir outro registro?', () => navigateTo(target, { replace, restored, discarded: true, scrollY }));
        return;
    }
    const openerHref = document.activeElement?.closest?.('a[data-action="v7-route"]')?.getAttribute('href');
    if (!restored) globalThis.history?.replaceState?.({ hanneUI: structuredClone(ui), target: currentDetailTarget || currentDestination(), scrollY: window.scrollY || 0 }, '');
    closeModal(true);
    if (restored) Object.assign(ui, restored);
    else {
        ui.page = target.page; ui.mobile = false; ui.threadOpen = false;
        if (target.page === 'services') {
            ui.serviceTab = target.tab === 'catalog' ? 'catalog' : 'records';
            const linkedRecord = target.record && state.records.find(r => r.id === target.record);
            ui.recordsMode = target.mode || (linkedRecord ? 'day' : ui.recordsMode);
            if (target.date && validCalendarDate(target.date)) ui.recordsDate = target.date;
            else if (linkedRecord) ui.recordsDate = linkedRecord.date;
            if (target.month) ui.recordsMonth = target.month;
            ui.recordsService = target.service || ''; ui.recordsSet = target.set || ''; ui.recordsClient = target.client || ''; ui.recordsPage = Number(target.p) || 1;
        }
        if (target.page === 'finance') {
            const linkedPayment = target.payment && state.payments.find(p => p.id === target.payment);
            ui.financeTab = ['bills', 'cards', 'deposits', 'expenses', 'history'].includes(target.tab) ? target.tab : target.installment ? 'cards' : target.expense ? 'expenses' : linkedPayment ? (linkedPayment.kind === 'Sinal' ? 'deposits' : 'history') : 'bills';
            if (target.month === undefined && linkedPayment && !linkedPayment.isOpening) ui.month = linkedPayment.date.slice(0, 7);
            ui.financeScope = target.scope || ''; ui.financeDate = target.date || ''; ui.financePageIndex = Number(target.p) || 1;
            if (target.month !== undefined) ui.month = target.month;
        }
        if (target.page === 'agenda') { const linkedDate = target.date || state.appointments.find(a => a.id === target.appointment)?.date; if (linkedDate) ui.date = linkedDate; ui.agendaStatus = target.status || ''; ui.agendaView = 'day'; }
        if (target.page === 'inventory') { ui.inventoryTab = target.tab === 'movements' ? 'movements' : 'products'; ui.inventoryScope = target.movement || ''; ui.inventoryPageIndex = Number(target.p) || 1; if (target.month !== undefined) ui.month = target.month; }
    }
    render();
    if (!restored) globalThis.history?.[replace ? 'replaceState' : 'pushState']?.({ hanneUI: structuredClone(ui), target }, '', destinationHref({ ...currentDestination(), ...target }));
    openDestinationDetail(target);
    if (document.getElementById('dialog')) modalReturnHref = openerHref || null;
    if (!document.getElementById('dialog')) {
        const heading = document.querySelector?.(target.scroll === 'records' ? '#records-heading' : '#main h1');
        heading?.setAttribute('tabindex', '-1'); heading?.focus?.({ preventScroll: true });
        if (target.scroll === 'records') heading?.scrollIntoView?.({ block: 'start' }); else window.scrollTo(0, restored ? scrollY : 0);
    }
}

window.addEventListener('popstate', e => {
    const target = e.state?.target || parseDestination(location.hash || '') || { page: 'dashboard' };
    navigateTo(target, { replace: true, restored: e.state?.hanneUI || null, scrollY: e.state?.scrollY || 0 });
});
// Destinos e ícones da navegação principal.
const navItems = [['dashboard', 'grid', 'Visão geral'], ['agenda', 'calendar', 'Agenda'], ['conversations', 'chat', 'Atendimentos'], ['clients', 'users', 'Clientes'], ['finance', 'wallet', 'Financeiro'], ['inventory', 'leaf', 'Estoque'], ['services', 'scissors', 'Serviços'], ['quotes', 'file', 'Orçamentos'], ['tasks', 'checklist', 'Tarefas']];
/**
 * render — Reconstrói a estrutura da interface a partir do estado e dos filtros atuais.
 */
function render() {
    const pageName = navItems.find(n => n[0] === ui.page)?.[2] || (ui.page === 'setup' ? 'Preparar operação' : 'Configurações');
    const navButton = ([id, symbol, label]) => `<button type="button" data-action="nav" data-page="${id}" class="${ui.page === id ? 'active' : ''}" ${ui.page === id ? 'aria-current="page"' : ''} title="${label}">${icon(symbol)}<span>${label}</span>${id === 'conversations' ? `<b class="nav-count" data-pending-total ${pendingConvs().length + whatsappPending ? '' : 'hidden'}>${pendingConvs().length + whatsappPending}</b>` : ''}</button>`;
    document.title = `${dataset === 'example' ? 'Exemplos · ' : ''}${pageName} · Hanne`;
    document.getElementById('app').innerHTML = `
        <div class="mobile-shade ${ui.mobile ? 'visible' : ''}" data-action="mobile-menu"></div>
        <aside class="sidebar ${ui.mobile ? 'mobile-open' : ''}" aria-label="Navegação principal">
            <div class="brand"><div class="brand-mark">h</div><div><div class="brand-name">hanne<span>.</span></div><span class="brand-sub">Gestão do ateliê</span></div></div>
            <nav class="nav" aria-label="Dia a dia"><div class="nav-label">Dia a dia</div>${navItems.slice(0, 4).map(navButton).join('')}</nav>
            <nav class="nav management-nav" aria-label="Gestão"><div class="nav-label">Gestão</div>${navItems.slice(4).map(navButton).join('')}</nav>
            <div class="sidebar-bottom">
                <div class="focus-box"><button type="button" class="focus-toggle" data-action="focus" role="switch" aria-checked="${state.focus}"><span>${icon('moon')} Modo de foco</span><span class="switch ${state.focus ? 'on' : ''}"></span></button><p>As prioridades continuam em destaque.</p></div>
                <nav class="nav" aria-label="Suporte"><button type="button" data-action="nav" data-page="settings" class="${ui.page === 'settings' ? 'active' : ''}" title="Configurações">${icon('settings')}<span>Configurações</span></button><button type="button" data-action="help" title="Ajuda e primeiros passos">${icon('help')}<span>Ajuda e primeiros passos</span></button></nav>
                <button type="button" class="demo-label" data-action="v3-dataset" data-dataset="${dataset === 'example' ? 'real' : 'example'}" title="${dataset === 'example' ? 'Voltar aos dados reais' : 'Abrir a demonstração com dados fictícios'}">${icon(dataset === 'example' ? 'spark' : 'shield')}<span>${dataset === 'example' ? 'Demonstração · voltar aos dados reais' : 'Dados reais · ver demonstração'}</span></button>
            </div>
        </aside>
        <div class="workspace">
            <header class="topbar">${iconBtn('menu', 'mobile-menu', 'Abrir navegação', 'class="mobile-menu"')}<nav class="breadcrumb" aria-label="Caminho da página"><ol>${ui.page !== 'dashboard' ? `<li>${destinationLink('Meu ateliê', { page: 'dashboard' }, 'breadcrumb-link')}${icon('chevron')}</li>` : ''}<li aria-current="page"><strong>${pageName}</strong></li></ol></nav>
                <div class="top-actions"><button type="button" class="search-trigger" data-action="search" aria-label="Buscar no sistema">${icon('search')}<span>Buscar...</span><kbd>⌘ K</kbd></button>${themeControl()}<span class="sync-dot ${syncStatus === 'saved' ? 'saved' : ''}" title="${syncStatus === 'saved' ? 'Registros sincronizados' : 'Conferir sincronização'}" aria-label="${syncStatus === 'saved' ? 'Registros sincronizados' : 'Conferir sincronização'}"></span>${(() => { const n = alertCount(); return `<button type="button" class="icon-btn bell-btn ${n ? 'notify' : ''}" data-action="alerts" aria-label="Central de alertas${n ? `: ${plural(n, 'alerta', 'alertas')}` : ''}" title="Central de alertas">${icon('bell')}${n ? `<b class="bell-count" aria-hidden="true">${n > 9 ? '9+' : n}</b>` : ''}</button>`; })()}<button type="button" class="account-button" data-action="nav" data-page="settings" aria-label="Abrir configurações"><span class="user-avatar">${esc(initials(state.settings.name))}</span><span class="user-meta">${esc(state.settings.name)}<small>Meu ateliê</small></span></button></div>
            </header>
            <main class="main" id="main" data-page="${ui.page}">${datasetBanner()}${syncBanner()}${state.focus ? `<div class="focus-banner">${icon('moon')}<span>Modo de foco ativo. Prioridades seguem visíveis.</span>${btn('Encerrar', 'focus', '', 'text')}</div>` : ''}${renderPage()}<p class="gentle-note">${icon('heart')}Seu tempo para o que importa.</p></main>
            <nav class="mobile-bottom-nav" aria-label="Atalhos do celular">${[['dashboard','grid','Início'],['agenda','calendar','Agenda'],['conversations','chat','Conversas'],['finance','wallet','Financeiro']].map(([id, symbol, label]) => `<button type="button" data-action="nav" data-page="${id}" class="${ui.page === id ? 'active' : ''}" ${ui.page === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${id === 'conversations' ? `<b class="nav-count" data-pending-total ${pendingConvs().length + whatsappPending ? '' : 'hidden'}>${pendingConvs().length + whatsappPending}</b>` : ''}</button>`).join('')}<button type="button" data-action="mobile-menu" aria-label="Abrir todas as áreas">${icon('menu')}<span>Mais</span></button></nav>
        </div>`;
    adaptTables();
    whatsapp.mount();
}

/** Acrescenta rótulos visuais às células para ler cada registro como cartão no celular. */
function adaptTables() {
    for (const table of document.querySelectorAll?.('#main .data-table') || []) {
        const headers = [...(table.tHead?.rows[0]?.cells || [])].map(cell => cell.textContent.trim());
        table.classList.add('adaptive-table');
        for (const row of table.tBodies[0]?.rows || []) {
            [...row.cells].forEach((cell, index) => {
                if (cell.colSpan === 1) cell.dataset.label = headers[index] || '';
            });
        }
    }
}

/** Capa do painel: o resumo vem da agenda real, sem indicadores de tendência inventados. */
function dashboardIntro() {
    const today = activeAppts(localDate()).filter(a => a.status !== 'blocked');
    const done = today.filter(a => a.status === 'completed').length;
    return `<section class="atelier-welcome"><div class="welcome-copy"><span class="welcome-date">${icon('calendar')}${longDate(localDate())}</span><h1>Seu ateliê, <em>em dia.</em></h1><p>Olá, ${esc(state.settings.name)}. Agenda, produtos e dinheiro em uma rotina mais leve.</p><div class="welcome-actions">${btn('Concluir atendimento', 'v2-finish', 'check', 'primary')}${btn('Agendar', 'new-appointment', 'plus', 'secondary', 'aria-label="Agendar cliente"')}</div><div class="welcome-routine">${destinationLink('01 · Agenda', { page: 'agenda', date: localDate() }, 'welcome-step')}<i></i>${destinationLink('02 · Realizados hoje', { page: 'services', mode: 'day', date: localDate() }, 'welcome-step')}<i></i>${destinationLink('03 · Pagamentos', { page: 'finance', tab: 'history', date: localDate() }, 'welcome-step')}</div></div><div class="welcome-day"><div class="welcome-day-top"><span>Hoje, no seu espaço</span>${icon('sun')}</div>${destinationLink(today.length.toString().padStart(2, '0') + '<small>visitas na agenda</small>', { page: 'agenda', date: localDate() }, 'welcome-day-number', 'Ver visitas agendadas hoje')}<div class="welcome-day-bottom">${destinationLink(done + ' concluídas', { page: 'agenda', date: localDate(), status: 'completed' }, 'welcome-count')}${destinationLink((today.length - done) + ' em aberto', { page: 'agenda', date: localDate(), status: 'open' }, 'welcome-count')}</div>${btn('Ver minha agenda', 'nav', 'arrow', 'text', 'data-page="agenda"')}</div></section>${dataset === 'real' ? `<button type="button" class="wa-dashboard-link" data-action="nav" data-page="conversations">${icon('chat')}WhatsApp · <span data-wa-pending>${whatsappPending}</span> conversas pendentes ${icon('arrow')}</button>` : ''}${pageGuide()}`;
}

/** Resumo do dia selecionado; o tempo soma as visitas sem incluir os intervalos reservados. */
function agendaOverview(date) {
    const visits = activeAppts(date).filter(a => a.status !== 'blocked'), duration = visits.reduce((sum, a) => sum + a.duration, 0);
    return `<section class="agenda-overview" aria-label="Resumo da agenda do dia">${destinationLink(icon('calendar') + `<span>Visitas do dia<strong>${visits.length}</strong></span>`, { page: 'agenda', date }, 'agenda-summary-link')}${destinationLink(icon('check') + `<span>Concluídas<strong>${visits.filter(a => a.status === 'completed').length}</strong></span>`, { page: 'agenda', date, status: 'completed' }, 'agenda-summary-link')}<div>${icon('clock')}<span>Tempo reservado<strong>${Math.floor(duration / 60)}h${duration % 60 ? String(duration % 60).padStart(2, '0') : ''}<small> sem intervalos</small></strong></span></div></section>`;
}

/** Fatia da agenda selecionada pelo resumo; bloqueios não entram em contagens de visitas. */
function agendaEntries(date) {
    return activeAppts(date).filter(a => !ui.agendaStatus || a.status !== 'blocked' && (ui.agendaStatus === 'completed' ? a.status === 'completed' : a.status !== 'completed'));
}
/**
 * heading — Monta o título de uma página com subtítulo e ações.
 */
function heading(title, subtitle, actions = '', date = false) {
    if (['clients','services','agenda','conversations','quotes','tasks','inventory','finance','settings','setup'].includes(ui.page)) actions += btn('Excluir registro', 'v12-delete-list', '', 'text');
    const item = navItems.find(n => n[0] === ui.page), group = ['dashboard', 'agenda', 'conversations', 'clients'].includes(ui.page) ? 'Seu dia a dia' : 'Gestão do ateliê';
    return `<div class="page-heading"><div><span class="page-kicker">${icon(item?.[1] || 'settings')}${group}</span>${date ? `<div class="heading-date">${longDate(localDate())}</div>` : ''}<h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${actions ? `<div class="row wrap">${actions}</div>` : ''}</div>${pageGuide()}`;
}
/**
 * stat — Renderiza um indicador numérico do painel.
 */
function stat(title, value, detail, ic, target = null) {
    const targets = {
        'Recebido no período': { page: 'finance', tab: 'history', month: ui.month },
        'Resultado de caixa': { page: 'finance', tab: 'history', scope: 'cash', month: ui.month },
        'A receber de clientes': { page: 'finance', tab: 'bills', scope: 'open' },
        'A receber do cartão': { page: 'finance', tab: 'cards', scope: 'open' },
        'Despesas pagas': { page: 'finance', tab: 'expenses', scope: 'paid', month: ui.month },
        'Custo de consumo': { page: 'inventory', tab: 'movements', movement: 'consumption', month: ui.month },
        'Visitas concluídas': recordsDestination({ scroll: 'records' }),
        'Procedimentos realizados': recordsDestination({ scroll: 'records' }),
        'Valor cobrado': recordsDestination({ scroll: 'records' }),
        'Produtos cadastrados': { page: 'inventory', tab: 'products' },
        'Estoque baixo': { page: 'inventory', tab: 'products', movement: 'low' },
        'Custos a conferir': { page: 'inventory', tab: 'products', movement: 'unknown' }
    };
    target ||= targets[title];
    const content = `<div class="stat-head"><span class="stat-icon">${icon(ic)}</span>${title}</div><div class="stat-number">${value}</div><div class="stat-foot">${detail}</div>${target ? `<span class="stat-link-hint">Ver registros ${icon('arrow')}</span>` : ''}`;
    return target ? destinationLink(content, target, 'stat stat-link', `Ver registros: ${title}`) : `<article class="stat">${content}</article>`;
}
/**
 * dayRibbon — Monta a faixa de datas navegáveis da agenda.
 */
function dayRibbon() { const day = new Date(ui.date + 'T12:00:00').getDay(), start = dayOffset(-((day + 6) % 7), ui.date); return `<div class="day-ribbon">${Array.from({ length: 7 }, (_, i) => { const date = dayOffset(i, start); return `<button data-action="select-day" data-date="${date}" class="${date === ui.date ? 'active' : ''}" aria-label="${longDate(date)}"><span>${fmt(date, { weekday: 'short' }).replace('.', '').slice(0, 3)}</span><strong>${Number(date.slice(-2))}</strong></button>`; }).join('')}</div>`; }
/**
 * scheduleRow — Renderiza um compromisso ou bloqueio com suas ações.
 */
function scheduleRow(a) {
    const c = client(a.clientId), target = { page: 'agenda', date: a.date, appointment: a.id }, end = clock(minutes(a.time) + a.duration);
    const canFinish = a.clientId && a.date <= localDate() && !['blocked', 'completed', 'cancelled', 'absent'].includes(a.status) && !state.records.some(r => r.appointmentId === a.id);
    return `<div class="schedule-row ${a.status === 'blocked' ? 'is-pause' : ''}">${destinationLink(a.time + '<small>' + end + '</small>', target, 'schedule-time', 'Ver horário ' + a.time)}<span class="schedule-marker"></span>${destinationLink(`<div><strong>${esc(a.label || c.name)}</strong><p>${esc(a.status === 'blocked' ? 'Um intervalo para recarregar.' : service(a.serviceId).name)}</p></div>${a.status === 'blocked' ? '' : pill(statusLabel[a.status], a.status === 'pending' ? 'orange' : 'green')}`, target, 'schedule-body')}${canFinish ? btn('Concluir', 'new-record', 'check', 'text schedule-finish', `data-appointment="${a.id}" aria-label="Concluir atendimento de ${esc(c.name)}"`) : ''}</div>`;
}
/**
 * clientsPage — Renderiza clientes conforme busca, filtro e modo de visualização.
 */
function clientsPage() { let rows = state.clients.filter(c => (ui.clientFilter === 'all' || c.status === ui.clientFilter) && `${c.name} ${c.phone}`.toLowerCase().includes(ui.clientQuery.toLowerCase())); return `${heading('Clientes', 'Cadastros, histórico de visitas e valores a receber.', btn('Importar CSV', 'import', 'upload', 'secondary', 'data-kind="clients"') + btn('Novo cliente', 'new-client', 'plus', 'primary'))}<div class="toolbar"><div class="input-wrap">${icon('search')}<input id="client-search" placeholder="Buscar por nome ou telefone..." aria-label="Buscar clientes" data-input="client-search" value="${esc(ui.clientQuery)}"></div><select data-change="client-filter" aria-label="Situação do cadastro"><option value="all" ${ui.clientFilter === 'all' ? 'selected' : ''}>Todos os cadastros</option><option value="permanent" ${ui.clientFilter === 'permanent' ? 'selected' : ''}>Confirmados</option><option value="temporary" ${ui.clientFilter === 'temporary' ? 'selected' : ''}>Temporários</option></select><div class="segmented">${[['table', 'Lista'], ['cards', 'Cartões']].map(([v, t]) => `<button data-action="client-view" data-id="${v}" class="${ui.clientView === v ? 'active' : ''}">${t}</button>`).join('')}</div>${btn('Exportar', 'export', 'download', 'secondary', 'data-kind="clients"')}</div>${ui.clientView === 'cards' ? `<div class="client-grid">${rows.map(c => `<button class="card client-card" data-action="client-profile" data-id="${c.id}"><div class="row between">${avatar(c)}${pill(c.status === 'temporary' ? 'Temporário' : 'Confirmado', c.status === 'temporary' ? 'orange' : 'green')}</div><h3>${esc(c.name)}</h3><p class="phone">${esc(c.phone)}</p><div class="client-bottom"><span>${state.records.filter(r => r.clientId === c.id).length} serviços no histórico</span>${icon('arrow')}</div></button>`).join('')}</div>` : `<div class="card table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>Cadastro</th><th>Último cuidado</th><th>Histórico</th><th></th></tr></thead><tbody>${rows.map(c => { const last = state.records.filter(r => r.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date))[0]; return `<tr><td><div class="row">${avatar(c)}<div><button class="name-link" data-action="client-profile" data-id="${c.id}">${esc(c.name)}</button><p class="table-sub">${esc(c.phone)}</p></div></div></td><td>${pill(c.status === 'temporary' ? 'Temporário' : 'Confirmado', c.status === 'temporary' ? 'orange' : 'green')}</td><td>${last ? `${esc(service(last.serviceId).name)}<p class="table-sub">${fmt(last.date)}</p>` : '<span class="muted">Primeira visita</span>'}</td><td>${state.records.filter(r => r.clientId === c.id).length} serviços</td><td>${iconBtn('arrow', 'client-profile', 'Ver perfil', `data-id="${c.id}"`)}</td></tr>`; }).join('')}</tbody></table>${rows.length ? '' : empty('Nenhum cliente encontrado.', 'Experimente outro nome ou telefone.', 'search')}</div>`}<div class="notice section-gap">${icon('shield')}Contatos temporários só se tornam clientes confirmados após sua revisão. Os registros desta conta são sincronizados entre dispositivos.</div>`; }
/**
 * manualConversationsPage — Renderiza somente as notas internas; a aba WhatsApp usa o canal separado.
 */
/** Duas origens explícitas: mensagens reais do canal e anotações do aplicativo. */
function conversationsPage() {
    const real = dataset === 'real';
    const tabs = `<div class="wa-view-switch" role="group" aria-label="Origem dos atendimentos"><button type="button" class="btn ${ui.inboxView === 'whatsapp' ? 'primary' : 'secondary'}" data-action="inbox-mode" data-mode="whatsapp" aria-pressed="${ui.inboxView === 'whatsapp'}" ${real ? '' : 'disabled'}>WhatsApp ${real ? '' : '· abra os dados reais'}</button><button type="button" class="btn ${ui.inboxView === 'notes' ? 'primary' : 'secondary'}" data-action="inbox-mode" data-mode="notes" aria-pressed="${ui.inboxView === 'notes'}">Notas internas</button></div>`;
    return ui.inboxView === 'whatsapp' && real ? heading('Atendimentos', 'Conversas reais, com o próximo passo sempre à vista.') + tabs + '<div id="whatsapp-root"></div>' : tabs + manualConversationsPage();
}
function manualConversationsPage() { const convs = state.conversations.filter(v => ui.convFilter === 'all' || (ui.convFilter === 'resolved' ? v.status === 'resolved' : ui.convFilter === 'open' ? v.status !== 'resolved' : v.category === ui.convFilter)); let v = convs.find(v => v.id === ui.conversationId) || convs[0], c = v ? client(v.clientId) : null; return `${heading('Atendimentos', 'Organize as conversas e acompanhe o que ainda precisa de resposta.', btn('Sobre a integração', 'integrations', 'link', 'secondary'))}<div class="card inbox ${ui.threadOpen ? 'mobile-thread' : ''}"><aside class="inbox-list"><div class="inbox-list-head"><div class="row between inbox-pending-count"><strong>Atendimentos pendentes</strong>${pill(pendingConvs().length, 'orange')}</div><select data-change="conv-filter" aria-label="Filtrar conversas">${[['all', 'Todas as conversas'], ['open', 'Pendentes'], ['Segurança', 'Segurança'], ['Orçamento', 'Orçamentos'], ['resolved', 'Resolvidas']].map(([val, t]) => `<option value="${val}" ${ui.convFilter === val ? 'selected' : ''}>${t}</option>`).join('')}</select></div>${convs.map(x => `<button class="inbox-item ${v?.id === x.id ? 'active' : ''}" data-action="select-conversation" data-id="${x.id}">${avatar(client(x.clientId))}<div class="grow"><div class="row between gap6"><span class="name">${esc(client(x.clientId).name)}</span><small class="muted">${esc(x.time)}</small></div><p>${esc(x.messages.at(-1)?.text)}</p>${pill(x.status === 'resolved' ? 'Resolvida' : x.category, x.status === 'resolved' ? 'gray' : categoryColor(x.category))}</div></button>`).join('') || empty('Nenhuma conversa neste filtro.', '', 'chat')}</aside><section class="thread">${v ? `<header class="thread-head row">${iconBtn('left', 'back-inbox', 'Voltar para conversas', 'style="display:none" class="icon-btn thread-back"')}${avatar(c)}<button data-action="client-profile" data-id="${c.id}" style="text-align:left"><h3>${esc(c.name)}</h3><small>${esc(c.phone)} · ${c.status === 'temporary' ? 'Contato temporário' : 'Cliente confirmado'}</small></button><div class="thread-tools">${iconBtn('edit', 'classify', 'Alterar classificação', `data-id="${v.id}"`)}${btn(v.status === 'resolved' ? 'Reabrir' : 'Resolver', 'resolve-conversation', v.status === 'resolved' ? 'undo' : 'check', 'secondary sm', `data-id="${v.id}"`)}</div></header>${v.category === 'Segurança' && v.status !== 'resolved' ? `<div class="notice red" style="border-radius:0">${icon('warning')}Relato de segurança: avalie pessoalmente o contexto antes de orientar a cliente.</div>` : ''}<div class="thread-body"><div class="thread-date">Histórico de notas internas</div>${v.messages.map(m => `<div class="bubble ${m.type === 'note' ? 'note' : ''}">${m.type === 'note' ? '<span class="eyebrow">Nota interna</span><br>' : ''}${esc(m.text)}<time>${esc(m.time)}</time></div>`).join('')}</div><div class="summary-box"><strong>${icon('spark')}Contexto da conversa ${pill('IA pendente', 'gray')}</strong><p>${esc(v.summary)}</p></div>${v.draft ? `<div class="draft-box"><div class="row between"><h3>Rascunho para sua revisão</h3>${pill('Aprovação manual', 'orange')}</div><p>${esc(v.draft)}</p>${btn('Revisar e copiar', 'review-draft', 'edit', 'secondary sm', `data-id="${v.id}"`)}</div>` : ''}<form novalidate id="note-form" class="composer" data-form="note"><input type="hidden" name="id" value="${v.id}"><label class="field"><span>Registrar uma nota interna</span><textarea class="resize-none" name="text" required maxlength="3000" placeholder="Contexto, observações ou próximos passos..."></textarea></label><div class="composer-footer"><span class="muted small">Nota interna: não será enviada pelo WhatsApp.</span><button class="btn primary" type="submit">${icon('plus')}Salvar nota</button></div></form>` : empty('Selecione uma conversa.', 'As mensagens de exemplo aparecem aqui.', 'chat')}</section></div>`; }
/**
 * agendaPage — Renderiza a agenda diária ou de cinco dias.
 */
function agendaPage() { const date = ui.date; return `${heading('Agenda', 'Consulte os horários, confirme visitas e registre novos agendamentos.', btn('Importar CSV', 'import', 'upload', 'secondary', 'data-kind="appointments"') + btn('Bloquear horário', 'new-block', 'lock', 'secondary') + btn('Agendar', 'new-appointment', 'plus', 'primary'))}${agendaOverview(date)}${ui.agendaStatus ? `<div class="consultation-banner"><span>${ui.agendaStatus === 'completed' ? 'Agendamentos concluídos' : 'Visitas em aberto'}</span>${destinationLink('Ver agenda completa', { page: 'agenda', date }, 'btn text')}</div>` : ''}${dayRibbon()}<section class="card agenda-timeline"><div class="calendar-toolbar"><div class="row gap6">${iconBtn('left', 'agenda-prev', 'Período anterior')}<strong>${ui.agendaView === 'day' ? longDate(date) : `${fmt(date)} — ${fmt(dayOffset(4, date))}`}</strong>${iconBtn('chevron', 'agenda-next', 'Próximo período')}${btn('Hoje', 'agenda-today', '', 'secondary sm')}</div><div class="row gap8"><input type="date" value="${date}" data-change="agenda-date" aria-label="Selecionar data" class="agenda-date-input"><div class="segmented">${[['day', 'Dia'], ['week', '5 dias']].map(([val, t]) => `<button data-action="agenda-view" data-id="${val}" class="${ui.agendaView === val ? 'active' : ''}">${t}</button>`).join('')}</div></div></div>${ui.agendaView === 'day' ? `<div class="agenda-day">${agendaEntries(date).map(scheduleRow).join('') || empty('A agenda está livre.', 'Registre um atendimento ou bloqueie um horário.', 'calendar')}</div>` : `<div class="calendar-columns">${Array.from({ length: 5 }, (_, i) => { const d = dayOffset(i, date); return `<div class="calendar-day ${d === localDate() ? 'today' : ''}"><div class="calendar-day-heading">${fmt(d, { weekday: 'long' })}<b>${Number(d.slice(-2))}</b></div>${agendaEntries(d).map(a => `<button class="appointment-block ${a.status}" data-action="appointment-detail" data-id="${a.id}"><div class="atime">${a.time} — ${clock(minutes(a.time) + a.duration)}</div><strong>${esc(a.label || client(a.clientId).name)}</strong><p>${esc(a.status === 'blocked' ? 'Bloqueio de horário' : service(a.serviceId).name)}</p></button>`).join('')}<button class="free-slot" data-action="new-appointment" data-date="${d}">+ Registrar atendimento</button></div>`; }).join('')}</div>`}</section><div class="view-grid section-gap"><div class="notice">${icon('info')}Todo agendamento é manual. O sistema considera duração, intervalo e bloqueios para evitar conflitos.</div><div class="notice">Funcionamento: ${state.settings.open} às ${state.settings.close}</div></div><div class="card section-gap"><header class="card-head"><div><h2>Disponibilidade do dia</h2><p class="sub">Sugestões para corte de 60 min + 15 min de intervalo. Não reservam horário.</p></div></header><div style="padding:0 22px 22px"><div class="available-list">${availableSlots(date, 60, 15).map(t => `<span>${t}</span>`).join('') || '<span>Nenhum horário livre neste dia.</span>'}</div></div></div>`; }
/**
 * availableSlots — Calcula sugestões de horários respeitando expediente, dias fechados e conflitos com intervalo.
 */
function availableSlots(date, duration, buffer) {
    if (state.settings.closedDays.includes(new Date(date + 'T12:00:00').getDay()))
        return [];
    const result = [];
    for (let t = minutes(state.settings.open); t + duration + buffer <= minutes(state.settings.close); t += 30) {
        if (!appointmentConflict(state.appointments, { date, time: clock(t), duration, buffer }))
            result.push(clock(t));
    }
    return result;
}
/**
 * quotesPage — Renderiza orçamentos manuais por situação.
 */
function quotesPage() { const qs = state.quotes.filter(q => ui.quoteFilter === 'all' || q.status === ui.quoteFilter); return `${heading('Orçamentos', 'Reúna referências, confira informações e registre sua avaliação.', btn('Novo orçamento', 'new-quote', 'plus', 'primary'))}<div class="toolbar"><div class="segmented">${[['all', 'Todos'], ['missing', 'Faltam informações'], ['review', 'Em avaliação'], ['approved', 'Avaliados']].map(([val, t]) => `<button data-action="quote-filter" data-id="${val}" class="${ui.quoteFilter === val ? 'active' : ''}">${t}</button>`).join('')}</div></div><div class="quote-grid">${qs.map(q => `<article class="card quote-card"><div class="row between">${avatar(client(q.clientId))}${pill(quoteLabel[q.status], q.status === 'approved' ? 'green' : q.status === 'missing' ? 'orange' : 'gray')}</div><h3>${esc(client(q.clientId).name)}</h3><p class="desc">${esc(service(q.serviceId).name)} · ${fmt(q.date)}</p><div class="quote-note">${esc(q.notes || 'Nenhuma observação registrada.')}</div>${q.photos.length ? `<p class="table-sub">${icon('image')}${q.photos.length} foto(s) associada(s) manualmente</p>` : ''}<footer><span class="quote-value">${q.value === null ? '<span class="muted small">Valor a definir</span>' : money(q.value)}</span>${btn('Avaliar', 'edit-quote', 'arrow', 'soft sm', `data-id="${q.id}"`)}</footer></article>`).join('') || empty('Nenhum orçamento neste filtro.', 'Crie uma solicitação para começar.', 'file')}</div><div class="notice section-gap">${icon('scissors')}A definição do procedimento e do preço é sempre sua. As fotos são organizadas sem análise visual por IA.</div>`; }
/**
 * servicesPage — Renderiza catálogo de serviços e fichas de atendimentos.
 */
function servicesPage() {
    const tabs = `<div class="toolbar"><div class="segmented">${[['records', 'Procedimentos realizados'], ['catalog', 'Catálogo de serviços']].map(([id, label]) => `<button data-action="service-tab" data-id="${id}" aria-pressed="${ui.serviceTab === id}" class="${ui.serviceTab === id ? 'active' : ''}">${label}</button>`).join('')}</div></div>`;
    const title = heading('Serviços e histórico', 'Veja o que foi realizado hoje, consulte o mês e abra os registros relacionados.', btn(ui.serviceTab === 'catalog' ? 'Novo serviço' : 'Concluir atendimento', ui.serviceTab === 'catalog' ? 'new-service' : 'v2-finish', 'plus', 'primary'));
    if (ui.serviceTab === 'catalog') return `${title}${tabs}<div class="service-grid">${state.services.map((s, i) => `<article class="card service-card"><span class="service-icon">${icon(['scissors', 'spark', 'sun', 'leaf', 'heart'][i % 5])}</span><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><div class="meta"><span>${icon('clock')} ${s.duration} min</span><span>+ ${s.buffer} min de intervalo</span></div><footer><span class="muted tiny">Ficha configurável</span>${btn('Ver detalhes', 'edit-service', 'arrow', 'text', `data-id="${s.id}"`)}</footer></article>`).join('')}</div>`;
    const filter = { mode: ui.recordsMode, date: ui.recordsDate, month: ui.recordsMonth, service: ui.recordsService, set: ui.recordsSet, client: ui.recordsClient };
    const summary = attendanceSummary(state, filter), history = attendanceSummary(state), paging = recordPage(summary.records, ui.recordsPage);
    ui.recordsPage = paging.page;
    const period = ui.recordsMode === 'day' ? (ui.recordsDate === localDate() ? 'Hoje · ' : '') + fmt(ui.recordsDate, { day: '2-digit', month: 'long', year: 'numeric' }) : ui.recordsMode === 'month' ? fmt(ui.recordsMonth + '-01', { month: 'long', year: 'numeric' }) : 'Todo o histórico';
    const selected = [ui.recordsService ? service(ui.recordsService).name : '', ui.recordsSet ? ui.recordsSet.split(',').map(id => service(id).name).join(' + ') : '', ui.recordsClient ? client(ui.recordsClient).name : ''].filter(Boolean);
    return `${title}${tabs}<section class="records-controls" aria-label="Filtros dos procedimentos realizados"><div class="segmented" role="group" aria-label="Período dos procedimentos">${[['day', 'Dia', 'v7-day'], ['month', 'Mês inteiro', 'v7-month'], ['all', 'Todo o histórico', 'v7-all']].map(([mode, label, action]) => `<button type="button" data-action="${action}" aria-pressed="${ui.recordsMode === mode}" class="${ui.recordsMode === mode ? 'active' : ''}">${label}</button>`).join('')}</div><div class="record-date-control">${ui.recordsMode === 'day' ? `<label class="field"><span>Data dos procedimentos</span><input type="date" value="${ui.recordsDate}" max="${localDate()}" data-change="v7-records-date" aria-label="Data dos procedimentos"></label>${destinationLink('Hoje', recordsDestination({ mode: 'day', date: localDate(), p: 1 }), 'btn secondary sm')}` : ui.recordsMode === 'month' ? `<label class="field"><span>Mês dos procedimentos</span><input type="month" value="${ui.recordsMonth}" max="${localDate().slice(0, 7)}" data-change="v6-records-month" aria-label="Mês dos procedimentos"></label>${btn('Mês atual', 'v6-current-month', 'calendar', 'secondary sm')}` : '<p class="muted small">Todos os meses salvos, sem apagar fichas anteriores.</p>'}</div></section>
    ${selected.length ? `<div class="active-record-filters"><span>${icon('search')}Filtrando: ${esc(selected.join(' · '))}</span>${btn('Limpar filtros', 'v7-clear-record-filters', 'close', 'text')}</div>` : ''}
    <p class="history-hint">${icon('info')}${ui.recordsMode === 'day' ? 'A consulta começa no dia de hoje. Use Mês inteiro para ampliar o período.' : 'A troca de período muda a consulta. Todas as fichas continuam salvas.'}</p>
    <section class="stats history-stats">${stat('Visitas concluídas', summary.records.length, 'Cada atendimento conta uma vez', 'calendar')}${stat('Procedimentos realizados', summary.procedures, 'Cada serviço conta dentro da visita', 'scissors')}${stat('Valor cobrado', money(summary.total), 'Preço total das visitas · não é o recebido', 'wallet')}</section>
    <section class="card" id="records-list"><header class="card-head"><div><h2 id="records-heading">Procedimentos realizados</h2><p class="sub">${esc(period)} · ${summary.records.length} visita${summary.records.length === 1 ? '' : 's'}</p></div>${pill(summary.procedures + (summary.procedures === 1 ? ' procedimento' : ' procedimentos'), 'gray')}</header><div class="table-wrap"><table class="data-table history-table" aria-labelledby="records-heading"><thead><tr><th scope="col">Cliente</th><th scope="col">Procedimentos da visita</th><th scope="col">Data</th><th scope="col">Total combinado</th><th scope="col">Abrir registro</th></tr></thead><tbody>${paging.rows.map(r => `<tr data-record-id="${esc(r.id)}"><td>${destinationLink(esc(client(r.clientId).name), { page: 'clients', client: r.clientId }, 'name-link')}</td><td><div class="procedure-links">${(r.serviceIds || [r.serviceId]).map(id => destinationLink(esc(service(id).name), recordsDestination({ service: id, set: '', p: 1 }), 'procedure-link')).join('<span class="muted" aria-hidden="true"> + </span>')}</div></td><td>${destinationLink(fmt(r.date, { day: '2-digit', month: '2-digit', year: 'numeric' }), { page: 'agenda', date: r.date, ...(r.appointmentId ? { appointment: r.appointmentId } : {}) }, 'date-link', 'Ver agenda em ' + fmt(r.date))}</td><td class="money">${destinationLink(money(r.total), { page: 'finance', bill: r.billId }, 'money-link', 'Ver cobrança e pagamentos de ' + client(r.clientId).name + ' em ' + fmt(r.date))}</td><td><div class="record-row-actions">${destinationLink('Ver atendimento ' + icon('arrow'), { ...recordsDestination(), record: r.id }, 'btn text')}${r.appointmentId ? destinationLink('Agendamento', { page: 'agenda', date: r.date, appointment: r.appointmentId }, 'btn text') : '<span class="muted tiny">Sem agenda vinculada</span>'}</div></td></tr>`).join('')}</tbody></table>${summary.records.length ? '' : `<div class="records-empty">${empty('Nenhum procedimento neste período.', selected.length ? 'Remova os filtros ou escolha outra data.' : 'Os atendimentos aparecem aqui depois de concluídos pela agenda.', 'calendar')}${selected.length ? btn('Limpar filtros', 'v7-clear-record-filters', 'close', 'secondary') : destinationLink('Ver o mês inteiro', recordsDestination({ mode: 'month', month: ui.recordsDate.slice(0, 7), p: 1 }), 'btn secondary')}</div>`}</div><nav class="records-pagination" aria-label="Páginas dos atendimentos"><span role="status">${paging.start}–${paging.end} de ${paging.total} visita${paging.total === 1 ? '' : 's'}</span><div class="row gap8">${paging.page > 1 ? destinationLink('Anterior', recordsDestination({ p: paging.page - 1, scroll: 'records' }), 'btn secondary sm') : '<button type="button" class="btn secondary sm" disabled>Anterior</button>'}<span aria-current="page">${paging.page} / ${paging.pages}</span>${paging.page < paging.pages ? destinationLink('Próxima', recordsDestination({ p: paging.page + 1, scroll: 'records' }), 'btn secondary sm') : '<button type="button" class="btn secondary sm" disabled>Próxima</button>'}</div></nav></section>
    <section class="card history-results section-gap"><header class="card-head"><div><span class="eyebrow">Todos os meses salvos</span><h2>Resultados acumulados</h2><p class="sub">${destinationLink(history.records.length + ' visitas · ' + money(history.total) + ' em valores cobrados', { page: 'services', mode: 'all' }, 'name-link')}</p></div>${icon('grid')}</header><div class="history-insights"><div><h3>Serviços mais realizados</h3><p class="muted small">Toque em um serviço para ver todas as visitas em que ele foi feito.</p><ul class="frequency-list">${history.ranked.map(r => `<li>${destinationLink(`<span>${esc(service(r.id).name)}</span><strong>${r.count}<small> vezes</small></strong>${icon('chevron')}`, { page: 'services', mode: 'all', service: r.id }, 'frequency-link')}</li>`).join('')}</ul>${history.ranked.length ? '' : '<p class="muted small">O ranking aparecerá após a primeira visita concluída.</p>'}</div><div><h3>Valor por conjunto de serviços</h3><p class="muted small">Toque no conjunto para consultar as visitas. O preço não é dividido entre serviços.</p><div class="combination-list">${history.combinations.map(g => destinationLink(`<span class="grow">${esc(g.ids.map(id => service(id).name).join(' + '))}<small>${g.count} visita${g.count === 1 ? '' : 's'}</small></span><strong>${money(g.total)}</strong>${icon('chevron')}`, { page: 'services', mode: 'all', set: g.ids.join(',') }, 'combination-link')).join('') || '<p class="muted small">Os conjuntos aparecerão após a primeira visita concluída.</p>'}</div></div></div></section>`;
}
/**
 * tasksPage — Renderiza tarefas abertas ou concluídas com seus filtros.
 */
function tasksPage() { const tasks = state.tasks.filter(t => ui.taskFilter === 'all' || (ui.taskFilter === 'done' ? t.done : !t.done)).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due)); return `${heading('Tarefas', 'Veja os próximos passos, os prazos e o que já foi concluído.', btn('Nova tarefa', 'new-task', 'plus', 'primary'))}<div class="toolbar"><div class="segmented">${[['open', 'Pendentes'], ['done', 'Concluídas'], ['all', 'Todas']].map(([id, t]) => `<button data-action="task-filter" data-id="${id}" class="${ui.taskFilter === id ? 'active' : ''}">${t}</button>`).join('')}</div></div><div class="card priority-list">${tasks.map(t => `<div class="task-row ${t.done ? 'done' : ''}"><button class="check ${t.done ? 'checked' : ''}" data-action="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'Reabrir' : 'Concluir'} ${esc(t.title)}">${t.done ? icon('check') : ''}</button><div class="grow"><span class="task-title">${esc(t.title)}</span><div class="task-meta"><span>${esc(t.area)}</span><span>·</span><span>${t.due < localDate() && !t.done ? 'Atrasada · ' : ''}${fmt(t.due)}</span>${t.clientId ? `<span>· ${esc(client(t.clientId).name)}</span>` : ''}</div></div>${pill(t.priority, t.priority === 'Alta' ? 'red' : t.priority === 'Média' ? 'orange' : 'gray')}${iconBtn('edit', 'edit-task', 'Editar tarefa', `data-id="${t.id}"`)}</div>`).join('') || empty('Tudo cuidado por aqui.', 'Crie uma tarefa quando precisar de um lembrete.', 'checklist')}</div>`; }
/**
 * renderPage — Seleciona a função de renderização da página ativa.
 */
function renderPage() { return ({ dashboard, clients: clientsPage, conversations: conversationsPage, agenda: agendaPage, quotes: quotesPage, services: servicesPage, finance: financePage, inventory: inventoryPage, tasks: tasksPage, settings: settingsPage, setup: setupPage }[ui.page] || dashboard)(); }
/**
 * modal — Abre o contêiner de diálogo com o conteúdo recebido.
 */
function modal(title, body, footer = '', wide = false) {
    const active = document.activeElement;
    if (active && !active.closest?.('dialog')) modalOpener = active;
    document.getElementById('overlay-root').innerHTML = `<dialog id="dialog" class="${wide ? 'wide' : ''}" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2>${iconBtn('close', 'close-modal', 'Fechar janela')}</div>${body}${footer ? `<div class="dialog-footer">${footer}</div>` : ''}</dialog>`;
    const d = document.getElementById('dialog');
    d.showModal();
    d.addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
    d.addEventListener('click', e => {
        if (e.target === d && !(e.clientX >= d.getBoundingClientRect().left && e.clientX <= d.getBoundingClientRect().right && e.clientY >= d.getBoundingClientRect().top && e.clientY <= d.getBoundingClientRect().bottom))
            closeModal();
    });
}
/**
 * closeModal — Fecha o diálogo e limpa a área de sobreposição.
 */
function closeModal(force = false) {
    if (document.querySelector?.('#dialog form')?.dataset.busy && !force) { toast('Aguarde a configuração terminar.'); return; }
    if (leaveConfirmation && !force) { restoreEditing(); return; }
    const dirty = document.querySelector?.('#dialog form')?.dataset.dirty === 'true';
    if (dirty && !force) { confirmLeaving('Há alterações ainda não salvas. Deseja descartá-las?', () => closeModal(true)); return; }
    document.getElementById('dialog')?.close();
    document.getElementById('overlay-root').innerHTML = '';
    if (currentDetailTarget && !force) globalThis.history?.replaceState?.({ hanneUI: structuredClone(ui), target: currentDestination() }, '', destinationHref(currentDestination()));
    currentDetailTarget = null;
    if (!force) {
        const matchingLink = modalReturnHref && [...document.querySelectorAll('a[href]')].find(a => a.getAttribute('href') === modalReturnHref);
        const focus = matchingLink || (modalOpener?.isConnected ? modalOpener : document.querySelector?.('#main h1'));
        if (focus?.tagName === 'H1') focus.setAttribute('tabindex', '-1');
        focus?.focus?.({ preventScroll: true });
        modalReturnHref = null;
    }
}

/** Confirmação do aplicativo preserva o nó original do formulário para continuar editando sem perda. */
function confirmLeaving(message, proceed) {
    const previous = document.getElementById('dialog'), focus = document.activeElement;
    previous?.close(); previous?.remove();
    modal('Descartar alterações não salvas?', `<div class="dialog-body"><p>${esc(message)}</p></div>`, btn('Continuar editando', 'v7-keep-editing', '', 'secondary') + btn('Descartar e continuar', 'v7-discard', '', 'danger'));
    leaveConfirmation = { previous, focus, proceed };
    document.querySelector?.('[data-action="v7-keep-editing"]')?.focus();
}

/** Restaura inclusive valores e eventos do formulário que estava aberto antes da confirmação. */
function restoreEditing() {
    const pending = leaveConfirmation;
    leaveConfirmation = null;
    document.getElementById('dialog')?.close();
    const root = document.getElementById('overlay-root'); root.innerHTML = '';
    if (pending?.previous) { root.append(pending.previous); pending.previous.showModal(); pending.focus?.focus?.(); }
}
/**
 * openForm — Monta e abre um formulário padronizado com corpo, identificador, mensagens de erro e ações de salvar ou cancelar.
 */
function openForm(title, kind, body, save = 'Salvar', id = '', wide = false) { modal(title, `<form novalidate data-form="${kind}"><input type="hidden" name="id" value="${esc(id)}"><div class="dialog-body"><div class="form-grid">${body}</div></div><div class="form-error" id="form-error" role="alert"></div><div class="dialog-footer">${btn('Cancelar', 'close-modal')}<button class="btn primary" type="submit">${icon('check')}${save}</button></div></form>`, '', wide); }
/** Mantém as restrições HTML sem balões do navegador, com erro associado e foco no campo. */

/**
 * field — Monta o campo de formulário com rótulo e indicação opcional.
 */
function field(label, name, value = '', type = 'text', extra = '', full = false) { return `<label class="field ${full ? 'full' : ''}"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`; }
/**
 * textfield — Monta um campo de texto de várias linhas com conteúdo escapado.
 */
function textfield(label, name, value = '', extra = '', full = true) { return `<label class="field ${full ? 'full' : ''}"><span>${label}</span><textarea class="resize-none" name="${name}" ${extra}>${esc(value)}</textarea></label>`; }
/**
 * selectField — Monta seleção com rótulo e opções fornecidas pelo chamador.
 */
function selectField(label, name, options, value, extra = '', full = false) { return `<label class="field ${full ? 'full' : ''}"><span>${label}</span><select name="${name}" ${extra}>${options.map(([id, text]) => `<option value="${esc(id)}" ${String(id) === String(value) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`; }
/**
 * clientOptions — Monta pares de identificador e nome das clientes para os seletores; identifica cadastros temporários.
 */
const clientOptions = () => state.clients.map(c => [c.id, c.name + (c.status === 'temporary' ? ' · temporário' : '')]);
/**
 * serviceOptions — Monta as opções do catálogo de serviços.
 */
const serviceOptions = () => state.services.map(s => [s.id, s.name]);
/**
 * clientForm — Abre cadastro ou edição de cliente e confirma o tipo de cadastro.
 */
function clientForm(id) { const c = state.clients.find(c => c.id === id); openForm(c ? 'Editar cadastro' : 'Um novo encontro', 'client', field('Nome', 'name', c?.name || '', 'text', 'required maxlength="100"', true) + field('Telefone', 'phone', c?.phone || '', 'tel', 'required maxlength="30"', true) + selectField('Situação do cadastro', 'status', [['temporary', 'Temporário'], ['permanent', 'Confirmado']], c?.status || 'temporary', '', true) + textfield('Preferências e observações', 'note', c?.note || '', 'maxlength="3000"') + textfield('Alerta técnico relatado (opcional)', 'alert', c?.alert || '', 'maxlength="1000"') + '<div class="notice full">Ao salvar como confirmado, você aprova o cadastro e a associação deste telefone. Confirme os dados e a associação deste telefone antes de salvar.</div>', c ? 'Confirmar alterações' : 'Salvar cadastro', id || ''); }
/**
 * profile — Exibe ficha de cliente e seus vínculos com agenda, financeiro e histórico.
 */
function profile(id, tab = 'overview') {
    const c = state.clients.find(c => c.id === id);
    if (!c)
        return;
    ui.profileTab = tab;
    const tabs = [['overview', 'Perfil'], ['conversations', 'Conversas'], ['appointments', 'Agenda'], ['records', 'Serviços'], ['payments', 'Pagamentos']];
    let body = '';
    if (tab === 'overview')
        body = `${c.alert ? `<div class="notice red">${icon('warning')}<strong>Informação relatada</strong><br>${esc(c.alert)}<br><small>Origem: registro manual · ${c.alertDate ? fmt(c.alertDate) : 'sem data'}. Confirme a informação antes de utilizá-la.</small></div>` : ''}<dl class="profile-info"><div><dt>Telefone associado manualmente</dt><dd>${esc(c.phone)}</dd></div><div><dt>Situação</dt><dd>${pill(c.status === 'temporary' ? 'Temporário · aguardando confirmação' : 'Cadastro confirmado', c.status === 'temporary' ? 'orange' : 'green')}</dd></div><div class="full"><dt>Preferências e observações</dt><dd>${esc(c.note || 'Nenhuma observação registrada.')}</dd></div></dl>${c.status === 'temporary' ? `<div class="notice orange">Este contato ainda não é um cadastro permanente. A confirmação é feita ao editar e salvar a situação como “Confirmado”.</div>` : ''}`;
    if (tab === 'conversations')
        body = state.conversations.filter(v => v.clientId === id).map(v => `<button class="search-result" data-action="open-conversation" data-id="${v.id}">${icon('chat')}<div><span>${esc(v.category)} · ${esc(v.time)}</span><small>${esc(v.summary)}</small></div>${icon('arrow')}</button>`).join('') || empty('Sem conversas registradas.');
    if (tab === 'appointments')
        body = state.appointments.filter(a => a.clientId === id).sort((a, b) => b.date.localeCompare(a.date)).map(a => `<div class="history-item"><time>${longDate(a.date)} · ${a.time}</time><strong>${esc(service(a.serviceId).name)}</strong><div style="margin-top:10px">${pill(statusLabel[a.status], a.status === 'cancelled' ? 'gray' : 'green')} ${btn('Ver atendimento', 'appointment-detail', 'arrow', 'text', `data-id="${a.id}"`)}</div></div>`).join('') || empty('Uma história para começar.', 'Nenhum agendamento registrado.');
    if (tab === 'records')
        body = state.records.filter(r => r.clientId === id).sort((a, b) => b.date.localeCompare(a.date)).map(r => `<div class="history-item"><time>${fmt(r.date, { day: 'numeric', month: 'long', year: 'numeric' })}</time><strong>${esc(service(r.serviceId).name)}</strong>${r.formula ? `<p>Fórmula registrada: ${esc(r.formula)}</p>` : ''}<p>${esc(r.notes)}</p>${btn('Consultar ficha', 'edit-record', 'arrow', 'text', `data-id="${r.id}"`)}</div>`).join('') || empty('Nenhum serviço realizado.');
    if (tab === 'payments')
        body = state.bills.filter(b => b.clientId === id).map(b => `<div class="history-item"><time>${fmt(b.date)}</time><strong>${esc(b.description)} · ${money(b.total)}</strong><p>Recebido: ${money(receivedFor(b, state.payments))} · Saldo: ${money(balanceFor(b, state.payments))}</p>${btn('Ver lançamento', 'bill-detail', 'arrow', 'text', `data-id="${b.id}"`)}</div>`).join('') || empty('Nenhum lançamento financeiro.');
    modal('História da cliente', `<div class="dialog-body"><div class="profile-header">${avatar(c, 'lg')}<div><h3>${esc(c.name)}</h3><span class="muted small">Um cuidado com nome, contexto e história.</span></div></div><div class="tabs profile-tabs">${tabs.map(([v, t]) => `<button data-action="profile-tab" data-tab="${v}" data-id="${id}" class="${tab === v ? 'active' : ''}">${t}</button>`).join('')}</div><div class="profile-section">${body}</div></div>`, btn('Editar cadastro', 'edit-client', 'edit', 'secondary', `data-id="${id}"`) + btn('Agendar', 'new-appointment', 'plus', 'primary', `data-client="${id}"`), true);
}
/**
 * appointmentForm — Abre agendamento com duração e intervalo do serviço.
 */
function appointmentForm(data = {}, blocked = false) {
    if (!blocked && !state.services.length) { toast('Cadastre um serviço antes de agendar.'); go('services'); return; }
    const s = service(state.services[0]?.id), date = data.date || ui.date;
    const clientFields = `<section class="booking-client full" aria-label="Cliente do agendamento"><input type="hidden" name="clientMode" value="existing"><div class="booking-client-head"><strong>Quem vem ao ateliê?</strong><button type="button" class="btn secondary sm" data-action="booking-client-mode" data-mode="new" aria-expanded="false" aria-controls="booking-new-client">${icon('plus')}Cadastrar nova cliente</button></div><div id="booking-existing-client">${selectField('Cliente cadastrada', 'clientId', [['', 'Selecione uma cliente'], ...clientOptions()], data.clientId || state.clients[0]?.id || '', 'required data-change="booking-client-selected"', true)}${!state.clients.length ? '<p class="muted small">Ainda não há clientes. Cadastre a primeira aqui mesmo.</p>' : ''}</div><fieldset id="booking-new-client" class="form-grid" hidden disabled><legend>Nova cliente</legend>${field('Nome da nova cliente', 'newClientName', '', 'text', 'required maxlength="100" autocomplete="name"', true)}${field('Telefone com DDD', 'newClientPhone', '', 'tel', 'required maxlength="30" autocomplete="tel" inputmode="tel" data-input="booking-phone"', true)}<div id="booking-match" class="full" role="status" aria-live="polite"></div>${selectField('Situação do cadastro', 'newClientStatus', [['temporary', 'Temporário'], ['permanent', 'Confirmado']], 'temporary', '', true)}<p class="notice full">Cliente e agendamento serão salvos juntos ao confirmar. Escolha Confirmado apenas depois de conferir nome e telefone.</p></fieldset><div class="booking-selected full" id="booking-selected" role="status" aria-live="polite"></div></section>`;
    openForm(blocked ? 'Um espaço para você' : 'Novo agendamento', blocked ? 'block' : 'appointment', blocked ? field('Motivo do bloqueio', 'label', '', 'text', 'required maxlength="100"', true) : clientFields + selectField('Serviço', 'serviceId', serviceOptions(), s.id, 'required data-change="appointment-service"', true), blocked ? 'Registrar bloqueio' : 'Confirmar agendamento');
    const form = document.querySelector('dialog form'), grid = form.querySelector('.form-grid');
    grid.insertAdjacentHTML('beforeend', field('Data', 'date', date, 'date', 'required') + field('Horário', 'time', availableSlots(date, blocked ? 60 : s.duration, blocked ? 0 : s.buffer)[0] || state.settings.open, 'time', 'required') + field('Duração (min)', 'duration', blocked ? 60 : s.duration, 'number', 'required min="15" max="600" step="5"') + field('Intervalo após (min)', 'buffer', blocked ? 0 : s.buffer, 'number', 'required min="0" max="120" step="5"') + (blocked ? '' : selectField('Situação', 'status', [['confirmed', 'Confirmado'], ['pending', 'A confirmar']], 'confirmed', '', true)) + textfield('Observações', 'note', '', 'maxlength="2000"') + '<div class="notice full">O período só será reservado após sua confirmação. Horários de funcionamento, dias de folga e conflitos serão verificados.</div>');
    if (!blocked && !state.clients.length) setBookingClientMode(form, 'new', false);
}

/** Alterna somente a seção de cliente; os demais campos e os valores digitados permanecem no DOM. */
function setBookingClientMode(form, mode, focus = true) {
    if (!form || form.dataset.form !== 'appointment') return;
    const isNew = mode === 'new', section = form.querySelector('#booking-new-client'), select = form.elements.clientId, button = form.querySelector('[data-action="booking-client-mode"]');
    form.elements.clientMode.value = isNew ? 'new' : 'existing';
    section.hidden = !isNew; section.disabled = !isNew; select.disabled = isNew;
    form.querySelector('#booking-existing-client').hidden = isNew;
    button.dataset.mode = isNew ? 'existing' : 'new'; button.setAttribute('aria-expanded', String(isNew));
    button.innerHTML = isNew ? icon('users') + 'Escolher cliente existente' : icon('plus') + 'Cadastrar nova cliente';
    form.querySelector('#form-error').textContent = '';
    form.querySelector('#booking-selected').textContent = !isNew && select.value ? 'Cliente selecionada: ' + client(select.value).name : '';
    if (focus) { form.dataset.dirty = 'true'; (isNew ? form.elements.newClientName : select).focus(); }
}

/** Sugere o cadastro com o mesmo telefone; a associação continua dependendo de uma escolha explícita. */
function showBookingClientMatch(form) {
    const match = matchingClient(state.clients, form.elements.newClientPhone.value), area = form.querySelector('#booking-match');
    area.innerHTML = match ? `<div class="notice orange"><strong>Este telefone já está cadastrado.</strong><p>${esc(match.name)} · ${esc(match.phone)}</p>${btn('Usar este cadastro', 'booking-use-existing', 'users', 'secondary sm', `data-id="${esc(match.id)}"`)}</div>` : '';
}

/**
 * appointmentDetail — Mostra os detalhes e as ações manuais de um agendamento.
 */
function appointmentDetail(id) {
    const a = state.appointments.find(x => x.id === id);
    if (!a)
        return;
    if (a.status === 'completed') {
        const r = state.records.find(r => r.appointmentId === id);
        modal('Agendamento concluído', `<div class="dialog-body"><h3>${esc(client(a.clientId).name)}</h3><p class="notice">${longDate(a.date)} · ${a.time} · ${a.duration} min + ${a.buffer} min de intervalo<br>Concluído</p>${r ? destinationLink('Ver atendimento realizado', { page: 'services', record: r.id }, 'btn primary') : '<p class="muted">Nenhuma ficha vinculada encontrada.</p>'}</div>`, btn('Fechar', 'close-modal'));
        return;
    }
    const blocked = a.status === 'blocked';
    if (blocked) {
        openForm('Bloqueio de horário', 'delete-block', `<div class="full"><h3>${esc(a.label)}</h3><p class="muted small section-gap">${longDate(a.date)} · ${a.time} — ${clock(minutes(a.time) + a.duration)}</p><p class="muted small section-gap">${esc(a.note)}</p></div><div class="notice full">Confirme abaixo para remover este bloqueio e liberar o período.</div>`, 'Remover bloqueio', id);
        return;
    }
    openForm('Detalhes do atendimento', 'appointment-status', `<div class="row full">${avatar(client(a.clientId))}<div><h3>${esc(client(a.clientId).name)}</h3><p class="muted small" style="margin-top:7px">${esc(service(a.serviceId).name)}</p></div></div><div class="notice full">${longDate(a.date)} · ${a.time} — ${clock(minutes(a.time) + a.duration)}<br>+ ${a.buffer} min de intervalo reservado</div>` + selectField('Situação confirmada por você', 'status', Object.entries(statusLabel).filter(([k]) => !['blocked', 'completed'].includes(k)), a.status, '', true) + textfield('Observações', 'note', a.note, 'maxlength="2000"') + `<div class="full row wrap">${btn('Remarcar', 'reschedule', 'calendar', 'secondary', `data-id="${id}"`)}${btn('Concluir atendimento', 'new-record', 'scissors', 'secondary', `data-appointment="${id}"`)}</div>`, 'Salvar situação', id);
}
/**
 * reschedule — Abre alteração de data e horário sem criar outro compromisso.
 */
function reschedule(id) {
    const a = state.appointments.find(a => a.id === id);
    if (!a)
        return;
    openForm('Remarcar atendimento', 'reschedule', `<div class="notice full">${esc(client(a.clientId).name)} · ${esc(service(a.serviceId).name)}<br>Atual: ${fmt(a.date)} às ${a.time}</div>` + field('Nova data', 'date', a.date, 'date', 'required') + field('Novo horário', 'time', a.time, 'time', 'required') + '<div class="notice full">O horário anterior só será liberado após a validação e sua confirmação.</div>', 'Confirmar remarcação', id);
}
/**
 * serviceForm — Abre edição dos dados técnicos e do tempo de um serviço.
 */
function serviceForm(id) { const s = state.services.find(s => s.id === id); openForm(s ? 'Detalhes do cuidado' : 'Novo serviço', 'service', field('Nome do serviço', 'name', s?.name || '', 'text', 'required maxlength="120"', true) + textfield('Descrição', 'description', s?.description || '', 'required maxlength="2000"') + field('Duração (min)', 'duration', s?.duration || 60, 'number', 'required min="15" max="600" step="5"') + field('Intervalo após (min)', 'buffer', s?.buffer ?? 15, 'number', 'required min="0" max="120" step="5"') + textfield('Produtos utilizados', 'products', s?.products || '', 'maxlength="2000"') + textfield('Orientações anteriores', 'before', s?.before || '', 'maxlength="2000"') + textfield('Orientações posteriores', 'after', s?.after || '', 'maxlength="2000"') + `<div class="full"><span class="small">Campos obrigatórios na ficha técnica</span><div class="weekday-checks">${['Fórmula e cor', 'Produtos utilizados', 'Observações técnicas'].map(t => `<label><input type="checkbox" name="requiredFields" value="${t}" ${s?.required?.toLowerCase().includes(t.toLowerCase().split(' ')[0]) ? 'checked' : ''}>${t}</label>`).join('')}</div></div>` + '<div class="notice full">Alterar duração e intervalo vale para novos agendamentos. Os já registrados preservam os tempos originais.</div>', 'Salvar serviço', id || '', true); }
/**
 * updateRecordRequired — Ajusta campos técnicos obrigatórios do formulário legado de ficha; o fechamento atual usa o fluxo em etapas.
 */
function updateRecordRequired() {
    const f = document.querySelector('dialog form');
    if (!f)
        return;
    const s = service(f.elements.serviceId.value), config = (s.required || '').toLowerCase();
    f.elements.formula.required = config.includes('fórmula');
    f.elements.products.required = config.includes('produtos');
    f.elements.notes.required = config.includes('observações');
    document.getElementById('record-required').textContent = `Campos obrigatórios para este serviço: ${s.required || 'nenhum campo técnico adicional'}. Registros e alterações são confirmados por você.`;
}
// Fotos do orçamento em edição; só entram no estado após confirmação do formulário.
let quotePhotos = [];
/**
 * quoteForm — Abre orçamento com valor, avaliação e até três fotos locais.
 */
function quoteForm(id) {
    const q = state.quotes.find(q => q.id === id);
    quotePhotos = [...(q?.photos || [])];
    openForm(q ? 'Avaliar solicitação' : 'Novo orçamento', 'quote', selectField('Cliente', 'clientId', clientOptions(), q?.clientId || state.clients[0]?.id, 'required') + selectField('Serviço solicitado', 'serviceId', serviceOptions(), q?.serviceId || state.services[0]?.id, 'required') + selectField('Etapa da avaliação', 'status', Object.entries(quoteLabel), q?.status || 'review', 'required') + field('Valor definido por você (R$)', 'value', q?.value ?? '', 'number', 'min="0.01" max="100000" step="0.01"') + textfield('Contexto, histórico e informações ausentes', 'notes', q?.notes || '', 'maxlength="3000"') + textfield('Perguntas para revisar e copiar', 'question', q?.question || '', 'maxlength="3000"') + `<div class="full"><label class="field"><span>Fotos associadas manualmente</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-change="quote-photos"><small>Até 3 fotos, com no máximo 500 KB cada. Sem análise visual.</small></label><div class="photos" id="quote-photos">${photoMarkup()}</div></div>` + '<div class="notice full">Salvar registra sua avaliação. Nenhuma proposta ou pergunta é enviada à cliente. Copie o texto revisado para usar no seu canal de atendimento.</div>', 'Salvar avaliação', id || '', true);
    if (q?.question)
        document.querySelector('dialog .dialog-footer').insertAdjacentHTML('afterbegin', btn('Copiar perguntas', 'copy-question', 'copy', 'secondary'));
}
/**
 * photoMarkup — Renderiza prévias das fotos do orçamento mantidas temporariamente em memória.
 */
function photoMarkup() { return quotePhotos.map((p, i) => `<div class="photo"><img src="${esc(p)}" alt="Referência associada ao orçamento ${i + 1}"><button type="button" data-action="remove-photo" data-index="${i}" aria-label="Remover foto ${i + 1}">${icon('close')}</button></div>`).join(''); }
/**
 * billForm — Abre lançamento manual de valor a receber de uma cliente.
 */
function billForm() { openForm('Novo lançamento', 'bill', selectField('Cliente', 'clientId', clientOptions(), state.clients[0]?.id, 'required', true) + field('Descrição do serviço', 'description', '', 'text', 'required maxlength="160"', true) + field('Valor total (R$)', 'total', '', 'number', 'required min="0.01" max="100000" step="0.01"') + field('Data do serviço', 'date', localDate(), 'date', 'required') + field('Vencimento', 'due', localDate(), 'date', 'required', true) + '<div class="notice full">O lançamento cria um saldo a receber. Sinais e pagamentos são registrados separadamente.</div>', 'Criar lançamento'); }
/**
 * taskForm — Abre cadastro ou edição de tarefa interna.
 */
function taskForm(id) { const t = state.tasks.find(t => t.id === id); openForm(t ? 'Cuidar desta tarefa' : 'Uma nova tarefa', 'task', field('O que precisa ser feito?', 'title', t?.title || '', 'text', 'required maxlength="180"', true) + selectField('Área', 'area', ['Atendimento', 'Agenda', 'Clientes', 'Financeiro', 'Operação'].map(t => [t, t]), t?.area || 'Atendimento', 'required') + selectField('Prioridade', 'priority', ['Alta', 'Média', 'Baixa'].map(t => [t, t]), t?.priority || 'Média', 'required') + field('Prazo', 'due', t?.due || localDate(), 'date', 'required') + selectField('Cliente relacionado', 'clientId', [['', 'Nenhum'], ...clientOptions()], t?.clientId || ''), 'Salvar tarefa', id || ''); }
/**
 * reviewDraft — Permite revisar um texto de resposta antes de copiá-lo; não envia mensagens.
 */
function reviewDraft(id, followup = false) { const v = state.conversations.find(v => v.id === id), r = state.records.find(r => r.id === id); const text = followup ? `Oi, ${client(r.clientId).name.split(' ')[0]}! Tudo bem? Estou passando para saber como ficou o resultado do nosso último atendimento e conversar sobre os próximos cuidados.` : v?.draft || ''; openForm(followup ? 'O cuidado continua' : 'Revisar rascunho', 'draft', `<input type="hidden" name="followup" value="${followup}">` + textfield('Edite e confira antes de copiar', 'text', text, 'required maxlength="4000"') + '<div class="notice full">Copiar prepara o texto revisado para envio manual. Faça o envio manual no seu canal, após revisar a orientação e a destinatária.</div>', 'Confirmar e copiar', id); }
/**
 * copyText — Copia texto para a área de transferência e informa o resultado.
 */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        (document.getElementById('dialog') || document.body).appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        }
        catch { }
        ta.remove();
        return ok;
    }
}
/**
 * exportModal — Abre seleção de categoria, período e formato de exportação.
 */
function exportModal() { openForm('Leve seus registros com você', 'export', selectField('Dados para exportar', 'kind', [['clients', 'Clientes'], ['appointments', 'Agendamentos'], ['records', 'Atendimentos realizados'], ['payments', 'Recebimentos'], ['expenses', 'Despesas'], ['stock', 'Estoque'], ['cards', 'Repasses do cartão']], ui.page === 'finance' ? 'payments' : 'clients', 'required', true) + field('Data inicial (opcional)', 'from', '', 'date') + field('Data final (opcional)', 'to', '', 'date') + selectField('Formato', 'format', [['csv', 'CSV · compatível com planilhas'], ['pdf', 'PDF · impressão do navegador']], 'csv', 'required', true) + '<div class="notice full">CSV pode ser aberto em aplicativos de planilhas. A opção PDF abre um relatório para imprimir ou salvar em PDF. Exportação XLSX nativa ainda não está disponível.</div>', 'Gerar relatório'); }
/**
 * legacyExportRows — Mantém o mapeamento de exportação anterior; o fluxo atual utiliza exportRows.
 */
function legacyExportRows(kind, from = '', to = '') {
    const inRange = d => (!from || d >= from) && (!to || d <= to);
    if (kind === 'clients')
        return [['Nome', 'Telefone', 'Cadastro', 'Observações', 'Alerta'], ...state.clients.map(c => [c.name, c.phone, c.status === 'temporary' ? 'Temporário' : 'Confirmado', c.note, c.alert])];
    if (kind === 'appointments')
        return [['Data', 'Horário', 'Cliente', 'Serviço', 'Duração', 'Intervalo', 'Situação'], ...state.appointments.filter(a => inRange(a.date)).map(a => [a.date, a.time, client(a.clientId).name, a.label || service(a.serviceId).name, a.duration, a.buffer, statusLabel[a.status]])];
    if (kind === 'records')
        return [['Data', 'Cliente', 'Serviço', 'Fórmula', 'Produtos', 'Observações', 'Manutenção'], ...state.records.filter(r => inRange(r.date)).map(r => [r.date, client(r.clientId).name, service(r.serviceId).name, r.formula, r.products, r.notes, r.followup])];
    return [['Data', 'Cliente', 'Descrição', 'Valor recebido', 'Método', 'Tipo'], ...state.payments.filter(p => inRange(p.date)).map(p => { const b = state.bills.find(b => b.id === p.billId); return [p.date, client(b?.clientId).name, b?.description, p.amount.toFixed(2), p.method, p.kind]; })];
}
/**
 * download — Cria e descarrega arquivo no navegador, liberando a URL temporária.
 */
function download(content, name, type) { const url = URL.createObjectURL(new Blob([content], { type })), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
/**
 * exportData — Gera CSV, cópia JSON ou impressão conforme seleção; identifica dados fictícios.
 */
function exportData(kind, from = '', to = '', format = 'csv') {
    const rows = exportRows(kind, from, to);
    if (format === 'pdf') {
        modal('Relatório para impressão', `<div class="dialog-body"><p class="small muted">Use “Salvar em PDF” na janela de impressão do navegador.</p><div class="table-wrap section-gap" id="print-report"><h2>Hanne · ${esc({ clients: 'Clientes', appointments: 'Agendamentos', records: 'Atendimentos realizados', payments: 'Recebimentos', expenses: 'Despesas', stock: 'Estoque', cards: 'Repasses do cartão' }[kind])}</h2><p class="small muted">${dataset === 'example' ? 'DADOS FICTÍCIOS' : 'Registros reais'} · gerado em ${new Date().toLocaleString('pt-BR')}<br>${from || 'Início'} a ${to || 'hoje'}</p><table class="data-table section-gap"><thead><tr>${rows[0].map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row => `<tr>${row.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`, btn('Imprimir / salvar PDF', 'print-report', 'print', 'primary'), true);
        return;
    }
    download('\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n'), `hanne-${dataset === 'example' ? 'exemplo-' : ''}${kind}-${localDate()}.csv`, 'text/csv;charset=utf-8');
    audit('Exportação CSV: ' + kind);
    persist();
    toast('Arquivo CSV preparado.');
}
// Prévia da importação aguardando revisão explícita dos vínculos.
let importCandidate = null;
/**
 * importTemplate — Descarrega modelo CSV para clientes ou agendamentos.
 */
function importTemplate(kind) { const text = kind === 'clients' ? 'nome;telefone\nCliente Exemplo;(41) 90000-0099\n' : 'data;hora;nome;telefone;servico;duracao;intervalo\n' + dayOffset(1) + ';14:00;Cliente Exemplo;(41) 90000-0099;Corte & finalização;60;15\n'; download('\uFEFF' + text, `modelo-hanne-${kind}.csv`, 'text/csv;charset=utf-8'); }
/**
 * importModal — Abre a seleção do CSV e o processo de conferência antes de importar.
 */
function importModal(kind) { importCandidate = null; openForm('Importar com cuidado', 'import', `<input type="hidden" name="kind" value="${kind}"><div class="notice full">${kind === 'clients' ? 'Colunas obrigatórias: nome, telefone. Os contatos entram como temporários.' : 'Colunas: data (AAAA-MM-DD), hora (HH:MM), nome, telefone, servico, duracao, intervalo. Clientes e serviços devem existir e cada associação será apresentada para revisão.'}<br>Até 100 linhas por importação. O arquivo deve seguir o modelo; exportações do Minha Agenda podem exigir adaptação.</div><div class="full">${btn('Baixar modelo CSV', 'import-template', 'download', 'secondary sm', `data-kind="${kind}"`)}</div><label class="field full"><span>Selecione o arquivo CSV</span><input type="file" name="file" accept=".csv,text/csv" required data-change="import-file"></label><div class="full" id="import-preview"></div>`, 'Validar arquivo', '', true); }
/**
 * validateAppointment — Valida expediente, folgas, duração e conflitos antes de alterar a agenda.
 */
function validateAppointment(candidate, ignoreId) { return validateBookingSlot(state, candidate, ignoreId); }

/**
 * alerts — Monta alertas internos do painel; não produz notificações externas.
 */
function alerts() { const urgent = pendingConvs().filter(v => ['Segurança', 'Agendamento urgente', 'Reclamação'].includes(v.category)); modal('O que merece atenção', `<div class="dialog-body">${urgent.map(v => `<button class="search-result" data-action="open-conversation" data-id="${v.id}">${icon(v.category === 'Segurança' ? 'warning' : 'chat')}<div><span>${esc(client(v.clientId).name)}</span><small>${esc(v.category)} · ${esc(v.summary)}</small></div>${icon('arrow')}</button>`).join('') || (overdueItems().total || lowStock().length ? '' : empty('Nenhum alerta prioritário.', 'Siga cuidando do seu dia.'))}${overdueItems().total ? `<h3 class="section-gap">Vencidos no financeiro</h3>${overdueRows(10)}` : ''}${lowStock().map(lowStockRow).join('')}<div class="notice section-gap">Alertas desta versão aparecem apenas no painel aberto. Notificações fora do aplicativo ainda não estão ativas.</div>${state.tasks.filter(t => !t.done && t.due < localDate()).map(t => `<div class="audit-row">${pill('Tarefa em atraso', 'orange')}<p style="margin-top:8px">${esc(t.title)}</p></div>`).join('')}</div>`, btn('Ver tarefas', 'nav', 'arrow', 'primary', 'data-page="tasks"'), true); }
/**
 * searchModal — Abre a pesquisa global por registros.
 */
function searchModal() { modal('Encontre no seu ateliê', `<div class="dialog-body"><label class="field"><span>Clientes, serviços e conversas</span><input id="global-search" class="search-input" type="search" placeholder="Digite um nome, serviço ou assunto..." data-input="global-search" autocomplete="off"></label><div id="search-results" class="search-results section-gap">${searchResults('')}</div></div>`); }
/**
 * searchResults — Monta resultados da busca conforme o texto informado.
 */
function searchResults(query) {
    const q = query.toLowerCase(), results = [];
    for (const c of state.clients)
        if (c.name.toLowerCase().includes(q) || c.phone.includes(q))
            results.push({ ic: 'users', title: c.name, sub: 'Cliente · ' + c.phone, action: 'client-profile', id: c.id });
    for (const s of state.services)
        if (s.name.toLowerCase().includes(q))
            results.push({ ic: 'scissors', title: s.name, sub: 'Serviço · ' + s.duration + ' min', action: 'edit-service', id: s.id });
    if (q)
        for (const v of state.conversations)
            if ((v.summary + ' ' + v.category).toLowerCase().includes(q))
                results.push({ ic: 'chat', title: client(v.clientId).name, sub: 'Conversa · ' + v.category, action: 'open-conversation', id: v.id });
    return results.slice(0, 12).map(r => `<button class="search-result" data-action="${r.action}" data-id="${r.id}">${icon(r.ic)}<div class="grow"><span>${esc(r.title)}</span><small>${esc(r.sub)}</small></div>${icon('arrow')}</button>`).join('') || empty('Nada encontrado.', 'Tente outro termo.', 'search');
}
/**
 * redrawInput — Atualiza resultados de campo sem perder posição de digitação.
 */
function redrawInput(id) {
    const input = document.getElementById(id), pos = input?.selectionStart;
    render();
    const next = document.getElementById(id);
    if (next) {
        next.focus();
        next.setSelectionRange(pos, pos);
    }
}
/**
 * Delegação de input: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('input', e => {
    if (e.target.getAttribute?.('aria-invalid') === 'true' && e.target.checkValidity?.()) e.target.removeAttribute('aria-invalid');
    if (e.target.form) e.target.form.dataset.dirty = 'true';
    if (e.target.name === 'firstDue') e.target.dataset.touched = 'true';
    if (e.target.dataset.input === 'booking-phone') showBookingClientMatch(e.target.form);
    if (e.target.tagName === 'TEXTAREA') { e.target.style.height = 'auto'; e.target.style.height = Math.min(420, Math.max(115, e.target.scrollHeight)) + 'px'; }
    if (e.target.dataset.input === 'client-search') {
        ui.clientQuery = e.target.value;
        redrawInput('client-search');
    }
    if (e.target.dataset.input === 'global-search')
        document.getElementById('search-results').innerHTML = searchResults(e.target.value);
});
/**
 * Delegação de change: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('change', async (e) => {
    const t = e.target, action = t.dataset.change;
    if (t.form) t.form.dataset.dirty = 'true';
    if (!action)
        return;
    if (action === 'client-filter') {
        ui.clientFilter = t.value;
        render();
    }
    if (action === 'conv-filter') {
        ui.convFilter = t.value;
        render();
    }
    if (action === 'agenda-date') {
        if (t.value) {
            ui.date = t.value;
            render();
        }
    }
    if (action === 'booking-client-selected') { const selected = t.form.querySelector('#booking-selected'); selected.textContent = t.value ? 'Cliente selecionada: ' + client(t.value).name : ''; }
    if (action === 'appointment-service') {
        const f = t.form, s = service(t.value);
        f.elements.duration.value = s.duration;
        f.elements.buffer.value = s.buffer;
        const slot = availableSlots(f.elements.date.value, s.duration, s.buffer)[0];
        if (slot)
            f.elements.time.value = slot;
    }
    if (action === 'record-service')
        updateRecordRequired();
    if (action === 'quote-photos') {
        const files = [...t.files];
        if (quotePhotos.length + files.length > 3) {
            toast('Escolha até 3 fotos por orçamento.');
            t.value = '';
            return;
        }
        if (files.some(f => f.size > 500000 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) {
            toast('Use fotos JPG, PNG ou WebP com até 500 KB cada.');
            t.value = '';
            return;
        }
        const photos = await Promise.all(files.map(f => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); }))).catch(() => null);
        if (photos) {
            quotePhotos.push(...photos);
            const container = document.getElementById('quote-photos');
            if (container)
                container.innerHTML = photoMarkup();
        }
        else
            toast('Não foi possível ler a imagem.');
        t.value = '';
    }
    if (action === 'import-file') {
        importCandidate = null;
        document.getElementById('import-preview').innerHTML = '';
        t.form.querySelector('[type=submit]').innerHTML = icon('check') + 'Validar arquivo';
    }
});
/**
 * Delegação de keydown: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchModal();
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-action]')) {
        e.preventDefault();
        e.target.click();
    }
});
/**
 * Delegação de click: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target)
        return;
    const a = target.dataset.action, id = target.dataset.id;
    if (a === 'nav') {
        closeModal();
        go(target.dataset.page);
    }
    if (a === 'mobile-menu') {
        ui.mobile = !ui.mobile;
        render();
    }
    if (a === 'close-modal')
        closeModal();
    if (a === 'help')
        help();
    if (a === 'alerts')
        alerts();
    if (a === 'search')
        searchModal();
    if (a === 'focus') {
        state.focus = !state.focus;
        audit(state.focus ? 'Modo de foco ativado' : 'Modo de foco encerrado');
        persist(state.focus ? 'Modo de foco ativo. Alertas de segurança continuam em destaque.' : 'Modo de foco encerrado.');
        render();
    }
    if (a === 'dash-tab') {
        ui.dashTab = id;
        render();
    }
    if (a === 'select-day') {
        ui.date = target.dataset.date;
        render();
    }
    if (a === 'client-view') {
        ui.clientView = id;
        render();
    }
    if (a === 'open-conversation') {
        closeModal();
        ui.page = 'conversations';
        ui.convFilter = 'all';
        ui.conversationId = id;
        ui.threadOpen = true;
        ui.mobile = false;
        const v = state.conversations.find(v => v.id === id);
        if (v) {
            v.unread = false;
            persist();
        }
        render();
        window.scrollTo(0, 0);
    }
    if (a === 'select-conversation') {
        ui.conversationId = id;
        ui.threadOpen = true;
        const v = state.conversations.find(v => v.id === id);
        if (v) {
            v.unread = false;
            persist();
        }
        render();
    }
    if (a === 'back-inbox') {
        ui.threadOpen = false;
        render();
    }
    if (a === 'resolve-conversation') {
        const v = state.conversations.find(v => v.id === id);
        openForm(v.status === 'resolved' ? 'Reabrir conversa' : 'Concluir atendimento', 'resolve', `<div class="notice full">${esc(client(v.clientId).name)}<br>${v.status === 'resolved' ? 'A conversa voltará à fila de pendências.' : 'Confirme que você avaliou e resolveu as solicitações desta conversa. Esta ação não conclui tarefas vinculadas automaticamente.'}</div>`, 'Confirmar', id);
    }
    if (a === 'classify') {
        const v = state.conversations.find(v => v.id === id);
        openForm('Revisar classificação', 'classify', selectField('Categoria confirmada por você', 'category', ['Segurança', 'Agendamento urgente', 'Pós-procedimento', 'Orçamento', 'Informações gerais', 'Reclamação', 'Exige esclarecimentos', 'Spam ou suspeita'].map(t => [t, t]), v.category, 'required', true) + '<div class="notice full">A correção fica no histórico desta conta. A integração com IA ainda está pendente.</div>', 'Confirmar categoria', id);
    }
    if (a === 'client-profile')
        profile(id);
    if (a === 'profile-tab')
        profile(id, target.dataset.tab);
    if (a === 'new-client')
        clientForm();
    if (a === 'edit-client')
        clientForm(id);
    if (a === 'booking-client-mode') setBookingClientMode(target.closest('form'), target.dataset.mode);
    if (a === 'booking-use-existing') { const form = target.closest('form'); if (state.clients.some(c => c.id === id)) { form.elements.clientId.value = id; setBookingClientMode(form, 'existing'); } }
    if (a === 'new-appointment')
        appointmentForm({ date: target.dataset.date, clientId: target.dataset.client });
    if (a === 'new-block')
        appointmentForm({}, true);
    if (a === 'appointment-detail')
        appointmentDetail(id);
    if (a === 'reschedule')
        reschedule(id);
    if (a === 'agenda-prev' || a === 'agenda-next') {
        ui.date = dayOffset((a === 'agenda-prev' ? -1 : 1) * (ui.agendaView === 'day' ? 1 : 5), ui.date);
        render();
    }
    if (a === 'agenda-today') {
        ui.date = localDate();
        render();
    }
    if (a === 'agenda-view') {
        ui.agendaView = id;
        render();
    }
    if (a === 'service-tab') {
        ui.serviceTab = id;
        render();
    }
    if (a === 'new-service')
        serviceForm();
    if (a === 'edit-service')
        serviceForm(id);
    if (a === 'new-record')
        finishForm(target.dataset.appointment);
    if (a === 'edit-record')
        recordForm(id);
    if (a === 'new-quote')
        quoteForm();
    if (a === 'edit-quote')
        quoteForm(id);
    if (a === 'quote-filter') {
        ui.quoteFilter = id;
        render();
    }
    if (a === 'remove-photo') {
        quotePhotos.splice(Number(target.dataset.index), 1);
        document.getElementById('quote-photos').innerHTML = photoMarkup();
    }
    if (a === 'copy-question') {
        const text = document.querySelector('dialog form').elements.question.value;
        if (!text.trim())
            toast('Escreva as perguntas antes de copiar.');
        else
            toast(await copyText(text) ? 'Perguntas copiadas. Revise a destinatária antes de enviar.' : 'Não foi possível copiar. Selecione o texto manualmente.');
    }
    if (a === 'new-bill')
        billForm();
    if (a === 'new-payment')
        paymentForm(id);
    if (a === 'bill-detail')
        billDetail(id);
    if (a === 'finance-period') {
        ui.financePeriod = id;
        render();
    }
    if (a === 'new-task')
        taskForm();
    if (a === 'edit-task')
        taskForm(id);
    if (a === 'task-filter') {
        ui.taskFilter = id;
        render();
    }
    if (a === 'toggle-task') {
        const t = state.tasks.find(t => t.id === id);
        t.done = !t.done;
        audit(`${t.done ? 'Tarefa concluída' : 'Tarefa reaberta'}: ${t.title}`, !t.done, t.done);
        persist(t.done ? 'Tarefa concluída por você.' : 'Tarefa reaberta.');
        render();
    }
    if (a === 'review-draft')
        reviewDraft(id);
    if (a === 'followup')
        reviewDraft(id, true);
    if (a === 'export')
        exportData(target.dataset.kind);
    if (a === 'export-modal')
        exportModal();
    if (a === 'import')
        importModal(target.dataset.kind);
    if (a === 'import-template')
        importTemplate(target.dataset.kind);
    if (a === 'backup') {
        download(JSON.stringify(state, null, 2), `hanne-${dataset === 'example' ? 'exemplo' : 'dados'}-${localDate()}.json`, 'application/json');
        toast('Cópia dos registros preparada.');
    }
    if (a === 'reset-confirm')
        openForm('Recomeçar a demonstração', 'reset', '<div class="notice orange full">Seus testes na sua conta serão substituídos pelos dados fictícios iniciais. Exporte uma cópia antes, se quiser preservá-los.</div><label class="row full small"><input type="checkbox" required>Confirmo a substituição dos meus testes.</label>', 'Restaurar dados fictícios');
    if (a === 'audit')
        modal('Histórico de ações', `<div class="dialog-body">${state.audit.map(x => `<div class="audit-row"><strong>${esc(x.action)}</strong><time>${new Date(x.at).toLocaleString('pt-BR')} · ${esc(x.by)}</time>${x.before !== '' ? `<p class="muted tiny">Antes: ${esc(typeof x.before === 'string' ? x.before : JSON.stringify(x.before))}</p>` : ''}${x.after !== '' ? `<p class="muted tiny">Depois: ${esc(typeof x.after === 'string' ? x.after : JSON.stringify(x.after))}</p>` : ''}</div>`).join('')}</div>`, btn('Fechar', 'close-modal'), true);
    if (a === 'integrations') {
        whatsapp.configure();
    }
    if (a === 'print-report') {
        const section = document.getElementById('print-report');
        if (!section)
            return;
        const print = document.createElement('div');
        print.id = 'print-area';
        print.innerHTML = section.innerHTML;
        document.body.appendChild(print);
        window.print();
        print.remove();
    }
});
/**
 * Delegação de submit: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('submit', async (e) => {
    const form = e.target, kind = form.dataset.form;
    if (!kind || kind.startsWith('v2-') || kind.startsWith('wa-'))
        return;
    e.preventDefault();
    const fd = new FormData(form), val = n => String(fd.get(n) || '').trim(), id = val('id');
    const error = document.getElementById(kind === 'settings' ? 'settings-error' : 'form-error');
    if (error)
        error.textContent = '';
    let message = 'Alterações salvas na sua conta.';
    try {
        for (const el of form.querySelectorAll('input[required]:not(:disabled),textarea[required]:not(:disabled)'))
            if (['text', 'tel', 'search'].includes(el.type) || el.tagName === 'TEXTAREA') {
                if (!el.value.trim())
                    throw new Error('Preencha os campos obrigatórios com informações válidas.');
            }
        if (kind === 'settings') {
            if (minutes(val('close')) <= minutes(val('open')))
                throw new Error('O fim do expediente precisa ser após o início.');
            if (fd.getAll('closedDays').length === 7)
                throw new Error('Escolha ao menos um dia de funcionamento.');
            const before = { ...state.settings };
            state.settings = { ...state.settings, name: val('name'), open: val('open'), close: val('close'), closedDays: fd.getAll('closedDays').map(Number), responseMinutes: Number(val('responseMinutes')) };
            audit('Rotina do ateliê alterada', before, state.settings);
            persist('Rotina salva.');
            render();
            return;
        }
        if (kind === 'client') {
            const c = state.clients.find(c => c.id === id);
            validateClientContact({ name: val('name'), phone: val('phone') }, state.clients, id);
            const data = { name: val('name'), phone: val('phone'), status: val('status'), note: val('note'), alert: val('alert'), alertDate: c?.alert === val('alert') ? c?.alertDate : localDate() };
            if (c) {
                const before = { ...c };
                Object.assign(c, data);
                audit('Cadastro atualizado: ' + c.name, before, { ...c });
            }
            else {
                state.clients.push({ id: uid(), color: ['rose', 'olive', 'sand', 'lilac'][state.clients.length % 4], ...data });
                audit('Cadastro criado e confirmado manualmente: ' + data.name, '', data);
            }
            message = 'Cadastro salvo com sua confirmação.';
        }
        if (kind === 'appointment' || kind === 'block') {
            const data = { date: val('date'), time: val('time'), duration: Number(val('duration')), buffer: Number(val('buffer')), note: val('note'), status: kind === 'block' ? 'blocked' : val('status'), ...(kind === 'block' ? { clientId: null, serviceId: null, label: val('label') } : { clientId: val('clientId'), serviceId: val('serviceId') }) };
            const isNew = kind === 'appointment' && val('clientMode') === 'new';
            const result = createBooking(state, data, { appointmentId: uid(), clientId: isNew ? uid() : undefined, contact: isNew ? { name: val('newClientName'), phone: val('newClientPhone'), status: val('newClientStatus') } : null });
            state = result.state;
            ui.date = data.date;
            audit(kind === 'block' ? 'Bloqueio manual registrado' : isNew ? 'Cliente e agendamento criados juntos' : 'Agendamento manual confirmado', '', { appointmentId: result.appointment.id, clientId: result.appointment.clientId, date: data.date, time: data.time });
            message = kind === 'block' ? 'Período bloqueado por você.' : isNew ? 'Cliente cadastrada e agendamento confirmado.' : 'Agendamento registrado por você.';
        }
        if (kind === 'reschedule') {
            const a = state.appointments.find(a => a.id === id), before = { ...a }, data = { ...a, date: val('date'), time: val('time') };
            validateAppointment(data, id);
            Object.assign(a, data, { status: a.status === 'cancelled' || a.status === 'absent' ? 'pending' : a.status });
            audit('Atendimento remarcado manualmente', before, { ...a });
            message = 'Horário atualizado. Nenhuma mensagem foi enviada.';
        }
        if (kind === 'appointment-status') {
            const a = state.appointments.find(a => a.id === id), before = { ...a }, status = val('status');
            if (!['cancelled', 'absent'].includes(status))
                validateAppointment(a, id);
            a.status = status;
            a.note = val('note');
            audit('Situação de atendimento confirmada', before, { ...a });
            message = 'Situação atualizada por você.';
        }
        if (kind === 'delete-block') {
            const a = state.appointments.find(a => a.id === id);
            state.appointments = state.appointments.filter(a => a.id !== id);
            audit('Bloqueio removido manualmente', a, 'Removido');
            message = 'Período liberado.';
        }
        if (kind === 'service') {
            const s = state.services.find(s => s.id === id), data = { name: val('name'), description: val('description'), duration: Number(val('duration')), buffer: Number(val('buffer')), products: val('products'), before: val('before'), after: val('after'), required: fd.getAll('requiredFields').join('; ') };
            if (s) {
                const before = { ...s };
                Object.assign(s, data);
                audit('Serviço alterado: ' + s.name, before, { ...s });
            }
            else {
                state.services.push({ id: uid(), ...data });
                audit('Serviço cadastrado: ' + data.name, '', data);
            }
            message = 'Catálogo atualizado. Agendamentos existentes foram preservados.';
        }
        if (kind === 'record') {
            if (val('date') > localDate())
                throw new Error('Registre serviços realizados até a data de hoje.');
            const linked = state.appointments.find(a => a.id === val('appointmentId'));
            if (linked && (['cancelled', 'absent', 'blocked'].includes(linked.status) || linked.clientId !== val('clientId') || linked.serviceId !== val('serviceId') || linked.date !== val('date')))
                throw new Error('Para concluir este atendimento, mantenha cliente, serviço e data do agendamento. Faça a remarcação antes, se necessário.');
            const r = state.records.find(r => r.id === id), s = service(val('serviceId')), cfg = (s.required || '').toLowerCase();
            if ((cfg.includes('fórmula') && !val('formula')) || (cfg.includes('produtos') && !val('products')) || (cfg.includes('observações') && !val('notes')))
                throw new Error('Preencha os campos obrigatórios configurados para este serviço.');
            if (val('followup') && val('followup') < val('date'))
                throw new Error('A manutenção precisa ser na data do serviço ou depois.');
            const data = { clientId: val('clientId'), serviceId: val('serviceId'), date: val('date'), followup: val('followup'), formula: val('formula'), products: val('products'), notes: val('notes') };
            if (r) {
                const before = { ...r };
                Object.assign(r, data);
                audit('Ficha técnica revisada', before, { ...r });
            }
            else {
                state.records.push({ id: uid(), ...data });
                audit('Serviço realizado registrado', '', data);
            }
            const a = state.appointments.find(a => a.id === val('appointmentId'));
            if (a) {
                const before = { ...a };
                a.status = 'completed';
                audit('Atendimento concluído com ficha', before, { ...a });
            }
            message = 'Ficha confirmada. Acompanhamentos exigem sua revisão.';
        }
        if (kind === 'quote') {
            const q = state.quotes.find(q => q.id === id), value = val('value') === '' ? null : Number(val('value'));
            if (val('status') === 'approved' && value === null)
                throw new Error('Defina manualmente o valor antes de marcar como avaliado.');
            const data = { clientId: val('clientId'), serviceId: val('serviceId'), status: val('status'), value, notes: val('notes'), question: val('question'), photos: [...quotePhotos] };
            if (q) {
                const before = { ...q, photos: q.photos.map(() => '(foto)') };
                Object.assign(q, data);
                audit('Orçamento revisado pela profissional', before, { ...q, photos: q.photos.map(() => '(foto)') });
            }
            else {
                state.quotes.push({ id: uid(), date: localDate(), ...data });
                audit('Orçamento criado manualmente', '', { ...data, photos: data.photos.map(() => '(foto)') });
            }
            message = 'Avaliação salva. Nenhuma mensagem foi enviada.';
        }
        if (kind === 'bill') {
            if (!state.settings.cutoff)
                throw new Error('Confirme a data de início em Preparar operação.');
            const total = Number(val('total'));
            if (!Number.isFinite(total) || total <= 0)
                throw new Error('Informe um valor total válido.');
            const data = { id: uid(), clientId: val('clientId'), description: val('description'), total, date: val('date'), due: val('due') };
            state.bills.push(data);
            audit('Lançamento financeiro criado', '', data);
            message = 'Lançamento criado. Registre os recebimentos separadamente.';
        }
        if (kind === 'payment') {
            const b = state.bills.find(b => b.id === id), amount = Math.round(Number(val('amount')) * 100) / 100;
            if (!b || !Number.isFinite(amount) || amount <= 0 || amount > balanceFor(b, state.payments))
                throw new Error('O recebimento deve ser positivo e não pode ultrapassar o saldo.');
            const data = { id: uid(), billId: id, amount, date: val('date'), method: val('method'), kind: val('kind') };
            state.payments.push(data);
            audit('Recebimento confirmado manualmente', '', data);
            message = 'Recebimento registrado. Nenhuma transação foi executada.';
        }
        if (kind === 'task') {
            const t = state.tasks.find(t => t.id === id), data = { title: val('title'), area: val('area'), priority: val('priority'), due: val('due'), clientId: val('clientId') || null };
            if (t) {
                const before = { ...t };
                Object.assign(t, data);
                audit('Tarefa alterada', before, { ...t });
            }
            else {
                state.tasks.push({ id: uid(), done: false, ...data });
                audit('Tarefa criada', '', data);
            }
            message = 'Tarefa salva.';
        }
        if (kind === 'note') {
            const v = state.conversations.find(v => v.id === id);
            if (!val('text'))
                throw new Error('Escreva uma observação antes de salvar.');
            v.messages.push({ text: val('text'), type: 'note', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
            audit('Nota interna registrada: ' + client(v.clientId).name);
            message = 'Nota interna salva. Não foi enviada à cliente.';
        }
        if (kind === 'classify') {
            const v = state.conversations.find(v => v.id === id), before = v.category;
            v.category = val('category');
            audit('Classificação corrigida manualmente', before, v.category);
            message = 'Categoria atualizada por você.';
        }
        if (kind === 'resolve') {
            const v = state.conversations.find(v => v.id === id), before = v.status;
            v.status = v.status === 'resolved' ? 'open' : 'resolved';
            audit('Situação da conversa confirmada', before, v.status);
            message = v.status === 'resolved' ? 'Conversa resolvida por você.' : 'Conversa reaberta.';
        }
        if (kind === 'draft') {
            const text = val('text');
            if (val('followup') !== 'true') {
                const v = state.conversations.find(v => v.id === id);
                if (v)
                    v.draft = text;
            }
            const ok = await copyText(text);
            audit('Rascunho revisado e ' + (ok ? 'copiado' : 'salvo'));
            message = ok ? 'Texto copiado. O envio é manual.' : 'Rascunho salvo. Selecione e copie o texto manualmente.';
            if (!ok) {
                persist(message);
                return;
            }
        }
        if (kind === 'export') {
            if (val('from') && val('to') && val('from') > val('to'))
                throw new Error('A data final precisa ser posterior à inicial.');
            const args = [val('kind'), val('from'), val('to'), val('format')];
            form.dataset.dirty = '';
            closeModal();
            exportData(...args);
            return;
        }
        if (kind === 'import') {
            if (!importCandidate) {
                const file = fd.get('file');
                if (!file || file.size > 250000)
                    throw new Error('Escolha um CSV de até 250 KB.');
                const text = await file.text();
                prepareImport(text, val('kind'), form);
                return;
            }
            confirmImport(importCandidate);
            message = `${importCandidate.items.length} registros importados após sua confirmação.`;
            importCandidate = null;
        }
        if (kind === 'reset') {
            throw new Error('A restauração de exemplos não está disponível na base real.');
        }
        if (persist(message, form)) {
            closeModal();
            render();
        }
    }
    catch (err) {
        if (error) {
            error.textContent = err.message;
            error.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        else
            toast(err.message);
    }
});
/**
 * prepareImport — Lê e valida o CSV com limite de linhas e prepara vínculos para conferência manual.
 */
function prepareImport(text, kind, form) {
    const rows = parseCSV(text.replace(/^\uFEFF/, ''));
    if (rows.length < 2 || rows.length > 101)
        throw new Error('O arquivo deve ter um cabeçalho e de 1 a 100 registros.');
    const header = rows.shift().map(s => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')), required = kind === 'clients' ? ['nome', 'telefone'] : ['data', 'hora', 'nome', 'telefone', 'servico', 'duracao', 'intervalo'];
    if (required.some(k => !header.includes(k)))
        throw new Error('Cabeçalho incompatível. Baixe o modelo e confira as colunas.');
    const seen = new Set(), items = [];
    for (let i = 0; i < rows.length; i++) {
        const row = Object.fromEntries(header.map((k, j) => [k, (rows[i][j] || '').trim()]));
        if (!row.nome || !row.telefone)
            throw new Error(`Linha ${i + 2}: nome e telefone são obrigatórios.`);
        const phone = row.telefone.replace(/\D/g, '');
        if (phone.length < 10 || phone.length > 15)
            throw new Error(`Linha ${i + 2}: telefone inválido.`);
        if (kind === 'clients') {
            if (seen.has(phone) || state.clients.some(c => c.phone.replace(/\D/g, '') === phone))
                throw new Error(`Linha ${i + 2}: telefone já existente ou repetido. Revise a identidade manualmente.`);
            seen.add(phone);
            items.push({ id: uid(), name: row.nome, phone: row.telefone, status: 'temporary', color: 'olive', note: 'Importado por CSV após confirmação.', alert: '' });
        }
        else {
            const matches = state.clients.filter(c => c.phone.replace(/\D/g, '') === phone && c.name.toLowerCase() === row.nome.toLowerCase()), services = state.services.filter(s => s.name.toLowerCase() === row.servico.toLowerCase());
            if (matches.length !== 1 || services.length !== 1)
                throw new Error(`Linha ${i + 2}: cliente (nome + telefone) ou serviço não corresponde a um registro único. Cadastre ou corrija antes de importar.`);
            const a = { id: uid(), clientId: matches[0].id, serviceId: services[0].id, date: row.data, time: row.hora, duration: Number(row.duracao), buffer: Number(row.intervalo), status: 'pending', note: 'Importado por CSV com associação revisada manualmente.' };
            validateAppointment(a);
            if (appointmentConflict(items, a))
                throw new Error(`Linha ${i + 2}: conflito entre horários do próprio arquivo.`);
            items.push(a);
        }
    }
    importCandidate = { kind, items };
    document.getElementById('import-preview').innerHTML = `<div class="notice orange">Confira as ${items.length} associações abaixo. Nada foi importado ainda.</div><div class="table-wrap section-gap"><table class="data-table"><thead><tr><th>Nome</th><th>${kind === 'clients' ? 'Telefone' : 'Data / horário'}</th><th>${kind === 'clients' ? 'Cadastro' : 'Serviço'}</th></tr></thead><tbody>${items.map(x => `<tr><td>${esc(kind === 'clients' ? x.name : client(x.clientId).name)}</td><td>${esc(kind === 'clients' ? x.phone : `${x.date} ${x.time}`)}</td><td>${esc(kind === 'clients' ? 'Temporário' : service(x.serviceId).name)}</td></tr>`).join('')}</tbody></table></div><label class="row small section-gap"><input type="checkbox" required>Revisei os dados e confirmo estas associações e ${kind === 'clients' ? 'cadastros temporários' : 'agendamentos manuais'}.</label>`;
    form.querySelector('[type=submit]').innerHTML = icon('check') + 'Confirmar importação';
}
/**
 * confirmImport — Aplica somente a importação revisada e solicita sua persistência.
 */
function confirmImport(candidate) {
    if (candidate.kind === 'clients')
        state.clients.push(...candidate.items);
    else {
        for (const a of candidate.items)
            validateAppointment(a);
        state.appointments.push(...candidate.items);
    }
    audit('Importação CSV revisada e confirmada manualmente', '', `${candidate.items.length} ${candidate.kind}`);
}
/**
 * syncBanner — Exibe carregamento, erro de gravação ou conflito e suas opções de recuperação.
 */
function syncBanner() {
    if (syncStatus === 'error' || syncStatus === 'conflict')
        return `<div class="notice red sync-banner">${icon('warning')}<div class="grow"><strong>Alterações ainda não salvas</strong><p>${esc(syncError)}</p></div><div class="row wrap">${syncStatus === 'error' ? btn('Tentar salvar', 'v2-retry', 'undo', 'secondary sm') : ''}${btn('Exportar rascunho', 'backup', 'download', 'secondary sm')}${btn('Recarregar', 'v2-reload', 'undo', 'secondary sm')}</div></div>`;
    return syncStatus === 'saving' ? '<div class="sync-line" role="status">Salvando com segurança…</div>' : '';
}
/**
 * queueSave — Valida o estado e sinaliza que há uma versão pendente para a fila de gravação.
 */
function queueSave(message) {
    try {
        validateState(state, confirmedState);
    }
    catch (e) {
        state = structuredClone(confirmedState);
        toast(e.message);
        return false;
    }
    savePending = true;
    lastSaveMessage = message || 'Registros atualizados.';
    syncStatus = 'saving';
    flushSave();
    return true;
}
/**
 * flushSave — Serializa POSTs com revisão otimista; atualiza a confirmação ou interrompe edições em caso de conflito.
 */
async function flushSave() {
    if (saving || !savePending)
        return;
    saving = true;
    savePending = false;
    const snapshot = structuredClone(state), action = state.audit[0]?.action || 'Registros atualizados';
    try {
        const r = await fetch(stateURL(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: snapshot, revision, action }) }), d = await r.json();
        if (!r.ok) {
            syncStatus = r.status === 409 ? 'conflict' : 'error';
            throw Error(d.error || 'Falha ao salvar.');
        }
        revision = d.revision;
        lastSavedAt = d.updatedAt || lastSavedAt;
        confirmedState = structuredClone(snapshot);
        if (d.audit) {
            confirmedState.audit = d.audit;
            if (!savePending)
                state.audit = d.audit;
        }
        syncStatus = savePending ? 'saving' : 'saved';
        if (!savePending)
            toast(lastSaveMessage);
    }
    catch (e) {
        syncError = e.message;
        savePending = true;
        if (syncStatus !== 'conflict')
            syncStatus = 'error';
    }
    finally {
        saving = false;
        render();
        if (savePending && syncStatus === 'saving')
            flushSave();
    }
}
/**
 * bootstrap — Carrega a base selecionada da API e inicia a interface autenticada.
 */
async function bootstrap() {
    document.getElementById('app').innerHTML = '<main class="boot"><div class="brand-name">hanne.</div><p>Preparando seu espaço privado…</p></main>';
    try {
        const r = await fetch(stateURL(), { cache: 'no-store' }), d = await r.json();
        if (!r.ok)
            throw Error(d.error || 'Falha ao carregar.');
        state = d.state;
        revision = d.revision;
        confirmedState = structuredClone(state);
        lastSavedAt = d.updatedAt;
        syncStatus = 'saved';
        const initialTarget = parseDestination(location.hash || '');
        if (initialTarget) navigateTo(initialTarget, { replace: true }); else render();
        refreshRoutine();
    }
    catch (e) {
        document.getElementById('app').innerHTML = `<main class="boot"><h1>Seu espaço precisa reconectar.</h1><p>${esc(e.message)}</p><button class="btn primary" data-action="v2-reload">Tentar novamente</button></main>`;
    }
}
// Executa no uso do aplicativo; nenhuma tarefa é executada com o site fechado.
window.addEventListener('focus', refreshRoutine);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshRoutine(); });
window.setInterval?.(() => { if (document.visibilityState === 'visible') refreshRoutine(); }, 60000);
window.addEventListener('beforeunload', e => {
    if (saving || savePending || document.querySelector?.('#dialog form')?.dataset.dirty === 'true') {
        e.preventDefault();
        e.returnValue = '';
    }
});
/**
 * Delegação de click: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('click', e => {
    if (!['error', 'conflict', 'loading'].includes(syncStatus))
        return;
    const b = e.target.closest('[data-action]');
    if (b && !['v2-retry', 'v2-reload', 'backup', 'nav', 'close-modal', 'help', 'export', 'export-modal', 'search', 'v3-dataset', 'v5-theme', 'service-tab', 'v6-current-month', 'v6-all-records', 'v7-route', 'v7-day', 'v7-month', 'v7-all', 'v7-clear-record-filters', 'v7-keep-editing', 'v7-discard'].includes(b.dataset.action)) {
        e.stopImmediatePropagation();
        toast('Resolva a sincronização antes de alterar os registros.');
    }
}, true);
/**
 * Delegação de submit: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('submit', e => {
    if (saving || ['error', 'conflict', 'loading'].includes(syncStatus)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toast(saving ? 'Aguarde a gravação atual antes de confirmar novamente.' : 'Resolva a sincronização antes de continuar.');
        return;
    }
    const form = e.target;
    if (!validateVisibleControls(form)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
/**
 * baseIsEmpty — Indica que a base real ainda não tem registros de negócio; só então uma cópia pode ser restaurada.
 */
const baseIsEmpty = () => !state.settings.cutoff && ['clients', 'appointments', 'records', 'bills', 'payments', 'products', 'movements', 'expenses'].every(k => !state[k].length);
// Restauração de cópia JSON: usada para trazer os dados de outra hospedagem para uma base real ainda vazia.
document.addEventListener('click', e => {
    if (!e.target.closest?.('[data-action="v14-restore"]'))
        return;
    if (dataset !== 'real' || !baseIsEmpty()) { toast('A restauração só é permitida em uma base real ainda vazia.'); return; }
    openForm('Restaurar cópia JSON', 'v14-restore', `<div class="notice full">Use o arquivo gerado por “Cópia completa JSON” na versão anterior do sistema. Todos os registros do arquivo serão gravados nesta conta, que ainda está vazia.</div><label class="field full"><span>Arquivo da cópia (.json)</span><input type="file" name="file" accept="application/json,.json" required></label><label class="row full small"><input type="checkbox" name="confirm" required>Confirmo que este arquivo contém os dados reais do ateliê.</label>`, 'Restaurar registros');
});
document.addEventListener('submit', async e => {
    const form = e.target;
    if (form.dataset?.form !== 'v14-restore')
        return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const error = form.querySelector('#form-error');
    try {
        const file = form.elements.file.files[0];
        if (!file || file.size > 3000000)
            throw Error('Escolha o arquivo .json da cópia, com até 3 MB.');
        let next;
        try { next = JSON.parse(await file.text()); }
        catch { throw Error('O arquivo não é uma cópia JSON válida.'); }
        if (next?.datasetKind === 'example')
            throw Error('Este arquivo é da demonstração e não pode entrar nos dados reais.');
        if (!baseIsEmpty())
            throw Error('A base já possui registros. A restauração foi cancelada para não sobrescrevê-los.');
        validateState(next);
        next.audit = Array.isArray(next.audit) ? next.audit : [];
        state = next;
        audit('Cópia JSON restaurada', '', file.name.slice(0, 100));
        if (queueSave('Registros restaurados da cópia.'))
            closeModal(true);
    }
    catch (err) {
        error.textContent = err.message;
    }
}, true);
/**
 * stockNumber — Formata quantidade de estoque com até três casas decimais.
 */
const stockNumber = n => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
/**
 * viewPeriod — Converte o mês selecionado ou todo o histórico em limites de data.
 */
function viewPeriod() { return periodOf(ui.month); }
/**
 * periodToolbar — Renderiza os controles do período financeiro.
 */
function periodToolbar() { return `<div class="toolbar period-toolbar"><div class="row gap8">${icon('calendar')}<label class="small" for="month-filter">Período</label><input id="month-filter" type="month" max="${localDate().slice(0, 7)}" value="${ui.month}" data-change="v2-month" aria-label="Mês do painel">${btn('Todo o período', 'v2-all-period', '', 'secondary sm')}</div><span class="muted tiny">${ui.month ? fmt(ui.month + '-01', { month: 'long', year: 'numeric' }) : 'Todos os registros'} · horário de Brasília</span></div>`; }
/**
 * setupNotice — Mostra aviso quando ainda falta confirmar o início da operação.
 */
function setupNotice() { return !state.settings.cutoff ? `<div class="onboarding-banner"><span class="onboarding-icon">${icon('leaf')}</span><div class="grow"><strong>Seu ateliê começa com os seus dados.</strong><p>Defina a data de início, confira clientes e registre os saldos de abertura. Nenhum exemplo entra nos indicadores.</p></div>${btn('Preparar operação', 'nav', 'arrow', 'primary', 'data-page="setup"')}</div>` : ''; }
/**
 * cashChart — Agrupa entradas e saídas para o gráfico de caixa do período.
 */
function cashChart(from, to) {
    const end = to > localDate() ? localDate() : to, start = dayOffset(-6, end), days = Array.from({ length: 7 }, (_, i) => dayOffset(i, start)).filter(d => d >= from), values = days.map(d => ({ date: d, ...metrics(state, d, d) })), max = Math.max(1, ...values.flatMap(v => [v.received, v.expenses]));
    if (!values.some(v => v.received || v.expenses))
        return empty('Os movimentos vão aparecer aqui.', 'Registre recebimentos e despesas pagas para acompanhar a evolução.', 'wallet');
    return `<div class="cash-chart" role="group" aria-label="Movimentos por dia: abra as barras para consultar os registros">${values.map(v => {
        const income = { page: 'finance', tab: 'history', date: v.date, month: v.date.slice(0, 7) }, expense = { page: 'finance', tab: 'expenses', scope: 'paid', date: v.date, month: v.date.slice(0, 7) };
        return `<div class="cash-day"><div class="bar-pair">${v.received ? destinationLink('', income, 'income-bar chart-bar', 'Recebimentos em ' + fmt(v.date) + ': ' + money(v.received)).replace('<a ', `<a style="height:${Math.max(3, v.received / max * 100)}%" `) : '<span class="income-bar" style="height:0" aria-hidden="true"></span>'}${v.expenses ? destinationLink('', expense, 'expense-bar chart-bar', 'Despesas pagas em ' + fmt(v.date) + ': ' + money(v.expenses)).replace('<a ', `<a style="height:${Math.max(3, v.expenses / max * 100)}%" `) : '<span class="expense-bar" style="height:0" aria-hidden="true"></span>'}</div>${destinationLink(fmt(v.date, { day: '2-digit', month: '2-digit' }), { ...income, scope: 'cash' }, 'date-link')}<small>${destinationLink(money(v.received), income, 'chart-value')}</small></div>`;
    }).join('')}</div><div class="chart-legend"><span><i style="background:var(--accent)"></i>Recebimentos líquidos</span><span><i style="background:var(--red)"></i>Despesas pagas</span></div>`;
}
/**
 * attentionSummary — Renderiza contadores distintos de conversas pendentes e agendamentos a confirmar.
 */
function attentionSummary() {
    const pending = pendingConvs(), priority = pending.filter(v => ['Segurança', 'Agendamento urgente', 'Reclamação'].includes(v.category)).length, waiting = pending.filter(v => v.status === 'waiting').length, unconfirmed = state.appointments.filter(a => a.status === 'pending' && a.date >= localDate());
    return `<section class="attention-summary" aria-label="Pendências de atendimento"><button class="attention-card ${priority ? 'has-priority' : ''}" data-action="v4-open-pending" aria-label="${pending.length + whatsappPending} atendimentos pendentes: abrir conversas"><span class="attention-card-icon">${icon('chat')}</span><span class="grow"><span class="attention-card-label">Atendimentos pendentes</span><span class="attention-card-detail">${dataset === 'real' ? 'WhatsApp e notas ainda não resolvidas' : 'Conversas ainda não resolvidas'}</span><span class="attention-card-foot">Prioritários: ${priority} · Aguardando cliente: ${waiting}</span></span><strong class="attention-value" data-indicator="pending-conversations">${pending.length + whatsappPending}</strong>${icon('chevron')}</button><button class="attention-card" data-action="v4-open-unconfirmed" aria-label="${unconfirmed.length} agendamentos a confirmar: abrir agenda"><span class="attention-card-icon">${icon('calendar')}</span><span class="grow"><span class="attention-card-label">Agendamentos a confirmar</span><span class="attention-card-detail">Hoje e próximos dias</span><span class="attention-card-foot">Solicitações de confirmação na agenda</span></span><strong class="attention-value" data-indicator="unconfirmed-appointments">${unconfirmed.length}</strong>${icon('chevron')}</button></section>`;
}
/**
 * dashboard — Monta o painel com pendências, caixa, frequência de serviços e alertas de estoque.
 */
function dashboard() {
    const { from, to } = viewPeriod(), m = metrics(state, from, to), today = activeAppts(localDate()), low = lowStock(), pending = state.tasks.filter(t => !t.done), overdue = overdueItems();
    const agenda = `<section class="card today-card"><header class="card-head"><div><h2>Agenda de hoje</h2><p class="sub">${plural(today.filter(a => a.status !== 'blocked').length, 'agendamento', 'agendamentos')} · ${fmt(localDate())}</p></div>${btn('Ver agenda', 'nav', 'arrow', 'text', 'data-page="agenda"')}</header><div class="schedule-items">${today.map(scheduleRow).join('') || empty('Nenhum horário marcado para hoje.', 'Use Agendar cliente para adicionar uma visita.', 'calendar')}</div></section>`;
    const ranking = `<section class="card"><header class="card-head"><div><h2>Serviços mais realizados</h2><p class="sub">Quantidade de vezes no período.</p></div>${pill(plural(m.records, 'visita', 'visitas'), 'purple')}</header><div class="ranking">${m.ranked.slice(0, 5).map((s, i) => `${destinationLink(`<span class="rank-num">${String(i + 1).padStart(2, '0')}</span><div class="grow"><div class="row between small"><strong>${esc(s.name)}</strong><span>${s.count}</span></div><div class="rank-track"><i style="width:${s.count / m.ranked[0].count * 100}%"></i></div></div>`, { page: 'services', mode: ui.month ? 'month' : 'all', month: ui.month, service: s.id }, 'rank-item rank-link')}`).join('') || empty('Ainda sem serviços concluídos.', 'Eles aparecerão após finalizar os atendimentos.', 'scissors')}</div></section>`;
    return `${dashboardIntro()}${setupNotice()}${attentionSummary()}<div class="section-heading"><div><span class="eyebrow">Seu dinheiro</span><h2>Resumo financeiro</h2></div>${btn('Novo lançamento', 'v2-finance-menu', 'plus', 'text')}</div>${periodToolbar()}<section class="stats">${stat('Recebido no período', money(m.received), 'Dinheiro que já entrou', 'wallet')}${stat('Resultado de caixa', money(m.cashResult), `Recebido menos ${money(m.expenses)} em despesas`, 'file')}${stat('A receber de clientes', money(m.clientPending), 'Saldo em aberto · todas as datas', 'users')}${stat('A receber do cartão', money(m.cardPendingGross), m.cardPendingNet === null ? 'Valor bruto · taxas a conferir' : `Líquido previsto: ${money(m.cardPendingNet)}`, 'clock')}</section><div class="dashboard-grid"><section class="card cash-panel"><header class="card-head"><div><h2>Entradas e saídas</h2><p class="sub">Últimos 7 dias disponíveis do período.</p></div>${btn('Ver financeiro', 'nav', 'arrow', 'text', 'data-page="finance"')}</header>${cashChart(from, to)}</section>${agenda}</div><div class="lower-grid">${ranking}<section class="card"><header class="card-head"><div><h2>Para resolver</h2><p class="sub">Vencidos, estoque e tarefas que precisam de atenção.</p></div>${icon('checklist')}</header>${!state.settings.cutoff ? '<div class="task-row">Defina a data de início da operação.</div>' : ''}${overdueRows(4)}${low.slice(0, 3).map(lowStockRow).join('')}${m.incomplete ? `<div class="task-row">${icon('info')}Há consumo com custo ainda não informado.</div>` : ''}${pending.slice(0, 3).map(t => `<div class="task-row"><button class="check" data-action="toggle-task" data-id="${t.id}" aria-label="Concluir ${esc(t.title)}"></button><span>${esc(t.title)}</span></div>`).join('')}${state.settings.cutoff && !low.length && !pending.length && !m.incomplete && !overdue.total ? empty('Tudo em dia.', 'As próximas pendências aparecerão aqui.') : ''}</section></div><details class="more-metrics"><summary><span>${icon('grid')}Mais números do período</span>${icon('down')}</summary><div class="detail-metrics">${destinationLink('<span>Atendimentos concluídos</span><strong>' + m.records + '</strong>', { page: 'services', mode: ui.month ? 'month' : 'all', month: ui.month }, 'detail-metric-link')}${destinationLink('<span>Valor dos atendimentos</span><strong>' + money(m.serviceValue) + '</strong><small>Preço total combinado por visita</small>', { page: 'services', mode: ui.month ? 'month' : 'all', month: ui.month }, 'detail-metric-link')}${destinationLink('<span>Custo dos produtos usados</span><strong>' + (m.productCost === null ? 'A conferir' : money(m.productCost)) + '</strong><small>' + (m.incomplete ? `${m.incomplete} consumo(s) sem custo conhecido` : 'Informativo · não desconta a compra outra vez') + '</small>', { page: 'inventory', tab: 'movements', movement: 'consumption', month: ui.month }, 'detail-metric-link')}${destinationLink('<span>Sinais disponíveis</span><strong>' + money(m.unusedDeposits) + '</strong><small>Valores já recebidos, ainda não aplicados</small>', { page: 'finance', tab: 'deposits', scope: 'available' }, 'detail-metric-link')}</div><p class="notice">${icon('info')}O resultado de caixa é o dinheiro recebido menos as despesas pagas. Ele não representa o lucro contábil.</p></details>`;
}

/**
 * financePage — Renderiza indicadores do período e abas de dívidas, repasses, sinais, despesas e recebimentos.
 */
function financePage() {
    const { from, to } = viewPeriod(), m = metrics(state, from, to), inside = d => ui.financeDate ? d === ui.financeDate : d && d >= from && d <= to;
    const tabs = [['bills', 'A receber de clientes'], ['cards', 'Repasses do cartão'], ['deposits', 'Sinais'], ['expenses', 'Despesas'], ['history', 'Recebimentos']];
    const cLink = id => destinationLink(esc(client(id).name), { page: 'clients', client: id }, 'name-link');
    let body = '';
    if (ui.financeTab === 'bills') {
        const bills = state.bills.filter(b => !b.cancelled && (ui.financeScope !== 'open' || billBalance(state, b) > 0));
        body = table(['Cliente / atendimento', 'Total', 'Quitado pela cliente', 'Saldo', ''], bills.map(b => `<tr><td>${destinationLink(esc(client(b.clientId).name), { page: 'finance', bill: b.id }, 'name-link')}<p class="table-sub">${esc(b.description)}${b.isOpening ? ' · saldo de abertura' : ''}</p></td><td>${destinationLink(money(b.total), { page: 'finance', bill: b.id }, 'money-link')}</td><td>${destinationLink(money(billPaid(state, b.id)), { page: 'finance', bill: b.id }, 'money-link')}</td><td>${destinationLink(money(billBalance(state, b)), { page: 'finance', bill: b.id }, 'money-link')}</td><td>${billBalance(state, b) > 0 ? btn('Receber', 'new-payment', 'plus', 'soft sm', `data-id="${b.id}"`) : pill('Quitado', 'green')}</td></tr>`), 'Nenhuma cobrança corresponde a esta consulta.');
    }
    if (ui.financeTab === 'cards') {
        body = table(['Cliente / parcela', 'Previsão', 'Bruto', 'Taxa', 'Situação', ''], state.installments.filter(i => ui.financeScope !== 'open' || !i.receivedDate).map(i => {
            const p = state.payments.find(p => p.id === i.paymentId), target = { page: 'finance', installment: i.id };
            return `<tr><td>${cLink(p.clientId)}<p class="table-sub">${destinationLink('Parcela ' + i.number + '/' + i.count + ' · ' + esc(p.method), target, 'name-link')}</p></td><td>${destinationLink(fmt(i.due), target, 'date-link')}</td><td>${destinationLink(money(i.gross), target, 'money-link')}</td><td>${i.fee === null ? pill('Conferir', 'orange') : money(i.fee)}</td><td>${destinationLink(pill(i.receivedDate ? 'Recebido: ' + money(i.receivedNet) : 'Previsto', i.receivedDate ? 'green' : 'gray'), target, 'status-link')}</td><td>${i.receivedDate ? '' : btn('Confirmar repasse', 'v2-settle', 'check', 'soft sm', `data-id="${i.id}"`)}</td></tr>`;
        }), 'Nenhum repasse corresponde a esta consulta.');
    }
    if (ui.financeTab === 'deposits') body = table(['Cliente', 'Sinal', 'Origem', 'Situação', ''], state.payments.filter(p => p.kind === 'Sinal' && (ui.financeScope !== 'available' || p.depositStatus === 'available' && !p.billId)).map(p => `<tr><td>${cLink(p.clientId)}<p class="table-sub">${fmt(p.date)} · ${esc(p.method)}</p></td><td>${destinationLink(money(p.amount), { page: 'finance', payment: p.id }, 'money-link')}</td><td>${p.isOpening ? 'Saldo de abertura' : 'Recebimento registrado'}</td><td>${destinationLink(pill({ available: 'Disponível', applied: 'Aplicado', retained: 'Retido' }[p.depositStatus] || 'Registrado', p.depositStatus === 'available' ? 'green' : 'gray'), { page: 'finance', payment: p.id }, 'status-link')}</td><td>${p.depositStatus === 'available' && !p.billId ? btn('Registrar retenção', 'v2-retain', 'lock', 'text', `data-id="${p.id}"`) : ''}</td></tr>`), 'Nenhum sinal corresponde a esta consulta.');
    if (ui.financeTab === 'expenses') body = table(['Despesa', 'Vencimento', 'Valor', 'Situação', ''], state.expenses.filter(e => ui.financeScope === 'paid' ? e.paidDate && inside(e.paidDate) : ui.financeScope === 'open' ? !e.paidDate : true).map(e => `<tr><td>${destinationLink(esc(e.description), { page: 'finance', expense: e.id }, 'name-link')}<p class="table-sub">${{ space: 'Espaço compartilhado', products: 'Compra de produtos', disposables: 'Descartáveis' }[e.category]}</p></td><td>${destinationLink(fmt(e.due), { page: 'finance', expense: e.id }, 'date-link')}</td><td>${destinationLink(money(e.amount), { page: 'finance', expense: e.id }, 'money-link')}</td><td>${destinationLink(pill(e.paidDate ? 'Pago em ' + fmt(e.paidDate) : 'Em aberto', e.paidDate ? 'green' : 'orange'), { page: 'finance', expense: e.id }, 'status-link')}</td><td>${e.paidDate ? '' : btn('Confirmar pagamento', 'v2-expense-pay', 'check', 'soft sm', `data-id="${e.id}"`)}</td></tr>`), 'Nenhuma despesa corresponde a esta consulta.');
    if (ui.financeTab === 'history') {
        const lines = [
            ...state.payments.filter(p => !cardMethod(p.method) && !p.isOpening && inside(p.date)).map(p => ({ date: p.date, name: client(p.clientId).name, kind: p.kind + ' · ' + p.method, value: p.amount, target: { page: 'finance', payment: p.id } })),
            ...state.installments.filter(i => i.receivedDate && inside(i.receivedDate)).map(i => ({ date: i.receivedDate, name: client(state.payments.find(p => p.id === i.paymentId).clientId).name, kind: 'Repasse líquido do cartão', value: i.receivedNet, target: { page: 'finance', installment: i.id } })),
            ...(ui.financeScope === 'cash' ? state.expenses.filter(e => e.paidDate && inside(e.paidDate)).map(e => ({ date: e.paidDate, name: e.description, kind: 'Despesa paga', value: -e.amount, target: { page: 'finance', expense: e.id } })) : [])
        ].sort((a, b) => b.date.localeCompare(a.date));
        body = table(['Data', 'Registro', 'Origem', ui.financeScope === 'cash' ? 'Entrada / saída' : 'Recebido'], lines.map(l => `<tr><td>${destinationLink(fmt(l.date), l.target, 'date-link')}</td><td>${destinationLink(esc(l.name), l.target, 'name-link')}</td><td>${esc(l.kind)}</td><td>${destinationLink(money(l.value), l.target, 'money-link')}</td></tr>`), 'Nenhum movimento corresponde a este período.');
    }
    const scopeText = ui.financeScope === 'cash' ? 'Entradas e saídas que compõem o resultado de caixa' : ui.financeScope === 'open' ? 'Somente valores em aberto · todas as datas' : ui.financeScope === 'paid' ? 'Somente despesas pagas no período' : ui.financeScope === 'available' ? 'Somente sinais disponíveis' : ui.financeDate ? 'Recebimentos em ' + fmt(ui.financeDate) : '';
    return `${heading('Financeiro', 'Acompanhe o dinheiro recebido, os valores a receber e as despesas.', btn('Exportar', 'export-modal', 'download', 'secondary') + btn('Novo registro', 'v2-finance-menu', 'plus', 'primary'))}${setupNotice()}${periodToolbar()}<div class="stats">${stat('Recebido no período', money(m.received), 'Líquido confirmado · inclui sinais novos', 'wallet')}${stat('Despesas pagas', money(m.expenses), 'Compras e contas pagas no período', 'file')}${stat('Resultado de caixa', money(m.cashResult), 'Recebimentos menos despesas pagas', 'checklist')}${stat('Custo de consumo', m.productCost === null ? 'Incompleto' : money(m.productCost), 'Informativo · não descontado novamente', 'leaf')}</div><div class="card"><div class="tabs finance-tabs">${tabs.map(([id, t]) => `<button data-action="v2-finance-tab" data-id="${id}" aria-pressed="${ui.financeTab === id}" class="${ui.financeTab === id ? 'active' : ''}">${t}</button>`).join('')}</div>${scopeText ? `<div class="consultation-banner"><span>${esc(scopeText)}</span>${destinationLink('Ver todos desta aba', { page: 'finance', tab: ui.financeTab, month: ui.month }, 'btn text')}</div>` : ''}${body}</div><div class="toolbar section-gap">${btn('Registrar sinal', 'v2-deposit', 'plus', 'secondary')}${btn('Registrar despesa', 'v2-expense', 'plus', 'secondary')}<details class="secondary-actions"><summary>Outras opções ${icon('down')}</summary><div>${btn('Conta de outro mês', 'v2-recurring', 'calendar', 'secondary')}${btn('Saldos de abertura', 'v2-opening', 'upload', 'secondary')}</div></details></div><div class="notice">${icon('info')}Toque em nomes, datas ou valores destacados para abrir os registros. Clientes e cartão mostram saldos de todas as datas. Confirmar pagamento continua sendo uma ação separada.</div>`;
}
/**
 * table — Renderiza tabela reutilizável com cabeçalhos e linhas fornecidos.
 */
function table(headers, rows, message) {
    const items = Array.isArray(rows) ? rows : null, target = currentDestination(), pageKey = ui.page === 'finance' ? 'financePageIndex' : 'inventoryPageIndex';
    const paging = items ? recordPage(items, ui[pageKey]) : null;
    if (paging) ui[pageKey] = paging.page;
    const markup = paging ? paging.rows.join('') : rows;
    return `<div class="table-wrap"><table class="data-table" aria-label="Registros de ${ui.page === 'finance' ? 'financeiro' : 'estoque'}"><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${markup}</tbody></table>${markup ? '' : empty(message || 'Nenhum registro.', 'Revise o período ou os filtros selecionados.')}</div>${paging ? `<nav class="records-pagination" aria-label="Páginas dos registros"><span role="status">${paging.start}–${paging.end} de ${paging.total} registros</span><div class="row gap8">${paging.page > 1 ? destinationLink('Anterior', { ...target, p: paging.page - 1 }, 'btn secondary sm') : '<button type="button" class="btn secondary sm" disabled>Anterior</button>'}<span aria-current="page">${paging.page} / ${paging.pages}</span>${paging.page < paging.pages ? destinationLink('Próxima', { ...target, p: paging.page + 1 }, 'btn secondary sm') : '<button type="button" class="btn secondary sm" disabled>Próxima</button>'}</div></nav>` : ''}`;
}
/**
 * inventoryPage — Renderiza produtos, saldos calculados e movimentos de estoque.
 */
function inventoryPage() {
    const total = state.products.length, missing = state.products.filter(p => stockOf(state, p.id).quantity > 0 && stockOf(state, p.id).unitCost === null).length, low = state.products.filter(p => stockOf(state, p.id).quantity <= p.minimum).length;
    const { from, to } = viewPeriod(), products = state.products.filter(p => { const st = stockOf(state, p.id); return ui.inventoryScope === 'low' ? st.quantity <= p.minimum : ui.inventoryScope === 'unknown' ? st.quantity > 0 && st.unitCost === null : true; });
    const moves = [...state.movements].reverse().filter(m => ui.inventoryScope !== 'consumption' || m.type === 'consumption' && m.date >= from && m.date <= to);
    const scope = { low: 'Produtos com estoque baixo', unknown: 'Produtos com custo a conferir', consumption: 'Consumo dos atendimentos no período selecionado' }[ui.inventoryScope];
    const body = ui.inventoryTab === 'products' ? table(['Produto', 'Saldo', 'Custo por unidade', 'Estoque mínimo', ''], products.map(p => { const st = stockOf(state, p.id), target = { page: 'inventory', product: p.id }; return `<tr><td>${destinationLink(esc(p.name), target, 'name-link')}<p class="table-sub">${esc(p.brand || 'Sem marca informada')} · embalagem ${stockNumber(p.packageSize)} ${p.unit}</p></td><td>${destinationLink(stockNumber(st.quantity) + ' ' + p.unit, target, 'money-link')}${st.quantity <= p.minimum ? `<p class="table-sub">${pill('Repor', 'orange')}</p>` : ''}</td><td>${st.unitCost === null ? pill('Custo pendente', 'orange') : moneyPrecise(st.unitCost) + ' / ' + p.unit}</td><td>${stockNumber(p.minimum)} ${p.unit}</td><td>${destinationLink('Detalhes ' + icon('arrow'), target, 'btn text')}</td></tr>`; }), 'Nenhum produto corresponde a esta consulta.') : table(['Data', 'Produto', 'Movimento', 'Quantidade', 'Custo registrado'], moves.map(m => { const p = state.products.find(p => p.id === m.productId), target = m.recordId ? { page: 'services', record: m.recordId } : m.expenseId ? { page: 'finance', expense: m.expenseId } : { page: 'inventory', product: m.productId }; return `<tr><td>${destinationLink(fmt(m.date), target, 'date-link')}</td><td>${destinationLink(esc(p.name), { page: 'inventory', product: p.id }, 'name-link')}</td><td>${destinationLink({ opening: 'Estoque inicial', purchase: 'Compra', consumption: 'Atendimento', loss: 'Perda', valuation: 'Custo conferido' }[m.type], target, 'name-link')}<p class="table-sub">${esc(m.note || '')}</p></td><td>${m.type === 'valuation' ? '—' : stockNumber(m.quantity) + ' ' + p.unit}</td><td>${m.unitCost === null ? 'A conferir' : moneyPrecise(m.unitCost) + ' / ' + p.unit}</td></tr>`; }), 'Nenhuma movimentação corresponde a esta consulta.');
    return `${heading('Estoque', 'Veja o saldo dos produtos e abra o atendimento ou a compra de origem.', btn('Registrar compra', 'v2-purchase', 'plus', 'secondary') + btn('Cadastrar produto', 'v2-product', 'plus', 'primary'))}${setupNotice()}<div class="stats inventory-stats">${stat('Produtos cadastrados', total, 'Marcas e tonalidades em itens separados', 'leaf')}${stat('Estoque baixo', low, 'Saldo igual ou abaixo do mínimo configurado', 'warning')}${stat('Custos a conferir', missing, 'Produtos com saldo e custo desconhecido', 'file')}</div><div class="toolbar"><div class="segmented">${[['products', 'Produtos'], ['movements', 'Movimentações']].map(([id, label]) => `<button data-action="v2-stock-tab" data-id="${id}" aria-pressed="${ui.inventoryTab === id}" class="${ui.inventoryTab === id ? 'active' : ''}">${label}</button>`).join('')}</div>${btn('Exportar estoque', 'v2-stock-export', 'download', 'secondary')}</div><section class="card">${scope ? `<div class="consultation-banner"><span>${scope}</span>${destinationLink('Ver todos', { page: 'inventory', tab: ui.inventoryTab }, 'btn text')}</div>` : ''}${body}</section><div class="notice section-gap">${icon('shield')}Toque em Atendimento para abrir a ficha, em Compra para ver a despesa ou no produto para consultar seu estoque. O custo permanece registrado no momento do consumo.</div>`;
}
/**
 * moneyPrecise — Exibe custo unitário com precisão adicional para produtos fracionados.
 */
function moneyPrecise(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
/**
 * setupPage — Renderiza data de início, participação fixa do espaço e saldos de abertura.
 */
function setupPage() { const cutoff = state.settings.cutoff, steps = [['Data de início', cutoff ? fmt(cutoff, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Ainda não definida', !!cutoff], ['Clientes', `${state.clients.length} cadastros`, state.clients.length > 0], ['Estoque', `${state.products.length} produtos · quantidades conferidas manualmente`, state.products.length > 0], ['Saldos anteriores', 'Confira dívidas, sinais, repasses e contas antes de operar', state.bills.some(b => b.isOpening) || state.payments.some(p => p.isOpening) || state.expenses.some(e => e.isOpening)]]; return `${heading('Preparar operação', 'Defina a data de início e confira os dados que vai trazer.')}<div class="setup-steps">${steps.map(([t, desc, done], i) => `<div><span class="setup-step ${done ? 'done' : ''}">${done ? icon('check') : i + 1}</span><strong>${t}</strong><p>${desc}</p></div>`).join('')}</div><div class="settings-grid"><section class="card settings-card"><h2>Início da operação</h2><form novalidate data-form="v2-setup"><div class="form-grid">${field('Data de início', 'cutoff', cutoff || '', 'date', `required max="${localDate()}" ${cutoff ? 'readonly' : ''}`, true)}${field('Valor fixo mensal do espaço (R$)', 'spaceAmount', state.settings.spaceAmount ?? '', 'number', 'min="0.01" max="100000" step="0.01"', true)}${field('Dia de vencimento do espaço', 'spaceDueDay', state.settings.spaceDueDay, 'number', 'required min="1" max="28"', true)}<div class="notice full">A data separa a nova operação dos saldos anteriores e fica bloqueada após confirmação. O valor do espaço pode ser informado depois. Ao acessar o sistema em cada mês, a conta será criada automaticamente em aberto. O pagamento continua dependendo da sua confirmação. Meses anteriores não são preenchidos automaticamente.</div><div id="setup-error" role="alert" class="full small" style="color:var(--red)"></div><div class="full"><button class="btn primary" type="submit">${icon('check')}${cutoff ? 'Salvar configurações' : 'Confirmar início'}</button></div></div></form></section><section class="card settings-card"><h2>Entrada dos seus dados</h2><div class="setting-row"><div><strong>Clientes e serviços</strong><p>Revise o catálogo inicial e cadastre os clientes. A importação CSV exige revisão de cada associação.</p></div>${btn('Clientes', 'nav', 'arrow', 'text', 'data-page="clients"')}</div><div class="setting-row"><div><strong>Produtos e embalagens</strong><p>Informe g, ml ou unidades, preço conhecido e quantidade restante, inclusive em embalagens abertas.</p></div>${btn('Estoque', 'nav', 'arrow', 'text', 'data-page="inventory"')}</div><div class="setting-row"><div><strong>Valores anteriores</strong><p>Traga apenas o saldo ainda devido, sinais disponíveis, repasses futuros e contas a pagar.</p></div>${btn('Registrar', 'v2-opening', 'plus', 'text')}</div><div class="setting-row"><div><strong>Minha Agenda</strong><p>O formato de exportação ainda precisa ser conferido. Os modelos CSV do site estão disponíveis para adaptação.</p></div>${btn('Modelo', 'import-template', 'download', 'text', 'data-kind="clients"')}</div></section></div>`; }
/**
 * settingsPage — Renderiza preferências, expediente e opções manuais de dados e auditoria.
 */
function settingsPage() { return `${heading('Configurações', 'Aparência, horários de trabalho e preferências do ateliê.')}<div class="toolbar">${btn('Preparar operação', 'nav', 'arrow', 'primary', 'data-page="setup"')}${btn('Exportar dados', 'export-modal', 'download', 'secondary')}${btn('Cópia completa JSON', 'backup', 'download', 'secondary')}${dataset === 'real' && baseIsEmpty() ? btn('Restaurar cópia JSON', 'v14-restore', 'upload', 'secondary') : ''}${btn(dataset === 'example' ? 'Voltar aos dados reais' : 'Ver demonstração', 'v3-dataset', 'spark', 'text', `data-dataset="${dataset === 'example' ? 'real' : 'example'}"`)}</div><section class="card appearance-card"><div><span class="eyebrow">Deixe confortável para você</span><h2>Aparência</h2><p>Escolha entre claro e escuro suave. Sua escolha fica salva neste dispositivo.</p></div>${themeControl()}</section><div class="settings-grid"><section class="card settings-card"><h2>Sua rotina</h2><form novalidate data-form="settings"><div class="form-grid">${field('Como prefere ser chamada?', 'name', state.settings.name, 'text', 'required maxlength="50"', true)}${field('Início do expediente', 'open', state.settings.open, 'time', 'required')}${field('Fim do expediente', 'close', state.settings.close, 'time', 'required')}${field('Prazo de resposta de referência (min)', 'responseMinutes', state.settings.responseMinutes, 'number', 'required min="5" max="1440"', true)}<div class="full"><span class="small">Dias de folga</span><div class="weekday-checks">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => `<label><input type="checkbox" name="closedDays" value="${i}" ${state.settings.closedDays.includes(i) ? 'checked' : ''}>${d}</label>`).join('')}</div></div><div id="settings-error" role="alert" class="full small" style="color:var(--red)"></div><div class="full"><button type="submit" class="btn primary">Salvar rotina</button></div></div></form></section><section class="card settings-card"><h2>Conexões e acesso</h2><a class="btn secondary" href="/login" data-salon-logout>Sair da conta</a><div class="setting-row"><div><strong>Dados persistentes</strong><p>Registros vinculados à conta autenticada, com conferência de versão para alterações simultâneas.</p></div>${pill(syncStatus === 'saved' ? 'Sincronizado' : 'Conferir', syncStatus === 'saved' ? 'green' : 'orange')}</div><div class="setting-row"><div><strong>WhatsApp Business</strong><p>O conector Baileys permite vincular por QR Code e receber e enviar textos, imagens e áudios. Requer um servidor Node sempre ligado. Confira a conexão em Atendimentos → WhatsApp. Notas internas continuam separadas.</p></div>${btn('Configurar', 'integrations', 'link', 'secondary sm')}</div><div class="setting-row"><div><strong>Inteligência artificial</strong><p>Classificação automática, resumos e transcrição ainda dependem de avaliação técnica e de custos.</p></div>${pill('Pendente', 'gray')}</div><div class="setting-row"><div><strong>Acesso individual</strong><p>Conta única da Hanne com e-mail e senha. A conta é criada uma única vez com o código de configuração da hospedagem, que também permite redefinir a senha. As sessões expiram em 12 horas.</p></div>${icon('shield')}</div></section><section class="card settings-card full"><h2>Histórico de ações confirmadas</h2><p class="small muted">As alterações salvas ficam registradas no servidor. Última sincronização: ${lastSavedAt ? new Date(lastSavedAt).toLocaleString('pt-BR') : 'nenhuma alteração ainda'}.</p>${state.audit.slice(0, 8).map(a => `<div class="audit-row">${esc(a.action)}<time>${new Date(a.at).toLocaleString('pt-BR')} · ${esc(a.by)}</time></div>`).join('') || empty('O histórico começa com sua primeira alteração.')}${state.audit.length ? btn('Histórico completo', 'audit', 'arrow', 'text') : ''}</section></div>`; }
/**
 * help — Exibe orientação resumida e limitações da operação atual.
 */
function help() {
    modal('Uma rotina mais simples', `<div class="dialog-body skeleton-help"><p class="notice">${dataset === 'example' ? 'Você está na base de exemplos, separada dos dados reais.' : 'Os registros pertencem à sua conta. Confira o indicador de sincronização antes de sair.'}</p><div class="help-list section-gap"><div><strong>1. Prepare uma vez</strong>Defina a data de início, confira clientes, estoque e saldos anteriores. Cadastre o valor fixo e o vencimento do espaço.</div><div><strong>2. Comece pela agenda</strong>Agende cliente, serviço e duração. Depois da visita, toque em Concluir: os dados já vêm preenchidos.</div><div><strong>3. Confira produtos e pagamento</strong>Informe o preço do conjunto. Use a última ficha equivalente como referência de consumo e ajuste as quantidades. Selecione sinais e informe o pagamento confirmado; o saldo restante fica a receber.</div><div><strong>4. Consulte os resultados</strong>Serviços e histórico mostra o mês atual e os meses anteriores. Cada serviço conta no ranking; os valores são somados por conjunto vendido.</div><div><strong>5. Confira o financeiro</strong>A conta do espaço é criada em aberto ao acessar o sistema no mês, depois de configurar o valor. Confirme pagamentos de despesas e repasses do cartão quando ocorrerem.</div></div><p class="notice section-gap">Cada tela traz “Como usar esta tela”, com explicações sobre suas ações e indicadores. Sugestões não confirmam consumo ou recebimento. Não há geração de contas enquanto o site está fechado; meses antigos podem ser registrados em Outras opções no Financeiro.</p></div>`);
}
/**
 * requireStarted — Impede registros operacionais antes da confirmação da data de início.
 */
function requireStarted() {
    if (!state.settings.cutoff) {
        go('setup');
        toast('Confirme a data de início antes de registrar valores e estoque.');
        return false;
    }
    return true;
}
/**
 * cardFields — Monta parcelas, primeiro vencimento e taxa para pagamentos em cartão.
 */
function cardFields() { return `<div class="full card-fields form-grid">${field('Quantidade de parcelas', 'count', 1, 'number', 'min="1" max="24" required')}${field('Primeiro repasse previsto', 'firstDue', localDate(), 'date', 'required')}${field('Taxa total prevista em R$ (opcional)', 'feeTotal', '', 'number', 'min="0" max="100000" step="0.01"', true)}<div class="notice full">Deixe a taxa vazia enquanto não conferir a operadora. O valor líquido real será confirmado em cada repasse.</div></div>`; }
/**
 * updateCardFields — Ajusta a visibilidade e as restrições dos campos conforme o método de recebimento.
 */
function updateCardFields(form) {
    const card = cardMethod(form.elements.method?.value);
    form.querySelectorAll('.card-fields').forEach(el => { el.hidden = !card; el.querySelectorAll('input').forEach(i => i.disabled = !card); });
    if (card && form.elements.method.value === 'Cartão de débito')
        form.elements.count.value = 1;
    // Sugere o prazo usual da operadora (débito D+1, crédito D+30) enquanto a data não foi editada à mão.
    const due = form.elements.firstDue;
    if (card && due && !due.dataset.touched) {
        const base = validCalendarDate(form.elements.date?.value) ? form.elements.date.value : localDate();
        due.value = dayOffset(form.elements.method.value === 'Cartão de débito' ? 1 : 30, base);
    }
}
/**
 * paymentForm — Abre recebimento parcial ou total de uma dívida existente.
 */
function paymentForm(id) {
    if (!requireStarted())
        return;
    const b = state.bills.find(b => b.id === id);
    if (!b)
        return;
    const balance = billBalance(state, b);
    openForm('Registrar pagamento da cliente', 'v2-payment', `<div class="notice full">${esc(client(b.clientId).name)} · saldo ${money(balance)}<br>No cartão, a confirmação quita a cliente e gera repasses a conferir.</div>` + field('Valor pago pela cliente (R$)', 'amount', balance, 'number', `required min="0.01" max="${balance}" step="0.01"`) + field('Data do pagamento', 'date', localDate(), 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`) + selectField('Forma de pagamento', 'method', METHODS.map(m => [m, m]), 'Pix', 'required data-change="v2-payment-method"', true) + cardFields(), 'Confirmar pagamento', id);
    updateCardFields(document.querySelector('dialog form'));
}
/**
 * depositForm — Abre registro de sinal disponível para uma cliente e vínculo opcional com agenda.
 */
function depositForm() {
    if (!requireStarted())
        return;
    if (!state.clients.length) {
        go('clients');
        toast('Cadastre a cliente antes de registrar o sinal.');
        return;
    }
    openForm('Registrar sinal recebido', 'v2-deposit', selectField('Cliente', 'clientId', clientOptions(), state.clients[0].id, 'required', true) + field('Valor do sinal (R$)', 'amount', '', 'number', 'required min="0.01" max="100000" step="0.01"') + field('Data do recebimento', 'date', localDate(), 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`) + selectField('Forma de pagamento', 'method', METHODS.map(m => [m, m]), 'Pix', 'required data-change="v2-payment-method"', true) + selectField('Vincular a um agendamento (opcional)', 'appointmentId', [['', 'Sem agendamento vinculado'], ...state.appointments.filter(a => a.clientId).map(a => [a.id, client(a.clientId).name + ' · ' + fmt(a.date) + ' ' + a.time])], '', '', true) + cardFields() + '<div class="notice full">O sinal ficará disponível para aplicar no fechamento. Recebimentos anteriores ao início devem entrar em “Saldos de abertura”.</div>', 'Confirmar sinal');
    updateCardFields(document.querySelector('dialog form'));
}
/**
 * productForm — Abre cadastro de produto com unidade, embalagem, estoque inicial e custo conhecido ou pendente.
 */
function productForm() {
    if (!requireStarted())
        return;
    openForm('Cadastrar produto e saldo inicial', 'v2-product', field('Produto / tonalidade', 'name', '', 'text', 'required maxlength="120"', true) + field('Marca (opcional)', 'brand', '', 'text', 'maxlength="80"', true) + selectField('Unidade de controle', 'unit', [['g', 'Gramas (g)'], ['ml', 'Mililitros (ml)'], ['un', 'Unidades (un)']], 'g', 'required') + field('Tamanho de uma embalagem', 'packageSize', '', 'number', 'required min="0.001" max="1000000" step="0.001"') + field('Preço de compra da embalagem (R$)', 'packageCost', '', 'number', 'min="0.01" max="100000" step="0.01"') + field('Quantidade restante total', 'quantity', 0, 'number', 'required min="0" max="1000000" step="0.001"') + field('Estoque mínimo para aviso', 'minimum', 0, 'number', 'required min="0" max="1000000" step="0.001"') + field('Data da contagem inicial', 'date', state.settings.cutoff, 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`) + '<div class="notice full">Informe quantidade e embalagem na mesma unidade. Exemplo: embalagem de 1.000 ml com 350 ml restantes. Preço desconhecido fica em branco. Este saldo inicial não gera despesa nova.</div>', 'Confirmar produto', null, true);
}
/**
 * purchaseForm — Abre compra que produzirá entrada de estoque e despesa vinculada.
 */
function purchaseForm(productId) {
    if (!requireStarted())
        return;
    if (!state.products.length) {
        productForm();
        return;
    }
    openForm('Entrada por compra', 'v2-purchase', selectField('Produto', 'productId', state.products.map(p => [p.id, p.name + ' · ' + p.unit]), productId || state.products[0].id, 'required', true) + field('Quantidade adquirida na unidade do produto', 'quantity', '', 'number', 'required min="0.001" max="1000000" step="0.001"') + field('Valor total da compra (R$)', 'total', '', 'number', 'required min="0.01" max="100000" step="0.01"') + field('Data da entrada no estoque', 'date', localDate(), 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`) + field('Vencimento da compra', 'due', localDate(), 'date', 'required') + selectField('Pagamento', 'paid', [['paid', 'Já paguei na data da entrada'], ['pending', 'Ainda vou pagar']], 'paid', 'required', true) + '<div class="notice full">A compra registra estoque e despesa em conjunto. O custo médio conhecido será atualizado; a saída de dinheiro só conta quando o pagamento estiver confirmado.</div>', 'Confirmar compra');
}
/**
 * productDetail — Exibe saldo, custo e histórico de movimentos do produto.
 */
function productDetail(id) {
    const p = state.products.find(p => p.id === id);
    if (!p)
        return;
    const s = stockOf(state, id);
    modal(p.name, `<div class="dialog-body"><p class="muted small">${esc(p.brand)} · embalagem ${stockNumber(p.packageSize)} ${p.unit}</p><div class="detail-metrics two section-gap"><div><span>Disponível</span><strong>${stockNumber(s.quantity)} ${p.unit}</strong></div><div><span>Custo médio atual</span><strong>${s.unitCost === null ? 'A conferir' : moneyPrecise(s.unitCost)}</strong><small>por ${p.unit}</small></div></div><h3 class="section-gap">Últimos movimentos</h3>${state.movements.filter(m => m.productId === id).slice(-6).reverse().map(m => `<div class="audit-row">${fmt(m.date)} · ${{ opening: 'Estoque inicial', purchase: 'Compra', consumption: 'Consumo em atendimento', loss: 'Perda', valuation: 'Custo conferido' }[m.type]}<time>${stockNumber(m.quantity)} ${p.unit} · ${esc(m.note)}</time></div>`).join('')}</div>`, btn('Registrar perda', 'v2-loss', 'warning', 'secondary', `data-id="${id}"`) + btn('Conferir custo', 'v2-value', 'edit', 'secondary', `data-id="${id}"`) + btn('Nova compra', 'v2-purchase', 'plus', 'primary', `data-id="${id}"`), true);
}
/**
 * movementForm — Abre perda de estoque ou conferência de custo, sem reescrever o histórico.
 */
function movementForm(id, type) {
    const p = state.products.find(p => p.id === id), stock = stockOf(state, id);
    if (!p)
        return;
    openForm(type === 'loss' ? 'Registrar perda de produto' : 'Conferir custo do estoque', 'v2-movement', `<input type="hidden" name="type" value="${type}"><div class="notice full">${esc(p.name)} · saldo ${stockNumber(stock.quantity)} ${p.unit}</div>` + (type === 'loss' ? field(`Quantidade perdida (${p.unit})`, 'quantity', '', 'number', `required min="0.001" max="${stock.quantity}" step="0.001"`, true) : field(`Custo de uma embalagem de ${stockNumber(p.packageSize)} ${p.unit} (R$)`, 'packageCost', '', 'number', 'required min="0.01" max="100000" step="0.01"', true)) + field('Data da conferência', 'date', localDate(), 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`, true) + textfield('Motivo / origem da informação', 'note', '', 'required maxlength="500"') + `<div class="notice full">${type === 'loss' ? 'A perda reduz o saldo e fica no histórico.' : 'O custo informado será aplicado ao estoque atual a partir desta conferência. Custos anteriores permanecem como registrados.'}</div>`, 'Confirmar movimento', id);
}
/**
 * expenseForm — Abre despesa de espaço, produto ou descartável e confirmação opcional de pagamento.
 */
function expenseForm() {
    if (!requireStarted())
        return;
    openForm('Registrar despesa', 'v2-expense', field('Descrição', 'description', '', 'text', 'required maxlength="160"', true) + selectField('Categoria', 'category', [['space', 'Aluguel / contas do espaço'], ['disposables', 'Descartáveis']], 'space', 'required', true) + field('Valor (R$)', 'amount', '', 'number', 'required min="0.01" max="100000" step="0.01"') + field('Data da despesa', 'date', localDate(), 'date', `required min="${state.settings.cutoff}"`) + field('Vencimento', 'due', localDate(), 'date', 'required') + field('Data de pagamento (deixe vazio se pendente)', 'paidDate', '', 'date', `max="${localDate()}"`) + '<div class="notice full">Compras de produtos devem entrar pela tela de estoque para gerar a entrada e a despesa juntas.</div>', 'Confirmar despesa');
}
/**
 * openingForm — Abre saldo anterior de cliente, sinal, cartão ou conta do espaço.
 */
function openingForm() {
    if (!requireStarted())
        return;
    openForm('Saldos de abertura', 'v2-opening', selectField('O que vai trazer da operação anterior?', 'type', [['debt', 'Saldo que uma cliente ainda deve'], ['deposit', 'Sinal já recebido para atendimento futuro'], ['expense', 'Aluguel / conta do espaço ainda não paga'], ['card', 'Repasse de cartão anterior ainda a receber']], 'debt', 'required data-change="v2-opening-type"', true) + selectField('Cliente (exceto despesa do espaço)', 'clientId', [['', 'Selecione'], ...clientOptions()], '', '', true) + field('Descrição / referência', 'description', '', 'text', 'required maxlength="160"', true) + field('Valor pendente ou sinal disponível (R$)', 'amount', '', 'number', 'required min="0.01" max="100000" step="0.01"') + field('Vencimento / repasse previsto', 'due', localDate(), 'date', 'required') + field('Taxa deste repasse em R$ (opcional)', 'feeTotal', '', 'number', 'min="0" max="100000" step="0.01"', true) + '<div class="notice full">Esses valores são anteriores à data de início. Sinais já recebidos não entram novamente como receita. Dívidas, contas e repasses entram no caixa apenas quando você confirmar o recebimento ou pagamento.</div>', 'Confirmar saldo inicial');
}
/**
 * settleForm — Abre confirmação de repasse do cartão com valor líquido e data efetivos.
 */
function settleForm(id) {
    const i = state.installments.find(i => i.id === id);
    if (!i || i.receivedDate)
        return;
    const p = state.payments.find(p => p.id === i.paymentId);
    openForm('Confirmar repasse do cartão', 'v2-settle', `<div class="notice full">${esc(client(p.clientId).name)} · parcela ${i.number}/${i.count}<br>Bruto ${money(i.gross)} · previsão ${fmt(i.due)}</div>` + field('Data efetiva do repasse', 'date', localDate(), 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`) + field('Valor líquido que entrou (R$)', 'net', i.fee === null ? '' : amount(cents(i.gross) - cents(i.fee)), 'number', `required min="0" max="${i.gross}" step="0.01"`) + '<div class="notice full">Confira o extrato. A diferença entre bruto e líquido será registrada como taxa; este recebimento entrará no caixa da data confirmada.</div>', 'Confirmar recebimento', id);
}
/**
 * retainForm — Exige motivo e confirmação para reter sinal e, quando necessário, cancelar o agendamento vinculado.
 */
function retainForm(id) {
    const p = state.payments.find(p => p.id === id);
    if (!p)
        return;
    const a = state.appointments.find(a => a.id === p.appointmentId), willCancel = !!a && ['confirmed', 'pending'].includes(a.status);
    if (a && !['confirmed', 'pending', 'cancelled'].includes(a.status)) {
        modal('Conferir agendamento', `<div class="dialog-body"><div class="notice orange">Este agendamento está como ${esc(statusLabel[a.status] || a.status)}. A retenção por cancelamento exige conferir essa situação primeiro.</div></div>`, btn('Ver agendamento', 'appointment-detail', 'calendar', 'primary', `data-id="${a.id}"`));
        return;
    }
    openForm(willCancel ? 'Cancelar e reter o sinal' : 'Registrar retenção do sinal', 'v2-retain', `<div class="notice orange full">${esc(client(p.clientId).name)} · ${money(p.amount)}<br>Este sinal deixará de estar disponível para outros atendimentos. O dinheiro já registrado não será contado novamente.</div>` +
        (a ? `<div class="notice full"><strong>Agendamento vinculado</strong><br>${esc(service(a.serviceId).name)} · ${longDate(a.date)} às ${a.time}<br>${willCancel ? 'Ao confirmar, este compromisso será cancelado e o horário será liberado.' : 'O agendamento já está cancelado. A confirmação registrará somente a retenção do sinal.'}</div>` : '') +
        (willCancel ? '<input type="hidden" name="cancelAppointment" value="1">' : '') +
        textfield('Referência do cancelamento e motivo', 'reason', '', 'required maxlength="500"') +
        `<label class="row full small"><input type="checkbox" name="confirmRetention" required>${willCancel ? 'Confirmo o cancelamento deste agendamento e a retenção do sinal.' : 'Confirmo a retenção deste sinal após o cancelamento informado.'}</label>`, willCancel ? 'Cancelar e reter sinal' : 'Confirmar retenção', id);
}
/**
 * recurringForm — Abre geração manual da conta mensal do espaço, impedindo duplicidade por mês.
 */
function recurringForm() {
    if (!requireStarted())
        return;
    if (!state.settings.spaceAmount) {
        go('setup');
        toast('Informe o valor mensal do espaço antes de gerar a conta.');
        return;
    }
    openForm('Conta mensal do espaço', 'v2-recurring', field('Mês de referência', 'month', ui.month || localDate().slice(0, 7), 'month', 'required', true) + `<div class="notice full">Valor fixo confirmado: ${money(state.settings.spaceAmount)}<br>Vencimento: dia ${state.settings.spaceDueDay}. A conta será criada pendente; a saída só ocorre ao confirmar o pagamento.</div>`, 'Gerar conta do mês');
}
/**
 * billDetail — Exibe composição do valor cobrado, pagamentos aceitos e saldo da cliente.
 */
function billDetail(id) { openDestinationDetail({ page: 'finance', bill: id }); }
/**
 * recordForm — Abre a edição de anotações da ficha; campos financeiros do fechamento permanecem protegidos.
 */
function recordForm(id) {
    const r = state.records.find(r => r.id === id);
    if (!r)
        return;
    const moves = state.movements.filter(m => m.recordId === id);
    openForm('Ficha do atendimento', 'v2-record', `<div class="related-links full">${destinationLink('Ver cobrança e pagamentos', { page: 'finance', bill: r.billId }, 'btn secondary')}${r.appointmentId ? destinationLink('Ver agendamento', { page: 'agenda', appointment: r.appointmentId }, 'btn secondary') : ''}</div><div class="notice full">${esc(client(r.clientId).name)} · ${fmt(r.date)}<br>${esc(r.serviceIds.map(id => service(id).name).join(' + '))}<br>Preço total ${money(r.total)}</div><div class="full">${moves.map(m => { const p = state.products.find(p => p.id === m.productId); return `<p class="small" style="margin-bottom:8px">${esc(p.name)} · ${stockNumber(-m.quantity)} ${p.unit} · ${m.unitCost === null ? 'custo desconhecido' : money(-m.quantity * m.unitCost)}</p>`; }).join('') || '<p class="small muted">Sem consumo de produtos, confirmado no fechamento.</p>'}</div>` + textfield('Fórmula e cor', 'formula', r.formula, 'maxlength="2000"') + textfield('Observações técnicas', 'notes', r.notes, 'maxlength="3000"') + field('Manutenção recomendada', 'followup', r.followup || '', 'date', '', true), 'Salvar observações', id, true);
}
// Etapa atual do formulário de fechamento; ainda não confirma registros.
let finishStep = 0;
/** Exige os campos técnicos do serviço também quando a seleção veio preenchida da agenda. */
function updateFinishRequirements(form) {
    const config = [...form.querySelectorAll('[name=serviceIds]:checked')].map(i => service(i.value).required || '').join('; ').toLowerCase();
    form.elements.formula.required = config.includes('fórmula');
    form.elements.notes.required = config.includes('observações');
}

/** Obtém só o contexto da ficha atual para consultar uma referência compatível. */
function consumptionForForm(form) {
    return previousConsumption(state, form.elements.clientId.value,
        [...form.querySelectorAll('[name=serviceIds]:checked')].map(i => i.value), form.elements.date.value);
}

/** Oferece referência histórica sem preencher campos ou baixar o estoque automaticamente. */
function updateConsumptionSuggestion(form) {
    const target = document.getElementById('finish-suggestion'), suggestion = consumptionForForm(form);
    if (!target) return;
    if (form.dataset.suggestionApplied) form.elements.consumptionReviewed.checked = false;
    if (!suggestion || !suggestion.items.length) {
        target.innerHTML = `<p class="notice">${icon('info')}${suggestion ? 'A última ficha equivalente não registrou consumo. Confira o que foi usado nesta visita.' : 'Sem ficha anterior com esta cliente e este conjunto de serviços. Informe o consumo real abaixo.'}</p>`;
        return;
    }
    target.innerHTML = `<div class="consumption-suggestion"><span class="eyebrow">Uma referência para conferir</span><h3>Produtos da última ficha equivalente</h3><p class="muted small">${fmt(suggestion.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} · mesma cliente e mesmos procedimentos</p><ul>${suggestion.items.map(i => `<li><span>${esc(i.name)}</span><strong>${stockNumber(i.quantity)} ${esc(i.unit)}</strong>${i.unavailable ? '<small class="stock-warning">Saldo insuficiente: ajuste a quantidade ou registre uma entrada.</small>' : ''}</li>`).join('')}</ul>${btn('Preencher para conferir', 'v6-use-consumption', 'copy', 'secondary sm')}<p class="tiny muted">Substitui as quantidades do formulário. Ajuste ao que realmente usou; o estoque só muda ao confirmar o atendimento.</p></div>`;
}

/** Copia a referência por ação explícita e pede conferência; nunca reduz estoque neste ponto. */
function applyConsumptionSuggestion() {
    const form = document.querySelector('form[data-form="v2-finish"]'), suggestion = form && consumptionForForm(form);
    if (!suggestion?.items.length) return;
    form.querySelectorAll('[name^=consume_]').forEach(input => input.value = '');
    for (const item of suggestion.items) {
        const input = form.elements.namedItem('consume_' + item.productId);
        if (input) input.value = item.quantity;
    }
    form.elements.noProducts.checked = false;
    form.dataset.suggestionApplied = 'true';
    form.elements.consumptionReviewed.checked = false;
    document.getElementById('consumption-review').hidden = false;
}

/** Preenche o restante após os sinais escolhidos, ainda sujeito à confirmação do pagamento. */
function fillPaymentRest() {
    const form = document.querySelector('form[data-form="v2-finish"]');
    if (!form) return;
    const ids = [...form.querySelectorAll('[name=depositIds]:checked')].map(i => i.value);
    const deposits = availableDeposits(state, form.elements.clientId.value).filter(p => ids.includes(p.id));
    form.elements.amount.value = amount(Math.max(0, cents(Number(form.elements.total.value)) - deposits.reduce((sum, p) => sum + cents(p.amount), 0)));
}

/**
 * finishForm — Abre fechamento em três etapas para serviços, consumo e recebimento.
 */
function finishForm(appointmentId, manual = false) {
    if (!requireStarted())
        return;
    if (!state.clients.length) {
        go('clients');
        toast('Cadastre a primeira cliente antes de finalizar um atendimento.');
        return;
    }
    if (!state.services.length) {
        go('services');
        toast('Cadastre os serviços primeiro.');
        return;
    }
    if (!appointmentId && !manual) {
        const appointments = state.appointments.filter(a => a.clientId && a.date <= localDate() && a.date >= state.settings.cutoff && !['cancelled', 'absent', 'blocked', 'completed'].includes(a.status) && !state.records.some(r => r.appointmentId === a.id))
            .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
        if (appointments.length) {
            modal('Qual visita deseja concluir?', `<div class="dialog-body"><p class="muted">Escolha um agendamento para preencher cliente, data e serviço. A duração reservada será mantida na agenda.</p><div class="finish-choices">${appointments.slice(0, 8).map(a => `<button type="button" class="finish-choice" data-action="v6-finish-appointment" data-id="${a.id}">${avatar(client(a.clientId))}<span class="grow"><strong>${esc(client(a.clientId).name)}</strong><small>${fmt(a.date)} · ${a.time} · ${esc(service(a.serviceId).name)} · ${a.duration} min</small></span>${icon('arrow')}</button>`).join('')}</div>${appointments.length > 8 ? '<p class="muted small">Para outras visitas, abra a data na Agenda.</p>' : ''}<div class="routine-alternative">${btn('Atendimento sem agendamento', 'v6-finish-manual', 'plus', 'secondary')}</div></div>`);
            return;
        }
    }
    const a = state.appointments.find(a => a.id === appointmentId), cid = a?.clientId || '';
    if (a && (a.date > localDate() || ['cancelled', 'absent', 'blocked', 'completed'].includes(a.status) || state.records.some(r => r.appointmentId === a.id))) {
        toast('Escolha uma visita em aberto, com data até hoje.');
        return;
    }
    finishStep = 0;
    modal('Finalizar atendimento', `<form novalidate data-form="v2-finish"><input type="hidden" name="appointmentId" value="${a?.id || ''}"><div class="finish-progress"><span class="active">1 · Atendimento</span><span>2 · Produtos</span><span>3 · Pagamento</span></div><div class="dialog-body"><section class="finish-step form-grid" data-step="0">${a ? `<div class="notice full agenda-prefill">${icon('check')}<div><strong>Dados preenchidos pela agenda</strong><p>${esc(client(cid).name)} · ${a.time} · ${a.duration} min + ${a.buffer} min de intervalo</p><small>Confira abaixo os procedimentos realizados e informe o preço combinado.</small></div></div><input type="hidden" name="clientId" value="${cid}">` : selectField('Cliente', 'clientId', [['', 'Selecione a cliente'], ...clientOptions()], cid, 'required data-change="v2-finish-client"', true)}${field('Data do atendimento', 'date', a?.date || localDate(), 'date', `required ${a ? 'readonly' : ''} data-change="v6-finish-date" min="${state.settings.cutoff}" max="${localDate()}"`, true)}<div class="full"><label class="field"><span>Serviços realizados nesta visita</span></label><div class="service-checks">${state.services.map(s => `<label><input type="checkbox" name="serviceIds" value="${s.id}" ${a?.serviceId === s.id ? 'checked' : ''} data-change="v2-finish-services"><span>${esc(s.name)}</span></label>`).join('')}</div></div>${field('Preço total combinado (R$)', 'total', '', 'number', 'required min="0.01" max="100000" step="0.01"', true)}<div class="notice full">O preço pertence ao conjunto. Cada serviço selecionado conta no ranking de frequência.</div></section><section class="finish-step form-grid" data-step="1" hidden><div class="full"><h3>Produtos realmente utilizados</h3><p class="muted small" style="margin-top:7px">Informe na unidade de cada produto. O saldo será baixado na confirmação final.</p></div><div id="finish-suggestion" class="full"></div><div class="consumption-list full">${state.products.map(p => { const st = stockOf(state, p.id); return `<label class="consumption-row"><span class="grow"><strong>${esc(p.name)}</strong><small>Disponível: ${stockNumber(st.quantity)} ${p.unit}${st.unitCost === null ? ' · custo a conferir' : ''}</small></span><input type="number" name="consume_${p.id}" min="0" max="${st.quantity}" step="${p.unit === 'un' ? '1' : '0.001'}" placeholder="0" aria-label="Quantidade usada de ${esc(p.name)}"><span>${p.unit}</span></label>`; }).join('') || '<p class="notice">Nenhum produto cadastrado. Cadastre o estoque antes de registrar consumo.</p>'}</div><label class="consumption-review full" id="consumption-review" hidden><input type="checkbox" name="consumptionReviewed">Conferi e ajustei as quantidades sugeridas para o consumo real desta visita.</label><label class="row full small"><input type="checkbox" name="noProducts">Confirmo que não houve consumo de produtos neste atendimento.</label>${textfield('Fórmula e cor, quando aplicável', 'formula', '', 'maxlength="2000"')}${textfield('Observações técnicas', 'notes', '', 'maxlength="3000"')}${field('Data recomendada de manutenção (opcional)', 'followup', '', 'date', '', true)}</section><section class="finish-step form-grid" data-step="2" hidden><div class="full" id="finish-summary"></div><div class="full" id="finish-deposits">${depositChecks(cid)}</div><div class="full row between wrap"><p class="muted small">Informe somente o pagamento confirmado agora.</p>${btn('Preencher saldo restante', 'v6-payment-rest', 'wallet', 'text')}</div>${field('Pagamento recebido ou aceito agora (R$)', 'amount', 0, 'number', 'min="0" max="100000" step="0.01"', true)}${selectField('Forma de pagamento', 'method', METHODS.map(m => [m, m]), 'Pix', 'data-change="v2-payment-method"', true)}${cardFields()}${field('Vencimento do saldo restante', 'due', localDate(), 'date', 'required', true)}<div class="notice full">Sinais selecionados serão aplicados uma única vez. Se o pagamento for parcial ou zero, o restante ficará a receber. Cartão gera parcelas previstas, sem contar como dinheiro recebido agora.</div></section></div><div id="form-error" class="form-error" role="alert"></div><div class="dialog-footer"><button type="button" class="btn secondary" data-action="v2-finish-back">Cancelar</button><button type="button" class="btn primary" data-action="v2-finish-next">Continuar ${icon('arrow')}</button><button type="submit" class="btn primary finish-submit" hidden>${icon('check')}Confirmar atendimento</button></div></form>`, '', true);
    const form = document.querySelector('dialog form');
    updateCardFields(form);
    updateFinishRequirements(form);
    updateConsumptionSuggestion(form);
}
/**
 * depositChecks — Monta seleção de sinais ainda disponíveis da cliente no fechamento.
 */
function depositChecks(id) { const ps = availableDeposits(state, id); return ps.length ? `<label class="field"><span>Sinais disponíveis: selecione os que deseja aplicar</span></label><div class="service-checks">${ps.map(p => `<label><input type="checkbox" name="depositIds" value="${p.id}"><span>${money(p.amount)} · ${fmt(p.date)}${p.isOpening ? ' · anterior ao início' : ''}</span></label>`).join('')}</div>` : '<p class="muted small">Nenhum sinal disponível para esta cliente.</p>'; }
/**
 * showFinishStep — Atualiza a etapa visível sem concluir ou gravar o atendimento.
 */
function showFinishStep(n) {
    const f = document.querySelector('form[data-form="v2-finish"]');
    if (!f)
        return;
    finishStep = n;
    f.querySelectorAll('.finish-step').forEach((s, i) => s.hidden = i !== n);
    f.querySelectorAll('.finish-progress span').forEach((s, i) => s.classList.toggle('active', i === n));
    f.querySelector('[data-action="v2-finish-back"]').textContent = n ? 'Voltar' : 'Cancelar';
    f.querySelector('[data-action="v2-finish-next"]').hidden = n === 2;
    f.querySelector('.finish-submit').hidden = n !== 2;
    if (n === 2) {
        const services = [...f.querySelectorAll('[name=serviceIds]:checked')].map(c => service(c.value).name);
        document.getElementById('finish-summary').innerHTML = `<div class="finish-total"><span>${esc(client(f.elements.clientId.value).name)}</span><strong>${money(f.elements.total.value)}</strong><p>${esc(services.join(' + '))}</p></div>`;
    }
    document.getElementById('form-error').textContent = '';
    document.getElementById('dialog').scrollTop = 0;
}
/**
 * checkFinishStep — Confere os campos necessários antes de avançar na conclusão do atendimento.
 */
function checkFinishStep() {
    const f = document.querySelector('form[data-form="v2-finish"]');
    for (const input of f.querySelectorAll(`.finish-step[data-step="${finishStep}"] input,.finish-step[data-step="${finishStep}"] select,.finish-step[data-step="${finishStep}"] textarea`))
        if (!input.checkValidity()) {
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', 'form-error');
            // Nomeia o campo: em etapas longas no celular, a mensagem genérica não dizia o que faltava.
            const label = input.labels?.[0]?.querySelector('span')?.textContent?.trim() || input.labels?.[0]?.textContent?.trim() || 'Este campo';
            document.getElementById('form-error').textContent = input.validity.valueMissing ? `${label}: preencha antes de continuar.` : `${label}: confira o valor informado e os limites.`;
            input.focus();
            return false;
        }
    if (finishStep === 0 && !f.querySelector('[name=serviceIds]:checked')) {
        document.getElementById('form-error').textContent = 'Selecione ao menos um serviço.';
        return false;
    }
    if (finishStep === 1) {
        if (f.dataset.suggestionApplied && !f.elements.consumptionReviewed.checked) {
            document.getElementById('form-error').textContent = 'Confira as quantidades sugeridas e marque a confirmação do consumo real.';
            return false;
        }
        const used = [...f.querySelectorAll('[name^=consume_]')].some(i => Number(i.value) > 0), none = f.elements.noProducts.checked;
        if (!used && !none) {
            document.getElementById('form-error').textContent = 'Informe o consumo ou confirme que nenhum produto foi utilizado.';
            return false;
        }
        if (used && none) {
            document.getElementById('form-error').textContent = 'Remova a confirmação de nenhum consumo ou zere as quantidades.';
            return false;
        }
    }
    return true;
}
/**
 * exportRows — Mapeia entidades atuais para colunas de exportação e respeita os filtros aplicáveis.
 */
function exportRows(kind, from = '', to = '') {
    const inside = d => (!from || d >= from) && (!to || d <= to);
    if (kind === 'payments') {
        const direct = state.payments.filter(p => !cardMethod(p.method) && !p.isOpening && inside(p.date)).map(p => [p.date, client(p.clientId).name, p.kind, p.amount, p.method]);
        const cards = state.installments.filter(i => i.receivedDate && inside(i.receivedDate)).map(i => [i.receivedDate, client(state.payments.find(p => p.id === i.paymentId).clientId).name, 'Repasse líquido', i.receivedNet, 'Cartão']);
        return [['Data', 'Cliente', 'Origem', 'Recebido', 'Método'], ...direct, ...cards];
    }
    if (kind === 'expenses')
        return [['Descrição', 'Categoria', 'Data', 'Vencimento', 'Valor', 'Pagamento', 'Saldo anterior'], ...state.expenses.filter(e => inside(e.date)).map(e => [e.description, e.category, e.date, e.due, e.amount, e.paidDate || 'Pendente', e.isOpening ? 'Sim' : 'Não'])];
    if (kind === 'stock')
        return [['Produto', 'Marca', 'Unidade', 'Embalagem', 'Saldo', 'Custo unitário conhecido', 'Mínimo'], ...state.products.map(p => { const s = stockOf(state, p.id); return [p.name, p.brand, p.unit, p.packageSize, s.quantity, s.unitCost ?? 'Desconhecido', p.minimum]; })];
    if (kind === 'cards')
        return [['Cliente', 'Parcela', 'Previsão', 'Bruto', 'Taxa', 'Data do repasse', 'Líquido'], ...state.installments.filter(i => inside(i.due)).map(i => [client(state.payments.find(p => p.id === i.paymentId).clientId).name, i.number + '/' + i.count, i.due, i.gross, i.fee ?? 'Desconhecida', i.receivedDate || 'Pendente', i.receivedNet ?? ''])];
    if (kind === 'records')
        return [['Data', 'Cliente', 'Serviços', 'Total combinado', 'Fórmula', 'Observações', 'Manutenção'], ...state.records.filter(r => inside(r.date)).map(r => [r.date, client(r.clientId).name, r.serviceIds.map(id => service(id).name).join(' + '), r.total, r.formula, r.notes, r.followup])];
    return legacyExportRows(kind, from, to);
}
/**
 * Delegação de change: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('change', e => {
    const a = e.target.dataset.change, f = e.target.form;
    if (a === 'v6-records-month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) navigateTo(recordsDestination({ mode: 'month', month: e.target.value, p: 1 }));
    if (a === 'v7-records-date' && validCalendarDate(e.target.value)) navigateTo(recordsDestination({ mode: 'day', date: e.target.value, p: 1 }));
    if (a === 'v2-month') {
        ui.month = e.target.value;
        ui.financeDate = ''; ui.financePageIndex = 1;
        render();
        globalThis.history?.replaceState?.({ hanneUI: structuredClone(ui), target: currentDestination() }, '', destinationHref(currentDestination()));
    }
    if (a === 'v2-payment-method')
        updateCardFields(f);
    if (a === 'v2-finish-client') {
        document.getElementById('finish-deposits').innerHTML = depositChecks(e.target.value);
        updateConsumptionSuggestion(f);
    }
    if (a === 'v6-finish-date') updateConsumptionSuggestion(f);
    if (a === 'v2-finish-services') { updateFinishRequirements(f); updateConsumptionSuggestion(f); }
});
/**
 * Delegação de click: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t)
        return;
    const a = t.dataset.action, id = t.dataset.id;
    if (a === 'inbox-mode') { ui.inboxView = t.dataset.mode; render(); return; }
    if (a === 'v7-keep-editing') { restoreEditing(); return; }
    if (a === 'v7-discard' && leaveConfirmation) {
        const pending = leaveConfirmation; leaveConfirmation = null; closeModal(true); pending.proceed(); return;
    }
    if (a === 'v7-route') {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
        e.preventDefault?.();
        try { navigateTo(JSON.parse(t.dataset.route)); } catch { toast('Não foi possível abrir este destino. Volte à lista e tente novamente.'); }
        return;
    }
    if (['v7-day', 'v7-month', 'v7-all'].includes(a)) {
        navigateTo(recordsDestination({ mode: { 'v7-day': 'day', 'v7-month': 'month', 'v7-all': 'all' }[a], p: 1 }));
        return;
    }
    if (a === 'v7-clear-record-filters') { navigateTo(recordsDestination({ service: '', set: '', client: '', p: 1 })); return; }
    if (a === 'v6-current-month' || a === 'v6-all-records') { navigateTo(recordsDestination({ mode: a === 'v6-current-month' ? 'month' : 'all', month: localDate().slice(0, 7), p: 1 })); }
    if (a === 'v6-finish-appointment') finishForm(id);
    if (a === 'v6-finish-manual') finishForm(null, true);
    if (a === 'v6-use-consumption') applyConsumptionSuggestion();
    if (a === 'v6-payment-rest') fillPaymentRest();
    if (a === 'v2-reload') {
        if (savePending) { confirmLeaving('Há registros ainda não sincronizados. Recarregar descartará o rascunho em memória. Cancele e exporte o rascunho se precisar preservá-lo.', () => location.reload()); return; }
        location.reload();
    }
    if (a === 'v2-retry') {
        syncStatus = 'saving';
        flushSave();
        render();
    }
    if (a === 'v2-all-period') {
        ui.month = ''; ui.financeDate = ''; ui.financePageIndex = 1;
        render();
        globalThis.history?.replaceState?.({ hanneUI: structuredClone(ui), target: currentDestination() }, '', destinationHref(currentDestination()));
    }
    if (a === 'v2-finance-tab') {
        navigateTo({ page: 'finance', tab: id, month: ui.month });
    }
    if (a === 'v2-stock-tab') {
        navigateTo({ page: 'inventory', tab: id });
    }
    if (a === 'v2-stock-export')
        exportData('stock');
    if (a === 'v2-finish')
        finishForm();
    if (a === 'v2-product')
        productForm();
    if (a === 'v2-purchase')
        purchaseForm(id);
    if (a === 'v2-product-detail')
        productDetail(id);
    if (a === 'v2-loss')
        movementForm(id, 'loss');
    if (a === 'v2-value')
        movementForm(id, 'valuation');
    if (a === 'v2-expense')
        expenseForm();
    if (a === 'v2-deposit')
        depositForm();
    if (a === 'v2-opening')
        openingForm();
    if (a === 'v2-settle')
        settleForm(id);
    if (a === 'v2-retain')
        retainForm(id);
    if (a === 'v2-recurring')
        recurringForm();
    if (a === 'v2-finance-menu')
        modal('O que deseja registrar?', `<div class="dialog-body finance-menu">${btn('Pagamento de uma cliente', 'v2-show-bills', 'wallet', 'secondary')}${btn('Sinal para atendimento futuro', 'v2-deposit', 'plus', 'secondary')}${btn('Despesa do negócio', 'v2-expense', 'file', 'secondary')}${btn('Compra de produtos', 'v2-purchase', 'leaf', 'secondary')}${btn('Saldo anterior ao início', 'v2-opening', 'upload', 'secondary')}${btn('Novo valor a receber', 'new-bill', 'plus', 'secondary')}</div>`);
    if (a === 'v2-show-bills') {
        closeModal();
        ui.financeTab = 'bills';
        render();
        toast('Escolha a cliente e toque em Receber.');
    }
    if (a === 'v2-expense-pay') {
        const x = state.expenses.find(e => e.id === id);
        if (x && !x.paidDate)
            openForm('Confirmar pagamento da despesa', 'v2-expense-pay', `<div class="notice full">${esc(x.description)} · ${money(x.amount)}</div>` + field('Data em que pagou', 'date', localDate(), 'date', `required min="${state.settings.cutoff}" max="${localDate()}"`, true), 'Confirmar pagamento', id);
    }
    if (a === 'v2-finish-next' && checkFinishStep())
        showFinishStep(Math.min(2, finishStep + 1));
    if (a === 'v2-finish-back') {
        if (finishStep)
            showFinishStep(finishStep - 1);
        else
            closeModal();
    }
});
/**
 * Delegação de submit: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('submit', e => {
    const form = e.target, kind = form.dataset.form;
    if (!kind?.startsWith('v2-'))
        return;
    e.preventDefault();
    const fd = new FormData(form), v = n => String(fd.get(n) || '').trim(), id = v('id'), error = document.getElementById(kind === 'v2-setup' ? 'setup-error' : 'form-error');
    if (error)
        error.textContent = '';
    let next = structuredClone(state), message = 'Registro confirmado.', action = 'Registro atualizado';
    try {
        for (const el of form.querySelectorAll('input[required]:not(:disabled),textarea[required]:not(:disabled)'))
            if ((['text', 'tel', 'search'].includes(el.type) || el.tagName === 'TEXTAREA') && !el.value.trim())
                throw Error('Preencha os campos obrigatórios.');
        const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + 'T12:00:00Z')), operationDate = d => {
            if (!validDate(d) || d < next.settings.cutoff || d > localDate())
                throw Error('Use uma data entre o início da operação e hoje.');
        }, stockDate = (pid, date) => {
            operationDate(date);
            const last = next.movements.filter(m => m.productId === pid).at(-1);
            if (last && date < last.date)
                throw Error('A data deve ser igual ou posterior ao último movimento do produto.');
        };
        const parts = (clientId, billId = null, kind = 'Pagamento') => {
            const value = Number(v('amount')), method = v('method'), date = v('date');
            operationDate(date);
            if (cardMethod(method)) {
                if (v('firstDue') < date)
                    throw Error('O primeiro repasse não pode ser anterior à venda.');
                if (v('feeTotal') !== '' && Number(v('feeTotal')) > value)
                    throw Error('A taxa não pode superar o valor recebido.');
            }
            return paymentEntries(next, { id: uid(), clientId, billId, value, method, kind, date, appointmentId: v('appointmentId') || null, count: cardMethod(method) ? Number(v('count')) : 1, firstDue: v('firstDue') || date, feeTotal: v('feeTotal') === '' ? null : Number(v('feeTotal')) });
        };
        // Confirma a data de corte e as condições fixas do espaço antes dos lançamentos operacionais.
        if (kind === 'v2-setup') {
            const cutoff = v('cutoff');
            if (!validDate(cutoff) || cutoff > localDate())
                throw Error('Escolha uma data de início válida, até hoje.');
            next.settings.cutoff = cutoff;
            next.settings.spaceAmount = v('spaceAmount') === '' ? null : Number(v('spaceAmount'));
            next.settings.spaceDueDay = Number(v('spaceDueDay'));
            const routine = ensureSpaceExpense(next);
            next = routine.state;
            action = routine.expense ? 'Preparação confirmada e conta do espaço criada em aberto' : 'Preparação da operação confirmada';
            message = routine.expense ? 'Configurações salvas. Conta deste mês criada em aberto.' : 'Configurações salvas. As contas já criadas mantêm o valor original.';
        }
        // Cadastra o produto e o saldo físico inicial sem fabricar uma despesa nova.
        if (kind === 'v2-product') {
            operationDate(v('date'));
            const quantity = qty(Number(v('quantity'))), packageSize = Number(v('packageSize')), cost = v('packageCost') === '' ? null : Number(v('packageCost')) / packageSize;
            if (v('unit') === 'un' && !Number.isInteger(quantity))
                throw Error('Produtos controlados em unidades precisam de quantidades inteiras.');
            const productId = uid();
            next.products.push({ id: productId, name: v('name'), brand: v('brand'), unit: v('unit'), packageSize, minimum: qty(Number(v('minimum'))) });
            next.movements.push({ id: uid(), productId, type: 'opening', date: v('date'), quantity, unitCost: cost, note: 'Saldo inicial conferido manualmente' });
            action = 'Produto e estoque inicial cadastrados';
            message = 'Produto registrado. O saldo inicial não gerou nova despesa.';
        }
        // Registra estoque e despesa vinculada na mesma cópia; paidDate só existe se houve pagamento.
        if (kind === 'v2-purchase') {
            const productId = v('productId'), p = next.products.find(p => p.id === productId), quantity = qty(Number(v('quantity'))), total = Number(v('total'));
            stockDate(productId, v('date'));
            if (!p || quantity <= 0 || total <= 0)
                throw Error('Confira produto, quantidade e valor.');
            if (p.unit === 'un' && !Number.isInteger(quantity))
                throw Error('Informe uma quantidade inteira em unidades.');
            const expenseId = uid();
            next.movements.push({ id: uid(), productId, type: 'purchase', date: v('date'), quantity, unitCost: total / quantity, expenseId, note: 'Compra registrada com despesa vinculada' });
            next.expenses.push({ id: expenseId, category: 'products', description: 'Compra · ' + p.name, amount: amount(cents(total)), date: v('date'), due: v('due'), paidDate: v('paid') === 'paid' ? v('date') : null, isOpening: false });
            action = 'Compra de produto e despesa registradas em conjunto';
            message = 'Compra registrada e estoque atualizado.';
        }
        // Registra perda ou valoração atual sem editar movimentos históricos.
        if (kind === 'v2-movement') {
            const p = next.products.find(p => p.id === id), type = v('type'), st = stockOf(next, id);
            stockDate(id, v('date'));
            let quantity = 0, cost = st.unitCost;
            if (type === 'loss') {
                quantity = -qty(Number(v('quantity')));
                if (quantity >= 0 || -quantity > st.quantity)
                    throw Error('A perda deve ser positiva e caber no estoque.');
                if (p.unit === 'un' && !Number.isInteger(quantity))
                    throw Error('Use quantidade inteira para unidades.');
            }
            else {
                cost = Number(v('packageCost')) / p.packageSize;
                if (!Number.isFinite(cost) || cost <= 0)
                    throw Error('Informe um custo válido.');
            }
            next.movements.push({ id: uid(), productId: id, type, date: v('date'), quantity, unitCost: cost, note: v('note') });
            action = type === 'loss' ? 'Perda de produto confirmada' : 'Custo do estoque conferido';
            message = 'Movimento registrado no histórico.';
        }
        // Recebe parte de uma cobrança existente; cartão produz repasses previstos, não dinheiro imediato.
        if (kind === 'v2-payment') {
            const b = next.bills.find(b => b.id === id);
            if (!b || cents(Number(v('amount'))) > cents(billBalance(next, b)))
                throw Error('O valor ultrapassa o saldo da cliente.');
            const result = parts(b.clientId, id);
            next.payments.push(result.payment);
            next.installments.push(...result.installments);
            action = 'Pagamento da cliente confirmado';
            message = cardMethod(result.payment.method) ? 'Pagamento aceito. Repasses do cartão ficaram previstos.' : 'Recebimento registrado no caixa.';
        }
        // Cria sinal disponível e, se informado, mantém o vínculo com agenda da mesma cliente.
        if (kind === 'v2-deposit') {
            const clientId = v('clientId'), a = next.appointments.find(a => a.id === v('appointmentId'));
            if (a && (a.clientId !== clientId || ['cancelled', 'absent', 'completed'].includes(a.status)))
                throw Error('O agendamento selecionado não corresponde à cliente ou não está ativo.');
            const result = parts(clientId, null, 'Sinal');
            next.payments.push(result.payment);
            next.installments.push(...result.installments);
            action = 'Sinal recebido e disponível para aplicação';
            message = 'Sinal registrado. Selecione-o ao finalizar o atendimento.';
        }
        // Cria despesa em aberto ou paga conforme confirmação explícita.
        if (kind === 'v2-expense') {
            if (v('paidDate'))
                operationDate(v('paidDate'));
            if (!validDate(v('date')) || v('date') < next.settings.cutoff)
                throw Error('Despesas anteriores devem entrar como saldo de abertura.');
            next.expenses.push({ id: uid(), description: v('description'), category: v('category'), amount: Number(v('amount')), date: v('date'), due: v('due'), paidDate: v('paidDate') || null, isOpening: false });
            action = 'Despesa registrada';
            message = v('paidDate') ? 'Despesa e pagamento registrados.' : 'Despesa pendente registrada.';
        }
        // Marca a data efetiva de pagamento de uma despesa existente.
        if (kind === 'v2-expense-pay') {
            operationDate(v('date'));
            const x = next.expenses.find(x => x.id === id);
            if (!x || x.paidDate)
                throw Error('Esta despesa já foi paga ou não existe.');
            x.paidDate = v('date');
            action = 'Pagamento de despesa confirmado';
            message = 'Saída de dinheiro confirmada.';
        }
        // Confirma o líquido e a taxa do repasse usando o extrato informado pela profissional.
        if (kind === 'v2-settle') {
            operationDate(v('date'));
            const i = next.installments.find(i => i.id === id), net = Number(v('net'));
            if (!i || i.receivedDate || !Number.isFinite(net) || net < 0 || cents(net) > cents(i.gross))
                throw Error('Confira a parcela e o valor líquido.');
            const p = next.payments.find(p => p.id === i.paymentId);
            if (!p.isOpening && v('date') < p.date)
                throw Error('O repasse não pode ocorrer antes da venda.');
            i.receivedDate = v('date');
            i.receivedNet = amount(cents(net));
            i.fee = amount(cents(i.gross) - cents(net));
            action = 'Repasse líquido do cartão conferido';
            message = 'Repasse confirmado. O valor líquido entrou no caixa.';
        }
        // Delega retenção e cancelamento vinculados à função atômica do domínio.
        if (kind === 'v2-retain') {
            next = retainDeposit(state, { id, reason: v('reason'), confirmed: fd.has('confirmRetention'), cancelAppointment: v('cancelAppointment') === '1' });
            action = v('cancelAppointment') === '1' ? 'Cancelamento de agendamento e retenção de sinal confirmados' : 'Retenção de sinal confirmada manualmente';
            message = v('cancelAppointment') === '1' ? 'Agendamento cancelado e sinal retido. O horário foi liberado.' : 'Retenção registrada. Um novo atendimento precisará de outro sinal.';
        }
        // Registra obrigações e direitos anteriores sem duplicar receitas ou compras no início.
        if (kind === 'v2-opening') {
            if (!next.settings.cutoff)
                throw Error('Defina a data de início primeiro.');
            const type = v('type'), value = Number(v('amount')), cid = v('clientId'), oldDate = dayOffset(-1, next.settings.cutoff);
            if (type !== 'expense' && !next.clients.some(c => c.id === cid))
                throw Error('Selecione a cliente correspondente.');
            if (type === 'debt')
                next.bills.push({ id: uid(), clientId: cid, description: v('description'), total: value, date: next.settings.cutoff, due: v('due'), isOpening: true });
            if (type === 'deposit')
                next.payments.push({ id: uid(), clientId: cid, billId: null, amount: value, method: 'Saldo anterior', kind: 'Sinal', date: oldDate, isOpening: true, depositStatus: 'available', description: v('description') });
            if (type === 'expense')
                next.expenses.push({ id: uid(), category: 'space', description: v('description'), amount: value, date: oldDate, due: v('due'), paidDate: null, isOpening: true });
            if (type === 'card') {
                const result = paymentEntries(next, { id: uid(), clientId: cid, value, method: 'Cartão de crédito', kind: 'Pagamento', date: oldDate, opening: true, count: 1, firstDue: v('due'), feeTotal: v('feeTotal') === '' ? null : Number(v('feeTotal')) });
                next.payments.push(result.payment);
                next.installments.push(...result.installments);
            }
            action = 'Saldo anterior à operação conferido';
            message = 'Saldo de abertura registrado sem criar recebimento novo.';
        }
        // Gera manualmente a despesa do espaço e impede duplicidade para o mesmo mês.
        if (kind === 'v2-recurring') {
            const month = v('month');
            if (!/^\d{4}-\d{2}$/.test(month) || month < next.settings.cutoff.slice(0, 7))
                throw Error('Escolha um mês a partir do início da operação.');
            if (next.expenses.some(e => e.recurringMonth === month))
                throw Error('A conta do espaço já foi gerada para este mês.');
            if (!next.settings.spaceAmount)
                throw Error('Informe o valor do espaço na preparação.');
            next.expenses.push({ id: uid(), category: 'space', description: 'Espaço compartilhado · ' + fmt(month + '-01', { month: 'long', year: 'numeric' }), amount: next.settings.spaceAmount, date: month + '-01' < next.settings.cutoff ? next.settings.cutoff : month + '-01', due: month + '-' + String(next.settings.spaceDueDay).padStart(2, '0'), paidDate: null, isOpening: false, recurringMonth: month });
            action = 'Conta mensal do espaço gerada';
            message = 'Conta pendente criada para o mês selecionado.';
        }
        // Permite atualizar observações técnicas, preservando dados financeiros confirmados.
        if (kind === 'v2-record') {
            const r = next.records.find(r => r.id === id);
            if (!r)
                throw Error('Atendimento não encontrado.');
            if (v('followup') && v('followup') < r.date)
                throw Error('A manutenção precisa ser após o atendimento.');
            r.formula = v('formula');
            r.notes = v('notes');
            r.followup = v('followup');
            action = 'Observações da ficha técnica revisadas';
            message = 'Ficha técnica atualizada; valores e consumo preservados.';
        }
        // Conclui a visita inteira por closeAttendance, substituindo o estado apenas após validação.
        if (kind === 'v2-finish') {
            if (form.dataset.suggestionApplied && !fd.has('consumptionReviewed'))
                throw Error('Confira e confirme o consumo real na etapa Produtos.');
            if (finishStep === 2 && !checkFinishStep())
                return;
            if (finishStep !== 2) {
                if (checkFinishStep())
                    showFinishStep(Math.min(2, finishStep + 1));
                return;
            }
            const consumption = [...form.querySelectorAll('[name^=consume_]')].filter(i => Number(i.value) > 0).map(i => ({ productId: i.name.slice(8), quantity: Number(i.value) })), serviceIds = fd.getAll('serviceIds'), value = Number(v('amount')), method = v('method'), feeTotal = v('feeTotal') === '' ? null : Number(v('feeTotal'));
            if (cardMethod(method) && v('firstDue') < v('date'))
                throw Error('O repasse previsto não pode anteceder o atendimento.');
            if (feeTotal !== null && feeTotal > value)
                throw Error('A taxa não pode superar o pagamento no cartão.');
            if (consumption.length && fd.has('noProducts'))
                throw Error('Confira a indicação de nenhum produto utilizado.');
            if (v('followup') && v('followup') < v('date'))
                throw Error('A manutenção precisa ser após o atendimento.');
            const cfg = serviceIds.map(id => service(id).required || '').join(';').toLowerCase();
            if (cfg.includes('fórmula') && !v('formula') || cfg.includes('observações') && !v('notes'))
                throw Error('Preencha fórmula e observações exigidas pelos serviços na etapa Produtos.');
            next = closeAttendance(state, { id: uid(), appointmentId: v('appointmentId') || null, clientId: v('clientId'), serviceIds, date: v('date'), total: Number(v('total')), consumption, noProducts: fd.has('noProducts'), depositIds: fd.getAll('depositIds'), formula: v('formula'), notes: v('notes'), followup: v('followup'), due: v('due'), payment: value > 0 ? { value, method, count: cardMethod(method) ? Number(v('count')) : 1, firstDue: v('firstDue') || v('date'), feeTotal } : null });
            action = 'Atendimento finalizado com serviços, estoque e pagamento';
            message = 'Atendimento registrado. Estoque, financeiro e ranking atualizados.';
        }
        validateState(next, state);
        state = next;
        audit(action);
        if (persist(message, form)) {
            if (kind !== 'v2-setup')
                closeModal();
            render();
        }
    }
    catch (err) {
        if (error) {
            error.textContent = err.message;
            error.scrollIntoView({ block: 'nearest' });
        }
        else
            toast(err.message);
    }
});
/**
 * datasetBanner — Identifica claramente se a visualização é real ou fictícia.
 */
function datasetBanner() {
    // Nos dados reais o aviso só ocupava espaço; a demonstração continua acessível em Configurações e no menu.
    if (dataset !== 'example')
        return '';
    return `<section class="dataset-banner ${dataset === 'example' ? 'example' : 'real'}" aria-label="${dataset === 'example' ? 'Dados fictícios' : 'Dados reais'}"><span class="dataset-symbol">${icon(dataset === 'example' ? 'spark' : 'shield')}</span><div class="grow"><strong>${dataset === 'example' ? 'Você está na demonstração' : 'Você está nos dados reais'}</strong><p>${dataset === 'example' ? 'Dados fictícios para explorar o sistema.' : 'Registros da sua operação, separados dos exemplos.'}</p></div>${btn(dataset === 'example' ? 'Usar dados reais' : 'Ver demonstração', 'v3-dataset', 'arrow', 'text', `data-dataset="${dataset === 'example' ? 'real' : 'example'}"`)}</section>`;
}
/**
 * Delegação de click: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="v3-dataset"]');
    if (!b)
        return;
    if (saving || savePending) {
        toast('Aguarde o salvamento ou exporte e confira as alterações pendentes antes de trocar de base.');
        return;
    }
    const selected = b.dataset.dataset === 'real' ? 'real' : 'example';
    try {
        localStorage.setItem('hanne-data-view', selected);
    }
    catch { }
    location.search = '?dados=' + (selected === 'real' ? 'reais' : 'exemplo');
});
/**
 * Delegação de click: identifica a ação pelo atributo data-* do elemento.
 * Os formulários v2 usam cópia do estado e validação antes da gravação; o listener legado ignora esses formulários.
 */
document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b)
        return;
    if (b.dataset.action === 'v4-open-pending') {
        ui.inboxView = dataset === 'real' && whatsappPending > 0 ? 'whatsapp' : 'notes';
        ui.convFilter = 'open';
        ui.conversationId = pendingConvs()[0]?.id || '';
        go('conversations');
    }
    if (b.dataset.action === 'v4-open-unconfirmed') {
        const next = state.appointments.filter(a => a.status === 'pending' && a.date >= localDate()).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))[0];
        ui.date = next?.date || localDate();
        ui.agendaView = 'day';
        go('agenda');
    }
});
bootstrap();

/** Troca só a aparência; atualiza os controles sem descartar campos em edição. */
document.addEventListener('click', e => {
    const button = e.target.closest('[data-action="v5-theme"]');
    if (!button) return;
    theme = applyTheme(button.dataset.theme, document.documentElement, globalThis.localStorage);
    document.querySelectorAll('[data-action="v5-theme"]').forEach(control => {
        const selected = control.dataset.theme === theme;
        control.classList.toggle('active', selected);
        control.setAttribute('aria-pressed', String(selected));
    });
});


/** Exclusão uniforme: prévia dos vínculos, confirmação explícita e transação por revisão. */
const deletionLabels={clients:'Cliente',services:'Serviço',appointments:'Agendamento',conversations:'Nota interna',quotes:'Orçamento',tasks:'Tarefa',products:'Produto',records:'Atendimento realizado',bills:'Cobrança',payments:'Pagamento / sinal',installments:'Parcela do cartão',movements:'Movimento de estoque',expenses:'Despesa',audit:'Histórico de ações',settings:'Configurações'};
function deletionName(key,item){
 const payment=item.paymentId?state.payments.find(p=>p.id===item.paymentId):null;
 const customer=state.clients.find(c=>c.id===(item.clientId||payment?.clientId));
 const product=state.products.find(p=>p.id===item.productId);
 return [item.name||item.title||item.description||item.action||customer?.name||product?.name||'Registro',item.date||item.due||'',item.amount!=null?money(item.amount):item.gross!=null?money(item.gross):'',item.quantity!=null?stockNumber(item.quantity)+' '+(product?.unit||''):''].filter(Boolean).join(' · ');
}
function deletionList(){
 const collections={clients:['clients'],services:['records','services'],agenda:['appointments'],conversations:['conversations'],quotes:['quotes'],tasks:['tasks'],inventory:['products','movements'],finance:['bills','payments','installments','expenses'],settings:allCollections,setup:allCollections}[ui.page]||allCollections;
 const rows=collections.flatMap(key=>state[key].map(x=>`<div class="setting-row" data-delete-row><div><strong>${esc(deletionLabels[key]+': '+deletionName(key,x))}</strong><p>${esc([x.date,x.time,x.amount!=null?money(x.amount):''].filter(Boolean).join(' · '))}</p></div>${btn('Excluir','v12-delete-confirm','','danger sm',`data-collection="${key}" data-id="${esc(x.id)}"`)}</div>`));
 modal('Excluir informações',`<div class="dialog-body"><p>Escolha um registro. Antes de apagar, você verá todos os vínculos afetados. A exclusão altera métricas, saldos e estoque e não pode ser desfeita. Exporte uma cópia nas configurações se quiser guardá-la.</p><label class="field"><span>Buscar registro para excluir</span><input id="deletion-search" type="search" placeholder="Nome, data ou valor"></label>${rows.join('')||empty('Nenhum registro para excluir.')}${['settings','setup'].includes(ui.page)?btn('Apagar dados da operação','v12-delete-confirm','','danger', 'data-collection="operation" data-id="all"'):''}</div>`,btn('Fechar','close-modal','','secondary'));
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action^="v12-delete-"]');if(!button)return;
 if(saving||syncStatus!=='saved'){toast('Aguarde a sincronização antes de excluir.');return;}
 const {action,collection,id}=button.dataset;
 if(action==='v12-delete-list')return deletionList();
 if(action==='v12-delete-confirm')try{
  const plan=deletionPlan(state,collection,id);
  modal('Confirmar exclusão definitiva',`<div class="dialog-body"><p><strong>${plan.entries.length} registro(s) serão apagados:</strong></p><ul>${plan.entries.map(x=>`<li>${esc(deletionLabels[x.collection]+': '+(state[x.collection]?.find(item=>item.id===x.id)?deletionName(x.collection,state[x.collection].find(item=>item.id===x.id)):x.label))}</li>`).join('')}</ul><p>Pagamentos e parcelas vinculados deixarão de compor os saldos. Consumos excluídos devolvem produtos ao estoque; ao excluir uma entrada, movimentos posteriores dependentes também são removidos. Isso não faz estorno bancário nem avisa a cliente. Mensagens reais do WhatsApp e credenciais de acesso são geridas separadamente. Um comprovante técnico da exclusão permanece no sistema.</p><label class="row"><input id="delete-agree" type="checkbox">Conferi a lista e quero excluir definitivamente.</label></div>`,btn('Manter registros','close-modal','','secondary')+btn('Excluir definitivamente','v12-delete-apply','','danger',`data-collection="${collection}" data-id="${esc(id)}"`));
  document.querySelector('[data-action="close-modal"]')?.focus();
 }catch(e){toast(e.message);}
 if(action==='v12-delete-apply'){
  if(!document.querySelector('#delete-agree')?.checked){toast('Marque a confirmação após conferir os vínculos.');return;}
  button.disabled=true;button.textContent='Excluindo…';saving=true;
  try{
   const plan=deletionPlan(state,collection,id);
   const response=await fetch(stateURL(),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,collection,id,confirmed:true,plan:JSON.stringify(plan.entries)})});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   state=data.state;confirmedState=structuredClone(state);revision=data.revision;lastSavedAt=data.updatedAt;syncStatus='saved';closeModal(true);render();toast('Exclusão confirmada. Saldos e estoque atualizados.');
  }catch(e){toast(e.message||'A exclusão não foi confirmada. Recarregue para conferir antes de tentar novamente.');button.disabled=false;button.textContent='Excluir definitivamente';}finally{saving=false;}
 }
});

document.addEventListener('click',event=>{if(!event.target.closest('[data-salon-logout]'))return;event.preventDefault();confirmLeaving('Deseja sair da conta? Confira se as alterações foram salvas.',async()=>{try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error();location.replace('/login');}catch{toast('Não foi possível sair. Tente novamente.');}});});

document.addEventListener('input',event=>{if(event.target.id!=='deletion-search')return;const query=event.target.value.toLocaleLowerCase('pt-BR');document.querySelectorAll('[data-delete-row]').forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase('pt-BR').includes(query);});});
