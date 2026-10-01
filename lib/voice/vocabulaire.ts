/**
 * Vocabulaire de l'agence pour Voxtral (`context_bias`, 100 termes au plus) :
 * les noms de l'équipe et des contacts suivis de près. C'est sur les noms
 * propres qu'une transcription se trompe — « Mme Leroy » écrit « Le Roi ».
 *
 * Mistral annonce ce réglage « expérimental » hors anglais :
 * `MISTRAL_STT_CONTEXT_BIAS=0` le coupe sans redéploiement de code.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

const MAX_TERMES = 100;
const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; termes: Promise<string[]> }>();

const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'van', 'von', 'di', 'da']);

/**
 * Un mot seul par terme. Mistral conseille des tirets bas pour les
 * expressions, mais Voxtral les recopie alors dans le texte (« Janine_Martin »,
 * constaté en test) : on découpe les noms composés en mots.
 */
export function termesContexte(brut: string | null | undefined): string[] {
  return (brut ?? '')
    .split(/[\s,]+/)
    .map((m) => m.trim())
    .filter((m) => m.length >= 3 && m.length <= 30 && !PARTICULES.has(m.toLowerCase()) && /\p{L}/u.test(m));
}

export function vocabulaireDepuis(noms: readonly (string | null | undefined)[]): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const nom of noms) {
    for (const t of termesContexte(nom)) {
      if (vus.has(t.toLowerCase())) continue;
      vus.add(t.toLowerCase());
      out.push(t);
      if (out.length >= MAX_TERMES) return out;
    }
  }
  return out;
}

async function charger(admin: Client, agencyId: string): Promise<string[]> {
  const [{ data: liens }, { data: contacts }] = await Promise.all([
    admin.from('profile_agencies').select('profile_id').eq('agency_id', agencyId).limit(40),
    admin
      .from('contacts')
      .select('first_name, last_name')
      .eq('agency_id', agencyId)
      .order('last_interaction_at', { ascending: false, nullsFirst: false })
      .limit(80),
  ]);
  const ids = ((liens ?? []) as { profile_id: string }[]).map((l) => l.profile_id);
  const { data: profils } = ids.length
    ? await admin.from('profiles').select('first_name, last_name').in('id', ids)
    : { data: [] };
  const nomsEquipe = ((profils ?? []) as { first_name: string | null; last_name: string | null }[]).flatMap((p) => [
    p.last_name,
    p.first_name,
  ]);
  const nomsContacts = ((contacts ?? []) as { first_name: string | null; last_name: string | null }[]).map(
    (c) => c.last_name,
  );
  return vocabulaireDepuis([...nomsEquipe, ...nomsContacts]);
}

export function vocabulaireAgence(admin: Client, agencyId: string): Promise<string[]> {
  if (process.env.MISTRAL_STT_CONTEXT_BIAS?.trim() === '0') return Promise.resolve([]);
  const hit = cache.get(agencyId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.termes;
  const termes = charger(admin, agencyId).catch(() => [] as string[]);
  cache.set(agencyId, { at: Date.now(), termes });
  return termes;
}
