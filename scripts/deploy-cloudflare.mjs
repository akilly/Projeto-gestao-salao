/**
 * Publica o Worker na conta Cloudflare de quem executa (wrangler login).
 * Uso: CLOUDFLARE_D1_DATABASE_ID=<id> npm run deploy:cloudflare
 * Opcional: WORKER_NAME (padrão hanne-atelier) e D1_DATABASE_NAME (padrão hanne-atelier-db).
 * Etapas: build Vinext → ajusta dist/server/wrangler.json com o D1 real → aplica migrações remotas → deploy.
 * Segredos (SETUP_TOKEN, WHATSAPP_ENCRYPTION_KEY...) são definidos à parte com `wrangler secret put`; veja DEPLOY.md.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || '';
const workerName = process.env.WORKER_NAME || 'hanne-atelier';
const databaseName = process.env.D1_DATABASE_NAME || 'hanne-atelier-db';
const skipBuild = process.argv.includes('--skip-build');
const dryRun = process.argv.includes('--dry-run');

if (!/^[0-9a-f-]{36}$/i.test(databaseId) || databaseId === '00000000-0000-4000-8000-000000000000') {
  console.error('Defina CLOUDFLARE_D1_DATABASE_ID com o ID do banco criado por `npx wrangler d1 create ' + databaseName + '`.');
  process.exit(1);
}

function run(file, args) {
  console.log('\n> ' + [path.basename(file), ...args].join(' '));
  const result = spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!skipBuild) run(path.join(root, 'node_modules/vinext/dist/cli.js'), ['build']);

const configPath = path.join(root, 'dist/server/wrangler.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.name = workerName;
config.topLevelName = workerName;
// O build local usa um D1 provisório; aqui ele aponta para o banco real e para as migrações versionadas.
config.d1_databases = [{ binding: 'DB', database_name: databaseName, database_id: databaseId, migrations_dir: '../../drizzle' }];
delete config.dev;
writeFileSync(configPath, JSON.stringify(config));
console.log(`\nConfiguração pronta: Worker "${workerName}", D1 "${databaseName}" (${databaseId}).`);

const wrangler = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
// --dry-run confere o pacote sem tocar no banco nem na conta.
if (!dryRun) run(wrangler, ['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath]);
run(wrangler, ['deploy', '--config', configPath, ...(dryRun ? ['--dry-run', '--outdir', 'dist/.deploy-check'] : [])]);
if (dryRun) process.exit(0);
console.log('\nPublicado. Se ainda não definiu, rode: npx wrangler secret put SETUP_TOKEN --name ' + workerName);
