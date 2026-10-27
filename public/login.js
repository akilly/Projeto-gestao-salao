import { validateVisibleControls } from './form-validation.js';

/** A senha só sai por HTTPS para a API; nunca vai ao armazenamento do navegador. */
const form = document.querySelector('#login');
const error = document.querySelector('#error');
const submit = document.querySelector('#submit');
const retry = document.querySelector('#retry');
const loading = document.querySelector('#loading');
const missingCode = document.querySelector('#missing-code');
const recover = document.querySelector('#recover');
const back = document.querySelector('#back');
// login | setup (primeira conta) | reset (recuperação com o código de configuração)
let mode = 'login';
let status = null;

const copy = {
  login: ['Entrar no seu espaço', 'Use o e-mail e a senha da conta da titular.', 'Entrar'],
  setup: ['Crie a conta da titular', 'Informe o código de configuração, o e-mail e uma senha com pelo menos 12 caracteres. Guarde-os em um local seguro.', 'Criar conta e entrar'],
  reset: ['Redefina sua senha', 'Informe o código de configuração e a nova senha. As sessões abertas em outros aparelhos serão encerradas.', 'Redefinir senha e entrar'],
};

function setError(message = '') {
  error.textContent = message;
  if (message) error.focus();
}

function setMode(next) {
  mode = next;
  const creating = mode !== 'login';
  const [title, intro, label] = copy[mode];
  document.querySelector('#title').textContent = title;
  document.querySelector('#intro').textContent = intro;
  submit.textContent = label;
  document.querySelector('#code').hidden = !creating;
  document.querySelector('#repeat').hidden = !creating;
  form.elements.setupCode.required = creating;
  form.elements.repeat.required = creating;
  form.elements.password.autocomplete = creating ? 'new-password' : 'current-password';
  recover.hidden = mode !== 'login' || !status?.canSetup;
  back.hidden = mode !== 'reset';
  setError();
}

function applyStatus(next) {
  status = next;
  const canCreate = !status.configured && status.canSetup;
  form.hidden = !(status.configured || canCreate);
  missingCode.hidden = status.configured || canCreate;
  setMode(canCreate ? 'setup' : 'login');
  if (new URLSearchParams(location.search).has('recover') && status.configured && status.canSetup) setMode('reset');
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
recover.addEventListener('click', () => { setMode('reset'); form.elements.setupCode.focus(); });
back.addEventListener('click', () => { setMode('login'); form.elements.email.focus(); });
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
form.addEventListener('submit', async event => {
  event.preventDefault();
  setError();
  if (!validateVisibleControls(form)) return;
  if (mode !== 'login' && form.elements.password.value !== form.elements.repeat.value) {
    setError('As senhas precisam ser iguais.');
    form.elements.repeat.setAttribute('aria-invalid', 'true');
    form.elements.repeat.setAttribute('aria-describedby', 'error');
    form.elements.repeat.focus();
    return;
  }

  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  const idleLabel = copy[mode][2];
  submit.textContent = 'Aguarde…';
  try {
    const response = await fetch('/api/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.elements.email.value, password: form.elements.password.value, ...(mode !== 'login' ? { setupCode: form.elements.setupCode.value } : {}) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
    form.reset();
    location.replace('/');
  } catch (failure) {
    setError(failure.message || 'Não foi possível entrar. Tente novamente.');
  } finally {
    submit.disabled = false;
    form.removeAttribute('aria-busy');
    submit.textContent = idleLabel;
  }
});

await loadStatus();
