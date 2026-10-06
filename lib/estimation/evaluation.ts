import {
  assemblerEstimation,
  construireIndice,
  preparerLot,
  type MoteurInput,
  type MoteurResultat,
  type VenteBrute,
} from '@/lib/estimation/moteur';

export type EchantillonEvaluation = {
  id: string;
  zone: string;
  type: 'appartement' | 'maison';
  surfaceM2: number;
  prix: number;
  date: string;
  lat: number;
  lng: number;
  postalCode: string;
};

export type LigneEvaluation = {
  id: string;
  zone: string;
  type: 'appartement' | 'maison';
  prixReel: number;
  estime: number | null;
  erreurAbs: number | null;
  erreurPct: number | null;
  disponible: boolean;
};

export type RapportEvaluation = {
  n: number;
  nEstimes: number;
  medianeAbs: number | null;
  medianePct: number | null;
  part10: number | null;
  part20: number | null;
  parZone: Record<string, { n: number; nEstimes: number; medianePct: number | null; part10: number | null; part20: number | null }>;
  parType: Record<string, { n: number; nEstimes: number; medianePct: number | null; part10: number | null; part20: number | null }>;
};

function mediane(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function synthetiser(lignes: readonly LigneEvaluation[]): RapportEvaluation {
  const ok = lignes.filter((l) => l.erreurPct != null) as Array<LigneEvaluation & { erreurPct: number }>;
  const abs = ok.map((l) => l.erreurAbs!).sort((a, b) => a - b);
  const pct = ok.map((l) => Math.abs(l.erreurPct));
  const recap = (subset: readonly LigneEvaluation[]) => {
    const e = subset.filter((l) => l.erreurPct != null);
    const p = e.map((l) => Math.abs(l.erreurPct!));
    return {
      n: subset.length,
      nEstimes: e.length,
      medianePct: mediane(p),
      part10: p.length ? p.filter((x) => x <= 0.1).length / p.length : null,
      part20: p.length ? p.filter((x) => x <= 0.2).length / p.length : null,
    };
  };
  const parZone: RapportEvaluation['parZone'] = {};
  const parType: RapportEvaluation['parType'] = {};
  for (const l of lignes) {
    parZone[l.zone] = recap(lignes.filter((x) => x.zone === l.zone));
    parType[l.type] = recap(lignes.filter((x) => x.type === l.type));
  }
  return {
    n: lignes.length,
    nEstimes: ok.length,
    medianeAbs: mediane(abs),
    medianePct: mediane(pct),
    part10: pct.length ? pct.filter((x) => x <= 0.1).length / pct.length : null,
    part20: pct.length ? pct.filter((x) => x <= 0.2).length / pct.length : null,
    parZone,
    parType,
  };
}

/**
 * Seuils proposés — à tenir sur le rapport ventes réelles, pas sur un cas isolé.
 * médiane |erreur| ≤ 12 %, ≥ 40 % des biens à ±10 %, ≥ 70 % à ±20 %.
 */
export const SEUILS_ACCEPTABLES = {
  medianePctMax: 0.12,
  part10Min: 0.4,
  part20Min: 0.7,
} as const;

export function seuilsTenus(r: RapportEvaluation): boolean {
  if (r.medianePct == null || r.part10 == null || r.part20 == null) return false;
  return (
    r.medianePct <= SEUILS_ACCEPTABLES.medianePctMax &&
    r.part10 >= SEUILS_ACCEPTABLES.part10Min &&
    r.part20 >= SEUILS_ACCEPTABLES.part20Min
  );
}

function inputDepuis(e: EchantillonEvaluation): MoteurInput {
  return {
    surfaceM2: e.surfaceM2,
    propertyType: e.type,
    floor: null,
    hasElevator: null,
    dernierEtage: null,
    conditionRating: null,
    dpeClass: null,
    balconTerrasse: false,
    piscine: false,
    annexes: [],
    terrainM2: null,
  };
}

function venteDepuis(e: EchantillonEvaluation): VenteBrute {
  return {
    id: e.id,
    idMutation: e.id,
    dateMutation: e.date,
    valeurFonciere: e.prix,
    surfaceM2: e.surfaceM2,
    prixM2: e.surfaceM2 > 0 ? e.prix / e.surfaceM2 : null,
    typeLocal: e.type === 'maison' ? 'Maison' : 'Appartement',
    natureMutation: 'Vente',
    banId: e.id,
    parcelleId: e.id,
    lat: e.lat,
    lng: e.lng,
    adresse: `${e.zone} ${e.postalCode}`,
    codePostal: e.postalCode,
    surfaceTerrain: null,
  };
}

export function estimerSansSoi(
  cible: EchantillonEvaluation,
  voisines: readonly EchantillonEvaluation[],
): MoteurResultat {
  const input = inputDepuis(cible);
  const brutes = voisines.filter((v) => v.id !== cible.id).map(venteDepuis);
  const indice = construireIndice(brutes, new Date(cible.date));
  const lot = preparerLot(
    brutes.filter((v) => v.surfaceM2 != null && v.valeurFonciere != null && v.valeurFonciere > 0),
    input,
    { lat: cible.lat, lng: cible.lng, banId: cible.id, parcelleId: cible.id, voie: null },
    indice,
    new Date(cible.date),
  );
  return assemblerEstimation({
    input,
    lot,
    indice,
    radiusM: 1000,
    fenetreMois: 36,
    exclues: [],
    maintenant: new Date(cible.date),
  });
}

export function evaluerEchantillon(echantillon: readonly EchantillonEvaluation[]): LigneEvaluation[] {
  return echantillon.map((cible) => {
    const r = estimerSansSoi(cible, echantillon);
    const estime = r.available ? r.value : null;
    const erreurAbs = estime != null ? Math.abs(estime - cible.prix) : null;
    const erreurPct = estime != null && cible.prix > 0 ? (estime - cible.prix) / cible.prix : null;
    return {
      id: cible.id,
      zone: cible.zone,
      type: cible.type,
      prixReel: cible.prix,
      estime,
      erreurAbs,
      erreurPct,
      disponible: r.available,
    };
  });
}
