import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
if (process.env.FINTRACK_DISPOSABLE_DATABASE !== 'YES') throw new Error('Requires FINTRACK_DISPOSABLE_DATABASE=YES and a new disposable PostgreSQL database');
if (!process.env.PGDATABASE || !/^fintrack_(test|ci)(_|$)/.test(process.env.PGDATABASE)) throw new Error('PGDATABASE must be an explicitly named fintrack_test/fintrack_ci disposable database');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
run(process.execPath, ['scripts/database/preflight.mjs']);
run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/bootstrap/postgres-fixtures.sql']);
const manifest = JSON.parse(readFileSync(resolve(root, 'supabase/bootstrap/manifest.json'), 'utf8'));
for (const file of manifest.files) run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', file.path]);
for (const file of manifest.tests) run('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-f', file]);
