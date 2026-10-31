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

/** Monta um e-mail simples com um botão; o link é o único dado variável. */
export function accessEmail(kind, link, minutes) {
  const setup = kind === 'setup';
  const subject = setup ? 'Crie sua senha no Hanne' : 'Redefinir sua senha do Hanne';
  const title = setup ? 'Vamos criar sua senha' : 'Redefinir sua senha';
  const intro = setup ? 'Recebemos um pedido de primeiro acesso ao sistema do seu ateliê.' : 'Recebemos um pedido para redefinir a senha do sistema do seu ateliê.';
  const validity = minutes >= 120 ? `${Math.round(minutes / 60)} horas` : `${minutes} minutos`;
  const action = setup ? 'Criar minha senha' : 'Criar nova senha';
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
export async function sendMail(env, to, { subject, html, text }, fetcher = fetch) {
  if (!mailEnabled(env)) throw Error('mail_not_configured');
  if (!validEmail(to)) throw Error('invalid_recipient');
  const response = await fetcher(BREVO, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { email: env.MAIL_FROM, name: String(env.MAIL_FROM_NAME || 'Hanne').slice(0, 70) }, to: [{ email: to }], subject, htmlContent: html, textContent: text, tags: ['hanne-acesso'] }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('mail_rejected_' + response.status);
  return true;
}
