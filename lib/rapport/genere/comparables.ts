/**
 * Sélection des ventes DVF pour la page « Ventes comparables ».
 * Uniquement les mutations d'un seul logement (dépendances tolérées).
 * Les prix au m² aberrants (MAD 2,5) sont écartés, comme le moteur.
 */

import { ecartAbsoluMedian, mediane } from '@/lib/estimation/moteur';
import { MOTEUR_CONFIG } from '@/lib/estimation/moteur-config';

export const COMPARABLES_RAYON_M = 500;
export const COMPARABLES_SURFACE_TOLERANCE = 0.25;
export const COMPARABLES_MOIS_COURT = 24;
export const COMPARABLES_MOIS_LONG = 36;
export const COMPARABLES_MIN = 4;
export const COMPARABLES_MAX = 6;

export type MutationBrute = {
  id: string;
  idMutation: string | null;
  dateMutation: string;
  valeurFonciere: number | null;
  surfaceM2: number | null;
  pieces: number | null;
  typeLocal: string | null;
  codePostal: string | null;
  banId: string | null;
  parcelleId: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type VenteComparable = {
  id: string;
  typeLocal: string | null;
  pieces: number | null;
  surfaceM2: number;
  codePostal: string | null;
  prix: number;
  prixM2: number | null;
  date: string;
  distanceM: number | null;
  perimetre: 'rayon' | 'commune';
  horizonMois: 24 | 36;
};

export type CritereComparables = {
  propertyType: 'appartement' | 'maison';
  surfaceM2: number;
  codePostal: string;
  latitude: number;
  longitude: number;
  exclus: readonly string[];
  maintenant?: Date;
};

function estLogement(type: string | null): boolean {
  if (!type) return false;
  return /appart/i.test(type) || /maison/i.test(type);
}

function memeType(type: string | null, attendu: 'appartement' | 'maison'): boolean {
  if (!type) return false;
  return attendu === 'maison' ? /maison/i.test(type) : /appart/i.test(type);
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function moisDepuis(iso: string, maintenant: Date): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (maintenant.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

/** Regroupe les lignes DVF d'une même mutation. Une seule habitation, dépendances OK. */
export function mutationsMonoLogement(rows: readonly MutationBrute[]): MutationBrute[] {
  const groupes = new Map<string, MutationBrute[]>();
  rows.forEach((row, i) => {
    const cle = row.idMutation?.trim() || `seul:${row.id || i}`;
    const list = groupes.get(cle) ?? [];
    list.push(row);
    groupes.set(cle, list);
  });
  const out: MutationBrute[] = [];
  for (const [cle, lignes] of groupes) {
    const logements = lignes.filter((l) => estLogement(l.typeLocal));
    if (logements.length !== 1) continue;
    const principal = logements[0]!;
    out.push({
      ...principal,
      id: cle,
      valeurFonciere: principal.valeurFonciere,
    });
  }
  return out;
}

/** Même règle que le moteur : écarte un €/m² à plus de 2,5 MAD de la médiane. */
export function ecarterComparablesAberrants<T extends { id: string; prixM2: number | null }>(
  ventes: readonly T[],
): { retenues: T[]; exclues: T[] } {
  const avecPrix = ventes.filter((v) => v.prixM2 != null && v.prixM2 > 0);
  const prix = avecPrix.map((v) => v.prixM2!);
  const med = mediane(prix);
  const mad = ecartAbsoluMedian(prix);
  if (med == null || mad == null || mad === 0 || avecPrix.length < 5) {
    return { retenues: [...ventes], exclues: [] };
  }
  const seuil = MOTEUR_CONFIG.MAD_SEUIL * mad;
  const retenues: T[] = [];
  const exclues: T[] = [];
  for (const v of ventes) {
    if (v.prixM2 == null || v.prixM2 <= 0) {
      retenues.push(v);
      continue;
    }
    if (Math.abs(v.prixM2 - med) > seuil) exclues.push(v);
    else retenues.push(v);
  }
  return { retenues, exclues };
}

export function selectionnerComparables(
  rows: readonly MutationBrute[],
  critere: CritereComparables,
): { retenues: VenteComparable[]; reserve: VenteComparable[] } {
  const maintenant = critere.maintenant ?? new Date();
  const minSurf = critere.surfaceM2 * (1 - COMPARABLES_SURFACE_TOLERANCE);
  const maxSurf = critere.surfaceM2 * (1 + COMPARABLES_SURFACE_TOLERANCE);
  const exclus = new Set(critere.exclus);

  const candidates = mutationsMonoLogement(rows)
    .map((row) => {
      const surface = row.surfaceM2;
      const prix = row.valeurFonciere;
      if (surface == null || surface <= 0 || prix == null || prix <= 0) return null;
      if (!memeType(row.typeLocal, critere.propertyType)) return null;
      if (surface < minSurf || surface > maxSurf) return null;
      const mois = moisDepuis(row.dateMutation, maintenant);
      if (mois == null || mois > COMPARABLES_MOIS_LONG) return null;
      const dist =
        row.latitude != null && row.longitude != null
          ? haversineM(critere.latitude, critere.longitude, row.latitude, row.longitude)
          : null;
      const dansRayon = dist != null && dist <= COMPARABLES_RAYON_M;
      const memeCp = (row.codePostal ?? '') === critere.codePostal;
      if (!dansRayon && !memeCp) return null;
      const vente: VenteComparable = {
        id: row.id,
        typeLocal: row.typeLocal,
        pieces: row.pieces,
        surfaceM2: surface,
        codePostal: row.codePostal,
        prix,
        prixM2: Math.round(prix / surface),
        date: row.dateMutation,
        distanceM: dist,
        perimetre: dansRayon ? 'rayon' : 'commune',
        horizonMois: mois <= COMPARABLES_MOIS_COURT ? 24 : 36,
      };
      return vente;
    })
    .filter((v): v is VenteComparable => v != null)
    .sort((a, b) => {
      const da = a.distanceM ?? Number.POSITIVE_INFINITY;
      const db = b.distanceM ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return b.date.localeCompare(a.date);
    });

  function filtrer(horizon: 24 | 36, rayonSeul: boolean): VenteComparable[] {
    return candidates.filter((v) => {
      if (horizon === 24 && v.horizonMois !== 24) return false;
      if (rayonSeul && v.perimetre !== 'rayon') return false;
      return true;
    });
  }

  let pool = filtrer(24, true);
  if (pool.length < COMPARABLES_MIN) pool = filtrer(24, false);
  if (pool.length < COMPARABLES_MIN) pool = filtrer(36, false);
  pool = ecarterComparablesAberrants(pool).retenues;

  const visibles = pool.filter((v) => !exclus.has(v.id));
  const retenues = visibles.slice(0, COMPARABLES_MAX);
  const reserve = pool.filter((v) => exclus.has(v.id));
  return { retenues, reserve };
}
