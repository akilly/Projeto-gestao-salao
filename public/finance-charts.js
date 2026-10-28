/**
 * Gráficos do Financeiro. Dados calculados a partir do mesmo estado e das mesmas regras de `metrics`;
 * desenho em SVG/HTML sem bibliotecas. Somente leitura: nenhum gráfico altera registros.
 * Cores: roxo da marca (série 1) e laranja (série 2), validadas para daltonismo e contraste nos dois temas.
 */
import { metrics, periodOf, cardMethod } from './domain.js';

const CATEGORY = { space: 'Espaço e contas', products: 'Compra de produtos', disposables: 'Descartáveis' };
const round = v => Math.round(v * 100) / 100;

/** Meses (AAAA-MM) terminando em `endMonth`, do mais antigo para o mais recente. */
export function lastMonths(endMonth, n = 6) {
    const [y, m] = endMonth.split('-').map(Number), out = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
    return out;
}
/** Recebido x despesas pagas por mês, com o mesmo cálculo dos indicadores do topo. */
export function monthlyFlow(state, endMonth, n = 6) {
    return lastMonths(endMonth, n).map(month => { const { from, to } = periodOf(month), m = metrics(state, from, to); return { month, received: m.received, expenses: m.expenses, result: m.cashResult }; });
}
/** Dinheiro que entrou no período por forma: Pix/transferência na data do pagamento; cartão quando o repasse líquido foi confirmado. */
export function receivedByMethod(state, from, to) {
    const inside = d => d && d >= from && d <= to, totals = new Map();
    for (const p of state.payments) if (!p.isOpening && !cardMethod(p.method) && inside(p.date)) totals.set(p.method, (totals.get(p.method) || 0) + p.amount);
    for (const i of state.installments) if (i.receivedDate && inside(i.receivedDate)) { const p = state.payments.find(p => p.id === i.paymentId), key = (p?.method || 'Cartão') + ' (repasse)'; totals.set(key, (totals.get(key) || 0) + i.receivedNet); }
    return [...totals].map(([label, value]) => ({ label, value: round(value) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
}
/** Valor dos atendimentos por serviço. Visitas com vários serviços dividem o preço igualmente entre eles. */
export function revenueByService(state, from, to, top = 6) {
    const totals = new Map();
    for (const r of state.records) {
        if (!(r.date >= from && r.date <= to)) continue;
        const ids = r.serviceIds?.length ? r.serviceIds : [r.serviceId];
        for (const id of ids) { const t = totals.get(id) || { value: 0, count: 0 }; t.value += r.total / ids.length; t.count++; totals.set(id, t); }
    }
    const rows = [...totals].map(([id, t]) => ({ label: state.services.find(s => s.id === id)?.name || 'Serviço', value: round(t.value), count: t.count })).sort((a, b) => b.value - a.value);
    if (rows.length <= top) return rows;
    const rest = rows.slice(top - 1);
    return [...rows.slice(0, top - 1), { label: `Outros (${rest.length})`, value: round(rest.reduce((s, x) => s + x.value, 0)), count: rest.reduce((s, x) => s + x.count, 0) }];
}
/** Despesas pagas no período por categoria. */
export function expensesByCategory(state, from, to) {
    const totals = new Map();
    for (const e of state.expenses) if (e.paidDate && e.paidDate >= from && e.paidDate <= to) totals.set(e.category, (totals.get(e.category) || 0) + e.amount);
    return [...totals].map(([k, value]) => ({ label: CATEGORY[k] || k, value: round(value) })).sort((a, b) => b.value - a.value);
}
/** Topo do eixo arredondado (1, 2, 2,5 ou 5 × 10ⁿ) e 4 divisões. */
export function niceMax(v) {
    if (!(v > 0)) return 100;
    const raw = v / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= raw);
    return step * 4;
}

/* ---------- Desenho ---------- */
const compact = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Colunas agrupadas (recebido x despesas) por mês, com eixo único, legenda, dica ao passar o mouse e tabela.
 * Feito em HTML para o texto manter o tamanho em qualquer largura de tela. */
export function flowChart(rows, { esc, money, monthLabel }) {
    if (!rows.some(r => r.received || r.expenses)) return '<p class="muted small chart-empty">Sem recebimentos nem despesas pagas nestes meses.</p>';
    const max = niceMax(Math.max(...rows.flatMap(r => [r.received, r.expenses]))), pct = v => (v / max * 100).toFixed(2) + '%';
    const ticks = [0, 1, 2, 3, 4].map(i => `<span class="flow-tick" style="bottom:${i * 25}%"><b>${compact(max / 4 * i)}</b></span>`).join('');
    const cols = rows.map(r => { const label = monthLabel(r.month), tip = `${label}\nRecebido: ${money(r.received)}\nDespesas pagas: ${money(r.expenses)}\nResultado: ${money(r.result)}`; return `<div class="flow-col" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip.replace(/\n/g, ' · '))}"><div class="flow-bars">${r.received ? `<span class="mark s1" style="height:${pct(r.received)}"></span>` : '<span class="mark-empty"></span>'}${r.expenses ? `<span class="mark s2" style="height:${pct(r.expenses)}"></span>` : '<span class="mark-empty"></span>'}</div><span class="flow-x">${esc(label)}</span></div>`; }).join('');
    const table = `<details class="chart-table"><summary>Ver em tabela</summary><table class="data-table"><thead><tr><th scope="col">Mês</th><th scope="col">Recebido</th><th scope="col">Despesas pagas</th><th scope="col">Resultado</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(monthLabel(r.month))}</td><td>${money(r.received)}</td><td>${money(r.expenses)}</td><td>${money(r.result)}</td></tr>`).join('')}</tbody></table></details>`;
    return `<div class="chart-legend"><span><i class="key s1"></i>Recebido</span><span><i class="key s2"></i>Despesas pagas</span></div><div class="chart-plot flow" role="img" aria-label="Recebido e despesas pagas nos últimos ${rows.length} meses"><div class="flow-area">${ticks}<div class="flow-cols">${cols}</div></div><div class="chart-tip" role="status" hidden></div></div>${table}`;
}
/** Barras horizontais de uma série, com valor na ponta; a tabela repete os números. */
export function barList(rows, { esc, money, detail = () => '', empty = 'Sem registros no período.' }) {
    if (!rows.length) return `<p class="muted small chart-empty">${esc(empty)}</p>`;
    const max = Math.max(...rows.map(r => r.value)), total = rows.reduce((s, r) => s + r.value, 0);
    return `<div class="chart-plot"><ul class="bar-list">${rows.map(r => { const pct = Math.round((r.value / total) * 100), extra = detail(r); return `<li tabindex="0" data-tip="${esc(`${r.label}\n${money(r.value)} · ${pct}% do total${extra ? '\n' + extra : ''}`)}"><span class="bar-label">${esc(r.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(1.5, (r.value / max) * 100).toFixed(1)}%"></span></span><span class="bar-value">${money(r.value)}</span></li>`; }).join('')}</ul><div class="chart-tip" role="status" hidden></div></div><p class="chart-total muted small">Total: ${money(total)}</p>`;
}
/** Dica flutuante compartilhada por todos os gráficos (mouse, toque e teclado). */
export function installChartTips(doc = document) {
    const show = el => { const plot = el.closest('.chart-plot'), tip = plot?.querySelector('.chart-tip'); if (!tip) return; tip.textContent = el.dataset.tip; tip.hidden = false; const pr = plot.getBoundingClientRect(), er = el.getBoundingClientRect(); const x = Math.min(Math.max(8, er.left - pr.left + er.width / 2 - tip.offsetWidth / 2), pr.width - tip.offsetWidth - 8); tip.style.left = x + 'px'; tip.style.top = Math.max(0, er.top - pr.top - tip.offsetHeight - 8) + 'px'; plot.querySelectorAll('.is-active').forEach(x => x.classList.remove('is-active')); el.classList.add('is-active'); };
    const hide = el => { const plot = el?.closest?.('.chart-plot'); if (!plot) return; plot.querySelector('.chart-tip').hidden = true; plot.querySelectorAll('.is-active').forEach(x => x.classList.remove('is-active')); };
    doc.addEventListener('pointerover', e => { const el = e.target.closest?.('.chart-plot [data-tip]'); if (el) show(el); });
    doc.addEventListener('pointerout', e => { const el = e.target.closest?.('.chart-plot [data-tip]'); if (el && !el.contains(e.relatedTarget)) hide(el); });
    doc.addEventListener('focusin', e => { const el = e.target.closest?.('.chart-plot [data-tip]'); if (el) show(el); });
    doc.addEventListener('focusout', e => { const el = e.target.closest?.('.chart-plot [data-tip]'); if (el) hide(el); });
}
