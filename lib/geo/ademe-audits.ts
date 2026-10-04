/**
 * Audits énergétiques d'une liste d'adresses BAN (ADEME, data-fair).
 *
 * Interrogé à l'ouverture d'une fiche parcelle, et par la veille des
 * immeubles suivis. Ni clé ni quota, mais on reste poli : lots de 40
 * adresses, résultat gardé six heures. Rend null si l'ADEME ne répond pas,
 * pour ne jamais conclure « aucun audit » sur une panne.
 */

import { regrouperAudits, type AuditEnergetique, type LigneAudit } from '@/lib/carte/audits';

const BASE = process.env.ADEME_API_BASE ?? 'https://data.ademe.fr/data-fair/api/v1/datasets';
const DATASET = process.env.ADEME_AUDIT_DATASET ?? 'audit-opendata';
const DELAI_MS = 3000;
const TTL_MS = 6 * 60 * 60 * 1000;
const LOT = 40;
const SELECT = [
  'n_audit',
  'categorie_scenario',
  'date_etablissement_audit',
  'classe_bilan_dpe',
  'typologie_logement',
  'surface_habitable_logement',
  'surface_habitable_immeuble',
  'n_etage_appart',
  'identifiant_ban',
].join(',');

const cache = new Map<string, { at: number; audits: AuditEnergetique[] }>();

async function lireLot(bans: readonly string[]): Promise<LigneAudit[] | null> {
  const url = new URL(`${BASE}/${DATASET}/lines`);
  // `qs` est bloqué par le pare-feu de l'ADEME ; `{champ}_in` passe.
  url.searchParams.set('identifiant_ban_in', bans.join(','));
  url.searchParams.set('select', SELECT);
  url.searchParams.set('size', '500');
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'Priimo/1.0 (audits)' },
    signal: AbortSignal.timeout(DELAI_MS),
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('[ademe-audits] réponse', res.status);
    return null;
  }
  const json = (await res.json()) as { results?: LigneAudit[] };
  return json.results ?? [];
}

export async function lireAuditsParBan(bans: readonly string[]): Promise<AuditEnergetique[] | null> {
  const uniques = [...new Set(bans.filter((b) => b && !b.startsWith('gps:')))].sort();
  if (uniques.length === 0) return [];
  const cle = uniques.join('|');
  const connu = cache.get(cle);
  if (connu && Date.now() - connu.at < TTL_MS) return connu.audits;
  try {
    const lots: string[][] = [];
    for (let i = 0; i < uniques.length; i += LOT) lots.push(uniques.slice(i, i + LOT));
    const resultats = await Promise.all(lots.map(lireLot));
    if (resultats.some((r) => r === null)) return null;
    const audits = regrouperAudits(resultats.flat() as LigneAudit[]);
    cache.set(cle, { at: Date.now(), audits });
    return audits;
  } catch (err) {
    console.error('[ademe-audits] échec', err instanceof Error ? err.message : err);
    return null;
  }
}
