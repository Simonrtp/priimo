/**
 * Lance le balayage des annonces de particuliers depuis ce poste, comme le
 * cron de nuit (/api/cron/balayage), et affiche chaque tranche. Écrit en base
 * (service role) : c'est le vrai balayage, pas une simulation.
 *
 *   npx tsx --require ./scripts/hors-next.cjs --env-file=.env.local scripts/essai-balayage.ts [tranches]
 *
 * BALAYAGE_CODES_POSTAUX=75020 limite à un code postal ; BALAYAGE_PLAFOND_JOUR
 * borne les pages du jour (250 par défaut).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { planifierNuit, traiterTranche } from '@/lib/annonces/balayage/balayer';

async function main() {
  const tranchesMax = Number(process.argv[2] ?? 60);
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  console.log('planification', JSON.stringify(await planifierNuit(admin)));
  for (let i = 0; i < tranchesMax; i += 1) {
    const t = await traiterTranche(admin);
    console.log(`tranche ${i} : ${t.traitees} tâches en ${Math.round(t.dureeMs / 1000)} s, ${t.restantes} restantes, ${t.closes} clôtures${t.plafond ? ', PLAFOND DU JOUR' : ''}`);
    if (t.restantes === 0 || t.plafond || t.traitees === 0) break;
  }
  const { data } = await admin.from('annonces_runs').select('*').order('finished_at', { ascending: false }).limit(4);
  console.table(data);
}

void main();
