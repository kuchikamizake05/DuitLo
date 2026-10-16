import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('history preflight identifies duplicate versions and malformed snapshot without changing files', () => {
  const result = spawnSync(process.execPath, ['scripts/database/preflight.mjs', '--history'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /duplicate migration version: 20260714/);
  assert.match(result.stdout, /malformed historical snapshot/);
});

test('fresh bootstrap manifest explicitly excludes malformed history and includes integrity migration', () => {
  assert.ok(existsSync('supabase/bootstrap/manifest.json'));
  const manifest = JSON.parse(readFileSync('supabase/bootstrap/manifest.json', 'utf8'));
  assert.ok(manifest.excluded.some((entry) => entry.path.endsWith('20260714_add_account_equity_snapshots.sql')));
  assert.ok(manifest.files.some((entry) => entry.path.endsWith('202610160001_financial_integrity.sql')));
  for (const entry of [...manifest.files, ...manifest.excluded]) {
    assert.equal(entry.sha256, createHash('sha256').update(readFileSync(entry.path)).digest('hex'), entry.path);
  }
});

test('preflight validates reviewed fresh manifest without executing any SQL', () => {
  const result = spawnSync(process.execPath, ['scripts/database/preflight.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Reviewed fresh bootstrap verified/);
});

test('disposable SQL runner refuses implicit execution before connecting', () => {
  const result = spawnSync(process.execPath, ['scripts/database/run-disposable.mjs'], {
    encoding: 'utf8', env: { ...process.env, FINTRACK_DISPOSABLE_DATABASE: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Requires FINTRACK_DISPOSABLE_DATABASE=YES/);
});

test('disposable SQL runner refuses a production database name even with explicit flag', () => {
  const result = spawnSync(process.execPath, ['scripts/database/run-disposable.mjs'], {
    encoding: 'utf8', env: { ...process.env, FINTRACK_DISPOSABLE_DATABASE: 'YES', PGDATABASE: 'production' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PGDATABASE must be an explicitly named/);
});
