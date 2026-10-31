/**
 * `npm run ia:configurar` (ou CONFIGURAR-IA.cmd): liga a IA (Workers AI) no sistema rodando no computador.
 * Os modelos rodam na nuvem da Cloudflare, então é preciso entrar na conta Cloudflare (gratuita) uma vez.
 * Usa a mesma pasta de configuração do `npm run local`, grava HANNE_IA=1 em .dev.vars e não guarda senha nenhuma.
 * Na nuvem não precisa disto: o deploy já liga a IA.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', XDG_CONFIG_HOME: path.join(root, '.sites-runtime', 'xdg-config') };
const off = process.argv.includes('--desligar');
const varsFile = path.join(root, '.dev.vars');
const vars = Object.fromEntries((existsSync(varsFile) ? readFileSync(varsFile, 'utf8') : '').split(/\r?\n/).filter(l => /^\w+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const save = () => writeFileSync(varsFile, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
const wr = (args, stdio = 'inherit') => spawnSync(process.execPath, [wrangler, ...args], { cwd: root, env, stdio, encoding: 'utf8' });

if (off) { delete vars.HANNE_IA; save(); console.log('IA desligada neste computador. Feche e abra o INICIAR-HANNE.cmd.'); process.exit(0); }
console.log(`
Ligar a IA do Hanne (Cloudflare Workers AI, gratuito até 10.000 neurons por dia)
-------------------------------------------------------------------------------
O navegador vai abrir a página da Cloudflare: entre (ou crie a conta gratuita) e clique em "Allow".
`);
let who = wr(['whoami'], 'pipe');
if (!/associated with the email|You are logged in/i.test(who.stdout || '')) {
  const login = wr(['login']);
  if (login.status !== 0) { console.error('\nNão foi possível entrar na Cloudflare. Tente de novo.'); process.exit(1); }
  who = wr(['whoami'], 'pipe');
}
if (!/associated with the email|You are logged in/i.test(who.stdout || '')) { console.error('\nO login na Cloudflare não foi confirmado. Rode de novo.'); process.exit(1); }
vars.HANNE_IA = '1'; save();
console.log('\nPronto: IA ligada. Feche e abra o INICIAR-HANNE.cmd. As sugestões aparecem em Atendimentos.');
