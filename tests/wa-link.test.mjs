/** Link manual do WhatsApp: telefone normalizado, texto codificado e modelos sem dados faltando. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { waPhone, waURL, waMessages, whenText, firstName } from '../public/wa-link.js';

test('telefone brasileiro ganha o DDI 55', () => {
    assert.equal(waPhone('(11) 98765-4321'), '5511987654321');
    assert.equal(waPhone('11 3456-7890'), '551134567890');
    assert.equal(waPhone('+55 (21) 99999-0001'), '5521999990001');
    assert.equal(waPhone('011 98765-4321'), '5511987654321');
    assert.equal(waPhone('0055 11 98765 4321'), '5511987654321');
});

test('telefone incompleto não gera link', () => {
    assert.equal(waPhone('98765-4321'), '');
    assert.equal(waPhone(''), '');
    assert.equal(waURL('123', 'oi'), '');
});

test('o texto vai codificado, com acentos e quebras de linha', () => {
    assert.equal(waURL('(11) 98765-4321', 'Olá, Ana!\nAté amanhã & obrigada'), 'https://wa.me/5511987654321?text=Ol%C3%A1%2C%20Ana!%0AAt%C3%A9%20amanh%C3%A3%20%26%20obrigada');
});

test('modelos usam o primeiro nome e todos os dados informados', () => {
    assert.equal(firstName('  Mariana Costa Lima '), 'Mariana');
    const confirm = waMessages.confirm({ name: 'Mariana Costa', salon: 'Hanne', service: 'Coloração', date: 'sexta-feira, 30 de outubro', time: '14:00' });
    assert.match(confirm, /^Oi, Mariana!/);
    assert.match(confirm, /Coloração.*sexta-feira, 30 de outubro, às 14:00/);
    const charge = waMessages.charge({ name: 'Ana', balance: 'R$ 120,00', description: 'Corte', date: '20/10/2026', due: '25/10/2026' });
    assert.match(charge, /R\$ 120,00, referente a Corte \(20\/10\/2026\), com vencimento em 25\/10\/2026/);
    const quote = waMessages.quote({ name: 'Ana', service: 'Mechas', questions: '  Já fez química?  ' });
    assert.ok(quote.endsWith(':\n\nJá fez química?'));
    for (const text of [confirm, charge, quote, waMessages.reminder({ name: 'Ana', service: 'Corte', when: 'amanhã', time: '10:00' }), waMessages.followup({ name: 'Ana' })])
        assert.doesNotMatch(text, /undefined|null/);
});

test('lembrete diz hoje, amanhã ou o dia da semana com o artigo certo', () => {
    assert.equal(whenText('2026-10-28', '2026-10-28', 'quarta-feira, 28 de outubro'), 'hoje');
    assert.equal(whenText('2026-10-29', '2026-10-28', 'quinta-feira, 29 de outubro'), 'amanhã');
    assert.equal(whenText('2026-10-30', '2026-10-28', 'sexta-feira, 30 de outubro'), 'na sexta-feira, 30 de outubro');
    assert.equal(whenText('2026-10-31', '2026-10-28', 'sábado, 31 de outubro'), 'no sábado, 31 de outubro');
    assert.equal(whenText('2026-11-01', '2026-10-31', 'domingo, 1 de novembro'), 'amanhã');
});

test('histórico de mensagens da cliente é validado sem quebrar cadastros antigos', async () => {
    const { blankState, validateState } = await import('../public/domain.js');
    const s = blankState();
    s.clients = [{ id: 'c1', name: 'Ana', phone: '(41) 99999-0001', status: 'permanent', color: 'rose', note: '', alert: '' }];
    assert.doesNotThrow(() => validateState(s));
    s.clients[0].waLog = [{ at: new Date().toISOString(), context: 'Lembrete', text: 'Oi, Ana!' }];
    assert.doesNotThrow(() => validateState(s));
    s.clients[0].waLog = [{ at: 'x', text: 'a'.repeat(1001) }];
    assert.throws(() => validateState(s), /Histórico de mensagens inválido/);
    s.clients[0].waLog = 'texto';
    assert.throws(() => validateState(s), /Histórico de mensagens inválido/);
});
