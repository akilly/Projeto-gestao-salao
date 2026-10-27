/**
 * Executa cada arquivo de teste em processo próprio. Equivale a `node --test`, que em alguns
 * ambientes Windows não termina ao abrir subprocessos.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [
  ...readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => path.join('tests', f)),
  path.join('services', 'baileys', 'store.test.mjs'),
];
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 120000 });
  const pass = /ℹ pass (\d+)/.exec(result.stdout)?.[1] ?? '?', fail = /ℹ fail (\d+)/.exec(result.stdout)?.[1] ?? '?';
  const ok = result.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✖'} ${file}  (pass ${pass}, fail ${fail})`);
  if (!ok) console.log(result.stdout.split('\n').filter(l => /✖|Error|expected|actual/.test(l)).slice(0, 20).join('\n') + (result.stderr || ''));
}
process.exit(failed ? 1 : 0);
