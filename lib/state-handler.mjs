/**
 * Fronteira HTTP e persistência do estado. Identidade é fornecida pela hospedagem autenticada. Escrita exige mesma origem, JSON, revisão válida e validação do domínio. O batch D1 mantém estado e evento atômicos.
 * Referências: docs/DOCUMENTACAO_TECNICA.md e docs/REFERENCIA_FUNCOES.md.
 */
import { deletionPlan } from '../public/deletion.js';
import { exampleState } from '../public/examples.js';
import { blankState, validateState } from '../public/domain.js';
/**
 * response — Produz resposta JSON privada sem cache e com proteção contra interpretação incorreta de MIME.
 */
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
/**
 * handleStateRequest — Atende leitura e gravação do agregado em D1: autentica, separa bases, valida e grava por revisão otimista junto com auditoria. Não confia no estado enviado pelo navegador.
 */
export async function handleStateRequest(request, db) {
    // A identidade vem do proxy autenticado do Sites; nunca de um campo do formulário.
    const identity = request.headers.get('oai-authenticated-user-id');
    if (!identity)
        return response({ error: 'Entre na sua conta para acessar os registros.' }, 401);
    if (!db)
        return response({ error: 'A base de dados ainda não está disponível.' }, 503);
    const selection = new URL(request.url).searchParams.get('dataset');
    if (selection && selection !== 'example')
        return response({ error: 'Base desconhecida.' }, 400);
    const isExample = selection === 'example', dataset = isExample ? 'example' : 'real', user = isExample ? identity + '::examples-v1' : identity, initial = () => isExample ? exampleState() : blankState();
    try {
        if (request.method === 'GET') {
            const row = await db.prepare('SELECT revision, payload, updated_at FROM atelier_accounts WHERE user_id = ?').bind(user).first();
            return response({ state: row ? JSON.parse(row.payload) : initial(), revision: row?.revision || 0, updatedAt: row?.updated_at || null, dataset });
        }
        if (!['POST','DELETE'].includes(request.method))
            return response({ error: 'Método não permitido.' }, 405);
        if (request.headers.get('origin') !== new URL(request.url).origin)
            return response({ error: 'Origem não autorizada.' }, 403);
        if (!request.headers.get('content-type')?.startsWith('application/json'))
            return response({ error: 'Formato não permitido.' }, 415);
        const raw = await request.text();
        if (raw.length > 3000000)
            return response({ error: 'Limite de dados atingido. Exporte uma cópia e revise os anexos.' }, 413);
        let input;
        try {
            input = JSON.parse(raw);
        }
        catch {
            return response({ error: 'JSON inválido.' }, 400);
        }
        if (!Number.isInteger(input.revision) || input.revision < 0)
            return response({ error: 'Versão inválida.' }, 400);
        const row = await db.prepare('SELECT revision, payload FROM atelier_accounts WHERE user_id = ?').bind(user).first();
        if ((row?.revision || 0) !== input.revision)
            return response({ error: 'Os registros mudaram em outro dispositivo. Recarregue a versão atual antes de continuar.' }, 409);
        const previous = row ? JSON.parse(row.payload) : initial();
        if (request.method==='POST' && !isExample && input.state?.datasetKind === 'example')
            return response({ error: 'Dados fictícios não podem ser gravados na base real.' }, 422);
        if (request.method==='POST' && isExample && input.state?.datasetKind !== 'example')
            return response({ error: 'Mantenha a identificação dos dados fictícios.' }, 422);
        if(request.method==='DELETE') {
            if(input.confirmed!==true)return response({error:'Confirme a exclusão.'},422);
            try {
                const plan=deletionPlan(previous,input.collection,input.id);
                const fingerprint=JSON.stringify(plan.entries);
                if(input.plan!==fingerprint)return response({error:'Os vínculos mudaram. Confira a confirmação novamente.'},409);
                // Somente o plano calculado pelo servidor pode remover histórico; o snapshot do cliente é ignorado.
                validateState(plan.next);
                input.state=plan.next;
                input.action='Exclusão confirmada: '+plan.entries.length+' registro(s)';
            } catch(e) {return response({error:e.message},422);}
        }
        try {
            validateState(input.state, request.method==='DELETE'?null:previous);
        }
        catch (e) {
            return response({ error: e.message }, 422);
        }
        const changed = Object.keys(previous).filter(k => (k !== 'audit' || request.method==='DELETE') && JSON.stringify(previous[k]) !== JSON.stringify(input.state[k]));
        if (!changed.length)
            return response({ revision: input.revision, updatedAt: null });
        const now = new Date().toISOString(), revision = input.revision + 1, eventId = crypto.randomUUID(), action = typeof input.action === 'string' ? input.action.slice(0, 200) : 'Registros atualizados';
        const event = { id: eventId, at: now, action, before: `Versão ${input.revision}`, after: changed.join(', '), by: 'Titular autenticada' };
        const payload = { ...input.state, audit: [event, ...((request.method==='DELETE'?input.state.audit:previous.audit) || [])].slice(0, 200) };
        // Compare-and-swap: somente a revisão que foi lida pode ser substituída.
        const write = row ? db.prepare('UPDATE atelier_accounts SET payload = ?, revision = ?, updated_at = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(payload), revision, now, user, input.revision) : db.prepare('INSERT OR IGNORE INTO atelier_accounts (payload, revision, updated_at, user_id) VALUES (?, ?, ?, ?)').bind(JSON.stringify(payload), revision, now, user);
        // changes() condiciona o evento ao sucesso da escrita anterior no mesmo batch transacional.
        const audit = db.prepare('INSERT INTO atelier_events (id,user_id,revision,action,changes,created_at) SELECT ?,?,?,?,?,? WHERE changes() = 1').bind(eventId, user, revision, action, JSON.stringify(changed), now);
        const result = await db.batch([write, audit]);
        if (result[0].meta.changes !== 1)
            return response({ error: 'Outro dispositivo salvou primeiro. Recarregue para conferir as alterações.' }, 409);
        return response({ revision, updatedAt: now, audit: payload.audit, ...(request.method==='DELETE'?{state:payload}:{}) });
    }
    catch {
        return response({ error: 'Não foi possível acessar os registros. Tente novamente.' }, 503);
    }
}
