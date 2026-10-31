/** `npm run user:test:create`: aplica as migrações no D1 local e cria a conta de teste (teste@hanne.local). Nunca usar em produção. */
import { randomBytes } from 'node:crypto';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { derive } from '../lib/salon-auth.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const runtimeDir = path.join(projectRoot, '.sites-runtime');
const stateDir = path.join(projectRoot, '.wrangler/state');
const configPath = path.join(runtimeDir, 'd1.json');
const sqlPath = path.join(runtimeDir, 'create-test-user.sql');
const email = process.env.TEST_USER_EMAIL || 'teste@hanne.local';
const password = process.env.TEST_USER_PASSWORD || 'HanneTeste#2026';
const owner = 'local_seedy';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
  throw new Error('Use TEST_USER_EMAIL válido e TEST_USER_PASSWORD com pelo menos 12 caracteres.');
}

mkdirSync(runtimeDir, { recursive: true });
writeFileSync(configPath, JSON.stringify({
  name: 'hanne-local-db',
  compatibility_date: '2026-05-15',
  d1_databases: [{
    binding: 'DB',
    database_name: 'site-creator-d1',
    database_id: '00000000-0000-4000-8000-000000000000',
    migrations_dir: '../drizzle',
  }],
}, null, 2));

const wrangler = path.join(projectRoot, 'node_modules/wrangler/bin/wrangler.js');
const environment = {
  ...process.env,
  CI: 'true',
  XDG_CONFIG_HOME: path.join(runtimeDir, 'xdg-config'),
  WRANGLER_SEND_METRICS: 'false',
};
function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run(['d1', 'migrations', 'apply', 'DB', '--local', '--config', configPath, '--persist-to', stateDir]);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const salt = randomBytes(24).toString('hex');
const hash = await derive(password, salt);
writeFileSync(sqlPath, `INSERT INTO salon_credentials (id, owner_id, email, salt, password_hash)
VALUES (1, ${quote(owner)}, ${quote(email.toLowerCase())}, ${quote(salt)}, ${quote(hash)})
ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id, email=excluded.email, salt=excluded.salt, password_hash=excluded.password_hash;
DELETE FROM salon_sessions;
DELETE FROM salon_login_limits;
`);
try {
  run(['d1', 'execute', 'DB', '--local', '--config', configPath, '--persist-to', stateDir, '--file', sqlPath]);
} finally {
  unlinkSync(sqlPath);
}

console.log('\nUsuário de teste local criado.');
console.log(`E-mail: ${email}`);
console.log(process.env.TEST_USER_PASSWORD ? 'Senha: definida por TEST_USER_PASSWORD' : `Senha: ${password}`);
console.log('Este usuário existe somente no D1 local e nunca deve ser usado em produção.');
