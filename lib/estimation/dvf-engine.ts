/**
 * Moteur d'estimation DVF.
 * Chaque étape renvoyée correspond à un vrai comptage / vrai traitement.
 * Coefficients partagés avec lib/estimation.ts (funnel public).
 *
 * Le moteur sert deux appelants : le dashboard (agence connectée) et le widget
 * public embarqué sur le site d'une agence. Quand `agencyId` est null, aucune
 * donnée interne d'agence n'est lue ni renvoyée.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  CONFIG_ESTIMATION,
  computeEstimation,
  getReferencePricePerM2,
  type EstimationFeatureKey,
  type EstimationPropertyType,
} from '@/lib/estimation';
import { parseDpeLetter } from '@/lib/carte/dpe-public';
import { formatPeriodeConstruction } from '@/lib/queries/parcelle';
import type { EstimationSourceId } from '@/lib/estimation/sources';
import {
  extrasCoefficients,
  extrasTotalPct,
  type EstimationExtras,
} from '@/lib/estimation/extras';
import {
  buildCorrectionLines,
  type CorrectionLine,
} from '@/lib/estimation/corrections';

type Db = SupabaseClient<Database>;

export const RADIUS_M = 200;
/** ~1° lat ≈ 111 km ; approx longitude à 48°N. */
const LAT_DELTA = RADIUS_M / 111_320;
const LNG_DELTA_AT_48 = RADIUS_M / (111_320 * Math.cos((48.85 * Math.PI) / 180));

/** Au-delà de ce rapport (écart interquartile / médiane), la fourchette ment. */
const DISPERSION_THRESHOLD = 0.35;
/** En dessous de ce nombre de comparables, la dispersion n'est pas mesurable. */
const DISPERSION_MIN_SAMPLE = 6;

export type DvfEngineOptions = {
  /**
   * Mode `--sans-bienici` : n'interroge pas le marché Bien'ici.
   * Défaut true — Bien'ici n'est pas branché ; le badge n'apparaît que si interrogé.
   */
  sansBienici?: boolean;
};

export type DvfEngineInput = {
  address: string;
  postalCode: string;
  city: string | null;
  banId: string | null;
  latitude: number;
  longitude: number;
  propertyType: EstimationPropertyType;
  surfaceM2: number;
  rooms: number;
  /** null = « je ne sais pas » — non pénalisant. */
  floor: string | null;
  /** Ascenseur — pertinent pour un appartement. null = non renseigné. */
  hasElevator: boolean | null;
  /** 1 mauvais … 4 excellent. */
  conditionRating: 1 | 2 | 3 | 4 | null;
  dpeClass: string | null;
  features: EstimationFeatureKey[];
  /**
   * Critères complémentaires du parcours agent. Facultatifs : le widget public
   * et le funnel priimo.fr ne les collectent pas.
   */
  extras?: EstimationExtras | null;
};

export type EstimationStep = {
  id: string;
  label: string;
  detail?: string;
};

export type ComparableSale = {
  date: string;
  surfaceM2: number | null;
  price: number | null;
  pricePerM2: number | null;
  pricePerM2Adjusted: number | null;
  /** Voie anonymisée pour la page publique (pas de n°). */
  voie: string | null;
  sameBuilding: boolean;
};

/** Un mandat de l'agence, pour le repli dépliable du dashboard. */
export type BienEnVente = {
  id: string;
  address: string;
  price: number | null;
  surfaceM2: number | null;
  rooms: number | null;
};

export type DpeRepartitionEntry = { letter: string; count: number };

export type DvfEngineContext = {
  immeubleVentes: number;
  quartierVentes: number;
  outliersExcluded: number;
  coproLots: number | null;
  coproPeriode: string | null;
  dpeKnown: string | null;
  /** D'où vient l'étiquette retenue : déclarée par la personne, ou base ADEME. */
  dpeSource: 'declare' | 'ademe' | null;
  /** Étiquettes relevées dans l'immeuble (base ADEME). */
  dpeRepartition: DpeRepartitionEntry[];
  biensEnVenteSecteur: number;
  /** Détail des mandats — jamais renseigné quand agencyId est null. */
  biensEnVenteDetail: BienEnVente[];
  negociacionMedianePct: number | null;
  /** Rayon réellement retenu autour de l'adresse. */
  radiusM: number;
  /** « 2e trimestre 2026 » — période de la vente comparable la plus récente. */
  trimestreLabel: string | null;
  /** Les comparables sont trop hétérogènes pour resserrer une fourchette. */
  dispersionElevee: boolean;
  dispersionRatio: number | null;
  /** Sources réellement mobilisées — persistées avec le résultat. */
  sources: EstimationSourceId[];
  /**
   * Niveau de dégradation du calcul :
   * - null : DVF local exploitable
   * - referentiel_cp : repli sur le prix médian du code postal
   * - dispersion : ventes trop hétérogènes, fourchette élargie ou absente
   */
  degradation: 'referentiel_cp' | 'dispersion' | null;
  /** Message court, sans dramatiser, expliquant le socle du chiffre. */
  degradationLabel: string | null;
  /** Code métier pour l’UI — jamais d’erreur technique brute. */
  degradationCode: 'secteur_non_couvert' | null;
};

export type DvfEngineResult = {
  available: boolean;
  /** Valeur centrale retenue — l'information principale de l'écran de résultat. */
  value: number | null;
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  reliability: number;
  reliabilityLabel: string;
  steps: EstimationStep[];
  comparables: ComparableSale[];
  context: DvfEngineContext;
  /** Même liste que `context.sources` — pratique côté front / JSON. */
  sources: EstimationSourceId[];
  parcelleId: string | null;
  /** Détail ligne à ligne du calcul (base + coefficients en euros). */
  corrections: CorrectionLine[];
};

type TxRow = {
  ban_id: string | null;
  parcelle_id: string | null;
  date_mutation: string;
  valeur_fonciere: number | null;
  surface_reelle_bati: number | null;
  prix_m2: number | null;
  type_local: string | null;
};

type BuildingRow = {
  ban_id: string;
  parcelle_id: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function voieFromAdresse(adresse: string | null): string | null {
  if (!adresse?.trim()) return null;
  // Retire le numéro en tête : "12 Rue des Maraîchers 75020 Paris" → "Rue des Maraîchers"
  const withoutNum = adresse.trim().replace(/^\d+\s*(bis|ter|quater)?\s*/i, '');
  const beforeCp = withoutNum.replace(/\s+\d{5}\b.*$/, '').trim();
  return beforeCp || withoutNum;
}

function mapConditionToCoeff(rating: 1 | 2 | 3 | 4 | null): number {
  if (rating == null) return 0;
  // Funnel public : 1–5. Dashboard : 1–4 (mauvais → excellent).
  const mapped = { 1: 1, 2: 2, 3: 3, 4: 5 }[rating];
  return CONFIG_ESTIMATION.CONDITION[mapped] ?? 0;
}

function dpeCoeff(dpe: string | null): number {
  if (!dpe || dpe === 'inconnu') return 0;
  return CONFIG_ESTIMATION.DPE[dpe.toUpperCase()] ?? 0;
}

function floorCoeff(
  propertyType: EstimationPropertyType,
  floor: string | null,
  hasElevator: boolean | null,
): number {
  if (propertyType !== 'appartement' || floor == null) return 0;
  const raw = floor.trim();
  let level: number | null = null;
  if (/^rdc$/i.test(raw) || raw === '0') level = 0;
  else {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) level = n;
  }
  if (level == null) return 0;

  let coeff = 0;
  if (level === 0) coeff += CONFIG_ESTIMATION.FLOOR.RDC_PCT;
  else if (level > 2) {
    const bonus = (level - 2) * CONFIG_ESTIMATION.FLOOR.ABOVE_2_PER_FLOOR_PCT;
    coeff += Math.min(bonus, CONFIG_ESTIMATION.FLOOR.ABOVE_2_CAP_PCT);
  }
  if (level > 3 && hasElevator === false) {
    coeff += CONFIG_ESTIMATION.FLOOR.NO_ELEVATOR_ABOVE_3_PCT;
  }
  return coeff;
}

function featuresCoeff(features: EstimationFeatureKey[]): number {
  let coeff = 0;
  if (features.includes('balcon_terrasse')) coeff += CONFIG_ESTIMATION.FEATURES.balcon_terrasse;
  if (features.includes('parking')) coeff += CONFIG_ESTIMATION.FEATURES.parking;
  if (features.includes('cave')) coeff += CONFIG_ESTIMATION.FEATURES.cave;
  return coeff;
}

/** Actualisation simple : ventes > 24 mois ramenées vers le médian des 24 derniers mois du lot. */
function adjustPrixM2(
  prixM2: number,
  dateIso: string,
  recentMedian: number | null,
): number {
  if (recentMedian == null || recentMedian <= 0) return prixM2;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return prixM2;
  const ageYears = (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
  if (ageYears <= 2) return prixM2;
  // Blend vers le médian récent (poids croissant avec l'âge, plafonné).
  const w = Math.min(0.55, (ageYears - 2) * 0.12);
  return Math.round(prixM2 * (1 - w) + recentMedian * w);
}

function excludeOutliers(rows: { prixM2: number }[]): {
  kept: typeof rows;
  excluded: number;
} {
  if (rows.length < 5) return { kept: rows, excluded: 0 };
  const sorted = [...rows].sort((a, b) => a.prixM2 - b.prixM2);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!.prixM2;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!.prixM2;
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const kept = rows.filter((r) => r.prixM2 >= low && r.prixM2 <= high);
  return { kept, excluded: rows.length - kept.length };
}

/**
 * Écart interquartile rapporté à la médiane. Au-delà du seuil, les biens du
 * secteur ne se ressemblent pas assez : une fourchette resserrée serait un
 * chiffre inventé.
 */
export function dispersionRatio(values: readonly number[]): number | null {
  if (values.length < DISPERSION_MIN_SAMPLE) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)]!;
  const q3 = sorted[Math.floor(sorted.length * 0.75)]!;
  const median = sorted[Math.floor(sorted.length / 2)]!;
  if (median <= 0) return null;
  return (q3 - q1) / median;
}

export function isDispersionElevee(ratio: number | null): boolean {
  return ratio != null && ratio > DISPERSION_THRESHOLD;
}

/** « 2e trimestre 2026 » à partir d'une date de mutation. */
export function trimestreLabel(dateIso: string | null): string | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  const ordinal = q === 1 ? '1er' : `${q}e`;
  return `${ordinal} trimestre ${d.getUTCFullYear()}`;
}

function reliabilityScore(args: {
  immeuble: number;
  quartier: number;
  surfaceOk: boolean;
}): { score: number; label: string } {
  let score = 15;
  score += Math.min(args.immeuble * 12, 36);
  score += Math.min(args.quartier * 2, 36);
  if (args.surfaceOk) score += 8;
  score = Math.max(0, Math.min(100, score));

  // Le libellé dit ce dont on dispose, jamais ce qui manque : le niveau de
  // fiabilité s'affiche à part, en pastille.
  if (score >= 70) return { score, label: 'Fiabilité élevée' };
  if (score >= 40) return { score, label: 'Fiabilité correcte' };
  return { score, label: 'Fiabilité limitée' };
}

/** Phrase de synthèse : ce que l'on a réuni, avec sa période de référence. */
export function comparablesSentence(args: {
  quartier: number;
  radiusM: number;
  trimestre: string | null;
}): string {
  if (args.quartier === 0) return 'Aucune vente comparable exploitable à proximité.';
  const ventes = `${args.quartier} vente${args.quartier > 1 ? 's' : ''} comparable${args.quartier > 1 ? 's' : ''}`;
  const rayon = `dans un rayon de ${args.radiusM} m`;
  return args.trimestre
    ? `${ventes} ${rayon}, réactualisées au ${args.trimestre}`
    : `${ventes} ${rayon}`;
}

export type StepEmitter = (step: EstimationStep) => void | Promise<void>;

/* -------------------------------------------------------------------------- */
/* Résolution de l'immeuble et de la parcelle                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rattache l'adresse à un immeuble puis à une parcelle.
 *
 * Trois chemins, du plus sûr au plus tolérant : l'identifiant BAN, la table de
 * pivot parcelle_adresses (qui connaît des rattachements que `buildings` n'a
 * pas toujours), puis la proximité géographique. Sans ce repli, le cadastre et
 * le RNC ne remontaient jamais pour les adresses dont la ligne `buildings`
 * était incomplète.
 */
export async function resolveBuilding(
  admin: Db,
  input: { banId: string | null; latitude: number; longitude: number; postalCode: string },
): Promise<{ banId: string | null; parcelleId: string | null; building: BuildingRow | null }> {
  let building: BuildingRow | null = null;

  if (input.banId) {
    const { data } = await admin
      .from('buildings')
      .select('ban_id, parcelle_id, adresse, lat, lng')
      .eq('ban_id', input.banId)
      .limit(1)
      .maybeSingle();
    building = (data as BuildingRow | null) ?? null;
  }

  // Repli géographique : l'adresse saisie n'a pas d'identifiant BAN connu de
  // notre base, mais l'immeuble y est peut-être sous un autre identifiant.
  if (!building && Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    const { data } = await admin
      .from('buildings')
      .select('ban_id, parcelle_id, adresse, lat, lng')
      .eq('code_postal', input.postalCode)
      .gte('lat', input.latitude - 30 / 111_320)
      .lte('lat', input.latitude + 30 / 111_320)
      .gte('lng', input.longitude - 30 / (111_320 * Math.cos((48.85 * Math.PI) / 180)))
      .lte('lng', input.longitude + 30 / (111_320 * Math.cos((48.85 * Math.PI) / 180)))
      .limit(5);
    const rows = ((data ?? []) as unknown as BuildingRow[]).filter(
      (b) => b.lat != null && b.lng != null,
    );
    rows.sort(
      (a, b) =>
        haversineM(input.latitude, input.longitude, a.lat!, a.lng!) -
        haversineM(input.latitude, input.longitude, b.lat!, b.lng!),
    );
    building = rows[0] ?? null;
  }

  const banId = building?.ban_id ?? input.banId;
  let parcelleId = building?.parcelle_id ?? null;

  // La table de pivot connaît des rattachements que `buildings` n'a pas.
  if (!parcelleId && banId) {
    const { data } = await admin
      .from('parcelle_adresses')
      .select('parcelle_id')
      .eq('ban_id', banId)
      .limit(1)
      .maybeSingle();
    parcelleId = data?.parcelle_id ?? null;
  }

  return { banId, parcelleId, building };
}

/** Étiquettes DPE relevées dans l'immeuble (ADEME), de la plus fréquente à la plus rare. */
export async function fetchDpeImmeuble(
  admin: Db,
  banId: string | null,
): Promise<{ repartition: DpeRepartitionEntry[]; derniere: string | null }> {
  if (!banId) return { repartition: [], derniere: null };

  const { data } = await admin
    .from('building_dpe')
    .select('etiquette_dpe, date_dpe')
    .eq('ban_id', banId)
    .order('date_dpe', { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const counts = new Map<string, number>();
  let derniere: string | null = null;
  for (const row of rows) {
    const letter = parseDpeLetter(row.etiquette_dpe);
    if (!letter) continue;
    if (!derniere) derniere = letter;
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }

  const repartition = [...counts.entries()]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => (b.count - a.count) || a.letter.localeCompare(b.letter));

  return { repartition, derniere };
}

/* -------------------------------------------------------------------------- */
/* Calcul                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Calcule l'avis à partir du DVF / buildings. Émet des étapes au fur et à mesure.
 * `agencyId` null = contexte public : aucune donnée d'agence n'est lue.
 */
export async function runDvfEstimation(
  admin: Db,
  input: DvfEngineInput,
  agencyId: string | null,
  onStep: StepEmitter,
  options: DvfEngineOptions = {},
): Promise<DvfEngineResult> {
  const sansBienici = options.sansBienici !== false;
  const steps: EstimationStep[] = [];
  async function emit(step: EstimationStep) {
    steps.push(step);
    await onStep(step);
  }

  const { banId, parcelleId, building } = await resolveBuilding(admin, {
    banId: input.banId,
    latitude: input.latitude,
    longitude: input.longitude,
    postalCode: input.postalCode,
  });

  await emit({
    id: 'search_immeuble',
    label: `Recherche des ventes enregistrées au ${input.address}`,
  });

  // Ventes même immeuble / parcelle
  let immeubleTx: TxRow[] = [];
  if (banId || parcelleId) {
    let q = admin
      .from('building_transactions')
      .select(
        'ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2, type_local',
      )
      .order('date_mutation', { ascending: false })
      .limit(80);
    if (parcelleId) q = q.eq('parcelle_id', parcelleId);
    else if (banId) q = q.eq('ban_id', banId);
    const { data } = await q;
    immeubleTx = (data ?? []) as unknown as TxRow[];
  }

  await emit({
    id: 'immeuble_count',
    label:
      immeubleTx.length === 0
        ? 'Élargissement au quartier : aucune vente enregistrée dans cet immeuble'
        : `${immeubleTx.length} vente${immeubleTx.length > 1 ? 's' : ''} trouvée${immeubleTx.length > 1 ? 's' : ''} dans l’immeuble`,
    detail: immeubleTx.length > 0 ? `${immeubleTx.length} mutations` : undefined,
  });

  await emit({
    id: 'expand_quartier',
    label: `Relevé des ventes dans un rayon de ${RADIUS_M} m`,
  });

  const lat = input.latitude;
  const lng = input.longitude;
  const { data: nearBuildings } = await admin
    .from('buildings')
    .select('ban_id, parcelle_id, adresse, lat, lng')
    .eq('code_postal', input.postalCode)
    .gte('lat', lat - LAT_DELTA)
    .lte('lat', lat + LAT_DELTA)
    .gte('lng', lng - LNG_DELTA_AT_48)
    .lte('lng', lng + LNG_DELTA_AT_48)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(400);

  const near = ((nearBuildings ?? []) as unknown as BuildingRow[]).filter((b) => {
    if (b.lat == null || b.lng == null) return false;
    return haversineM(lat, lng, b.lat, b.lng) <= RADIUS_M;
  });

  const nearBanIds = [...new Set(near.map((b) => b.ban_id))];
  const nearParcelleIds = [...new Set(near.map((b) => b.parcelle_id).filter(Boolean))] as string[];

  let quartierTx: TxRow[] = [];
  if (nearParcelleIds.length > 0) {
    const { data } = await admin
      .from('building_transactions')
      .select(
        'ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2, type_local',
      )
      .in('parcelle_id', nearParcelleIds.slice(0, 200))
      .order('date_mutation', { ascending: false })
      .limit(400);
    quartierTx = (data ?? []) as unknown as TxRow[];
  } else if (nearBanIds.length > 0) {
    const { data } = await admin
      .from('building_transactions')
      .select(
        'ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2, type_local',
      )
      .in('ban_id', nearBanIds.slice(0, 200))
      .order('date_mutation', { ascending: false })
      .limit(400);
    quartierTx = (data ?? []) as unknown as TxRow[];
  }

  // Type de local cohérent
  const typeFilter =
    input.propertyType === 'maison'
      ? (t: string | null) => /maison/i.test(t ?? '')
      : (t: string | null) => !t || /appart/i.test(t) || /local/i.test(t) === false;

  const filteredQuartier = quartierTx.filter((t) => typeFilter(t.type_local));

  await emit({
    id: 'quartier_count',
    label: `${filteredQuartier.length} mutation${filteredQuartier.length > 1 ? 's' : ''} retenue${filteredQuartier.length > 1 ? 's' : ''} dans un rayon de ${RADIUS_M} m`,
  });

  // Prix au m² exploitables
  type Priced = {
    row: TxRow;
    prixM2: number;
    sameBuilding: boolean;
    adresse: string | null;
  };

  const adresseByBan = new Map(near.map((b) => [b.ban_id, b.adresse]));
  if (building) adresseByBan.set(building.ban_id, building.adresse);

  const priced: Priced[] = [];
  for (const row of filteredQuartier) {
    const surface = num(row.surface_reelle_bati);
    const prix = num(row.valeur_fonciere);
    let pm2 = num(row.prix_m2);
    if (pm2 == null && surface && surface > 0 && prix && prix > 0) {
      pm2 = Math.round(prix / surface);
    }
    if (pm2 == null || pm2 < 500 || pm2 > 50_000) continue;
    const sameBuilding =
      (banId != null && row.ban_id === banId) ||
      (parcelleId != null && row.parcelle_id === parcelleId);
    priced.push({
      row,
      prixM2: pm2,
      sameBuilding,
      adresse: row.ban_id ? adresseByBan.get(row.ban_id) ?? null : null,
    });
  }

  // Médiane récente (24 mois) pour actualisation
  const cutoff24 = Date.now() - 24 * 30.44 * 24 * 3600 * 1000;
  const recentPm2 = priced
    .filter((p) => Date.parse(p.row.date_mutation) >= cutoff24)
    .map((p) => p.prixM2)
    .sort((a, b) => a - b);
  const recentMedian =
    recentPm2.length > 0 ? recentPm2[Math.floor(recentPm2.length / 2)]! : null;

  if (priced.length > 0) {
    const trimestre =
      recentMedian != null
        ? `médiane récente du secteur ${Math.round(recentMedian).toLocaleString('fr-FR')} €/m²`
        : 'échantillon local';
    await emit({
      id: 'actualisation',
      label: `Actualisation des prix selon l’évolution constatée dans le secteur (${trimestre})`,
    });
  }

  const adjusted = priced.map((p) => ({
    ...p,
    prixM2Adj: adjustPrixM2(p.prixM2, p.row.date_mutation, recentMedian),
  }));

  const { kept, excluded } = excludeOutliers(adjusted.map((p) => ({ prixM2: p.prixM2Adj })));
  const finalRows =
    excluded === 0
      ? adjusted
      : adjusted.filter((p) => {
          if (kept.length === 0) return true;
          const vals = kept.map((k) => k.prixM2).sort((a, b) => a - b);
          const lo = vals[0]!;
          const hi = vals[vals.length - 1]!;
          return p.prixM2Adj >= lo && p.prixM2Adj <= hi;
        });

  if (excluded > 0) {
    await emit({
      id: 'outliers',
      label: `${excluded} vente${excluded > 1 ? 's' : ''} écartée${excluded > 1 ? 's' : ''} : prix aberrants`,
    });
  }

  // Copropriété — registre national (RNC)
  let coproLots: number | null = null;
  let coproPeriode: string | null = null;
  if (banId) {
    const { data: copro } = await admin
      .from('building_copro')
      .select('nombre_lots, periode_construction')
      .eq('ban_id', banId)
      .order('date_maj', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (copro) {
      coproLots = copro.nombre_lots ?? null;
      coproPeriode = formatPeriodeConstruction(copro.periode_construction);
      if (coproLots != null || coproPeriode) {
        await emit({
          id: 'copro',
          label: `Copropriété identifiée au registre national : ${coproLots ?? 'lots inconnus'}${coproLots != null ? ' lots' : ''}${coproPeriode ? `, construite ${coproPeriode.toLowerCase()}` : ''}`,
        });
      }
    }
  }

  if (parcelleId) {
    await emit({
      id: 'cadastre',
      label: 'Parcelle cadastrale rattachée : les ventes de la parcelle sont retenues en priorité',
    });
  }

  // DPE — la source ADEME n'est revendiquée que si un diagnostic a réellement
  // été lu. Une étiquette saisie par le visiteur n'est pas une donnée ADEME.
  const declaredDpe = parseDpeLetter(input.dpeClass);
  const { repartition: dpeRepartition, derniere: dpeAdeme } = await fetchDpeImmeuble(admin, banId);

  let dpeFromAdeme = dpeAdeme != null;
  if (!dpeFromAdeme && banId) {
    const { data: act } = await admin
      .from('building_activity')
      .select('etiquette_dpe')
      .eq('ban_id', banId)
      .maybeSingle();
    if (parseDpeLetter(act?.etiquette_dpe ?? null)) dpeFromAdeme = true;
  }

  const dpeKnown = declaredDpe ?? dpeAdeme ?? null;
  const dpeSource: 'declare' | 'ademe' | null = declaredDpe
    ? 'declare'
    : dpeAdeme
      ? 'ademe'
      : null;

  if (dpeRepartition.length > 0) {
    const total = dpeRepartition.reduce((sum, e) => sum + e.count, 0);
    await emit({
      id: 'dpe',
      label: `${total} diagnostic${total > 1 ? 's' : ''} énergétique${total > 1 ? 's' : ''} relevé${total > 1 ? 's' : ''} dans l’immeuble (base ADEME)`,
    });
  }

  // Biens en vente dans le secteur — donnée interne d'agence.
  // Jamais interrogée en contexte public (agencyId null).
  let biensEnVente = 0;
  let biensEnVenteDetail: BienEnVente[] = [];
  if (agencyId && input.postalCode) {
    const { data: biens } = await admin
      .from('biens')
      .select('id, address, price, surface_m2, rooms')
      .eq('agency_id', agencyId)
      .eq('postal_code', input.postalCode)
      .in('mandat_statut', ['mandat_simple', 'mandat_exclusif'])
      .order('created_at', { ascending: false })
      .limit(50);
    biensEnVenteDetail = (biens ?? []).map((b) => ({
      id: b.id as string,
      address: (b.address as string) ?? '',
      price: (b.price as number | null) ?? null,
      surfaceM2: (b.surface_m2 as number | null) ?? null,
      rooms: (b.rooms as number | null) ?? null,
    }));
    biensEnVente = biensEnVenteDetail.length;
    if (biensEnVente > 0) {
      await emit({
        id: 'biens_vente',
        label: `Comparaison avec ${biensEnVente} mandat${biensEnVente > 1 ? 's' : ''} de l’agence en cours dans le secteur`,
      });
    }
  }

  // Marché Bien'ici — uniquement si explicitement demandé (pas --sans-bienici).
  // Non branché aujourd'hui : on n'ajoute jamais la source sans requête réelle.
  let bieniciUsed = false;
  if (!sansBienici) {
    // Branchement futur : interroger Bien'ici ici, puis `bieniciUsed = hits > 0`.
    bieniciUsed = false;
  }

  const work = finalRows.length > 0 ? finalRows : adjusted;
  const immeubleCount = work.filter((p) => p.sameBuilding).length;
  const quartierCount = work.length;

  const sources: EstimationSourceId[] = [];
  if (priced.length > 0) sources.push('dvf');
  if (priced.length > 0 && recentMedian != null) sources.push('notaires_insee');
  if (parcelleId) sources.push('cadastre');
  if (dpeFromAdeme) sources.push('dpe');
  if (coproLots != null || coproPeriode != null) sources.push('copro');
  if (bieniciUsed) sources.push('bienici');

  const { score, label } = reliabilityScore({
    immeuble: immeubleCount,
    quartier: quartierCount,
    surfaceOk: input.surfaceM2 >= 20 && input.surfaceM2 <= 300,
  });

  const derniereVente = work
    .map((p) => p.row.date_mutation)
    .sort()
    .at(-1) ?? null;
  const trimestre = trimestreLabel(derniereVente);

  const baseContext: DvfEngineContext = {
    immeubleVentes: immeubleCount,
    quartierVentes: quartierCount,
    outliersExcluded: excluded,
    coproLots,
    coproPeriode,
    dpeKnown,
    dpeSource,
    dpeRepartition,
    biensEnVenteSecteur: biensEnVente,
    biensEnVenteDetail,
    negociacionMedianePct: null,
    radiusM: RADIUS_M,
    trimestreLabel: trimestre,
    dispersionElevee: false,
    dispersionRatio: null,
    sources,
    degradation: null,
    degradationLabel: null,
    degradationCode: null,
  };

  const features = input.features ?? [];
  const floorC = floorCoeff(input.propertyType, input.floor, input.hasElevator ?? null);
  const dpeC = dpeCoeff(input.dpeClass ?? dpeKnown);
  const conditionC = mapConditionToCoeff(input.conditionRating);
  const featC = featuresCoeff(features);
  const extraCoeffs = extrasCoefficients(input.propertyType, input.extras);
  const extraC = extrasTotalPct(extraCoeffs);

  if (quartierCount === 0) {
    // Repli sur le référentiel code postal — toujours une réponse quand on peut.
    const reference = computeEstimation({
      postalCode: input.postalCode,
      propertyType: input.propertyType,
      surfaceM2: input.surfaceM2,
      rooms: input.rooms,
      floor: input.floor,
      hasElevator: input.hasElevator ?? null,
      bathrooms: null,
      features,
      viewType: null,
      constructionYear: null,
      dpeClass: input.dpeClass ?? dpeKnown,
      conditionRating: input.conditionRating,
    });

    if (!reference.available || reference.value == null || reference.pricePerM2 == null) {
      await emit({
        id: 'secteur_non_couvert',
        label: 'Ce secteur n’est pas encore couvert par nos données de ventes',
      });
      return {
        available: false,
        value: null,
        low: null,
        high: null,
        pricePerM2: null,
        reliability: score,
        reliabilityLabel: label,
        steps,
        comparables: [],
        sources,
        corrections: [],
        context: {
          ...baseContext,
          immeubleVentes: immeubleTx.length,
          quartierVentes: 0,
          degradationCode: 'secteur_non_couvert',
          degradationLabel:
            'Ce secteur n’est pas encore couvert par nos données de ventes. Nous chargeons actuellement Paris et la Haute-Savoie.',
        },
        parcelleId,
      };
    }

    await emit({
      id: 'referentiel_cp',
      label: `Repli sur le prix de référence du code postal ${input.postalCode}`,
    });

    const medianPm2 = getReferencePricePerM2(input.postalCode) ?? reference.pricePerM2;
    const corrections = buildCorrectionLines(
      {
        surfaceM2: input.surfaceM2,
        medianPm2,
        propertyType: input.propertyType,
        floor: input.floor,
        hasElevator: input.hasElevator ?? null,
        dpeClass: input.dpeClass ?? dpeKnown,
        conditionRating: input.conditionRating,
        hasParking: features.includes('parking'),
        hasCave: features.includes('cave'),
        hasBalconTerrasse: features.includes('balcon_terrasse'),
        quartierVentes: 0,
      },
      { floor: floorC, dpe: dpeC, condition: conditionC, features: featC, extras: extraCoeffs },
    );

    return {
      available: true,
      value: reference.value,
      low: reference.low,
      high: reference.high,
      pricePerM2: reference.pricePerM2,
      reliability: Math.min(score, 35),
      reliabilityLabel: 'Fiabilité limitée',
      steps,
      comparables: [],
      sources,
      corrections,
      context: {
        ...baseContext,
        immeubleVentes: immeubleTx.length,
        quartierVentes: 0,
        degradation: 'referentiel_cp',
        degradationLabel: `Estimation fondée sur le prix de référence du code postal ${input.postalCode}, faute de ventes comparables à proximité.`,
      },
      parcelleId,
    };
  }

  const pm2List = work.map((p) => p.prixM2Adj).sort((a, b) => a - b);
  const medianPm2 = pm2List[Math.floor(pm2List.length / 2)]!;

  const ratio = dispersionRatio(pm2List);
  const dispersionElevee = isDispersionElevee(ratio);
  if (dispersionElevee) {
    await emit({
      id: 'dispersion',
      label: 'Prix au m² très dispersés dans ce secteur : la fourchette n’est pas resserrable',
    });
  }

  const coeff = 1 + floorC + dpeC + conditionC + featC + extraC;

  const value = roundToThousand(medianPm2 * input.surfaceM2 * coeff);
  let rangePct: number = CONFIG_ESTIMATION.RANGE_PCT;
  if (score < 40) rangePct = 0.14;
  else if (score < 70) rangePct = 0.1;

  // Dispersion élevée : pas de fourchette. Mieux vaut dire qu'une visite est
  // nécessaire qu'afficher un intervalle qui ne veut rien dire.
  const low = dispersionElevee ? null : roundToThousand(value * (1 - rangePct));
  const high = dispersionElevee ? null : roundToThousand(value * (1 + rangePct));
  const pricePerM2 = Math.round(value / input.surfaceM2);

  await emit({
    id: 'valeur',
    label: `Valeur retenue : ${pricePerM2.toLocaleString('fr-FR')} €/m² appliqués à ${input.surfaceM2} m²`,
  });

  const comparables: ComparableSale[] = work.slice(0, 20).map((p) => ({
    date: p.row.date_mutation,
    surfaceM2: num(p.row.surface_reelle_bati),
    price: num(p.row.valeur_fonciere),
    pricePerM2: p.prixM2,
    pricePerM2Adjusted: p.prixM2Adj,
    voie: voieFromAdresse(p.adresse),
    sameBuilding: p.sameBuilding,
  }));

  const corrections = buildCorrectionLines(
    {
      surfaceM2: input.surfaceM2,
      medianPm2,
      propertyType: input.propertyType,
      floor: input.floor,
      hasElevator: input.hasElevator ?? null,
      dpeClass: input.dpeClass ?? dpeKnown,
      conditionRating: input.conditionRating,
      hasParking: features.includes('parking'),
      hasCave: features.includes('cave'),
      hasBalconTerrasse: features.includes('balcon_terrasse'),
      quartierVentes: quartierCount,
    },
    { floor: floorC, dpe: dpeC, condition: conditionC, features: featC, extras: extraCoeffs },
  );

  return {
    available: true,
    value,
    low,
    high,
    pricePerM2,
    reliability: score,
    reliabilityLabel: label,
    steps,
    comparables,
    sources,
    corrections,
    context: {
      ...baseContext,
      dispersionElevee,
      dispersionRatio: ratio,
      degradation: dispersionElevee ? 'dispersion' : null,
      degradationLabel: dispersionElevee
        ? 'Les ventes du secteur sont hétérogènes : la valeur centrale reste affichée, sans fourchette resserrée.'
        : null,
    },
    parcelleId,
  };
}

/* -------------------------------------------------------------------------- */
/* Panneau de contexte — ce que la base sait déjà, avant le calcul            */
/* -------------------------------------------------------------------------- */

export type AddressContext = {
  /** Vrai seulement une fois l'adresse rattachée : rien ne s'affiche avant. */
  resolved: boolean;
  city: string | null;
  postalCode: string | null;
  immeubleVentes: number;
  derniereVente: string | null;
  coproLots: number | null;
  coproPeriode: string | null;
  dpeKnown: string | null;
  dpeRepartition: DpeRepartitionEntry[];
  parcelleKnown: boolean;
};

/**
 * Ce que Priimo sait de l'adresse avant même la première question.
 * Alimente le panneau de contexte des deux parcours.
 */
export async function fetchAddressContext(
  admin: Db,
  input: { banId: string | null; latitude: number; longitude: number; postalCode: string },
): Promise<AddressContext> {
  const { banId, parcelleId } = await resolveBuilding(admin, input);

  if (!banId && !parcelleId) {
    return {
      resolved: false,
      city: null,
      postalCode: input.postalCode || null,
      immeubleVentes: 0,
      derniereVente: null,
      coproLots: null,
      coproPeriode: null,
      dpeKnown: null,
      dpeRepartition: [],
      parcelleKnown: false,
    };
  }

  let txQuery = admin
    .from('building_transactions')
    .select('date_mutation')
    .order('date_mutation', { ascending: false })
    .limit(100);
  txQuery = parcelleId ? txQuery.eq('parcelle_id', parcelleId) : txQuery.eq('ban_id', banId!);
  const { data: tx } = await txQuery;

  const [{ data: copro }, dpe] = await Promise.all([
    banId
      ? admin
          .from('building_copro')
          .select('nombre_lots, periode_construction')
          .eq('ban_id', banId)
          .order('date_maj', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchDpeImmeuble(admin, banId),
  ]);

  return {
    resolved: true,
    city: null,
    postalCode: input.postalCode || null,
    immeubleVentes: tx?.length ?? 0,
    derniereVente: tx?.[0]?.date_mutation ?? null,
    coproLots: copro?.nombre_lots ?? null,
    coproPeriode: formatPeriodeConstruction(copro?.periode_construction),
    dpeKnown: dpe.derniere,
    dpeRepartition: dpe.repartition,
    parcelleKnown: parcelleId != null,
  };
}

/**
 * Combien de ventes comparables sont déjà identifiables pour ce type de bien.
 * Le même rayon et le même filtre que le calcul : le chiffre annoncé pendant
 * le parcours est celui qui sera utilisé.
 */
export async function countComparables(
  admin: Db,
  input: {
    latitude: number;
    longitude: number;
    postalCode: string;
    propertyType: EstimationPropertyType;
  },
): Promise<number> {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return 0;

  const { data: nearBuildings } = await admin
    .from('buildings')
    .select('ban_id, parcelle_id, lat, lng')
    .eq('code_postal', input.postalCode)
    .gte('lat', input.latitude - LAT_DELTA)
    .lte('lat', input.latitude + LAT_DELTA)
    .gte('lng', input.longitude - LNG_DELTA_AT_48)
    .lte('lng', input.longitude + LNG_DELTA_AT_48)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(400);

  const near = ((nearBuildings ?? []) as unknown as BuildingRow[]).filter(
    (b) =>
      b.lat != null &&
      b.lng != null &&
      haversineM(input.latitude, input.longitude, b.lat, b.lng) <= RADIUS_M,
  );
  if (near.length === 0) return 0;

  const parcelleIds = [...new Set(near.map((b) => b.parcelle_id).filter(Boolean))] as string[];
  const banIds = [...new Set(near.map((b) => b.ban_id))];

  let q = admin
    .from('building_transactions')
    .select('type_local, valeur_fonciere, surface_reelle_bati, prix_m2')
    .limit(400);
  q = parcelleIds.length > 0 ? q.in('parcelle_id', parcelleIds.slice(0, 200)) : q.in('ban_id', banIds.slice(0, 200));
  const { data } = await q;

  const typeFilter =
    input.propertyType === 'maison'
      ? (t: string | null) => /maison/i.test(t ?? '')
      : (t: string | null) => !t || /appart/i.test(t) || /local/i.test(t) === false;

  return (data ?? []).filter((row) => {
    if (!typeFilter((row.type_local as string | null) ?? null)) return false;
    const surface = num(row.surface_reelle_bati);
    const prix = num(row.valeur_fonciere);
    const pm2 = num(row.prix_m2) ?? (surface && prix ? prix / surface : null);
    return pm2 != null && pm2 >= 500 && pm2 <= 50_000;
  }).length;
}
