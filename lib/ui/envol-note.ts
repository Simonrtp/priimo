/**
 * Où part la note : la feuille rétrécit en un point, le point vole jusqu'au
 * compteur « Notes terrain », le chiffre monte à l'impact.
 *
 * Indépendant de React : la feuille se ferme pendant l'animation, qui vit dans
 * un calque posé sur `document.body` et se retire seule. Les cartes cibles se
 * signalent par `data-envol-cible` ; l'arrivée est annoncée par un événement
 * que la carte écoute pour faire monter son chiffre.
 */

export const EVENEMENT_ENVOL_ARRIVE = 'priimo:envol-arrive';

export type EnvolArrive = {
  cible: string;
  /** La note fait monter ce compteur (échange ou adresse rattachée). */
  compte: boolean;
  /** Instant du rangement : un chiffre déjà rafraîchi depuis ne remonte pas deux fois. */
  t0: number;
  /** Combien le chiffre monte. Une dictée peut créer plusieurs contacts. */
  pas?: number;
};

const CIBLE_NOTES = 'informations_terrain';
export const CIBLE_CONTACTS = 'contacts_qualifies';

const COULEUR_DEFAUT: Record<string, string> = {
  [CIBLE_NOTES]: '#D61F3A',
  [CIBLE_CONTACTS]: '#0F8F4A',
};

function visible(el: Element): DOMRect | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return null;
  return r;
}

/** L’élément marqué `data-envol-cible`, sinon (notes) l’entrée Accueil. */
function trouverCible(nom: string): { el: HTMLElement; couleur: string | null; carte: boolean } | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-envol-cible="${nom}"]`)) {
    if (visible(el)) return { el, couleur: el.dataset.envolCouleur ?? null, carte: true };
  }
  // Repli : l’agent n’est pas sur l’Accueil, la nav suffit.
  if (nom === CIBLE_NOTES || nom === CIBLE_CONTACTS) {
    for (const el of document.querySelectorAll<HTMLElement>('a[href="/dashboard"]')) {
      if (/accueil/i.test(el.textContent ?? '') && visible(el)) {
        return { el, couleur: COULEUR_DEFAUT[nom] ?? null, carte: false };
      }
    }
  }
  return null;
}

/** Quelle carte fait monter : toute note rangée va aux notes terrain. */
export function cibleEnvolNote(_opts?: { echange?: boolean; rattachee?: boolean }): string {
  return CIBLE_NOTES;
}

function variable(nom: string, defaut: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || defaut;
}

function annoncer(detail: EnvolArrive) {
  window.dispatchEvent(new CustomEvent<EnvolArrive>(EVENEMENT_ENVOL_ARRIVE, { detail }));
}

/** Fait monter un compteur de l'accueil sans envol, dès que l'agent a rangé. */
export function annoncerCompteur(cible: string, pas: number): void {
  if (typeof window === 'undefined' || pas <= 0) return;
  annoncer({ cible, compte: true, t0: Date.now(), pas });
}

const TAILLE = 18;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function attendre(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

/**
 * Lance l'envol. `feuille` : l'élément qui se ferme (on en garde une copie qui
 * rétrécit). `depart` : d'où part le point (le bouton touché), sinon le centre
 * de la feuille. `voile` : le fond assombri qui doit s'effacer en douceur.
 */
export type EnvolAussi = {
  cible: string;
  compte: boolean;
  pas?: number;
};

export function envolerNote(opts: {
  feuille?: HTMLElement | null;
  depart?: DOMRect | null;
  voile?: string | null;
  compte: boolean;
  cible?: string;
  pas?: number;
  /** Autres pastilles qui partent en même temps (nouveau contact, …). */
  aussi?: readonly EnvolAussi[];
}): void {
  if (typeof window === 'undefined') return;
  const t0 = Date.now();
  const vols: EnvolAussi[] = [
    { cible: opts.cible ?? CIBLE_NOTES, compte: opts.compte, pas: opts.pas },
    ...(opts.aussi ?? []),
  ];
  const premier = trouverCible(vols[0]!.cible);
  const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!premier || reduit) {
    for (const vol of vols) {
      const cible = trouverCible(vol.cible);
      if (cible?.carte) annoncer({ cible: vol.cible, compte: vol.compte, t0, pas: vol.pas });
    }
    return;
  }
  const couleur = premier.couleur || COULEUR_DEFAUT[vols[0]!.cible] || variable('--primary-500', '#6366f1');
  // Une variable CSS ne s'anime pas : on lit la couleur réelle de la feuille.
  const fond = variable('--surface', '#ffffff');

  const calque = document.createElement('div');
  calque.setAttribute('aria-hidden', 'true');
  Object.assign(calque.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '300' });
  document.body.appendChild(calque);

  const rectFeuille = opts.feuille?.getBoundingClientRect() ?? null;
  const depart = opts.depart ?? rectFeuille;
  const xDepart = depart ? depart.left + depart.width / 2 : window.innerWidth / 2;
  const yDepart = depart ? depart.top + depart.height / 2 : window.innerHeight * 0.75;

  // 1. Le voile s'efface au lieu de disparaître d'un coup.
  if (opts.voile) {
    const voile = document.createElement('div');
    Object.assign(voile.style, { position: 'absolute', inset: '0', background: opts.voile });
    calque.appendChild(voile);
    voile.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' });
  }

  // 2. La feuille rétrécit jusqu'au point, en prenant la couleur de la carte.
  if (opts.feuille && rectFeuille && rectFeuille.width > 0) {
    const coque = document.createElement('div');
    const r = rectFeuille;
    Object.assign(coque.style, {
      position: 'absolute',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      overflow: 'hidden',
      borderRadius: window.getComputedStyle(opts.feuille).borderRadius || '24px',
      background: fond,
      boxShadow: '0 24px 60px rgba(26, 42, 86, 0.18)',
      transformOrigin: '0 0',
      willChange: 'transform, border-radius',
    });
    const copie = opts.feuille.cloneNode(true) as HTMLElement;
    Object.assign(copie.style, { width: `${r.width}px`, height: `${r.height}px`, maxHeight: 'none', margin: '0' });
    coque.appendChild(copie);
    calque.appendChild(coque);
    // La copie reprend la position de défilement : l'agent voit sa note telle quelle.
    const originaux = opts.feuille.querySelectorAll<HTMLElement>('*');
    const copies = copie.querySelectorAll<HTMLElement>('*');
    originaux.forEach((el, i) => {
      if (el.scrollTop > 0 && copies[i]) copies[i]!.scrollTop = el.scrollTop;
    });

    const sx = TAILLE / r.width;
    const sy = TAILLE / r.height;
    const fin = `translate(${xDepart - TAILLE / 2 - r.left}px, ${yDepart - TAILLE / 2 - r.top}px) scale(${sx}, ${sy})`;
    coque.animate(
      [
        { transform: 'none', borderRadius: coque.style.borderRadius, background: fond },
        { transform: fin, borderRadius: '50%', background: couleur, offset: 1 },
      ],
      { duration: 380, easing: 'cubic-bezier(0.55, 0, 0.35, 1)', fill: 'forwards' },
    );
    copie.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    window.setTimeout(() => coque.remove(), 400);
  }

  void (async () => {
    await attendre(opts.feuille ? 360 : 0);

    const premierVisible = premier.el.getBoundingClientRect();
    if (premierVisible.top < 0 || premierVisible.bottom > window.innerHeight) {
      premier.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await attendre(420);
    }

    await Promise.all(vols.map((vol, rang) => volerPastille(calque, xDepart, yDepart, vol, t0, rang)));
    calque.remove();
  })();
}

async function volerPastille(
  calque: HTMLElement,
  xDepart: number,
  yDepart: number,
  vol: EnvolAussi,
  t0: number,
  rang: number,
): Promise<void> {
  const cible = trouverCible(vol.cible);
  if (!cible) {
    if (vol.compte) annoncer({ cible: vol.cible, compte: true, t0, pas: vol.pas });
    return;
  }
  const teinte = cible.couleur || COULEUR_DEFAUT[vol.cible] || variable('--primary-500', '#6366f1');
  let arrivee = cible.el.getBoundingClientRect();
  const xFin = arrivee.left + arrivee.width / 2;
  const yFin = arrivee.top + arrivee.height / 2;

  const point = (taille: number, opacite: number) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${taille}px`,
      height: `${taille}px`,
      borderRadius: '50%',
      background: teinte,
      opacity: String(opacite),
      boxShadow:
        taille >= TAILLE
          ? `0 0 0 6px color-mix(in srgb, ${teinte} 22%, transparent), 0 6px 18px color-mix(in srgb, ${teinte} 45%, transparent)`
          : 'none',
      willChange: 'transform',
    });
    calque.appendChild(el);
    return el;
  };
  const tete = point(TAILLE, 1);
  const trainee = [point(11, 0.45), point(8, 0.28), point(6, 0.16)];

  const distance = Math.hypot(xFin - xDepart, yFin - yDepart);
  const duree = Math.min(820, Math.max(520, distance * 0.9));
  const cote = rang % 2 === 0 ? -1 : 1;
  const cx = (xDepart + xFin) / 2 + cote * distance * 0.16;
  const cy = Math.min(yDepart, yFin) - Math.max(90, distance * 0.28);
  const position = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * xDepart + 2 * u * t * cx + t * t * xFin,
      y: u * u * yDepart + 2 * u * t * cy + t * t * yFin,
    };
  };

  await new Promise<void>((resolve) => {
    const debut = performance.now();
    const pas = (maintenant: number) => {
      const brut = Math.min(1, (maintenant - debut) / duree);
      const t = easeInOut(brut);
      const p = position(t);
      const echelle = 1 + Math.sin(Math.PI * t) * 0.18 - t * 0.35;
      tete.style.transform = `translate(${p.x - TAILLE / 2}px, ${p.y - TAILLE / 2}px) scale(${echelle})`;
      trainee.forEach((el, i) => {
        const q = position(Math.max(0, t - (i + 1) * 0.07));
        const taille = parseFloat(el.style.width);
        el.style.transform = `translate(${q.x - taille / 2}px, ${q.y - taille / 2}px)`;
      });
      if (brut < 1) requestAnimationFrame(pas);
      else resolve();
    };
    requestAnimationFrame(pas);
  });

  annoncer({ cible: vol.cible, compte: vol.compte && cible.carte, t0, pas: vol.pas });
  for (const el of trainee) el.remove();
  const impact = tete.animate(
    [
      { opacity: 1, transform: `${tete.style.transform}` },
      { opacity: 0, transform: `${tete.style.transform} scale(2.2)` },
    ],
    { duration: 260, easing: 'ease-out', fill: 'forwards' },
  );
  await impact.finished.catch(() => undefined);
}
