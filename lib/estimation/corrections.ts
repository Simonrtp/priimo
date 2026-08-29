/**
 * Lignes de correction affichées sur le résultat et l’avis partagé.
 *
 * Base = médiane €/m² × surface. Chaque coefficient devient un montant
 * en euros, pour que le négociateur puisse défendre le chiffre ligne à ligne.
 */

import { CONFIG_ESTIMATION } from '@/lib/estimation';
import type { ExtraCoeff } from '@/lib/estimation/extras';

export type CorrectionLine = {
  id: string;
  label: string;
  amountEur: number;
  /** Nombre de ventes ayant servi à calibrer ce coefficient — null si forfait. */
  sampleSize: number | null;
  kind: 'base' | 'ajustement' | 'total';
};

export type CoeffInput = {
  surfaceM2: number;
  medianPm2: number;
  propertyType: 'appartement' | 'maison';
  floor: string | null;
  hasElevator: boolean | null;
  dpeClass: string | null;
  conditionRating: 1 | 2 | 3 | 4 | null;
  hasParking: boolean;
  hasCave: boolean;
  hasBalconTerrasse: boolean;
  quartierVentes: number;
};

function roundEuro(n: number): number {
  return Math.round(n / 100) * 100;
}

function floorLabel(floor: string | null, hasElevator: boolean | null): string {
  const raw = (floor ?? '').trim();
  const etage =
    /^rdc$/i.test(raw) || raw === '0'
      ? 'Rez-de-chaussée'
      : raw
        ? `${raw}${/^\d+$/.test(raw) ? 'e' : ''} étage`
        : 'Étage';
  if (hasElevator === true) return `${etage} avec ascenseur`;
  if (hasElevator === false) return `${etage} sans ascenseur`;
  return etage;
}

/**
 * Construit le détail du calcul à partir de la base marché et des coefficients
 * déjà appliqués par le moteur (mêmes pourcentages que CONFIG_ESTIMATION).
 */
export function buildCorrectionLines(
  input: CoeffInput,
  coeffs: {
    floor: number;
    dpe: number;
    condition: number;
    features: number;
    /** Critères complémentaires du parcours agent (duplex, terrain, garage…). */
    extras?: readonly ExtraCoeff[];
  },
): CorrectionLine[] {
  const base = roundEuro(input.medianPm2 * input.surfaceM2);
  const lines: CorrectionLine[] = [
    {
      id: 'base',
      label: `Base marché, ${input.surfaceM2} m² à ${Math.round(input.medianPm2).toLocaleString('fr-FR')} €/m²`,
      amountEur: base,
      sampleSize: input.quartierVentes > 0 ? input.quartierVentes : null,
      kind: 'base',
    },
  ];

  if (coeffs.floor !== 0) {
    lines.push({
      id: 'etage',
      label: floorLabel(input.floor, input.hasElevator),
      amountEur: roundEuro(base * coeffs.floor),
      sampleSize: input.quartierVentes > 0 ? Math.min(input.quartierVentes, 40) : null,
      kind: 'ajustement',
    });
  }

  if (coeffs.dpe !== 0 && input.dpeClass) {
    lines.push({
      id: 'dpe',
      label: `Étiquette DPE ${input.dpeClass.toUpperCase()}`,
      amountEur: roundEuro(base * coeffs.dpe),
      sampleSize: null,
      kind: 'ajustement',
    });
  }

  if (coeffs.condition !== 0 && input.conditionRating != null) {
    const labels: Record<number, string> = {
      1: 'À rénover',
      2: 'État correct',
      3: 'Bon état',
      4: 'Excellent état',
    };
    lines.push({
      id: 'etat',
      label: labels[input.conditionRating] ?? 'État',
      amountEur: roundEuro(base * coeffs.condition),
      sampleSize: null,
      kind: 'ajustement',
    });
  }

  // Features : on décompose parking / cave / balcon si présents.
  if (input.hasParking) {
    lines.push({
      id: 'parking',
      label: 'Parking',
      amountEur: roundEuro(base * CONFIG_ESTIMATION.FEATURES.parking),
      sampleSize: null,
      kind: 'ajustement',
    });
  }
  if (input.hasBalconTerrasse) {
    lines.push({
      id: 'balcon',
      label: 'Balcon ou terrasse',
      amountEur: roundEuro(base * CONFIG_ESTIMATION.FEATURES.balcon_terrasse),
      sampleSize: null,
      kind: 'ajustement',
    });
  }
  if (input.hasCave) {
    lines.push({
      id: 'cave',
      label: 'Cave',
      amountEur: roundEuro(base * CONFIG_ESTIMATION.FEATURES.cave),
      sampleSize: null,
      kind: 'ajustement',
    });
  }

  for (const extra of coeffs.extras ?? []) {
    if (extra.pct === 0) continue;
    lines.push({
      id: extra.id,
      label: extra.label,
      amountEur: roundEuro(base * extra.pct),
      sampleSize: null,
      kind: 'ajustement',
    });
  }

  const total = lines.reduce((s, l) => s + l.amountEur, 0);
  lines.push({
    id: 'total',
    label: 'Valeur de marché',
    amountEur: roundEuro(total),
    sampleSize: null,
    kind: 'total',
  });

  return lines;
}
