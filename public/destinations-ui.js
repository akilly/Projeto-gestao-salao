/**
 * Fábrica dos detalhes de consulta. Recebe o contexto do aplicativo para reutilizar
 * os mesmos dados, formatadores, diálogos e links; não executa nenhuma alteração.
 */
export function detailViews(ctx) {
    const { state: getState, esc, money, fmt, link, modal, btn, client, service, billBalance, billPaid, stockNumber } = ctx;
    const missing = () => modal('Registro não encontrado', '<div class="dialog-body"><p>Este registro não está disponível na base atual. Volte à lista e confira os dados selecionados.</p></div>', btn('Fechar', 'close-modal'));
    const clientLink = id => link(esc(client(id).name), { page: 'clients', client: id }, 'name-link');
    const recordForBill = id => getState().records.find(r => r.billId === id);
    const relations = (record, bill) => `<div class="related-links">${record ? link('Ver ficha do atendimento', { page: 'services', record: record.id }, 'btn secondary') : ''}${record?.appointmentId ? link('Ver agendamento', { page: 'agenda', appointment: record.appointmentId }, 'btn secondary') : ''}${bill ? link('Ver cobrança e pagamentos', { page: 'finance', bill: bill.id }, 'btn secondary') : ''}</div>`;

    /** Ficha de consulta com preço do conjunto, consumo confirmado e vínculos do fechamento. */
    function record(id) {
        const s = getState(), r = s.records.find(r => r.id === id);
        if (!r) return missing();
        const bill = s.bills.find(b => b.id === r.billId), moves = s.movements.filter(m => m.recordId === id && m.type === 'consumption');
        modal('Atendimento realizado', `<div class="dialog-body"><div class="detail-identity">${clientLink(r.clientId)}<span>${fmt(r.date, { day: '2-digit', month: 'long', year: 'numeric' })}</span></div><h3>${esc(r.serviceIds.map(id => service(id).name).join(' + '))}</h3><dl class="record-facts"><div><dt>Total combinado</dt><dd>${money(r.total)}</dd></div><div><dt>Quitado pela cliente</dt><dd>${bill ? money(billPaid(s, bill.id)) : 'A conferir'}</dd></div><div><dt>Saldo da cliente</dt><dd>${bill ? money(billBalance(s, bill)) : 'A conferir'}</dd></div></dl>${relations(null, bill)}${r.appointmentId ? link('Ver agendamento desta visita', { page: 'agenda', appointment: r.appointmentId }, 'btn secondary') : '<p class="muted small">Registrado sem agendamento vinculado.</p>'}<section class="detail-section"><h3>Produtos utilizados</h3>${moves.map(m => { const p = s.products.find(p => p.id === m.productId); return `<div class="detail-line">${link(esc(p?.name || 'Produto'), { page: 'inventory', product: m.productId }, 'name-link')}<strong>${stockNumber(-m.quantity)} ${esc(p?.unit)}</strong></div>`; }).join('') || '<p class="muted small">Sem consumo de produtos, confirmado no fechamento.</p>'}</section>${[['Fórmula e cor', r.formula], ['Observações técnicas', r.notes], ['Manutenção recomendada', r.followup ? fmt(r.followup) : '']].filter(([, v]) => v).map(([label, value]) => `<section class="detail-section"><h3>${label}</h3><p class="detail-copy">${esc(value)}</p></section>`).join('')}<p class="notice">O preço pertence ao conjunto. Pagamentos e repasses têm registros próprios no Financeiro.</p></div>`, btn('Pós-atendimento pelo WhatsApp', 'wa-followup', 'chat', 'secondary', `data-id="${esc(id)}"`) + btn('Editar ficha técnica', 'edit-record', 'edit', 'secondary', `data-id="${esc(id)}"`) + btn('Fechar', 'close-modal'));
    }

    /** Cobrança: pagamentos aceitos quitam a cliente; cartão ainda depende de repasse. */
    function bill(id) {
        const s = getState(), b = s.bills.find(b => b.id === id);
        if (!b) return missing();
        const r = recordForBill(id), payments = s.payments.filter(p => p.billId === id);
        modal('Cobrança e pagamentos', `<div class="dialog-body"><div class="detail-identity">${clientLink(b.clientId)}<span>${esc(b.description)}</span></div><dl class="record-facts"><div><dt>Total</dt><dd>${money(b.total)}</dd></div><div><dt>Quitado pela cliente</dt><dd>${money(billPaid(s, id))}</dd></div><div><dt>Saldo da cliente</dt><dd>${money(billBalance(s, b))}</dd></div></dl>${relations(r, null)}<section class="detail-section"><h3>Pagamentos vinculados</h3>${payments.map(p => link(`<span>${esc(p.kind)} · ${esc(p.method)}<small>${fmt(p.date)}</small></span><strong>${money(p.amount)}</strong>`, { page: 'finance', payment: p.id }, 'detail-list-link')).join('') || '<p class="muted small">Nenhum pagamento registrado para esta cobrança.</p>'}</section><p class="notice">Cartão quita a parte da cliente; o dinheiro só entra no caixa quando o repasse líquido é confirmado.</p></div>`, (billBalance(s, b) > 0 ? btn('Cobrar pelo WhatsApp', 'wa-bill', 'chat', 'secondary', `data-id="${esc(id)}"`) + btn('Registrar pagamento', 'new-payment', 'plus', 'primary', `data-id="${esc(id)}"`) : '') + btn('Fechar', 'close-modal'));
    }

    /** Recebimento ou sinal, com acesso às parcelas e ao atendimento de origem. */
    function payment(id) {
        const s = getState(), p = s.payments.find(p => p.id === id);
        if (!p) return missing();
        const b = s.bills.find(b => b.id === p.billId), r = b && recordForBill(b.id), parts = s.installments.filter(i => i.paymentId === id);
        modal('Detalhes do pagamento', `<div class="dialog-body"><div class="detail-identity">${clientLink(p.clientId)}<span>${fmt(p.date)} · ${esc(p.kind)}</span></div><dl class="record-facts"><div><dt>Valor</dt><dd>${money(p.amount)}</dd></div><div><dt>Forma</dt><dd>${esc(p.method)}</dd></div><div><dt>Situação</dt><dd>${p.kind === 'Sinal' ? esc({ available: 'Sinal disponível', applied: 'Sinal aplicado', retained: 'Sinal retido' }[p.depositStatus] || 'Registrado') : 'Pagamento registrado'}</dd></div></dl>${relations(r, b)}${!r && p.appointmentId ? link('Ver agendamento do sinal', { page: 'agenda', appointment: p.appointmentId }, 'btn secondary') : ''}${parts.length ? `<section class="detail-section"><h3>Repasses do cartão</h3>${parts.map(i => link(`<span>Parcela ${i.number}/${i.count}<small>${i.receivedDate ? 'Recebido em ' + fmt(i.receivedDate) : 'Previsto para ' + fmt(i.due)}</small></span><strong>${money(i.receivedDate ? i.receivedNet : i.gross)}</strong>`, { page: 'finance', installment: i.id }, 'detail-list-link')).join('')}</section>` : ''}${p.isOpening ? '<p class="notice">Saldo anterior ao início da operação; não cria um recebimento novo no período.</p>' : ''}</div>`, btn('Fechar', 'close-modal'));
    }

    /** Parcela de cartão: valores previstos e confirmados têm rótulos distintos. */
    function installment(id) {
        const s = getState(), i = s.installments.find(i => i.id === id), p = i && s.payments.find(p => p.id === i.paymentId);
        if (!i || !p) return missing();
        modal('Repasse do cartão', `<div class="dialog-body"><div class="detail-identity">${clientLink(p.clientId)}<span>Parcela ${i.number}/${i.count} · ${esc(p.method)}</span></div><dl class="record-facts"><div><dt>Valor bruto</dt><dd>${money(i.gross)}</dd></div><div><dt>Taxa</dt><dd>${i.fee === null ? 'A conferir' : money(i.fee)}</dd></div><div><dt>${i.receivedDate ? 'Líquido recebido' : 'Líquido previsto'}</dt><dd>${i.receivedDate ? money(i.receivedNet) : i.fee === null ? 'A conferir' : money(i.gross - i.fee)}</dd></div></dl><p class="notice">${i.receivedDate ? 'Recebido em ' + fmt(i.receivedDate) : 'Repasse ainda não confirmado. Previsão: ' + fmt(i.due)}</p>${link('Ver pagamento de origem', { page: 'finance', payment: p.id }, 'btn secondary')}</div>`, (!i.receivedDate ? btn('Conferir repasse', 'v2-settle', 'check', 'primary', `data-id="${esc(id)}"`) : '') + btn('Fechar', 'close-modal'));
    }

    /** Consulta uma despesa sem registrar a saída; o pagamento exige o formulário existente. */
    function expense(id) {
        const e = getState().expenses.find(e => e.id === id);
        if (!e) return missing();
        modal('Detalhes da despesa', `<div class="dialog-body"><h3>${esc(e.description)}</h3><dl class="record-facts"><div><dt>Valor</dt><dd>${money(e.amount)}</dd></div><div><dt>Vencimento</dt><dd>${fmt(e.due)}</dd></div><div><dt>Situação</dt><dd>${e.paidDate ? 'Pago em ' + fmt(e.paidDate) : 'Em aberto'}</dd></div></dl><p class="notice">${e.paidDate ? 'O pagamento já faz parte das despesas pagas na data informada.' : 'Consultar esta conta não registra pagamento. Confirme somente depois de pagar.'}</p></div>`, (!e.paidDate ? btn('Confirmar pagamento', 'v2-expense-pay', 'check', 'primary', `data-id="${esc(id)}"`) : '') + btn('Fechar', 'close-modal'));
    }
    return { record, bill, payment, installment, expense, missing };
}
