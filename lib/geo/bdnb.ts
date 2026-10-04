/**
 * Client de l'API ouverte de la BDNB (api.bdnb.io), pour la fiche parcelle.
 *
 * Quota de l'offre ouverte : 10 000 appels par mois et 10 lignes par appel
 * (en-têtes X-Quota-Limit, X-Max-Items-Per-Call). Une fiche coûte deux
 * appels ; le résumé est donc gardé en mémoire et, surtout, en base trente
 * jours (table parcelle_batiments). Ne lève jamais : sans BDNB, la fiche
 * s'affiche sans le bloc immeuble.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { syntheseBdnb, type BatimentParcelle, type LigneBdnb } from '@/lib/carte/bdnb';

const BASE = process.env.BDNB_API_BASE ?? 'https://api.bdnb.io/v1/bdnb/donnees';
const DELAI_MS = 2500;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ENTETES = { accept: 'application/json', 'user-agent': 'Priimo/1.0 (fiche parcelle)' } as const;

const CHAMPS = [
  'batiment_groupe_id',
  'surface_emprise_sol',
  'usage_niveau_1_txt',
  'usage_principal_bdnb_open',
  'nb_log',
  'nb_log_rnc',
  'nb_niveau',
  'annee_construction',
  'mat_mur_txt',
  'l_denomination_proprietaire',
  'l_siren',
  'quartier_prioritaire',
  'nom_quartier_qpv',
  'distance_monument_historique',
  'denomination_monument_historique',
  'classe_conso_energie_dpe_tertiaire',
  'cle_interop_adr_principale_ban',
  'libelle_adr_principale_ban',
  'l_cle_interop_adr',
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((x) => [
    `nb_classe_bilan_dpe_${x}`,
    `nb_classe_conso_energie_arrete_2012_${x}`,
  ]),
].join(',');

export type LectureBdnb =
  | { etat: 'connu'; batiment: BatimentParcelle | null }
  | { etat: 'indisponible' };

const memoire = new Map<string, { at: number; batiment: BatimentParcelle | null }>();

/** À incrémenter dès que BatimentParcelle change de forme : l'ancien cache est ignoré. */
const VERSION_CACHE = 2;
type EnCache = { v: number; batiment: BatimentParcelle | null };

async function lireJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: ENTETES, signal: AbortSignal.timeout(DELAI_MS), cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 429) console.warn('[bdnb] quota atteint');
    else console.error('[bdnb] réponse', res.status);
    return null;
  }
  return (await res.json()) as T;
}

async function interrogerApi(parcelleId: string): Promise<LectureBdnb> {
  const liens = await lireJson<{ batiment_groupe_id: string }[]>(
    `${BASE}/rel_batiment_groupe_parcelle?parcelle_id=eq.${parcelleId}&select=batiment_groupe_id`,
  );
  if (!liens) return { etat: 'indisponible' };
  const ids = [...new Set(liens.map((l) => l.batiment_groupe_id).filter(Boolean))];
  if (ids.length === 0) return { etat: 'connu', batiment: null };
  const lignes = await lireJson<LigneBdnb[]>(
    `${BASE}/batiment_groupe_complet?batiment_groupe_id=in.(${ids.join(',')})&select=${CHAMPS}`,
  );
  if (!lignes) return { etat: 'indisponible' };
  return { etat: 'connu', batiment: syntheseBdnb(lignes) };
}

/**
 * Résumé BDNB d'une parcelle. `admin` sert uniquement au cache
 * parcelle_batiments (donnée publique, service_role).
 */
export async function lireBatimentsBdnb(admin: SupabaseClient, parcelleId: string): Promise<LectureBdnb> {
  try {
    const enMemoire = memoire.get(parcelleId);
    if (enMemoire && Date.now() - enMemoire.at < TTL_MS) return { etat: 'connu', batiment: enMemoire.batiment };

    const { data: cache } = await admin
      .from('parcelle_batiments')
      .select('donnees, lu_le')
      .eq('parcelle_id', parcelleId)
      .maybeSingle();
    const ligne = cache as { donnees: EnCache | null; lu_le: string } | null;
    // Un résumé d'une version antérieure n'a pas tous les champs : on relit.
    if (ligne?.donnees?.v === VERSION_CACHE && Date.now() - Date.parse(ligne.lu_le) < TTL_MS) {
      memoire.set(parcelleId, { at: Date.parse(ligne.lu_le), batiment: ligne.donnees.batiment });
      return { etat: 'connu', batiment: ligne.donnees.batiment };
    }

    const lecture = await interrogerApi(parcelleId);
    if (lecture.etat === 'connu') {
      memoire.set(parcelleId, { at: Date.now(), batiment: lecture.batiment });
      const donnees: EnCache = { v: VERSION_CACHE, batiment: lecture.batiment };
      const { error } = await admin
        .from('parcelle_batiments')
        .upsert({ parcelle_id: parcelleId, donnees, lu_le: new Date().toISOString() });
      if (error) console.error('[bdnb] cache', error.message);
    }
    return lecture;
  } catch (err) {
    console.error('[bdnb] échec', parcelleId, err instanceof Error ? err.message : err);
    return { etat: 'indisponible' };
  }
}
