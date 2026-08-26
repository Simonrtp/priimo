/**
 * Scan one-shot des doublons probables. Lecture seule.
 *   npx tsx scripts/scan-contact-duplicates.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { pairDuplicates, type DuplicateFields } from '../lib/contacts/duplicates';
import { buildFullName } from '../lib/queries/contacts';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (!process.env[key]) process.env[key] = val.replace(/^"|"$/g, '');
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

type Row = {
  id: string;
  agency_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

function toFields(row: Row): DuplicateFields {
  const firstName = (row.first_name ?? '').trim();
  const lastName = (row.last_name ?? '').trim();
  return {
    id: row.id,
    firstName,
    lastName,
    fullName: buildFullName(firstName, lastName),
    phone: row.phone,
    email: row.email,
  };
}

async function main() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('contacts')
    .select('id, agency_id, first_name, last_name, phone, email');
  if (error || !data) {
    console.error(error?.message ?? 'lecture impossible');
    process.exit(1);
  }

  const rows = data as unknown as Row[];
  const byAgency = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byAgency.get(row.agency_id) ?? [];
    list.push(row);
    byAgency.set(row.agency_id, list);
  }

  const ranked = [...byAgency.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`total_contacts=${rows.length} agencies=${ranked.length}`);
  for (const [agencyId, list] of ranked) {
    const pairs = pairDuplicates(list.map(toFields));
    const strong = pairs.filter((p) => p.strength === 'strong').length;
    const weak = pairs.filter((p) => p.strength === 'weak').length;
    const involved = new Set(pairs.flatMap((p) => [p.aId, p.bId]));
    const incomplete = list.filter((r) => !r.phone?.trim() && !r.email?.trim()).length;
    console.log(
      JSON.stringify({
        agencyId,
        contacts: list.length,
        pairs: pairs.length,
        strong,
        weak,
        fichesImpliquees: involved.size,
        fichesIncompletes: incomplete,
        exemples: pairs.slice(0, 8).map((p) => {
          const a = list.find((r) => r.id === p.aId);
          const b = list.find((r) => r.id === p.bId);
          return {
            strength: p.strength,
            reason: p.reason,
            a: buildFullName(a?.first_name ?? '', a?.last_name ?? ''),
            b: buildFullName(b?.first_name ?? '', b?.last_name ?? ''),
          };
        }),
      }),
    );
  }
}

void main();
