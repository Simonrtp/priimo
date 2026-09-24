export const SELECTEUR_PIPELINE = '[data-prospection-vue="pipeline"]';
export const VOL_CHIP = { w: 216, h: 40 } as const;
export const VOL_DUREE_MS = 520;

export type PointVol = { x: number; y: number };

export type VolLead = {
  id: string;
  score: number;
  adresse: string;
  start: PointVol;
  mid: PointVol;
  end: PointVol;
};

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Départ à gauche du lead, arrivée au centre de l’onglet, arc vers le haut. */
export function pointsVol(origine: RectLike, cible: RectLike, chip = VOL_CHIP) {
  const start: PointVol = {
    x: origine.left + Math.min(16, Math.max(0, origine.width * 0.06)),
    y: origine.top + origine.height / 2 - chip.h / 2,
  };
  const end: PointVol = {
    x: cible.left + cible.width / 2 - chip.w / 2,
    y: cible.top + cible.height / 2 - chip.h / 2,
  };
  const portee = Math.hypot(end.x - start.x, end.y - start.y);
  const lift = Math.min(88, Math.max(32, portee * 0.18));
  const mid: PointVol = {
    x: (start.x + end.x) / 2,
    y: Math.min(start.y, end.y) - lift,
  };
  return { start, mid, end };
}

export function keyframesVol(points: Pick<VolLead, 'start' | 'mid' | 'end'>): Keyframe[] {
  return [
    {
      transform: `translate3d(${points.start.x}px, ${points.start.y}px, 0) scale(1)`,
      opacity: 1,
    },
    {
      transform: `translate3d(${points.mid.x}px, ${points.mid.y}px, 0) scale(0.72)`,
      opacity: 1,
      offset: 0.48,
    },
    {
      transform: `translate3d(${points.end.x}px, ${points.end.y}px, 0) scale(0.22)`,
      opacity: 0.12,
    },
  ];
}

export function prefereMouvementReduit(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function elementPipelineVisible(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll<HTMLElement>(SELECTEUR_PIPELINE);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom < 0 || r.right < 0) continue;
    if (r.top > window.innerHeight || r.left > window.innerWidth) continue;
    return el;
  }
  return null;
}

export function pulseOngletPipeline(): void {
  const el = elementPipelineVisible();
  if (!el) return;
  el.classList.remove('pipeline-recoit');
  void el.offsetWidth;
  el.classList.add('pipeline-recoit');
  const fin = () => {
    el.classList.remove('pipeline-recoit');
    el.removeEventListener('animationend', fin);
  };
  el.addEventListener('animationend', fin);
}

export function mesurerVolLead(opts: {
  id: string;
  score: number;
  adresse: string;
  origine: HTMLElement | null | undefined;
}): VolLead | null {
  if (typeof document === 'undefined' || prefereMouvementReduit()) return null;
  const cible = elementPipelineVisible();
  if (!cible) return null;
  const fromEl =
    opts.origine?.closest<HTMLElement>('[data-lead-card]') ??
    document.querySelector<HTMLElement>(
      `[data-lead-card][data-lead-id="${CSS.escape(opts.id)}"]`,
    ) ??
    opts.origine ??
    null;
  const from = fromEl?.getBoundingClientRect();
  if (!from || from.width < 4) return null;
  return {
    id: `${opts.id}-${Date.now()}`,
    score: opts.score,
    adresse: opts.adresse,
    ...pointsVol(from, cible.getBoundingClientRect()),
  };
}
