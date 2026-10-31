import { validateVisibleControls } from './form-validation.js';

/**
 * Tela de entrada. A senha só sai por HTTPS para a API; nunca vai ao armazenamento do navegador.
 *
 * Modos:
 *   login        e-mail + senha
 *   link-setup   primeiro acesso: pede um link por e-mail (só o e-mail da titular recebe)
 *   link-reset   "esqueci minha senha": pede um link por e-mail
 *   complete     aberto pelo link do e-mail (?acesso=...): define a senha e já entra
 *   setup/reset  alternativa sem e-mail, com o código de configuração (SETUP_TOKEN)
 */
const form = document.querySelector('#login');
const error = document.querySelector('#error');
const sent = document.querySelector('#sent');
const submit = document.querySelector('#submit');
const retry = document.querySelector('#retry');
const loading = document.querySelector('#loading');
const missingCode = document.querySelector('#missing-code');
const recover = document.querySelector('#recover');
const useCode = document.querySelector('#use-code');
const back = document.querySelector('#back');
const field = name => document.querySelector('#field-' + name);

let mode = 'login';
let status = null;
// O token do link fica só na memória e sai da barra de endereço (histórico e compartilhamento de tela).
const accessToken = new URLSearchParams(location.search).get('acesso') || '';
if (accessToken) history.replaceState(null, '', '/login');

const MODES = {
  login: { title: 'Entrar no seu espaço', intro: 'Use o e-mail e a senha da conta da titular.', button: 'Entrar', fields: ['email', 'password'] },
  'link-setup': { title: 'Primeiro acesso', intro: 'Informe o e-mail da titular. Vamos enviar um link para você criar sua senha.', button: 'Enviar link por e-mail', fields: ['email'] },
  'link-reset': { title: 'Esqueci minha senha', intro: 'Informe o e-mail da conta. Vamos enviar um link para criar uma nova senha. As sessões abertas em outros aparelhos serão encerradas.', button: 'Enviar link por e-mail', fields: ['email'] },
  complete: { title: 'Crie sua senha', intro: 'Escolha uma senha com pelo menos 12 caracteres. Depois disso você já entra no sistema.', button: 'Salvar senha e entrar', fields: ['password', 'repeat'] },
  setup: { title: 'Crie a conta da titular', intro: 'Informe o código de configuração, o e-mail e uma senha com pelo menos 12 caracteres.', button: 'Criar conta e entrar', fields: ['code', 'email', 'password', 'repeat'] },
  reset: { title: 'Redefina sua senha', intro: 'Informe o código de configuração e a nova senha. As sessões abertas em outros aparelhos serão encerradas.', button: 'Redefinir senha e entrar', fields: ['code', 'email', 'password', 'repeat'] },
};

function setError(message = '') {
  error.textContent = message;
  if (message) error.focus();
}

function setMode(next) {
  mode = next;
  const { title, intro, button, fields } = MODES[mode];
  document.querySelector('#title').textContent = title;
  document.querySelector('#intro').textContent = intro;
  submit.textContent = button;
  for (const name of ['code', 'email', 'password', 'repeat']) {
    const visible = fields.includes(name);
    field(name).hidden = !visible;
    const input = field(name).querySelector('input');
    input.required = visible;
    input.disabled = !visible;
  }
  form.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  form.hidden = false;
  sent.hidden = true;
  const linkMode = mode.startsWith('link-');
  recover.hidden = mode !== 'login' || !(status?.emailEnabled || status?.canSetup);
  useCode.hidden = !linkMode || !status?.canSetup;
  back.hidden = mode === 'login' || (mode === 'link-setup' && !status?.configured) || (mode === 'setup' && !status?.emailSetup);
  setError();
}

function applyStatus(next) {
  status = next;
  missingCode.hidden = true;
  if (accessToken) return setMode('complete');
  if (status.configured) return setMode('login');
  if (status.emailSetup) return setMode('link-setup');
  if (status.canSetup) return setMode('setup');
  form.hidden = true;
  missingCode.hidden = false;
}

async function loadStatus() {
  loading.hidden = false;
  retry.hidden = true;
  form.hidden = true;
  missingCode.hidden = true;
  setError();
  try {
    const response = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar a conta.');
    applyStatus(await response.json());
  } catch (failure) {
    setError(failure.message || 'Não foi possível consultar a conta.');
    retry.hidden = false;
  } finally {
    loading.hidden = true;
  }
}

retry.addEventListener('click', loadStatus);
recover.addEventListener('click', () => { setMode(status?.emailEnabled ? 'link-reset' : 'reset'); form.elements[status?.emailEnabled ? 'email' : 'setupCode'].focus(); });
useCode.addEventListener('click', () => { setMode(status?.configured ? 'reset' : 'setup'); form.elements.setupCode.focus(); });
back.addEventListener('click', () => { setMode(status?.configured ? 'login' : status?.emailSetup ? 'link-setup' : 'setup'); form.elements.email.focus(); });
document.querySelector('#show').addEventListener('click', event => {
  const show = form.elements.password.type === 'password';
  form.elements.password.type = show ? 'text' : 'password';
  event.currentTarget.textContent = show ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(show));
});
form.addEventListener('input', event => {
  if (event.target.getAttribute('aria-invalid') === 'true' && event.target.checkValidity()) {
    event.target.removeAttribute('aria-invalid');
    event.target.removeAttribute('aria-describedby');
  }
});

/** Monta a chamada à API conforme o modo; a senha nunca vai para um modo que não precisa dela. */
function requestFor() {
  const value = name => form.elements[name].value;
  if (mode === 'login') return ['login', { email: value('email'), password: value('password') }];
  if (mode === 'link-setup' || mode === 'link-reset') return ['request-link', { email: value('email'), purpose: mode === 'link-setup' ? 'setup' : 'reset' }];
  if (mode === 'complete') return ['complete', { token: accessToken, password: value('password') }];
  return [mode, { email: value('email'), password: value('password'), setupCode: value('setupCode') }];
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  setError();
  if (!validateVisibleControls(form)) return;
  if (MODES[mode].fields.includes('repeat') && form.elements.password.value !== form.elements.repeat.value) {
    setError('As senhas precisam ser iguais.');
    form.elements.repeat.setAttribute('aria-invalid', 'true');
    form.elements.repeat.setAttribute('aria-describedby', 'error');
    form.elements.repeat.focus();
    return;
  }
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  const idleLabel = MODES[mode].button;
  submit.textContent = 'Aguarde…';
  try {
    const [path, body] = requestFor();
    const response = await fetch('/api/auth/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir.');
    if (path === 'request-link') {
      form.hidden = true;
      sent.hidden = false;
      sent.querySelector('p').textContent = data.message || 'Se o e-mail estiver correto, você vai receber um link em alguns minutos.';
      back.hidden = false;
      recover.hidden = true;
      useCode.hidden = true;
      sent.focus();
      return;
    }
    form.reset();
    location.replace('/');
  } catch (failure) {
    setError(failure.message || 'Não foi possível concluir. Tente novamente.');
  } finally {
    submit.disabled = false;
    form.removeAttribute('aria-busy');
    submit.textContent = idleLabel;
  }
});

await loadStatus();
