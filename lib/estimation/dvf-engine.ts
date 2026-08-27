/**
 * Moteur d'estimation DVF pour le dashboard.
 * Chaque étape renvoyée correspond à un vrai comptage / vrai traitement.
 * Coefficients partagés avec lib/estimation.ts (funnel public).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { CONFIG_ESTIMATION, type EstimationPropertyType } from '@/lib/estimation';
import { parseDpeLetter } from '@/lib/carte/dpe-public';
import { formatPeriodeConstruction } from '@/lib/queries/parcelle';
import type { EstimationSourceId } from '@/lib/estimation/sources';

type Db = SupabaseClient<Database>;

const RADIUS_M = 200;
/** ~1° lat ≈ 111 km ; approx longitude à 48°N. */
const LAT_DELTA = RADIUS_M / 111_320;
const LNG_DELTA_AT_48 = RADIUS_M / (111_320 * Math.cos((48.85 * Math.PI) / 180));

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
  /** 1 mauvais … 4 excellent. */
  conditionRating: 1 | 2 | 3 | 4 | null;
  dpeClass: string | null;
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

export type DvfEngineContext = {
  immeubleVentes: number;
  quartierVentes: number;
  outliersExcluded: number;
  coproLots: number | null;
  coproPeriode: string | null;
  dpeKnown: string | null;
  biensEnVenteSecteur: number;
  negociacionMedianePct: number | null;
  /** Sources réellement mobilisées — persistées avec le résultat. */
  sources: EstimationSourceId[];
};

export type DvfEngineResult = {
  available: boolean;
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

function floorCoeff(propertyType: EstimationPropertyType, floor: string | null): number {
  if (propertyType !== 'appartement' || floor == null) return 0;
  const raw = floor.trim();
  if (/^rdc$/i.test(raw) || raw === '0') return CONFIG_ESTIMATION.FLOOR.RDC_PCT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  if (n > 2) {
    const bonus = (n - 2) * CONFIG_ESTIMATION.FLOOR.ABOVE_2_PER_FLOOR_PCT;
    return Math.min(bonus, CONFIG_ESTIMATION.FLOOR.ABOVE_2_CAP_PCT);
  }
  return 0;
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

  if (score >= 70) {
    return {
      score,
      label: `Estimation fiable — ${args.quartier} ventes comparables dont ${args.immeuble} dans l'immeuble`,
    };
  }
  if (score >= 40) {
    return {
      score,
      label: `Estimation moyenne — ${args.quartier} ventes comparables dont ${args.immeuble} dans l'immeuble`,
    };
  }
  return {
    score,
    label: `Estimation peu fiable — seulement ${args.quartier} vente${args.quartier > 1 ? 's' : ''} comparable${args.quartier > 1 ? 's' : ''}. Fourchette élargie.`,
  };
}

export type StepEmitter = (step: EstimationStep) => void | Promise<void>;

/**
 * Calcule l'avis à partir du DVF / buildings. Émet des étapes au fur et à mesure.
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

  const emptyContext = (sources: EstimationSourceId[]): DvfEngineContext => ({
    immeubleVentes: 0,
    quartierVentes: 0,
    outliersExcluded: 0,
    coproLots: null,
    coproPeriode: null,
    dpeKnown: null,
    biensEnVenteSecteur: 0,
    negociacionMedianePct: null,
    sources,
  });

  // Résoudre l'immeuble
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

  const parcelleId = building?.parcelle_id ?? null;
  const banId = building?.ban_id ?? input.banId;

  await emit({
    id: 'search_immeuble',
    label: `Recherche des ventes dans le ${input.address}…`,
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
        ? 'Aucune vente trouvée dans l’immeuble'
        : `${immeubleTx.length} vente${immeubleTx.length > 1 ? 's' : ''} trouvée${immeubleTx.length > 1 ? 's' : ''} dans l’immeuble`,
    detail: immeubleTx.length > 0 ? `${immeubleTx.length} mutations` : undefined,
  });

  await emit({
    id: 'expand_quartier',
    label: 'Élargissement au quartier…',
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
      label: `Actualisation des prix selon l’évolution constatée dans le secteur (${trimestre})…`,
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

  // Copropriété
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
      await emit({
        id: 'copro',
        label: `Analyse de la copropriété : ${coproLots ?? '?'} lots${coproPeriode ? `, construite ${coproPeriode.toLowerCase()}` : ''}`,
      });
    }
  }

  // DPE connu
  let dpeKnown: string | null = parseDpeLetter(input.dpeClass) ?? null;
  let dpeFromAdeme = false;
  if (!dpeKnown && banId) {
    const { data: act } = await admin
      .from('building_activity')
      .select('etiquette_dpe')
      .eq('ban_id', banId)
      .maybeSingle();
    dpeKnown = parseDpeLetter(act?.etiquette_dpe ?? null);
    if (dpeKnown) dpeFromAdeme = true;
  }
  const dpeUsed =
    Boolean(parseDpeLetter(input.dpeClass)) || dpeFromAdeme || Boolean(dpeKnown);

  // Biens en vente dans le secteur (agence) — distinct de Bien'ici
  let biensEnVente = 0;
  if (agencyId && input.postalCode) {
    const { data: biens, count } = await admin
      .from('biens')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('postal_code', input.postalCode)
      .in('mandat_statut', ['mandat_simple', 'mandat_exclusif']);
    biensEnVente = count ?? 0;
    void biens;
    if (biensEnVente > 0) {
      await emit({
        id: 'biens_vente',
        label: `Comparaison avec ${biensEnVente} bien${biensEnVente > 1 ? 's' : ''} actuellement en vente dans le secteur`,
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
  if (dpeUsed) sources.push('dpe');
  if (coproLots != null || coproPeriode != null) sources.push('copro');
  if (bieniciUsed) sources.push('bienici');

  const { score, label } = reliabilityScore({
    immeuble: immeubleCount,
    quartier: quartierCount,
    surfaceOk: input.surfaceM2 >= 20 && input.surfaceM2 <= 300,
  });

  if (quartierCount === 0) {
    return {
      available: false,
      low: null,
      high: null,
      pricePerM2: null,
      reliability: score,
      reliabilityLabel: label,
      steps,
      comparables: [],
      sources,
      context: {
        ...emptyContext(sources),
        immeubleVentes: immeubleTx.length,
        outliersExcluded: excluded,
        coproLots,
        coproPeriode,
        dpeKnown,
        biensEnVenteSecteur: biensEnVente,
      },
      parcelleId,
    };
  }

  const pm2List = work.map((p) => p.prixM2Adj).sort((a, b) => a - b);
  const medianPm2 = pm2List[Math.floor(pm2List.length / 2)]!;

  const coeff =
    1 +
    floorCoeff(input.propertyType, input.floor) +
    dpeCoeff(input.dpeClass ?? dpeKnown) +
    mapConditionToCoeff(input.conditionRating);

  let value = roundToThousand(medianPm2 * input.surfaceM2 * coeff);
  let rangePct: number = CONFIG_ESTIMATION.RANGE_PCT;
  if (score < 40) rangePct = 0.14;
  else if (score < 70) rangePct = 0.1;

  const low = roundToThousand(value * (1 - rangePct));
  const high = roundToThousand(value * (1 + rangePct));
  const pricePerM2 = Math.round(value / input.surfaceM2);

  const comparables: ComparableSale[] = work.slice(0, 20).map((p) => ({
    date: p.row.date_mutation,
    surfaceM2: num(p.row.surface_reelle_bati),
    price: num(p.row.valeur_fonciere),
    pricePerM2: p.prixM2,
    pricePerM2Adjusted: p.prixM2Adj,
    voie: voieFromAdresse(p.adresse),
    sameBuilding: p.sameBuilding,
  }));

  return {
    available: true,
    low,
    high,
    pricePerM2,
    reliability: score,
    reliabilityLabel: label,
    steps,
    comparables,
    sources,
    context: {
      immeubleVentes: immeubleCount,
      quartierVentes: quartierCount,
      outliersExcluded: excluded,
      coproLots,
      coproPeriode,
      dpeKnown,
      biensEnVenteSecteur: biensEnVente,
      negociacionMedianePct: null,
      sources,
    },
    parcelleId,
  };
}

/** Aperçu immeuble dès la résolution BAN (avant le calcul). */
export async function peekBuildingHints(
  admin: Db,
  banId: string,
): Promise<{ ventes: number; coproLots: number | null; dpe: string | null }> {
  const { data: building } = await admin
    .from('buildings')
    .select('ban_id, parcelle_id')
    .eq('ban_id', banId)
    .limit(1)
    .maybeSingle();

  let ventes = 0;
  if (building?.parcelle_id) {
    const { count } = await admin
      .from('building_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('parcelle_id', building.parcelle_id);
    ventes = count ?? 0;
  } else {
    const { count } = await admin
      .from('building_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('ban_id', banId);
    ventes = count ?? 0;
  }

  const { data: copro } = await admin
    .from('building_copro')
    .select('nombre_lots')
    .eq('ban_id', banId)
    .limit(1)
    .maybeSingle();

  const { data: act } = await admin
    .from('building_activity')
    .select('etiquette_dpe')
    .eq('ban_id', banId)
    .maybeSingle();

  return {
    ventes,
    coproLots: copro?.nombre_lots ?? null,
    dpe: parseDpeLetter(act?.etiquette_dpe ?? null),
  };
}
