/**
 * Couleur associée au score d'un lead — échelle « heat » continue, ORANGE,
 * basée sur l'orange de marque Priimo #E8743C (choix de Simon).
 *
 * Principe : la profondeur porte le signal.
 *   - Leads TRÈS CHAUDS (note haute) → orange TRÈS FONCÉ (#7c2d12, brûlé).
 *   - Autour du centre              → orange Priimo (#f97316 / #E8743C).
 *   - Leads moins forts (note basse) → beaucoup plus clair, PRESQUE JAUNE
 *                                      (#fbbf24, amber clair).
 * Pas de rouge : un lead livré (score ≥ 60) n'est jamais « mauvais ».
 */

type Rgb = [number, number, number];

// Points d'ancrage (score → couleur), du moins fort (presque jaune) au plus
// chaud (orange brûlé). Palette amber/orange Tailwind autour de l'orange Priimo.
const STOPS: { s: number; c: Rgb }[] = [
  { s: 60, c: [251, 191, 36] }, //  amber-400   — moins forts (presque jaune, clair)
  { s: 66, c: [245, 158, 11] }, //  amber-500
  { s: 72, c: [249, 115, 22] }, //  orange-500  — ≈ orange Priimo #E8743C (centre)
  { s: 78, c: [234, 88, 12] }, //   orange-600
  { s: 85, c: [194, 65, 12] }, //   orange-700
  { s: 92, c: [154, 52, 18] }, //   orange-800
  { s: 100, c: [124, 45, 18] }, //  orange-900  — très chauds (orange très foncé)
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Retourne les composantes RGB associées au score (pins carte, halos, etc.). */
export function scoreRgb(score: number): Rgb {
  const min = STOPS[0];
  const max = STOPS[STOPS.length - 1];
  const s = Math.max(min.s, Math.min(max.s, score));

  let lo = min;
  let hi = max;
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    if (s >= STOPS[i].s && s <= STOPS[i + 1].s) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }

  const span = hi.s - lo.s;
  const t = span === 0 ? 0 : (s - lo.s) / span;
  return [
    lerp(lo.c[0], hi.c[0], t),
    lerp(lo.c[1], hi.c[1], t),
    lerp(lo.c[2], hi.c[2], t),
  ];
}

/** Retourne la couleur `rgb(...)` associée au score (compatible color-mix). */
export function scoreColor(score: number): string {
  const [r, g, b] = scoreRgb(score);
  return `rgb(${r}, ${g}, ${b})`;
}
