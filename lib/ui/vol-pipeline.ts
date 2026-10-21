export const SELECTEUR_PIPELINE = '[data-prospection-vue="pipeline"]';
export const VOL_CHIP = { w: 216, h: 40 } as const;
export const VOL_BILLE = { w: 16, h: 16 } as const;
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
export function pointsVol(origine: RectLike, cible: RectLike, chip: { readonly w: number; readonly h: number } = VOL_CHIP) {
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

export type VolBille = {
  id: string;
  start: PointVol;
  mid: PointVol;
  end: PointVol;
};

/** La bille orange part du bouton et l’onglet Pipeline s’allume. */
export function lancerBilleVersPipeline(origine: HTMLElement | null | undefined): void {
  if (typeof document === 'undefined') return;
  const vol = mesurerVolBille(origine);
  const cible = elementPipelineVisible();
  if (cible) cible.classList.add('pipeline-attend');
  const relacher = () => {
    pulseOngletPipeline();
    window.setTimeout(() => cible?.classList.remove('pipeline-attend'), 700);
  };
  if (!vol) {
    relacher();
    return;
  }
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.className =
    'pointer-events-none fixed left-0 top-0 z-[80] rounded-full bg-[#E8743C] shadow-[0_4px_12px_rgba(232,116,60,0.45)]';
  el.style.width = `${VOL_BILLE.w}px`;
  el.style.height = `${VOL_BILLE.h}px`;
  el.style.transform = `translate3d(${vol.start.x}px, ${vol.start.y}px, 0)`;
  document.body.appendChild(el);
  const anim = el.animate(keyframesVol(vol), {
    duration: VOL_DUREE_MS,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fill: 'forwards',
  });
  const fin = () => {
    el.remove();
    relacher();
  };
  anim.onfinish = fin;
  anim.oncancel = fin;
}

/** Petite bille orange : du bouton + jusqu’à l’onglet Pipeline. */
export function mesurerVolBille(origine: HTMLElement | null | undefined): VolBille | null {
  if (typeof document === 'undefined' || prefereMouvementReduit()) return null;
  const cible = elementPipelineVisible();
  const from = origine?.getBoundingClientRect();
  if (!cible || !from || from.width < 4) return null;
  return {
    id: `bille-${Date.now()}`,
    ...pointsVol(from, cible.getBoundingClientRect(), VOL_BILLE),
  };
}
