/**
 * Envio de e-mails transacionais pelo Brevo (API HTTP, plano gratuito: 300 e-mails/dia).
 * Configuração (segredos do Worker ou .dev.vars): BREVO_API_KEY, MAIL_FROM (remetente confirmado no Brevo)
 * e, opcional, MAIL_FROM_NAME. A chave só vai no cabeçalho `api-key`; nada é registrado em log.
 */
const BREVO = 'https://api.brevo.com/v3/smtp/email';
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

export const validEmail = value => typeof value === 'string' && value.length <= 254 && EMAIL.test(value);
export const mailEnabled = env => typeof env?.BREVO_API_KEY === 'string' && env.BREVO_API_KEY.length >= 20 && validEmail(env?.MAIL_FROM);

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Textos de cada tipo de link: primeiro acesso, nova senha, convite de salão e confirmação de e-mail novo. */
const MAIL_TEXT = {
  setup: { subject: 'Crie sua senha no Hanne', title: 'Vamos criar sua senha', intro: 'Recebemos um pedido de primeiro acesso ao sistema do seu ateliê.', action: 'Criar minha senha' },
  reset: { subject: 'Redefinir sua senha do Hanne', title: 'Redefinir sua senha', intro: 'Recebemos um pedido para redefinir a senha do sistema do seu ateliê.', action: 'Criar nova senha' },
  invite: { subject: 'Seu acesso ao Hanne', title: 'Você foi convidada para o Hanne', intro: 'Foi criado um acesso ao Hanne para o seu salão, com agenda, clientes e financeiro só seus. Crie sua senha para começar.', action: 'Criar minha senha' },
  email: { subject: 'Confirme seu novo e-mail no Hanne', title: 'Confirme seu novo e-mail', intro: 'Recebemos um pedido para usar este endereço como e-mail de acesso ao Hanne. A troca só acontece depois da confirmação.', action: 'Confirmar e-mail' },
};

/** Monta um e-mail simples com um botão; o link é o único dado variável. */
export function accessEmail(kind, link, minutes) {
  const { subject, title, intro, action } = MAIL_TEXT[kind] || MAIL_TEXT.reset;
  const validity = minutes >= 2880 ? `${Math.round(minutes / 1440)} dias` : minutes >= 120 ? `${Math.round(minutes / 60)} horas` : `${minutes} minutos`;
  const text = `${title}\n\n${intro}\n\n${action}: ${link}\n\nO link vale ${validity} e só pode ser usado uma vez.\nSe não foi você, ignore este e-mail: nada muda sem abrir o link.\n\nHanne · Gestão do ateliê`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f3fb;font-family:Arial,Helvetica,sans-serif;color:#1f1a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px">
<tr><td style="font-size:24px;font-weight:bold;color:#6b3fc4">hanne<span style="color:#b892ff">.</span></td></tr>
<tr><td style="padding-top:20px;font-size:22px;font-weight:bold">${escapeHTML(title)}</td></tr>
<tr><td style="padding-top:12px;font-size:16px;line-height:1.5;color:#4a4458">${escapeHTML(intro)}</td></tr>
<tr><td style="padding:28px 0"><a href="${escapeHTML(link)}" style="display:inline-block;background:#6b3fc4;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:12px">${escapeHTML(action)}</a></td></tr>
<tr><td style="font-size:14px;line-height:1.5;color:#6b6478">O link vale <b>${escapeHTML(validity)}</b> e só pode ser usado uma vez.<br>Se não foi você, ignore este e-mail: nada muda sem abrir o link.</td></tr>
<tr><td style="padding-top:20px;font-size:12px;line-height:1.5;color:#9a93a8;word-break:break-all">Se o botão não abrir, copie este endereço no navegador:<br>${escapeHTML(link)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html, text };
}

/** Envia pelo Brevo. Lança erro sem detalhes sensíveis quando o provedor recusa. */
export async function sendMail(env, to, { subject, html = '', text = '' }, fetcher = fetch) {
  if (!mailEnabled(env)) throw Error('mail_not_configured');
  if (!validEmail(to)) throw Error('invalid_recipient');
  const response = await fetcher(BREVO, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    // O Brevo aceita um único tipo de corpo por envio: vai o HTML (que já traz o link em texto também).
    body: JSON.stringify({ sender: { email: env.MAIL_FROM, name: String(env.MAIL_FROM_NAME || 'Hanne').slice(0, 70) }, to: [{ email: to }], subject, ...(html ? { htmlContent: html } : { textContent: text }), tags: ['hanne-acesso'] }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('mail_rejected_' + response.status);
  return true;
}
