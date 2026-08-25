/**
 * Applique un fichier SQL de migration sur Postgres (Supabase).
 *
 *   set DATABASE_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
 *   npx tsx scripts/apply-sql-migration.ts supabase/migrations/20260828_lead_pipeline.sql
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnvLocal();
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx scripts/apply-sql-migration.ts <path-to.sql>');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL manquant (mot de passe Postgres Supabase → Settings → Database).');
    process.exit(1);
  }

  const sql = readFileSync(resolve(process.cwd(), file), 'utf8');
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Migration appliquée : ${file}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
