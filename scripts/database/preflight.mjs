import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (name) => readFileSync(resolve(root, name));
const history = readdirSync(resolve(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
const versions = new Map();
const issues = [];
for (const name of history) {
  const version = name.split('_')[0];
  if (versions.has(version)) issues.push(`duplicate migration version: ${version} (${versions.get(version)}, ${name})`);
  else versions.set(version, name);
  if (/^\s*ga\s*$/i.test(read(`supabase/migrations/${name}`).toString())) issues.push(`malformed historical snapshot: ${name}`);
}
if (process.argv.includes('--history')) {
  console.log(issues.length ? issues.join('\n') : 'Historical migration versions are unique');
  process.exitCode = issues.length ? 1 : 0;
} else {
  const manifest = JSON.parse(read('supabase/bootstrap/manifest.json'));
  const listed = new Set();
  for (const item of [...manifest.files, ...manifest.excluded]) {
    if (listed.has(item.path)) throw new Error(`Duplicate manifest entry: ${item.path}`);
    listed.add(item.path);
    if (!/^supabase\/(schema\.sql|migrations\/[^/]+\.sql)$/.test(item.path)) throw new Error(`Invalid manifest path: ${item.path}`);
    if (createHash('sha256').update(read(item.path).toString('utf8').replace(/\r\n/g, '\n')).digest('hex') !== item.sha256) throw new Error(`Review checksum mismatch: ${item.path}`);
  }
  for (const name of history) {
    if (!listed.has(`supabase/migrations/${name}`)) throw new Error(`Unreviewed migration: ${name}`);
  }
  console.log(`Reviewed fresh bootstrap verified (${manifest.files.length} SQL files). Historical issues remain explicitly recorded: ${issues.length}.`);
}
