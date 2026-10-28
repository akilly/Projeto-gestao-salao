/** Testes da API com SQLite real em memória e adaptador D1. Verificam autenticação, isolamento, revisão e atomicidade. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleStateRequest } from '../lib/state-handler.mjs';
import { ensureSpaceExpense } from '../public/routine.js';
import { localDate } from '../public/core.js';
import { blankState, retainDeposit, metrics } from '../public/domain.js';
import { derive } from '../lib/salon-auth.mjs';
const PASSWORD = 'senha-da-titular-123';
async function owner(db) { db.sqlite.prepare('INSERT INTO salon_credentials (id,owner_id,email,salt,password_hash) VALUES (1,?,?,?,?)').run('o', 'hanne@teste.com', 'sal', await derive(PASSWORD, 'sal')); }
function database() { const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../drizzle/0000_big_elektra.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', '')); sqlite.exec(readFileSync(new URL('../drizzle/0003_salon_login.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', '')); return { sqlite, prepare(sql) { return { async first() { return sqlite.prepare(sql).get(); }, bind(...args) { return { async first() { return sqlite.prepare(sql).get(...args); }, async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; }, sql, args }; } }; }, async batch(statements) { sqlite.exec('BEGIN IMMEDIATE'); try {
        const out = statements.map(s => ({ meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } }));
        sqlite.exec('COMMIT');
        return out;
    }
    catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
    } } }; }
const request = (method, user, body, origin = 'https://hanne.test') => new Request('https://hanne.test/api/state', { method, headers: { ...(user ? { 'oai-authenticated-user-id': user } : {}), 'Content-Type': 'application/json', Origin: origin }, ...(body ? { body: JSON.stringify(body) } : {}) });
test('API rejeita ausência de identidade e origem externa', async () => { const db = database(); assert.equal((await handleStateRequest(request('GET'), db)).status, 401); assert.equal((await handleStateRequest(request('POST', 'a', { revision: 0, state: blankState() }, 'https://other.test'), db)).status, 403); assert.equal(db.sqlite.prepare('SELECT count(*) n FROM atelier_accounts').get().n, 0); });
test('gravação é persistente, isolada por conta e auditada', async () => { const db = database(), s = blankState(); s.settings.name = 'Ateliê A'; const save = await handleStateRequest(request('POST', 'a', { revision: 0, state: s, action: 'Nome atualizado' }), db); assert.equal(save.status, 200); assert.equal((await save.json()).revision, 1); const a = await (await handleStateRequest(request('GET', 'a'), db)).json(), b = await (await handleStateRequest(request('GET', 'b'), db)).json(); assert.equal(a.state.settings.name, 'Ateliê A'); assert.equal(b.state.settings.name, 'Hanne'); assert.equal(b.revision, 0); assert.equal(db.sqlite.prepare('SELECT count(*) n FROM atelier_events').get().n, 1); });
test('duas gravações da mesma versão geram conflito sem sobrescrever', async () => { const db = database(), s = blankState(); s.settings.name = 'Primeiro'; const second = structuredClone(s); second.settings.name = 'Segundo'; const rs = await Promise.all([handleStateRequest(request('POST', 'a', { revision: 0, state: s }), db), handleStateRequest(request('POST', 'a', { revision: 0, state: second }), db)]); assert.deepEqual(rs.map(r => r.status).sort(), [200, 409]); assert.equal(db.sqlite.prepare('SELECT revision FROM atelier_accounts').get().revision, 1); assert.equal(db.sqlite.prepare('SELECT count(*) n FROM atelier_events').get().n, 1); });
test('validação do servidor rejeita saldo negativo sem gravar', async () => { const db = database(), s = blankState(); s.settings.cutoff = '2026-10-19'; s.products.push({ id: 'p', name: 'Produto', unit: 'g', packageSize: 100, minimum: 0 }); s.movements.push({ id: 'm', productId: 'p', date: '2026-10-19', type: 'loss', quantity: -1, unitCost: 1 }); assert.equal((await handleStateRequest(request('POST', 'a', { revision: 0, state: s }), db)).status, 422); assert.equal(db.sqlite.prepare('SELECT count(*) n FROM atelier_accounts').get().n, 0); });
test('demonstração é separada da base real nas leituras e gravações', async () => { const db = database(), real = blankState(); real.settings.name = 'Titular Real'; assert.equal((await handleStateRequest(request('POST', 'a', { revision: 0, state: real }), db)).status, 200); const sampleReq = (method, body) => new Request('https://hanne.test/api/state?dataset=example', { method, headers: { 'oai-authenticated-user-id': 'a', 'Content-Type': 'application/json', Origin: 'https://hanne.test' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const demo = await (await handleStateRequest(sampleReq('GET'), db)).json(); assert.equal(demo.dataset, 'example'); assert.equal(demo.state.records.length, 12); demo.state.focus = true; assert.equal((await handleStateRequest(sampleReq('POST', { revision: 0, state: demo.state, action: 'Teste na demonstração' }), db)).status, 200); const persisted = await (await handleStateRequest(sampleReq('GET'), db)).json(); assert.equal(persisted.state.focus, true); const untouched = await (await handleStateRequest(request('GET', 'a'), db)).json(); assert.equal(untouched.state.settings.name, 'Titular Real'); assert.equal(untouched.state.records.length, 0); assert.equal(untouched.revision, 1); assert.equal((await handleStateRequest(request('POST', 'a', { revision: 1, state: demo.state }), db)).status, 422); const after = await (await handleStateRequest(request('GET', 'a'), db)).json(); assert.equal(after.state.clients.length, 0); assert.equal(after.revision, 1); });
test('cancelamento e retenção persistem juntos na base de exemplos', async () => { const db = database(), call = (method, body) => new Request('https://hanne.test/api/state?dataset=example', { method, headers: { 'oai-authenticated-user-id': 'retention-owner', 'Content-Type': 'application/json', Origin: 'https://hanne.test' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const initial = await (await handleStateRequest(call('GET'), db)).json(), before = metrics(initial.state, '0000-01-01', '9999-12-31').received, next = retainDeposit(initial.state, { id: 'ex-future-signal', reason: 'Cancelamento informado pela cliente', confirmed: true, cancelAppointment: true }); const save = await handleStateRequest(call('POST', { revision: 0, state: next, action: 'Cancelamento e retenção confirmados' }), db); assert.equal(save.status, 200); const saved = await (await handleStateRequest(call('GET'), db)).json(); assert.equal(saved.state.appointments.find(a => a.id === 'ex-future-appointment').status, 'cancelled'); assert.equal(saved.state.payments.find(p => p.id === 'ex-future-signal').depositStatus, 'retained'); assert.equal(metrics(saved.state, '0000-01-01', '9999-12-31').received, before); assert.equal(saved.state.audit[0].action, 'Cancelamento e retenção confirmados'); });


test('conta automática é persistida em aberto e revisões concorrentes não duplicam o mês', async () => {
    const db = database(), initial = blankState();
    initial.settings.cutoff = localDate(); initial.settings.spaceAmount = 900;
    const setup = await handleStateRequest(request('POST', 'space-owner', { revision: 0, state: initial }), db);
    assert.equal(setup.status, 200);
    const loaded = await (await handleStateRequest(request('GET', 'space-owner'), db)).json();
    const left = ensureSpaceExpense(loaded.state), right = ensureSpaceExpense(loaded.state);
    const save = await handleStateRequest(request('POST', 'space-owner', { revision: loaded.revision, state: left.state, action: 'Conta mensal automática' }), db);
    assert.equal(save.status, 200);
    const stale = await handleStateRequest(request('POST', 'space-owner', { revision: loaded.revision, state: right.state }), db);
    assert.equal(stale.status, 409);
    const final = await (await handleStateRequest(request('GET', 'space-owner'), db)).json();
    assert.equal(final.state.expenses.length, 1);
    assert.equal(final.state.expenses[0].paidDate, null);
    assert.equal(ensureSpaceExpense(final.state).expense, null);
    assert.equal(metrics(final.state, '0000-01-01', '9999-12-31').cashResult, 0);
    assert.equal((await (await handleStateRequest(request('GET', 'another-owner'), db)).json()).state.expenses.length, 0);
});

test('exclusão pelo servidor exige plano confirmado, rejeita versão antiga e preserva outra base',async()=>{const {deletionPlan}=await import('../public/deletion.js');const db=database(),url='https://hanne.test/api/state?dataset=example';await owner(db);const call=(method,body)=>new Request(url,{method,headers:{'oai-authenticated-user-id':'erase-owner',Origin:'https://hanne.test','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const initial=await (await handleStateRequest(call('GET'),db)).json();const record=initial.state.records[0],plan=deletionPlan(initial.state,'records',record.id);const input={revision:0,collection:'records',id:record.id,confirmed:true,password:PASSWORD,plan:JSON.stringify(plan.entries)};assert.equal((await handleStateRequest(call('DELETE',{...input,confirmed:false}),db)).status,422);assert.equal((await handleStateRequest(call('DELETE',{...input,plan:'tampered'}),db)).status,409);const result=await handleStateRequest(call('DELETE',input),db);assert.equal(result.status,200);const saved=await result.json();assert.equal(saved.state.records.length,11);assert.equal(saved.revision,1);assert.equal((await handleStateRequest(call('DELETE',input),db)).status,409);const real=await (await handleStateRequest(request('GET','erase-owner'),db)).json();assert.equal(real.state.records.length,0);});
test('entrada visível da auditoria pode ser excluída deixando comprovante técnico',async()=>{const {deletionPlan}=await import('../public/deletion.js');const db=database(),s=blankState();await owner(db);s.settings.name='Nome alterado';await handleStateRequest(request('POST','owner',{revision:0,state:s}),db);const current=await (await handleStateRequest(request('GET','owner'),db)).json(),id=current.state.audit[0].id,plan=deletionPlan(current.state,'audit',id);const result=await handleStateRequest(request('DELETE','owner',{revision:1,collection:'audit',id,confirmed:true,password:PASSWORD,plan:JSON.stringify(plan.entries)}),db);assert.equal(result.status,200);const saved=await result.json();assert.equal(saved.revision,2);assert.ok(saved.state.audit.every(x=>x.id!==id));assert.match(saved.state.audit[0].action,/Exclusão confirmada/);});

test('exclusão exige a senha da conta, conferida no servidor e com limite de tentativas', async () => {
    const { deletionPlan } = await import('../public/deletion.js');
    const db = database(); await owner(db);
    const call = body => new Request('https://hanne.test/api/state?dataset=example', { method: body ? 'DELETE' : 'GET', headers: { 'oai-authenticated-user-id': 'pw-owner', Origin: 'https://hanne.test', 'Content-Type': 'application/json', 'cf-connecting-ip': '10.0.0.9' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const initial = await (await handleStateRequest(call(), db)).json();
    const task = initial.state.tasks[0], plan = deletionPlan(initial.state, 'tasks', task.id);
    const input = { revision: 0, collection: 'tasks', id: task.id, confirmed: true, plan: JSON.stringify(plan.entries) };
    const missing = await handleStateRequest(call(input), db);
    assert.equal(missing.status, 403); assert.match((await missing.json()).error, /senha/i);
    const wrong = await handleStateRequest(call({ ...input, password: 'errada-errada-123' }), db);
    assert.equal(wrong.status, 403); assert.match((await wrong.json()).error, /Senha incorreta/);
    assert.equal((await (await handleStateRequest(call(), db)).json()).state.tasks.length, initial.state.tasks.length);
    const ok = await handleStateRequest(call({ ...input, password: PASSWORD }), db);
    assert.equal(ok.status, 200);
    assert.ok((await ok.json()).state.tasks.every(t => t.id !== task.id));
    for (let i = 0; i < 11; i++) await handleStateRequest(call({ ...input, revision: 1, password: 'errada-errada-123' }), db);
    assert.equal((await handleStateRequest(call({ ...input, revision: 1, password: PASSWORD }), db)).status, 429);
});
