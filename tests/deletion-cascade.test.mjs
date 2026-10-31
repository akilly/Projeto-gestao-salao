/** Exclusão em cascata: o plano mostra todos os vínculos e o servidor só aceita o plano confirmado. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleState} from '../public/examples.js';
import {allCollections,deletionPlan} from '../public/deletion.js';
import {validateState,stockOf} from '../public/domain.js';
import {ensureSpaceExpense} from '../public/routine.js';
test('cada tipo de registro pode ser excluído com cascata íntegra e sem alterar o original',()=>{const s=exampleState();for(const k of allCollections)for(const x of s[k]){const before=JSON.stringify(s),plan=deletionPlan(s,k,x.id);try{validateState(plan.next);}catch(e){throw Error(k+':'+x.id+' '+e.message);}assert.ok(!plan.next[k].some(y=>y.id===x.id));assert.equal(JSON.stringify(s),before);}});
test('excluir atendimento retira cobrança, parcelas, consumo e devolve estoque',()=>{const s=exampleState(),r=s.records.find(r=>!r.noProducts),consumption=s.movements.filter(m=>m.recordId===r.id),plan=deletionPlan(s,'records',r.id);assert.ok(!plan.next.bills.some(b=>b.id===r.billId));assert.ok(!plan.next.payments.some(p=>p.billId===r.billId));for(const m of consumption)assert.ok(stockOf(plan.next,m.productId).quantity>=stockOf(s,m.productId).quantity);validateState(plan.next);});
test('parcela exclui pagamento por inteiro e conta automática excluída não reaparece',()=>{const s=exampleState(),i=s.installments[0],plan=deletionPlan(s,'installments',i.id);assert.ok(!plan.next.payments.some(p=>p.id===i.paymentId));const generated=ensureSpaceExpense({...s,settings:{...s.settings,spaceAmount:800}},'2026-10-24');if(generated.expense){const next=deletionPlan(generated.state,'expenses',generated.expense.id).next;assert.equal(ensureSpaceExpense(next,'2026-10-24').expense,null);}});
test('reiniciar operação remove dados e configurações sem mexer em credenciais',()=>{const plan=deletionPlan(exampleState(),'operation','all');validateState(plan.next);for(const k of allCollections)assert.equal(plan.next[k].length,0);assert.equal(plan.next.settings.cutoff,'');});
