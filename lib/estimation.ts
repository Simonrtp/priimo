import prixM2Reference from '@/data/prix-m2-reference.json';

export const CONFIG_ESTIMATION = {
  /** Variation de la fourchette autour de l'estimation centrale. */
  RANGE_PCT: 0.08,
  FLOOR: {
    RDC_PCT: -0.05,
    /** Majoration par étage au-dessus du 2e, plafonnée. */
    ABOVE_2_PER_FLOOR_PCT: 0.015,
    ABOVE_2_CAP_PCT: 0.09,
    NO_ELEVATOR_ABOVE_3_PCT: -0.04,
  },
  DPE: {
    A: 0.05,
    B: 0.05,
    C: 0,
    D: 0,
    E: -0.03,
    F: -0.08,
    G: -0.08,
  } as Record<string, number>,
  CONDITION: {
    1: -0.15,
    2: -0.08,
    3: 0,
    4: 0.05,
    5: 0.1,
  } as Record<number, number>,
  FEATURES: {
    balcon_terrasse: 0.03,
    parking: 0.04,
  },
  VIEW: {
    vis_a_vis: 0,
    degagee: 0.02,
    exceptionnelle: 0.06,
  } as Record<string, number>,
  CONSENT_VERSION: 'v1',
  CONSENT_TEXT:
    "J'accepte d'être recontacté par Priimo et par l'agence immobilière partenaire de mon secteur au sujet de mon projet immobilier, par téléphone et par email.",
} as const;

export type EstimationPropertyType = 'appartement' | 'maison';
export type EstimationViewType = 'vis_a_vis' | 'degagee' | 'exceptionnelle' | null;
export type EstimationFeatureKey =
  | 'balcon_terrasse'
  | 'cave'
  | 'parking'
  | 'gardien'
  | 'travaux_recents';

export type EstimationInput = {
  postalCode: string;
  propertyType: EstimationPropertyType;
  surfaceM2: number;
  rooms: number;
  floor: string | null;
  hasElevator: boolean | null;
  bathrooms: number | null;
  features: EstimationFeatureKey[];
  viewType: EstimationViewType;
  constructionYear: number | null;
  dpeClass: string | null;
  conditionRating: number | null;
};

export type EstimationResult = {
  available: boolean;
  low: number | null;
  value: number | null;
  high: number | null;
  pricePerM2: number | null;
  confidence: number;
};

function parseFloorLevel(floor: string | null): number | null {
  if (!floor) return null;
  const raw = floor.trim();
  if (/^rdc$/i.test(raw) || raw === '0') return 0;
  if (raw === '20+') return 20;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function floorCoefficient(
  propertyType: EstimationPropertyType,
  floor: string | null,
  hasElevator: boolean | null,
): number {
  if (propertyType !== 'appartement') return 0;
  const level = parseFloorLevel(floor);
  if (level == null) return 0;

  let coeff = 0;
  if (level === 0) {
    coeff += CONFIG_ESTIMATION.FLOOR.RDC_PCT;
  } else if (level > 2) {
    const bonus = (level - 2) * CONFIG_ESTIMATION.FLOOR.ABOVE_2_PER_FLOOR_PCT;
    coeff += Math.min(bonus, CONFIG_ESTIMATION.FLOOR.ABOVE_2_CAP_PCT);
  }

  if (level > 3 && hasElevator === false) {
    coeff += CONFIG_ESTIMATION.FLOOR.NO_ELEVATOR_ABOVE_3_PCT;
  }

  return coeff;
}

function dpeCoefficient(dpeClass: string | null): number {
  if (!dpeClass || dpeClass === 'inconnu') return 0;
  return CONFIG_ESTIMATION.DPE[dpeClass.toUpperCase()] ?? 0;
}

function conditionCoefficient(rating: number | null): number {
  if (rating == null) return 0;
  return CONFIG_ESTIMATION.CONDITION[rating] ?? 0;
}

function featuresCoefficient(features: EstimationFeatureKey[]): number {
  let coeff = 0;
  if (features.includes('balcon_terrasse')) coeff += CONFIG_ESTIMATION.FEATURES.balcon_terrasse;
  if (features.includes('parking')) coeff += CONFIG_ESTIMATION.FEATURES.parking;
  return coeff;
}

function viewCoefficient(viewType: EstimationViewType): number {
  if (!viewType) return 0;
  return CONFIG_ESTIMATION.VIEW[viewType] ?? 0;
}

/** Fiabilité 1–5 selon le nombre de champs facultatifs renseignés. */
export function computeConfidence(input: EstimationInput): number {
  let filled = 0;
  if (input.features.length > 0) filled += 1;
  if (input.viewType) filled += 1;
  if (input.constructionYear != null) filled += 1;
  if (input.dpeClass && input.dpeClass !== 'inconnu') filled += 1;
  if (input.conditionRating != null) filled += 1;
  if (input.bathrooms != null && input.bathrooms > 0) filled += 1;
  if (input.propertyType === 'appartement' && input.hasElevator != null) filled += 1;

  if (filled <= 1) return 1;
  if (filled === 2) return 2;
  if (filled === 3) return 3;
  if (filled === 4) return 4;
  return 5;
}

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

function getReferencePricePerM2(postalCode: string): number | null {
  const key = postalCode.trim();
  const table = prixM2Reference as Record<string, number | string>;
  const raw = table[key];
  if (typeof raw !== 'number' || raw <= 0) return null;
  return raw;
}

/**
 * Calcule la fourchette. Si le CP est absent ou à 0 dans le référentiel,
 * `available` est false — aucun chiffre inventé.
 */
export function computeEstimation(input: EstimationInput): EstimationResult {
  const confidence = computeConfidence(input);
  const pricePerM2Ref = getReferencePricePerM2(input.postalCode);

  if (pricePerM2Ref == null || input.surfaceM2 <= 0) {
    return {
      available: false,
      low: null,
      value: null,
      high: null,
      pricePerM2: null,
      confidence,
    };
  }

  const coeff =
    1 +
    floorCoefficient(input.propertyType, input.floor, input.hasElevator) +
    dpeCoefficient(input.dpeClass) +
    conditionCoefficient(input.conditionRating) +
    featuresCoefficient(input.features) +
    viewCoefficient(input.viewType);

  const value = roundToThousand(pricePerM2Ref * input.surfaceM2 * coeff);
  const low = roundToThousand(value * (1 - CONFIG_ESTIMATION.RANGE_PCT));
  const high = roundToThousand(value * (1 + CONFIG_ESTIMATION.RANGE_PCT));
  const pricePerM2 = Math.round(value / input.surfaceM2);

  return {
    available: true,
    low,
    value,
    high,
    pricePerM2,
    confidence,
  };
}
