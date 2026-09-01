/**
 * Runner de tests — découvre les fichiers au lieu de les lister.
 *
 * Une liste écrite à la main dans package.json finit toujours par oublier un
 * fichier : le test existe, il passe, personne ne le lance. Ici tout `*.test.ts`
 * du dépôt est exécuté, point.
 *
 * Usage :
 *   node scripts/test.mjs            → tout
 *   node scripts/test.mjs carte geo  → seuls les chemins contenant « carte » ou « geo »
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IGNORED = new Set(['node_modules', '.next', '.git', 'public', 'supabase']);

function collect(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

const filters = process.argv.slice(2);
const files = collect(ROOT)
  .map((f) => relative(ROOT, f).split(sep).join('/'))
  .filter((f) => filters.length === 0 || filters.some((needle) => f.includes(needle)))
  .sort();

if (files.length === 0) {
  console.error(filters.length ? `Aucun test ne correspond a : ${filters.join(', ')}` : 'Aucun test trouve.');
  process.exit(1);
}

console.log(`${files.length} fichier(s) de test\n`);
const res = spawnSync('npx', ['--yes', 'tsx', '--test', ...files], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: ROOT,
});
process.exit(res.status ?? 1);
