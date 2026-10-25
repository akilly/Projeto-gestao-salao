import { validateVisibleControls } from './form-validation.js';

/** A senha só sai por HTTPS para a API; nunca vai ao armazenamento do navegador. */
const form = document.querySelector('#login');
const error = document.querySelector('#error');
const submit = document.querySelector('#submit');
const retry = document.querySelector('#retry');
const loading = document.querySelector('#loading');
const setupOwner = document.querySelector('#setup-owner');
let setup = false;
let reset = false;

function setError(message = '') {
  error.textContent = message;
  if (message) error.focus();
}

function applyMode(status) {
  const recoveryRequested = new URLSearchParams(location.search).has('recover');
  reset = Boolean(status.configured && status.canSetup && recoveryRequested);
  setup = Boolean(!status.configured && status.canSetup);
  form.hidden = !(status.configured || setup || reset);
  setupOwner.hidden = status.configured || setup;
  if (!setup && !reset) return;

  document.querySelector('#title').textContent = reset ? 'Redefina sua senha' : 'Cadastre o usuário titular';
  document.querySelector('#intro').textContent = 'Defina o e-mail e uma senha com pelo menos 12 caracteres. Guarde-os em um local seguro.';
  document.querySelector('#repeat').hidden = false;
  form.elements.repeat.required = true;
  form.elements.password.autocomplete = 'new-password';
  submit.textContent = reset ? 'Redefinir senha e entrar' : 'Cadastrar e entrar';
}

async function loadStatus() {
  loading.hidden = false;
  retry.hidden = true;
  form.hidden = true;
  setupOwner.hidden = true;
  setError();
  try {
    const response = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar a conta.');
    applyMode(await response.json());
  } catch (failure) {
    setError(failure.message || 'Não foi possível consultar a conta.');
    retry.hidden = false;
  } finally {
    loading.hidden = true;
  }
}

retry.addEventListener('click', loadStatus);
document.querySelector('#show').addEventListener('click', event => {
  const show = form.elements.password.type === 'password';
  form.elements.password.type = show ? 'text' : 'password';
  event.currentTarget.textContent = show ? 'Ocultar senha' : 'Mostrar senha';
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
  if ((setup || reset) && form.elements.password.value !== form.elements.repeat.value) {
    setError('As senhas precisam ser iguais.');
    form.elements.repeat.setAttribute('aria-invalid', 'true');
    form.elements.repeat.setAttribute('aria-describedby', 'error');
    form.elements.repeat.focus();
    return;
  }

  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  const idleLabel = reset ? 'Redefinir senha e entrar' : setup ? 'Cadastrar e entrar' : 'Entrar';
  submit.textContent = 'Aguarde…';
  try {
    const path = reset ? 'reset' : setup ? 'setup' : 'login';
    const response = await fetch('/api/auth/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.elements.email.value, password: form.elements.password.value }),
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
