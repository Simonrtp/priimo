import type { Lead } from '@/types/lead';

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
 * Échelle de chaleur calibrée sur la plage réellement présente.
 * Tous les leads livrés ont score >= 60 : on étire donc la couleur entre
 * le min et le max du lot pour que le meilleur ressorte vraiment.
 *   - haut de plage  → vert vif, plus gros (opportunité maximale)
 *   - milieu         → orange / ambre
 *   - bas de plage   → jaune
 */
export function buildScoreHeatScale(scores: number[]) {
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 100;
  const span = max - min;

  return function heatFor(score: number): ScoreHeat {
    const t = span > 0 ? Math.max(0, Math.min(1, (score - min) / span)) : 1;

    let color: string;
    let glow: string;
    let text: string;
    if (t >= 0.66) {
      color = '#16A34A'; // vert vif — top
      glow = 'rgba(22, 163, 74, 0.45)';
      text = '#FFFFFF';
    } else if (t >= 0.33) {
      color = '#F97316'; // orange / ambre — milieu
      glow = 'rgba(249, 115, 22, 0.4)';
      text = '#FFFFFF';
    } else {
      color = '#FACC15'; // jaune — bas de plage
      glow = 'rgba(250, 204, 21, 0.45)';
      text = '#713F12';
    }

    const size = Math.round(34 + t * 16); // 34px → 50px

    return { color, glow, text, size, t };
  };
}
