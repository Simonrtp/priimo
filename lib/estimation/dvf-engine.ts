/**
 * Moteur d'estimation DVF.
 * Chaque étape renvoyée correspond à un vrai comptage / vrai traitement.
 * Coefficients partagés avec lib/estimation.ts (funnel public).
 *
 * Le moteur sert le dashboard (agence connectée) et le parcours public
 * /estimation. Quand `agencyId` est null, aucune donnée interne d'agence
 * n'est lue ni renvoyée.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  type EstimationFeatureKey,
  type EstimationPropertyType,
} from '@/lib/estimation';
import { parseDpeLetter } from '@/lib/carte/dpe-public';
import { formatPeriodeConstruction } from '@/lib/queries/parcelle';
import { DVF_RAYON_M, dvfHorizonDepuisIso, type EstimationSourceId } from '@/lib/estimation/sources';
import { extrasCoefficients, type EstimationExtras } from '@/lib/estimation/extras';
import { buildCorrectionLines, type CorrectionLine } from '@/lib/estimation/corrections';
import { collecterVentesComparables } from '@/lib/estimation/moteur-collecte';
import {
  assemblerEstimation,
  construireIndice,
  impossible,
  motifDepuisSaisie,
  preparerLot,
  voieNormalisee,
  type AjustementApplique,
  type MotifImpossible,
} from '@/lib/estimation/moteur';

type Db = SupabaseClient<Database>;

export const RADIUS_M = DVF_RAYON_M;
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
   * Critères complémentaires du parcours agent. Facultatifs : le funnel
   * priimo.fr ne les collecte pas.
   */
  extras?: EstimationExtras | null;
  dernierEtage?: boolean | null;
  etagesImmeuble?: number | null;
  annexes?: Array<{ libelle: string; valorisationEur: number | null }>;
  exclusIds?: readonly string[];
  avant?: string | null;
  excludeMutationId?: string | null;
  maintenant?: Date;
};

export type EstimationStep = {
  id: string;
  label: string;
  detail?: string;
};

export type ComparableSale = {
  id: string;
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
  impossible: MotifImpossible | null;
  ajustements: AjustementApplique[];
  moteurValeur: number | null;
  fenetreMois: number | null;
  moteurTrace: unknown;
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
  impossible: MotifImpossible | null;
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

  const saisie = motifDepuisSaisie({
    surfaceM2: input.surfaceM2,
    propertyType: input.propertyType,
    latitude: input.latitude,
    longitude: input.longitude,
    postalCode: input.postalCode,
  });
  if (saisie) {
    await emit({ id: 'impossible', label: saisie.motif });
    return {
      available: false,
      value: null,
      low: null,
      high: null,
      pricePerM2: null,
      reliability: 0,
      reliabilityLabel: 'Fiabilité faible',
      steps,
      comparables: [],
      sources: [],
      corrections: [],
      impossible: saisie,
      context: {
        immeubleVentes: 0,
        quartierVentes: 0,
        outliersExcluded: 0,
        coproLots: null,
        coproPeriode: null,
        dpeKnown: null,
        dpeSource: null,
        dpeRepartition: [],
        biensEnVenteSecteur: 0,
        biensEnVenteDetail: [],
        negociacionMedianePct: null,
        radiusM: 0,
        trimestreLabel: null,
        dispersionElevee: false,
        dispersionRatio: null,
        sources: [],
        degradation: null,
        degradationLabel: saisie.motif,
        degradationCode: 'secteur_non_couvert',
        impossible: saisie,
        ajustements: [],
        moteurValeur: null,
        fenetreMois: null,
        moteurTrace: null,
      },
      parcelleId: null,
    };
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

  const collecte = await collecterVentesComparables(
    admin,
    {
      latitude: input.latitude,
      longitude: input.longitude,
      postalCode: input.postalCode,
      propertyType: input.propertyType,
      banId,
      parcelleId,
    },
    {
      avant: input.avant ?? null,
      excludeMutationId: input.excludeMutationId ?? null,
      exclusIds: input.exclusIds,
      maintenant: input.maintenant,
    },
  );

  const immeubleCount = collecte.candidates.filter(
    (v) =>
      (banId != null && v.banId === banId) || (parcelleId != null && v.parcelleId === parcelleId),
  ).length;
  const quartierCount = collecte.candidates.length;
  const excluded = collecte.exclues.filter((e) => e.motif === 'aberrant_mad').length;

  await emit({
    id: 'immeuble_count',
    label:
      immeubleCount === 0
        ? `Élargissement : aucune vente dans cet immeuble`
        : `${immeubleCount} vente${immeubleCount > 1 ? 's' : ''} dans l’immeuble`,
  });
  await emit({
    id: 'expand_quartier',
    label:
      collecte.radiusM != null
        ? `Relevé des ventes dans un rayon de ${collecte.radiusM} m (${collecte.fenetreMois ?? 24} mois)`
        : `Relevé des ventes du code postal ${input.postalCode}`,
  });
  await emit({
    id: 'quartier_count',
    label: `${quartierCount} vente${quartierCount > 1 ? 's' : ''} exploitable${quartierCount > 1 ? 's' : ''} après nettoyage`,
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

  const sources: EstimationSourceId[] = [];
  if (collecte.toutes.length > 0) sources.push('dvf');
  if (collecte.candidates.length > 0) sources.push('notaires_insee');
  if (parcelleId) sources.push('cadastre');
  if (dpeFromAdeme) sources.push('dpe');
  if (coproLots != null || coproPeriode != null) sources.push('copro');
  if (bieniciUsed) sources.push('bienici');

  const features = input.features ?? [];
  const moteurInput = {
    surfaceM2: input.surfaceM2,
    propertyType: input.propertyType,
    floor: input.floor,
    hasElevator: input.hasElevator ?? null,
    dernierEtage: input.dernierEtage ?? null,
    conditionRating: input.conditionRating,
    dpeClass: input.dpeClass ?? dpeKnown,
    balconTerrasse: features.includes('balcon_terrasse') || input.extras?.balconM2 != null,
    annexes: input.annexes ?? [],
    terrainM2: input.extras?.terrainM2 ?? null,
    exclusIds: input.exclusIds,
  };

  const indice = construireIndice(collecte.indicePool, input.maintenant);
  const origine = {
    lat: input.latitude,
    lng: input.longitude,
    banId,
    parcelleId,
    voie: voieNormalisee(building?.adresse ?? input.address),
  };

  let moteur = collecte.toutes.length === 0
    ? impossible(
        'aucune_vente_zone',
        `Aucune vente en base sur le code postal ${input.postalCode}.`,
        'Vérifiez le secteur, ou saisissez le prix à la main.',
      )
    : collecte.candidates.length === 0
      ? {
          ...impossible(
            'aucune_vente_apres_nettoyage',
            'Des ventes existent dans la zone, mais aucune n’est exploitable après nettoyage.',
            'Vérifiez le type de bien, ou saisissez le prix à la main.',
          ),
          exclues: collecte.exclues,
        }
      : assemblerEstimation({
          input: moteurInput,
          lot: preparerLot(collecte.candidates, moteurInput, origine, indice, input.maintenant),
          indice,
          radiusM: collecte.radiusM ?? 0,
          fenetreMois: collecte.fenetreMois ?? 60,
          exclues: collecte.exclues,
          maintenant: input.maintenant,
        });

  const fiabLabel =
    moteur.reliability === 'élevée'
      ? 'Fiabilité élevée'
      : moteur.reliability === 'moyenne'
        ? 'Fiabilité moyenne'
        : 'Fiabilité faible';

  const derniereVente = moteur.retenues.map((v) => v.date).sort().at(-1) ?? null;
  const trimestre = trimestreLabel(derniereVente);
  const ratio = dispersionRatio(moteur.retenues.map((v) => v.prixM2Actualise));
  const dispersionElevee = isDispersionElevee(ratio);

  const baseContext: DvfEngineContext = {
    immeubleVentes: immeubleCount,
    quartierVentes: moteur.retenues.length,
    outliersExcluded: excluded,
    coproLots,
    coproPeriode,
    dpeKnown,
    dpeSource,
    dpeRepartition,
    biensEnVenteSecteur: biensEnVente,
    biensEnVenteDetail,
    negociacionMedianePct: null,
    radiusM: collecte.radiusM ?? 0,
    trimestreLabel: trimestre,
    dispersionElevee,
    dispersionRatio: ratio,
    sources,
    degradation: moteur.available ? (dispersionElevee ? 'dispersion' : null) : null,
    degradationLabel: moteur.impossible?.motif ?? null,
    degradationCode: moteur.available ? null : 'secteur_non_couvert',
    impossible: moteur.impossible,
    ajustements: moteur.ajustements,
    moteurValeur: moteur.value,
    fenetreMois: collecte.fenetreMois,
    moteurTrace: {
      retenues: moteur.retenues,
      exclues: moteur.exclues,
      indice,
      radiusM: collecte.radiusM,
      fenetreMois: collecte.fenetreMois,
      candidates: collecte.toutes,
    },
  };

  if (!moteur.available || moteur.value == null) {
    const motif = moteur.impossible ?? {
      code: 'valeur_incalculable' as const,
      motif: 'Estimation impossible.',
      action: 'Saisissez le prix à la main.',
    };
    await emit({ id: 'impossible', label: motif.motif });
    return {
      available: false,
      value: null,
      low: null,
      high: null,
      pricePerM2: null,
      reliability: moteur.reliabilityScore,
      reliabilityLabel: fiabLabel,
      steps,
      comparables: [],
      sources,
      corrections: [],
      impossible: motif,
      context: { ...baseContext, quartierVentes: 0 },
      parcelleId,
    };
  }

  if (indice) {
    await emit({
      id: 'actualisation',
      label: `Actualisation à l’indice ${indice.niveau.replace('_', ' ')} (${Math.round(indice.actuel).toLocaleString('fr-FR')} €/m²)`,
    });
  }
  for (const a of moteur.ajustements) {
    await emit({ id: `ajust_${a.id}`, label: a.label });
  }
  await emit({
    id: 'valeur',
    label: `Valeur retenue : ${moteur.pricePerM2!.toLocaleString('fr-FR')} €/m² × ${input.surfaceM2} m²`,
  });

  const comparables: ComparableSale[] = moteur.retenues.slice(0, 24).map((v) => ({
    id: v.id,
    date: v.date,
    surfaceM2: v.surfaceM2,
    price: v.prix,
    pricePerM2: v.prixM2,
    pricePerM2Adjusted: v.prixM2Actualise,
    voie: v.voie,
    sameBuilding: v.sameBuilding,
  }));

  const extraCoeffs = extrasCoefficients(input.propertyType, input.extras);
  const medianPm2 = moteur.pricePerM2!;
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
      hasCave: (input.annexes ?? []).some((a) => /cave|cellier/i.test(a.libelle)),
      hasBalconTerrasse: moteurInput.balconTerrasse,
      quartierVentes: moteur.retenues.length,
    },
    {
      floor: 0,
      dpe: 0,
      condition: 0,
      features: 0,
      extras: extraCoeffs,
    },
  );
  const horsAnnexes = moteur.ajustements.filter((a) => !a.id.startsWith('annexe_'));
  const linesFromMoteur: CorrectionLine[] = [
    corrections[0]!,
    ...horsAnnexes.map((a) => ({
      id: a.id,
      label: a.label,
      amountEur: a.amountEur,
      sampleSize: moteur.retenues.length,
      kind: 'ajustement' as const,
    })),
    ...moteur.ajustements
      .filter((a) => a.id.startsWith('annexe_'))
      .map((a) => ({
        id: a.id,
        label: a.label,
        amountEur: a.amountEur,
        sampleSize: null,
        kind: 'ajustement' as const,
      })),
    {
      id: 'total',
      label: 'Valeur de marché',
      amountEur: moteur.value,
      sampleSize: null,
      kind: 'total',
    },
  ];

  return {
    available: true,
    value: moteur.value,
    low: moteur.low,
    high: moteur.high,
    pricePerM2: moteur.pricePerM2,
    reliability: moteur.reliabilityScore,
    reliabilityLabel: fiabLabel,
    steps,
    comparables,
    sources,
    corrections: linesFromMoteur,
    impossible: null,
    context: baseContext,
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
    .gte('date_mutation', dvfHorizonDepuisIso())
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
  const collecte = await collecterVentesComparables(admin, {
    latitude: input.latitude,
    longitude: input.longitude,
    postalCode: input.postalCode,
    propertyType: input.propertyType,
    banId: null,
    parcelleId: null,
  });
  return collecte.candidates.length;
}
