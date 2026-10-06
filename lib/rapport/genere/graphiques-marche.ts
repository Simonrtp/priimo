/** Graphiques marché en SVG, identiques page et PDF. */

export type PointMarche = { label: string; valeur: number };

function echelle(values: readonly number[], h: number, pad = 8): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
}

export function svgEvolutionMediane(points: readonly PointMarche[], accent = '#E8743C'): string {
  if (points.length < 2) return '';
  const w = 320;
  const h = 120;
  const ys = points.map((p) => p.valeur);
  const y = echelle(ys, h);
  const step = (w - 24) / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${12 + i * step} ${y(p.valeur)}`)
    .join(' ');
  const last = points[points.length - 1]!;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="${accent}" stroke-width="2"/><circle cx="${12 + (points.length - 1) * step}" cy="${y(last.valeur)}" r="3.5" fill="${accent}"/></svg>`;
}

export function svgRepartition(
  bins: readonly PointMarche[],
  position: number | null,
  accent = '#E8743C',
): string {
  if (bins.length === 0) return '';
  const w = 320;
  const h = 120;
  const max = Math.max(...bins.map((b) => b.valeur), 1);
  const barW = (w - 16) / bins.length;
  const bars = bins
    .map((b, i) => {
      const bh = (b.valeur / max) * (h - 28);
      const x = 8 + i * barW;
      return `<rect x="${x + 2}" y="${h - 16 - bh}" width="${Math.max(4, barW - 4)}" height="${bh}" fill="#D7D2CB" rx="2"/>`;
    })
    .join('');
  let curseur = '';
  if (position != null && bins.length > 0) {
    const idx = Math.min(bins.length - 1, Math.max(0, position));
    const x = 8 + (idx + 0.5) * barW;
    curseur = `<line x1="${x}" y1="8" x2="${x}" y2="${h - 16}" stroke="${accent}" stroke-width="2"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${bars}${curseur}</svg>`;
}

export function binsPrixM2(prixM2: readonly number[], n = 7): PointMarche[] {
  if (prixM2.length === 0) return [];
  const min = Math.min(...prixM2);
  const max = Math.max(...prixM2);
  const span = max - min || 1;
  const counts = Array.from({ length: n }, () => 0);
  for (const v of prixM2) {
    const i = Math.min(n - 1, Math.floor(((v - min) / span) * n));
    counts[i]! += 1;
  }
  return counts.map((valeur, i) => ({
    label: String(Math.round(min + (i + 0.5) * (span / n))),
    valeur,
  }));
}

export function indexBin(prixM2: number, bins: readonly PointMarche[], source: readonly number[]): number | null {
  if (bins.length === 0 || source.length === 0) return null;
  const min = Math.min(...source);
  const max = Math.max(...source);
  const span = max - min || 1;
  return Math.min(bins.length - 1, Math.floor(((prixM2 - min) / span) * bins.length));
}
