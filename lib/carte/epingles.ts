import type { Map as MapboxMap } from 'mapbox-gl';
import type { MapPointKind } from '@/lib/carte/points';

/**
 * Épingles CRM dessinées par la carte elle-même (calque symbole), et non en
 * HTML : quelques centaines d'épingles HTML suivaient chaque image du zoom
 * (18 images/s mesurées sur 400) ou disparaissaient pendant le geste.
 */
export const EPINGLES_LAYER_ID = 'priimo-epingles';
/** L'épingle ouverte ou survolée, redessinée au-dessus des autres. */
export const EPINGLES_DESSUS_LAYER_ID = 'priimo-epingles-dessus';
export const EPINGLES_LAYER_IDS = [EPINGLES_DESSUS_LAYER_ID, EPINGLES_LAYER_ID] as const;

/** Pastille de 28 px, bordure comprise — comme l'ancienne épingle HTML. */
export const EPINGLE_RAYON = 14;
/** Côté de l'image : pastille, anneau, badge et ombre tiennent dedans. */
const COTE = 48;
const PREFIXE = 'epingle:';

export type EpingleKind = MapPointKind | 'amas';

/** Tout ce qui change le dessin : une image par combinaison. */
export type EpingleDessin = {
  couleur: string;
  kind: EpingleKind;
  /** Badge « n fiches » au-delà de 1 ; pour un amas, le nombre au centre. */
  nombre: number;
  /** Opacité de l'anneau orange (0 = pas d'anneau). */
  anneau: number;
  /** Liseré blanc autour de la pastille (arrêt retenu pour la tournée). */
  lisere: boolean;
  bordure: string;
};

export function cleImageEpingle(d: EpingleDessin): string {
  return PREFIXE + JSON.stringify([d.couleur, d.kind, d.nombre, d.anneau, d.lisere ? 1 : 0, d.bordure]);
}

export function dessinDepuisCle(cle: string): EpingleDessin | null {
  if (!cle.startsWith(PREFIXE)) return null;
  try {
    const [couleur, kind, nombre, anneau, lisere, bordure] = JSON.parse(cle.slice(PREFIXE.length)) as [
      string,
      EpingleKind,
      number,
      number,
      number,
      string,
    ];
    return { couleur, kind, nombre, anneau, lisere: lisere === 1, bordure };
  } catch {
    return null;
  }
}

/** Tracés Lucide (viewBox 24) : maison, calepin, personne — comme PinIcone. */
const ICONES: Partial<Record<EpingleKind, { chemins: string[]; cercles?: [number, number, number][] }>> = {
  bien: {
    chemins: [
      'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
      'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    ],
  },
  note: {
    chemins: [
      'M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4',
      'M2 6h4',
      'M2 10h4',
      'M2 14h4',
      'M2 18h4',
      'M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z',
    ],
  },
  contact: { chemins: ['M20 21a8 8 0 0 0-16 0'], cercles: [[12, 8, 5]] },
};

function pilule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fond: string) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
  ctx.fillStyle = fond;
  ctx.fill();
}

/** Dessine une épingle à la densité de l'écran ; null hors navigateur. */
export function dessinerEpingle(d: EpingleDessin, ratio: number, police: string): ImageData | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = COTE * ratio;
  canvas.height = COTE * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(ratio, ratio);
  const c = COTE / 2;
  const rond = (r: number, fond: string) => {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = fond;
    ctx.fill();
  };

  if (d.anneau > 0) rond(EPINGLE_RAYON + 3, `rgba(232, 116, 60, ${d.anneau})`);
  if (d.lisere) rond(EPINGLE_RAYON + 2, '#ffffff');
  // Ombre « 0 1px 3px » : flou et décalage ne suivent pas l'échelle du contexte.
  ctx.save();
  if (d.anneau === 0) {
    ctx.shadowColor = 'rgba(26, 42, 86, 0.28)';
    ctx.shadowBlur = 3 * ratio;
    ctx.shadowOffsetY = 1 * ratio;
  }
  rond(EPINGLE_RAYON, d.bordure);
  ctx.restore();
  rond(EPINGLE_RAYON - 2, d.couleur);

  const icone = ICONES[d.kind];
  if (icone) {
    ctx.save();
    ctx.translate(c - 7, c - 7);
    ctx.scale(14 / 24, 14 / 24);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const chemin of icone.chemins) ctx.stroke(new Path2D(chemin));
    for (const [x, y, r] of icone.cercles ?? []) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (d.kind === 'amas') {
    ctx.font = `700 11px ${police}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(d.nombre), c, c + 0.5);
  } else if (d.nombre > 1) {
    // Badge orange en haut à droite (top/right -5px, 16 px de haut).
    ctx.font = `700 10px ${police}`;
    const texte = String(d.nombre);
    const w = Math.max(16, ctx.measureText(texte).width + 11);
    const droite = c + EPINGLE_RAYON + 5;
    const haut = c - EPINGLE_RAYON - 5;
    pilule(ctx, droite - w, haut, w, 16, '#f4efe8');
    pilule(ctx, droite - w + 1.5, haut + 1.5, w - 3, 13, '#e8743c');
    ctx.fillStyle = '#ffffff';
    ctx.fillText(texte, droite - w / 2, haut + 8.5);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * L'épingle sous le pointeur, au rond près (l'image carrée déborde de la
 * pastille) : la plus haute gagne. null s'il n'y en a pas.
 */
export function epingleSous(map: MapboxMap, point: { x: number; y: number }): string | null {
  let couches: string[];
  try {
    couches = EPINGLES_LAYER_IDS.filter((id) => Boolean(map.getLayer(id)));
  } catch {
    return null;
  }
  if (couches.length === 0) return null;
  const marge = EPINGLE_RAYON + 4;
  const hits = map.queryRenderedFeatures(
    [
      [point.x - marge, point.y - marge],
      [point.x + marge, point.y + marge],
    ],
    { layers: couches },
  );
  let meilleur: { id: string; rang: number } | null = null;
  for (const f of hits) {
    const id = f.properties?.id;
    if (typeof id !== 'string' || f.geometry.type !== 'Point') continue;
    const [lng, lat] = f.geometry.coordinates;
    const p = map.project([lng, lat]);
    if (Math.hypot(p.x - point.x, p.y - point.y) > EPINGLE_RAYON + 2) continue;
    const ordre = typeof f.properties?.ordre === 'number' ? f.properties.ordre : 0;
    const rang = (f.layer?.id === EPINGLES_DESSUS_LAYER_ID ? 1e9 : 0) + ordre;
    if (!meilleur || rang > meilleur.rang) meilleur = { id, rang };
  }
  return meilleur?.id ?? null;
}
