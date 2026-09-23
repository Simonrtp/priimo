/**
 * Collecte DVF : cercles concentriques, puis le code postal.
 * Arrêt dès 8 ventes exploitables après nettoyage.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { MOTEUR_CONFIG } from '@/lib/estimation/moteur-config';
import {
  haversineM,
  nettoyerVentes,
  type VenteBrute,
  type VenteExclue,
} from '@/lib/estimation/moteur';

type Db = SupabaseClient<Database>;

type TxRow = {
  id: string;
  id_mutation: string | null;
  ban_id: string | null;
  parcelle_id: string | null;
  date_mutation: string;
  valeur_fonciere: number | null;
  surface_reelle_bati: number | null;
  prix_m2: number | null;
  type_local: string | null;
  code_postal: string | null;
  nature_mutation?: string | null;
};

type BuildingRow = {
  ban_id: string;
  parcelle_id: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
};

function depuis(mois: number, maintenant = new Date()): string {
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d.toISOString().slice(0, 10);
}

function mapVente(
  row: TxRow,
  building: BuildingRow | undefined,
): VenteBrute {
  return {
    id: row.id,
    idMutation: row.id_mutation,
    dateMutation: row.date_mutation,
    valeurFonciere: row.valeur_fonciere,
    surfaceM2: row.surface_reelle_bati,
    prixM2: row.prix_m2,
    typeLocal: row.type_local,
    natureMutation: row.nature_mutation ?? null,
    banId: row.ban_id,
    parcelleId: row.parcelle_id,
    lat: building?.lat ?? null,
    lng: building?.lng ?? null,
    adresse: building?.adresse ?? null,
    codePostal: row.code_postal,
    surfaceTerrain: null,
  };
}

async function chargerImmeubles(admin: Db, banIds: string[]): Promise<Map<string, BuildingRow>> {
  const map = new Map<string, BuildingRow>();
  const unique = [...new Set(banIds.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 200) {
    const slice = unique.slice(i, i + 200);
    const { data, error } = await admin
      .from('buildings')
      .select('ban_id, parcelle_id, adresse, lat, lng')
      .in('ban_id', slice);
    if (error) {
      console.error('[moteur] buildings', error.message);
      continue;
    }
    for (const b of (data ?? []) as unknown as BuildingRow[]) {
      if (!map.has(b.ban_id)) map.set(b.ban_id, b);
    }
  }
  return map;
}

const COLS =
  'id, id_mutation, ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2, type_local, code_postal';
const COLS_NATURE = `${COLS}, nature_mutation`;

/** Paris / Lyon / Marseille : le CP est l’arrondissement, la commune est l’ensemble. */
export function cpsCommune(cp: string): string[] {
  if (/^750\d{2}$/.test(cp)) {
    return Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, '0')}`);
  }
  if (/^6900[1-9]$/.test(cp)) {
    return Array.from({ length: 9 }, (_, i) => `6900${i + 1}`);
  }
  if (/^130(0[1-9]|1[0-6])$/.test(cp)) {
    return Array.from({ length: 16 }, (_, i) => `130${String(i + 1).padStart(2, '0')}`);
  }
  return [cp];
}

async function chargerTransactionsCp(
  admin: Db,
  postalCode: string,
  depuisIso: string,
  avantIso: string | null,
): Promise<TxRow[]> {
  let q = admin
    .from('building_transactions')
    .select(COLS_NATURE)
    .eq('code_postal', postalCode)
    .gte('date_mutation', depuisIso)
    .order('date_mutation', { ascending: false })
    .limit(2500);
  if (avantIso) q = q.lt('date_mutation', avantIso);
  let { data, error } = await q;
  if (error && /nature_mutation/.test(error.message)) {
    let repli = admin
      .from('building_transactions')
      .select(COLS)
      .eq('code_postal', postalCode)
      .gte('date_mutation', depuisIso)
      .order('date_mutation', { ascending: false })
      .limit(2500);
    if (avantIso) repli = repli.lt('date_mutation', avantIso);
    const second = await repli;
    data = second.data;
    error = second.error;
  }
  if (error) {
    console.error('[moteur] building_transactions', error.message);
    return [];
  }
  return (data ?? []) as unknown as TxRow[];
}

async function chargerTransactions(
  admin: Db,
  postalCode: string,
  depuisIso: string,
  avantIso: string | null,
): Promise<TxRow[]> {
  return chargerTransactionsCp(admin, postalCode, depuisIso, avantIso);
}

export async function chargerVentesIndiceCommune(
  admin: Db,
  postalCode: string,
  depuisIso: string,
  avantIso: string | null,
): Promise<VenteBrute[]> {
  const cps = cpsCommune(postalCode).filter((c) => c !== postalCode);
  const rows: TxRow[] = [];
  for (const cp of cps) {
    rows.push(...(await chargerTransactionsCp(admin, cp, depuisIso, avantIso)));
  }
  return rows.map((r) => mapVente(r, undefined));
}

export type CollecteOpts = {
  avant?: string | null;
  excludeMutationId?: string | null;
  exclusIds?: readonly string[];
  maintenant?: Date;
};

export type CollecteResultat = {
  candidates: VenteBrute[];
  exclues: VenteExclue[];
  toutes: VenteBrute[];
  radiusM: number | null;
  fenetreMois: number | null;
  indicePool: VenteBrute[];
};

export async function collecterVentesComparables(
  admin: Db,
  input: {
    latitude: number;
    longitude: number;
    postalCode: string;
    propertyType: 'appartement' | 'maison';
    banId: string | null;
    parcelleId: string | null;
  },
  opts: CollecteOpts = {},
): Promise<CollecteResultat> {
  const maintenant = opts.maintenant ?? new Date();
  const cercles =
    input.propertyType === 'maison' ? MOTEUR_CONFIG.CERCLES_MAISON_M : MOTEUR_CONFIG.CERCLES_M;
  const vide: CollecteResultat = {
    candidates: [],
    exclues: [],
    toutes: [],
    radiusM: null,
    fenetreMois: null,
    indicePool: [],
  };

  let indicePool: VenteBrute[] = [];
  let lastExclues: VenteExclue[] = [];
  let toutes: VenteBrute[] = [];

  for (const mois of MOTEUR_CONFIG.FENETRES_MOIS) {
    const rows = await chargerTransactions(admin, input.postalCode, depuis(mois, maintenant), opts.avant ?? null);
    const immeubles = await chargerImmeubles(
      admin,
      rows.map((r) => r.ban_id).filter((id): id is string => Boolean(id)),
    );
    const mapped = rows.map((r) => mapVente(r, r.ban_id ? immeubles.get(r.ban_id) : undefined));
    toutes = mapped;
    if (indicePool.length < mapped.length) indicePool = mapped;

    const dansCercle = (rayon: number | null) =>
      mapped.filter((v) => {
        if (rayon == null) return true;
        if (v.lat == null || v.lng == null) return false;
        return haversineM(input.latitude, input.longitude, v.lat, v.lng) <= rayon;
      });

    for (const rayon of [...cercles, null] as Array<number | null>) {
      const pool = dansCercle(rayon);
      const { candidates, exclues } = nettoyerVentes(pool, input.propertyType, {
        exclusIds: opts.exclusIds,
        excludeMutationId: opts.excludeMutationId,
        avant: opts.avant,
      });
      lastExclues = exclues;
      if (candidates.length >= MOTEUR_CONFIG.CIBLE_VENTES) {
        return {
          candidates,
          exclues,
          toutes: pool,
          radiusM: rayon,
          fenetreMois: mois,
          indicePool,
        };
      }
      if (candidates.length >= MOTEUR_CONFIG.MIN_VENTES && rayon == null && mois === 60) {
        return {
          candidates,
          exclues,
          toutes: pool,
          radiusM: rayon,
          fenetreMois: mois,
          indicePool,
        };
      }
    }
  }

  const { candidates, exclues } = nettoyerVentes(toutes, input.propertyType, {
    exclusIds: opts.exclusIds,
    excludeMutationId: opts.excludeMutationId,
    avant: opts.avant,
  });
  if (candidates.length >= MOTEUR_CONFIG.MIN_VENTES) {
    return {
      candidates,
      exclues,
      toutes,
      radiusM: null,
      fenetreMois: 60,
      indicePool: indicePool.length > 0 ? indicePool : toutes,
    };
  }
  return { ...vide, exclues: exclues.length > 0 ? exclues : lastExclues, toutes, indicePool };
}
