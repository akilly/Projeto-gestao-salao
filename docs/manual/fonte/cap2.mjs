import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const B = 'http://127.0.0.1:5180', OUT = '/tmp/manual/img/', W = 1280, H = 800;
const only = process.argv[2]?.split(',');
const meta = existsSync('/tmp/manual/boxes.json') ? JSON.parse(readFileSync('/tmp/manual/boxes.json', 'utf8')) : {};
const browser = await chromium.launch();
async function ctx({ w = W, h = H, theme = 'light', data = 'example' } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await c.addInitScript(([t, d]) => { localStorage.setItem('hanne-theme', t); localStorage.setItem('hanne-data-view', d); }, [theme, data]);
  const p = await c.newPage(); p._w = w; p._h = h;
  await p.goto(B + '/login'); await p.evaluate(() => fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'teste@hanne.local', password: 'HanneTeste#2026' }) }));
  return p;
}
async function go(p, page, data = 'exemplo') { await p.goto(B + '/?dados=' + data + '#page=' + page); await p.waitForLoadState('networkidle'); await p.waitForTimeout(900); await p.addStyleTag({ content: '*{caret-color:transparent!important;transition:none!important;animation:none!important}' }); }
async function shot(p, name, targets = []) {
  const marks = [];
  for (const [n, loc] of targets) { const l = typeof loc === 'string' ? p.locator(loc).first() : loc.first(); const b = await l.boundingBox().catch(() => null); if (!b) { console.log('  sem caixa', name, n); continue; } marks.push({ n, x: (b.x + b.width / 2) / p._w * 100, y: (b.y + b.height / 2) / p._h * 100, l: b.x / p._w * 100, t: b.y / p._h * 100, w: b.width / p._w * 100, h: b.height / p._h * 100 }); }
  await p.screenshot({ path: OUT + name + '.png' }); meta[name] = { w: p._w, h: p._h, marks };
}
const role = (p, name, r = 'button') => p.getByRole(r, { name });
const S = {
  async login() { const c = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 }); const p = await c.newPage(); p._w = W; p._h = H; await p.goto(B + '/login'); await p.waitForTimeout(900); await shot(p, '00-login', [[1, p.locator('input[type=email]:visible')], [2, p.locator('input[type=password]:visible')], [3, p.getByRole('button', { name: 'Entrar' })]]); },
  async painel() { const p = await ctx(); await go(p, 'dashboard'); await shot(p, '01-visao-geral', [[1, '.sidebar nav'], [2, p.getByText('Buscar...').locator('..')], [3, p.getByText('Escuro', { exact: true }).first()], [4, '.dataset-banner a, .dataset-banner button'], [5, role(p, /Concluir atendimento/)], [6, p.locator('.atelier-welcome').getByText('Agendar', { exact: true })]]);
    await p.evaluate(() => window.scrollTo(0, 440)); await p.waitForTimeout(300); await shot(p, '01b-painel', [[1, p.locator('.attention-card, a, button').filter({ hasText: 'Atendimentos pendentes' }).first()], [2, p.locator('.attention-card, a, button').filter({ hasText: 'Agendamentos a confirmar' }).first()], [3, 'input[type=month]'], [4, p.getByText('Recebido no período').first()]]); },
  async agenda() { const p = await ctx(); await go(p, 'agenda'); await p.evaluate(() => window.scrollTo(0, 420)); await p.waitForTimeout(300); await shot(p, '02-agenda', [[1, p.getByText('sáb', { exact: true }).locator('../..')], [2, role(p, 'Hoje')], [3, role(p, '5 dias')], [4, p.getByText('Beatriz Almeida').first()], [5, role(p, /Concluir/)]]); },
  async agendar() { const p = await ctx(); await go(p, 'agenda'); await role(p, 'Agendar').first().click(); await p.waitForTimeout(700); await shot(p, '03-agendar', [[1, role(p, /Cadastrar nova cliente/)], [2, 'dialog[open] select >> nth=0'], [3, p.locator('dialog[open]').getByLabel(/^Serviço/)], [4, 'dialog[open] input[type=date]'], [5, role(p, /Confirmar agendamento/)]]); },
  async detalhe() { const p = await ctx(); await go(p, 'agenda'); await p.evaluate(() => window.scrollTo(0, 420)); await p.getByText('Beatriz Almeida').first().click(); await p.waitForTimeout(700); await shot(p, '02b-detalhe', [[1, 'dialog[open] select'], [2, role(p, /Confirmar pelo WhatsApp/)], [3, role(p, /Lembrete pelo WhatsApp/)], [4, role(p, /Remarcar/)], [5, p.locator('dialog[open]').getByRole('button', { name: /Concluir atendimento/ })]]);
    await role(p, /Confirmar pelo WhatsApp/).click(); await p.waitForTimeout(700); await shot(p, '12-whatsapp-mensagem', [[1, p.getByText('Contexto da cliente')], [2, 'dialog[open] input[type=tel], dialog[open] input[name=phone]'], [3, role(p, /Copiar texto/)], [4, role(p, /Abrir no WhatsApp/, 'link')]]); },
  async concluir() { const p = await ctx(); await go(p, 'agenda'); await p.evaluate(() => window.scrollTo(0, 420)); await role(p, /Concluir/).first().click(); await p.waitForTimeout(700); await shot(p, '04-concluir', [[1, p.getByText('1 · Atendimento').first()], [2, p.getByText('Serviços realizados nesta visita')], [3, p.getByText(/Preço total combinado/)], [4, role(p, /Continuar/)]]); },
  async clientes() { const p = await ctx(); await go(p, 'clients'); await shot(p, '05-clientes', [[1, p.getByPlaceholder(/Buscar por nome/)], [2, role(p, /Novo cliente/)], [3, p.getByText('Mariana Costa').first()], [4, role(p, /Exportar/)]]);
    await p.getByText('Mariana Costa').first().click(); await p.waitForTimeout(700); await shot(p, '06-cliente', [[1, 'dialog[open] [role=tablist], dialog[open] .tabs'], [2, p.getByText('Informação relatada')], [3, role(p, /^WhatsApp$/)], [4, role(p, /Editar cadastro/)], [5, 'dialog[open] >> role=button[name=/Agendar/]']]); },
  async financeiro() { const p = await ctx(); await go(p, 'finance'); await shot(p, '07-financeiro', [[1, 'input[type=month]'], [2, p.getByText('Recebido no período').first()], [3, role(p, /Novo registro/)], [4, role(p, /Exportar/)]]);
    await p.evaluate(() => window.scrollTo(0, 560)); await p.waitForTimeout(300); await shot(p, '08-graficos', [[1, p.getByText('Entradas e saídas').first()], [2, p.getByText('Recebido por forma de pagamento')], [3, p.getByText('Atendimentos por serviço')], [4, p.getByText('Despesas pagas por categoria')]]);
    await p.evaluate(() => window.scrollTo(0, 1180)); await p.waitForTimeout(300); await shot(p, '08b-receber-lista', [[1, p.getByText('A receber de clientes').first()], [2, role(p, /Receber/)], [3, p.getByText('Repasses do cartão').first()]]);
    await role(p, /Receber/).first().click(); await p.waitForTimeout(700); await shot(p, '09-receber', [[1, 'dialog[open] input[type=number], dialog[open] input[inputmode=decimal]'], [2, 'dialog[open] input[type=date]'], [3, 'dialog[open] select'], [4, role(p, /Confirmar pagamento/)]]); },
  async estoque() { const p = await ctx(); await go(p, 'inventory'); await shot(p, '10-estoque', [[1, role(p, /Registrar compra/)], [2, role(p, /Cadastrar produto/)], [3, p.getByText('Estoque baixo').first()], [4, p.getByText('Movimentações').first()]]); },
  async servicos() { const p = await ctx(); await go(p, 'services'); await shot(p, '13-servicos', [[1, p.getByText('Procedimentos realizados').first()], [2, p.getByText('Catálogo de serviços').first()], [3, role(p, 'Mês inteiro')], [4, role(p, /Concluir atendimento/)]]); },
  async atendimentos() { const p = await ctx(); await go(p, 'conversations'); await shot(p, '11-notas', [[1, role(p, 'Notas internas')], [2, p.getByText('Mariana Costa').first()], [3, role(p, /Resolver/)]]); },
  async excluir() { const p = await ctx(); await go(p, 'clients'); await role(p, 'Excluir registro').first().click(); await p.waitForTimeout(700); await shot(p, '14a-excluir', [[1, 'dialog[open] input[type=search], dialog[open] input[placeholder*=Nome]'], [2, 'dialog[open] >> role=button[name="Excluir"] >> nth=0']]);
    await p.locator('dialog[open]').getByRole('button', { name: 'Excluir', exact: true }).nth(5).click(); await p.waitForTimeout(800); await p.evaluate(() => { const d = document.querySelector('dialog[open]'); d.scrollTop = d.scrollHeight; }); await p.waitForTimeout(300); await shot(p, '14b-excluir-senha', [[1, 'dialog[open] ul'], [2, 'dialog[open] input[type=checkbox]'], [3, 'dialog[open] input[type=password]'], [4, 'dialog[open] >> role=button[name=/Excluir definitivamente/]']]); },
  async config() { const p = await ctx(); await go(p, 'settings'); await shot(p, '15-config', [[1, role(p, /Preparar operação/)], [2, role(p, /Exportar dados/)], [3, role(p, /Cópia completa JSON/)], [4, p.getByText('Aparência', { exact: true }).first()]]);
    const d = await ctx({ theme: 'dark' }); await go(d, 'dashboard'); await shot(d, '16-escuro'); },
  async celular() { for (const [pg, n] of [['dashboard', '17-cel-inicio'], ['agenda', '18-cel-agenda'], ['conversations', '19-cel-conversas']]) { const p = await ctx({ w: 390, h: 844 }); await go(p, pg); await shot(p, n, [[1, '.mobile-bottom-nav']]); await p.context().close(); } },
};
for (const [k, f] of Object.entries(S)) if (!only || only.includes(k)) { try { await f(); console.log('ok', k); } catch (e) { console.log('ERRO', k, e.message.split('\n')[0]); } }
writeFileSync('/tmp/manual/boxes.json', JSON.stringify(meta, null, 1));
await browser.close();
