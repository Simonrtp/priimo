import type { Lead } from '@/types/lead';
import { scoreRgb } from './score-color';

export type GeoLead = Lead & { latitude: number; longitude: number };

export function hasCoordinates(lead: Lead): lead is GeoLead {
  return (
    typeof lead.latitude === 'number' &&
    typeof lead.longitude === 'number' &&
    Number.isFinite(lead.latitude) &&
    Number.isFinite(lead.longitude) &&
    !(lead.latitude === 0 && lead.longitude === 0)
  );
}

export type LeadBounds = [[number, number], [number, number]];

/** Bounding box [[west, south], [east, north]] englobant tous les leads géolocalisés. */
export function computeLeadBounds(leads: GeoLead[]): LeadBounds | null {
  if (leads.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const lead of leads) {
    if (lead.longitude < minLng) minLng = lead.longitude;
    if (lead.longitude > maxLng) maxLng = lead.longitude;
    if (lead.latitude < minLat) minLat = lead.latitude;
    if (lead.latitude > maxLat) maxLat = lead.latitude;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export type ScoreHeat = {
  /** Couleur principale du marqueur. */
  color: string;
  /** Couleur de halo (survol / mise en évidence). */
  glow: string;
  /** Couleur du texte (score) sur le marqueur. */
  text: string;
  /** Diamètre du marqueur en px. */
  size: number;
  /** Position normalisée du score dans la plage présente [0..1]. */
  t: number;
};

/**
 * Échelle de chaleur des marqueurs, alignée sur la couleur des leads
 * (lib/score-color.ts) : orange basé sur l'orange Priimo #E8743C.
 *   - couleur : orange TRÈS FONCÉ pour les très chauds → presque jaune pour
 *     les moins forts (teinte absolue via scoreRgb, cohérente avec les badges).
 *   - taille  : le meilleur du lot ressort (relative à la plage présente).
 * Le texte du marqueur passe en blanc (fonds foncés) ou orange brûlé
 * (fonds clairs) selon la luminance, pour rester lisible.
 */
export function buildScoreHeatScale(scores: number[]) {
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 100;
  const span = max - min;

  return function heatFor(score: number): ScoreHeat {
    const t = span > 0 ? Math.max(0, Math.min(1, (score - min) / span)) : 1;

    const [r, g, b] = scoreRgb(score);
    const color = `rgb(${r}, ${g}, ${b})`;
    const glow = `rgba(${r}, ${g}, ${b}, 0.45)`;
    // Luminance perçue → texte lisible sur le marqueur.
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const text = luminance < 140 ? '#FFFFFF' : '#7C2D12';

    const size = Math.round(34 + t * 16); // 34px → 50px : le meilleur du lot ressort

    return { color, glow, text, size, t };
  };
}
