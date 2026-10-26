import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { numerosDeLaVoie } from '@/lib/geo/ban-voie';
import { pointDansPolygone } from './appartenance';
import { enveloppeDesParcelles } from './enveloppe';
import { bbox, type Bbox } from './geometrie';
import type { PariteVoie, ValeurPolygone } from './types';

/**
 * Les parcelles d'un secteur, côté serveur : contours (table `parcelles_geo`,
 * cadastre Etalab), parcelles d'un tracé ou d'un côté de rue, écriture avec la
 * règle « une parcelle, un seul secteur de l'agence », enveloppe.
 */

export type ParcelleGeo = {
  id: string;
  anneaux: [number, number][][];
  latitude: number;
  longitude: number;
};

type Ligne = { parcelle_id: string; geometrie: unknown; centre_lat: number; centre_lon: number };

const COLONNES = 'parcelle_id, geometrie, centre_lat, centre_lon';
/** Une liste `in.(…)` de 150 identifiants tient dans l'URL de l'API. */
const LOT = 150;
/** Au-delà, un tracé couvre un arrondissement entier : on refuse. */
export const PARCELLES_MAX_PAR_TRACE = 3000;

function versParcelle(l: Ligne): ParcelleGeo | null {
  if (!Array.isArray(l.geometrie) || l.geometrie.length === 0) return null;
  return {
    id: l.parcelle_id,
    anneaux: l.geometrie as [number, number][][],
    latitude: l.centre_lat,
    longitude: l.centre_lon,
  };
}

export function idsPropres(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  const ids = new Set<string>();
  for (const v of brut) {
    const id = typeof v === 'string' ? normalizeParcelleId(v) : null;
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Les contours de parcelles connues, par lots. */
export async function lireGeometries(client: SupabaseClient, ids: readonly string[]): Promise<ParcelleGeo[]> {
  const out: ParcelleGeo[] = [];
  for (let i = 0; i < ids.length; i += LOT) {
    const { data, error } = await client
      .from('parcelles_geo')
      .select(COLONNES)
      .in('parcelle_id', ids.slice(i, i + LOT));
    if (error) throw new Error(error.message);
    for (const l of (data ?? []) as Ligne[]) {
      const p = versParcelle(l);
      if (p) out.push(p);
    }
  }
  return out;
}

/** Les parcelles dont l'emprise touche la boîte, page par page. */
export async function parcellesDansEmprise(
  client: SupabaseClient,
  boite: Bbox,
  max = PARCELLES_MAX_PAR_TRACE,
): Promise<ParcelleGeo[]> {
  const out: ParcelleGeo[] = [];
  const PAGE = 1000;
  for (let debut = 0; debut < max; debut += PAGE) {
    const { data, error } = await client
      .from('parcelles_geo')
      .select(COLONNES)
      .lte('ouest', boite.est)
      .gte('est', boite.ouest)
      .lte('sud', boite.nord)
      .gte('nord', boite.sud)
      .order('parcelle_id')
      .range(debut, Math.min(debut + PAGE, max) - 1);
    if (error) throw new Error(error.message);
    const lignes = (data ?? []) as Ligne[];
    for (const l of lignes) {
      const p = versParcelle(l);
      if (p) out.push(p);
    }
    if (lignes.length < PAGE) break;
  }
  return out;
}

/** Les parcelles dont le centre tombe dans le tracé. */
export async function parcellesDuTrace(client: SupabaseClient, trace: ValeurPolygone): Promise<string[]> {
  const boite = bbox(trace);
  if (!boite) return [];
  const candidates = await parcellesDansEmprise(client, boite);
  return candidates.filter((p) => pointDansPolygone(p, trace)).map((p) => p.id);
}

/** Les parcelles d'une rue, d'un côté ou des deux (numéros de la BAN). */
export async function parcellesDeLaRue(
  voie: { nom: string; codePostal: string },
  parite: PariteVoie,
): Promise<string[]> {
  const numeros = await numerosDeLaVoie(voie);
  const ids = new Set<string>();
  for (const n of numeros) {
    if (parite === 'paires' && n.numero % 2 !== 0) continue;
    if (parite === 'impaires' && n.numero % 2 === 0) continue;
    for (const p of n.parcelles) {
      const id = normalizeParcelleId(p);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/** Recalcule l'enveloppe du secteur à partir de ses parcelles. */
export async function recalculerEnveloppe(client: SupabaseClient, zoneId: string): Promise<void> {
  const ids = await parcellesDuSecteur(client, zoneId);
  const geometries = ids.length > 0 ? await lireGeometries(client, ids) : [];
  const enveloppe = enveloppeDesParcelles(geometries.map((g) => g.anneaux));
  const { error } = await client
    .from('zones')
    .update({ enveloppe: enveloppe.length > 0 ? enveloppe : null })
    .eq('id', zoneId);
  if (error) throw new Error(error.message);
}

export async function parcellesDuSecteur(client: SupabaseClient, zoneId: string): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await client
      .from('zone_parcelles')
      .select('parcelle_id')
      .eq('zone_id', zoneId)
      .order('parcelle_id')
      .range(debut, debut + PAGE - 1);
    if (error) throw new Error(error.message);
    const lignes = (data ?? []) as { parcelle_id: string }[];
    out.push(...lignes.map((l) => l.parcelle_id));
    if (lignes.length < PAGE) return out;
  }
}

export type Refus = { parcelleId: string; zoneId: string };

/** Qui tient déjà ces parcelles dans l'agence. */
async function titulairesDe(
  client: SupabaseClient,
  agencyId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const tenues = new Map<string, string>();
  for (let i = 0; i < ids.length; i += LOT) {
    const { data, error } = await client
      .from('zone_parcelles')
      .select('zone_id, parcelle_id')
      .eq('agency_id', agencyId)
      .in('parcelle_id', ids.slice(i, i + LOT));
    if (error) throw new Error(error.message);
    for (const l of (data ?? []) as { zone_id: string; parcelle_id: string }[]) {
      tenues.set(l.parcelle_id, l.zone_id);
    }
  }
  return tenues;
}

/**
 * Ajoute et retire des parcelles d'un secteur. Une parcelle déjà tenue par un
 * autre secteur de l'agence est refusée, sauf `reprendre` (le directeur la
 * réattribue). La contrainte d'unicité de la base tranche les écritures
 * simultanées : la seconde est refusée, jamais doublée.
 */
export async function ecrireParcelles(
  client: SupabaseClient,
  params: {
    zoneId: string;
    agencyId: string;
    ajouter: readonly string[];
    retirer: readonly string[];
    reprendre?: boolean;
  },
): Promise<{ ajoutees: string[]; retirees: string[]; refusees: Refus[] }> {
  const { zoneId, agencyId } = params;
  const retirer = params.retirer.filter((id) => !params.ajouter.includes(id));

  for (let i = 0; i < retirer.length; i += LOT) {
    const { error } = await client
      .from('zone_parcelles')
      .delete()
      .eq('zone_id', zoneId)
      .in('parcelle_id', retirer.slice(i, i + LOT));
    if (error) throw new Error(error.message);
  }

  const tenues = await titulairesDe(client, agencyId, params.ajouter);
  const refusees: Refus[] = [];
  const libres: string[] = [];
  const reprises: string[] = [];
  for (const id of params.ajouter) {
    const zone = tenues.get(id);
    if (!zone) libres.push(id);
    else if (zone !== zoneId) {
      if (params.reprendre) reprises.push(id);
      else refusees.push({ parcelleId: id, zoneId: zone });
    }
  }

  for (let i = 0; i < reprises.length; i += LOT) {
    const { error } = await client
      .from('zone_parcelles')
      .delete()
      .eq('agency_id', agencyId)
      .in('parcelle_id', reprises.slice(i, i + LOT));
    if (error) throw new Error(error.message);
  }

  const aInserer = [...libres, ...reprises];
  const ajoutees: string[] = [];
  for (let i = 0; i < aInserer.length; i += LOT) {
    const lot = aInserer.slice(i, i + LOT);
    const { data, error } = await client
      .from('zone_parcelles')
      .upsert(
        lot.map((parcelle_id) => ({ zone_id: zoneId, agency_id: agencyId, parcelle_id })),
        { onConflict: 'agency_id,parcelle_id', ignoreDuplicates: true },
      )
      .select('parcelle_id');
    if (error) throw new Error(error.message);
    const inserees = new Set(((data ?? []) as { parcelle_id: string }[]).map((l) => l.parcelle_id));
    for (const id of lot) {
      if (inserees.has(id)) ajoutees.push(id);
    }
  }

  // Prises entre-temps par un collègue : la base les a gardées à lui.
  const perdues = aInserer.filter((id) => !ajoutees.includes(id));
  if (perdues.length > 0) {
    const encore = await titulairesDe(client, agencyId, perdues);
    for (const id of perdues) {
      const zone = encore.get(id);
      if (zone && zone !== zoneId) refusees.push({ parcelleId: id, zoneId: zone });
    }
  }

  if (ajoutees.length > 0 || retirer.length > 0) await recalculerEnveloppe(client, zoneId);
  return { ajoutees, retirees: retirer, refusees };
}
