/** Aplica o tema salvo antes de pintar a página (sem piscar). Arquivo externo para a CSP não precisar de script inline. */
try { document.documentElement.dataset.theme = localStorage.getItem('hanne-theme') === 'dark' ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
