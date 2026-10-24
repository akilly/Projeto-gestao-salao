/** Exclusão explícita de cadastros sem vínculos. Histórico financeiro permanece íntegro. */
export const removableCollections = ['clients', 'services', 'appointments', 'conversations', 'quotes', 'tasks', 'products'];
export function deletionBlock(state, collection, id) {
  if (!removableCollections.includes(collection)) return 'Este registro faz parte do histórico financeiro ou de estoque e não pode ser apagado.';
  const item = state[collection].find(x => x.id === id);
  if (!item) return 'Registro não encontrado.';
  if (collection === 'appointments' && item.status === 'completed') return 'Atendimento concluído. O histórico deve ser preservado.';
  const key = { clients: 'clientId', services: 'serviceId', appointments: 'appointmentId', products: 'productId', quotes: 'quoteId', conversations: 'conversationId', tasks: 'taskId' }[collection];
  // Inspeciona referências também dentro de fichas, itens e listas de procedimentos.
  const linked = value => Array.isArray(value) ? value.some(linked) : value && typeof value === 'object' ? Object.entries(value).some(([k,v]) => (k === key && v === id) || (collection === 'services' && k === 'serviceIds' && Array.isArray(v) && v.includes(id)) || (v && typeof v === 'object' && linked(v))) : false;
  for (const name of [...removableCollections, 'records', 'bills', 'payments', 'installments', 'movements', 'expenses']) {
    if ((state[name] || []).some(x => !(name === collection && x.id === id) && linked(x))) return 'Existe vínculo com outro registro. Preserve o histórico; cancele o agendamento ou resolva a pendência quando aplicável.';
  }
  return '';
}
export function deleteRecord(state, collection, id) {
  const issue = deletionBlock(state, collection, id);
  if (issue) throw Error(issue);
  const next = structuredClone(state);
  next[collection] = next[collection].filter(x => x.id !== id);
  return next;
}

/** Plano explícito de exclusão em cascata; o servidor reproduz antes de gravar. */
export const allCollections = [...removableCollections, 'records','bills','payments','installments','movements','expenses','audit'];
export function deletionPlan(state, collection, id) {
  if(collection==='operation'&&id==='all'){
    const next=structuredClone(state),entries=allCollections.flatMap(k=>state[k].map(x=>({collection:k,id:x.id,label:x.name||x.title||x.action||x.date||x.id})));
    for(const k of allCollections)next[k]=[];next.focus=false;
    next.settings={name:'Hanne',open:'09:00',close:'19:00',closedDays:[0],responseMinutes:60,notifications:true,cutoff:'',spaceAmount:null,spaceDueDay:10};
    entries.push({collection:'settings',id:'settings',label:'Configurações e data de início'});
    return {next,entries};
  }
  if (!allCollections.includes(collection) || !state[collection]?.some(x=>x.id===id)) throw Error('Registro não encontrado.');
  const removed = new Map(allCollections.map(k=>[k,new Set()]));
  removed.get(collection).add(id);
  const refs = {clientId:'clients',serviceId:'services',appointmentId:'appointments',recordId:'records',billId:'bills',paymentId:'payments',productId:'products',expenseId:'expenses',quoteId:'quotes',conversationId:'conversations',taskId:'tasks'};
  const linked = value => Array.isArray(value) ? value.some(linked) : value && typeof value==='object' ? Object.entries(value).some(([k,v])=>refs[k]&&removed.get(refs[k]).has(v) || k==='serviceIds'&&Array.isArray(v)&&v.some(id=>removed.get('services').has(id)) || typeof v==='object'&&linked(v)) : false;
  let changed=true;
  while(changed){
    changed=false;
    const add=(k,id)=>{if(id&&state[k].some(x=>x.id===id)&&!removed.get(k).has(id)){removed.get(k).add(id);changed=true;}};
    for(const k of allCollections) for(const x of state[k]) if(linked(x)) add(k,x.id);
    // Ficha e cobrança formam uma operação; uma parcela é parte do pagamento integral.
    for(const r of state.records) if(removed.get('records').has(r.id)){add('bills',r.billId);add('appointments',r.appointmentId);}
    for(const i of state.installments) if(removed.get('installments').has(i.id)) add('payments',i.paymentId);
    for(const m of state.movements) if(removed.get('movements').has(m.id)){
      if(m.recordId) add('records',m.recordId);
      if(m.expenseId) add('expenses',m.expenseId);
      // Retirar uma entrada altera todo o custo posterior: inclui os movimentos seguintes.
      if(m.quantity>0||m.type==='valuation') for(const later of state.movements.slice(state.movements.indexOf(m)+1)) if(later.productId===m.productId) add('movements',later.id);
    }
  }
  const next=structuredClone(state), entries=[];
  for(const k of allCollections){next[k]=state[k].filter(x=>!removed.get(k).has(x.id));for(const x of state[k])if(removed.get(k).has(x.id))entries.push({collection:k,id:x.id,label:x.name||x.title||x.description||x.action||x.date||x.id});}
  // Recalcula custo médio das saídas que permaneceram após devolver consumo ao estoque.
  const stocks=new Map();
  for(const m of next.movements){const old=stocks.get(m.productId)||{q:0,c:null};if(['loss','consumption'].includes(m.type))m.unitCost=old.c;
    let c=old.c;if(m.type==='valuation')c=m.unitCost;else if(m.quantity>0)c=old.q===0?m.unitCost:old.c===null||m.unitCost===null?null:(old.q*old.c+m.quantity*m.unitCost)/(old.q+m.quantity);
    const q=Math.round((old.q+m.quantity)*1000000)/1000000;if(q<0)throw Error('A exclusão deixaria estoque negativo.');stocks.set(m.productId,{q,c:q===0&&m.type!=='valuation'?null:c});}
  // Impede que a despesa automática excluída reapareça no próximo acesso.
  const skipped=state.expenses.filter(e=>removed.get('expenses').has(e.id)&&e.recurringMonth).map(e=>e.recurringMonth);
  if(skipped.length)next.settings.skippedSpaceMonths=[...new Set([...(state.settings.skippedSpaceMonths||[]),...skipped])];
  return {next,entries};
}
