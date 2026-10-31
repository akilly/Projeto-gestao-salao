/**
 * `npm run local`: roda o ateliê no próprio computador, como na nuvem, mas com banco local.
 *
 * - Cria uma vez o arquivo `.dev.vars` com SETUP_TOKEN (código do primeiro acesso) e
 *   WHATSAPP_ENCRYPTION_KEY. Nunca sobrescreve: trocar a chave impediria abrir dados cifrados.
 * - Compila o site (só quando falta ou com --build) e aplica as migrações no D1 local.
 * - Sobe o Worker em http://localhost:8787 (porta: PORT). Dados ficam em `.wrangler/state`.
 *
 * Para levar à nuvem depois: Configurações → Cópia completa JSON aqui, e "Restaurar cópia JSON"
 * no site publicado (veja docs/RODAR_NO_PC.md).
 */
import { spawnSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 8787);
const runtime = path.join(root, '.sites-runtime');
const state = path.join(root, '.wrangler', 'state');
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_CF_FETCH_ENABLED: 'false', XDG_CONFIG_HOME: path.join(runtime, 'xdg-config') };

function run(file, args, label) {
  console.log('\n==> ' + label);
  const result = spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', env });
  if (result.status !== 0) { console.error('\nFalhou: ' + label + '.'); process.exit(result.status || 1); }
}

if (!existsSync(wrangler)) { console.error('Dependências não instaladas. Rode primeiro o INICIAR-HANNE.cmd (ou pnpm install).'); process.exit(1); }

// 1. Segredos locais, criados uma única vez.
const varsFile = path.join(root, '.dev.vars');
const vars = Object.fromEntries((existsSync(varsFile) ? readFileSync(varsFile, 'utf8') : '').split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
let created = false;
if (!vars.SETUP_TOKEN) { vars.SETUP_TOKEN = randomBytes(9).toString('hex').toUpperCase().match(/.{6}/g).join('-'); created = true; }
if (!vars.WHATSAPP_ENCRYPTION_KEY) { vars.WHATSAPP_ENCRYPTION_KEY = randomBytes(32).toString('base64'); created = true; }
// Links dos e-mails apontam sempre para este endereço (não para o Host enviado na requisição).
if (!vars.APP_ORIGIN) { vars.APP_ORIGIN = `http://localhost:${port}`; created = true; }
if (created) writeFileSync(varsFile, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });

// 2. Compilação (primeira vez, ou --build depois de atualizar o código).
if (!existsSync(path.join(root, 'dist', 'server', 'wrangler.json')) || process.argv.includes('--build')) run(path.join(root, 'node_modules', 'vinext', 'dist', 'cli.js'), ['build'], 'Compilando o site (1 a 2 minutos)');

// 3. Migrações no banco local (o mesmo usado pelo servidor abaixo).
mkdirSync(runtime, { recursive: true });
const built = JSON.parse(readFileSync(path.join(root, 'dist', 'server', 'wrangler.json'), 'utf8'));
const migrateConfig = path.join(runtime, 'd1-local.json');
writeFileSync(migrateConfig, JSON.stringify({ name: 'hanne-local', compatibility_date: '2026-05-15', d1_databases: [{ ...built.d1_databases[0], migrations_dir: '../drizzle' }] }, null, 2));
run(wrangler, ['d1', 'migrations', 'apply', built.d1_databases[0].binding, '--local', '--config', migrateConfig, '--persist-to', state], 'Atualizando o banco local');

// 4. Servidor.
console.log(`\n=================================================================
 Hanne rodando neste computador:  http://localhost:${port}
 ${created ? `Primeiro acesso: use o código de configuração ${vars.SETUP_TOKEN}` : 'Código de configuração: veja SETUP_TOKEN no arquivo .dev.vars'}
 E-mails (primeiro acesso e esqueci a senha): ${vars.BREVO_API_KEY && vars.MAIL_FROM ? 'configurados para ' + (vars.OWNER_EMAIL || '(defina OWNER_EMAIL)') : 'não configurados. Rode CONFIGURAR-EMAIL.cmd'}
 Deixe esta janela aberta. Para parar: Ctrl+C.
=================================================================\n`);
const server = spawn(process.execPath, ['--import', './scripts/sites-env.mjs', wrangler, 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', state, '--env-file', varsFile, '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--show-interactive-dev-session=false'], { cwd: root, stdio: 'inherit', env });
server.on('exit', code => process.exit(code ?? 0));
// --open: abre o navegador quando o servidor responder (Windows/macOS/Linux).
if (process.argv.includes('--open')) (async () => {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/login`)).ok) break; } catch { /* ainda iniciando */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  const url = `http://localhost:${port}`;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
})();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
