/**
 * Envio manual pelo WhatsApp: monta o link wa.me com a mensagem já escrita.
 * Nada é enviado pelo sistema; a profissional revisa o texto, abre a conversa e toca em enviar no próprio WhatsApp.
 * As respostas chegam no WhatsApp dela, como qualquer outra conversa.
 */

/** Normaliza o telefone para o formato internacional exigido pelo wa.me (somente dígitos, com DDI). */
export function waPhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^0\d{10,11}$/.test(digits)) digits = digits.slice(1);
    if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
    return /^\d{12,15}$/.test(digits) ? digits : '';
}

/** Link que abre a conversa da cliente com o texto preenchido; vazio quando o telefone não serve. */
export function waURL(phone, text = '') {
    const number = waPhone(phone);
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(String(text))}` : '';
}

export const firstName = name => String(name || '').trim().split(/\s+/)[0] || '';

/** Modelos fixos. Os valores chegam já formatados pelo aplicativo (datas, horários e moeda). */
export const waMessages = {
    confirm: ({ name, salon, service, date, time }) =>
        `Oi, ${firstName(name)}! Tudo bem? Aqui é ${salon || 'o ateliê'}. Seu horário de ${service} está marcado para ${date}, às ${time}. Posso confirmar sua presença?`,
    reminder: ({ name, service, when, time }) =>
        `Oi, ${firstName(name)}! Passando para lembrar do seu horário de ${service} ${when}, às ${time}. Se surgir algum imprevisto, me avise por aqui. Até lá!`,
    charge: ({ name, balance, description, date, due }) =>
        `Oi, ${firstName(name)}! Tudo bem? Passando para lembrar do valor em aberto de ${balance}, referente a ${description} (${date}), com vencimento em ${due}. Se já tiver feito o pagamento, me avise para eu dar baixa. Obrigada!`,
    followup: ({ name }) =>
        `Oi, ${firstName(name)}! Tudo bem? Estou passando para saber como ficou o resultado do nosso último atendimento e conversar sobre os próximos cuidados.`,
    quote: ({ name, service, questions }) =>
        `Oi, ${firstName(name)}! Para avaliar o seu orçamento de ${service}, preciso de algumas informações:\n\n${String(questions || '').trim()}`,
    free: ({ name }) => `Oi, ${firstName(name)}! `,
};

/** “hoje”, “amanhã” ou “na sexta-feira, 30 de outubro”, a partir de datas ISO (AAAA-MM-DD). */
export function whenText(date, today, longDate) {
    const days = Math.round((Date.parse(date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
    if (days === 0) return 'hoje';
    if (days === 1) return 'amanhã';
    return (/^(sábado|domingo)/.test(longDate) ? 'no ' : 'na ') + longDate;
}
