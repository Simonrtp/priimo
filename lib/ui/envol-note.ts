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
};

const CIBLE_NOTES = 'informations_terrain';
/** Cloche du header : « Suivre un immeuble » s’envole ici. */
export const CIBLE_CLOCHE = 'cloche';

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
  // Repli notes : l’agent n’est pas sur l’Accueil, la nav suffit.
  if (nom === CIBLE_NOTES) {
    for (const el of document.querySelectorAll<HTMLElement>('a[href="/dashboard"]')) {
      if (/accueil/i.test(el.textContent ?? '') && visible(el)) return { el, couleur: null, carte: false };
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

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function attendre(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

/**
 * Lance l'envol. `feuille` : l'élément qui se ferme (on en garde une copie qui
 * rétrécit). `depart` : d'où part le point (le bouton touché), sinon le centre
 * de la feuille. `voile` : le fond assombri qui doit s'effacer en douceur.
 */
export function envolerNote(opts: {
  feuille?: HTMLElement | null;
  depart?: DOMRect | null;
  voile?: string | null;
  compte: boolean;
  cible?: string;
}): void {
  if (typeof window === 'undefined') return;
  const t0 = Date.now();
  const nomCible = opts.cible ?? CIBLE_NOTES;
  const cible = trouverCible(nomCible);
  const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!cible || reduit) {
    if (cible?.carte) annoncer({ cible: nomCible, compte: opts.compte, t0 });
    return;
  }
  const couleur = cible.couleur || variable('--primary-500', '#6366f1');
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
  const TAILLE = 18;

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

    // 3. La cible doit être visible : on la rapproche si besoin.
    let arrivee = cible.el.getBoundingClientRect();
    if (arrivee.top < 0 || arrivee.bottom > window.innerHeight) {
      cible.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      await attendre(420);
      arrivee = cible.el.getBoundingClientRect();
    }
    const xFin = arrivee.left + arrivee.width / 2;
    const yFin = arrivee.top + arrivee.height / 2;

    // 4. Le vol : un arc, le point en tête, une traînée qui s'estompe.
    const point = (taille: number, opacite: number) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${taille}px`,
        height: `${taille}px`,
        borderRadius: '50%',
        background: couleur,
        opacity: String(opacite),
        boxShadow: taille >= TAILLE ? `0 0 0 6px color-mix(in srgb, ${couleur} 22%, transparent), 0 6px 18px color-mix(in srgb, ${couleur} 45%, transparent)` : 'none',
        willChange: 'transform',
      });
      calque.appendChild(el);
      return el;
    };
    const tete = point(TAILLE, 1);
    const trainee = [point(11, 0.45), point(8, 0.28), point(6, 0.16)];

    const distance = Math.hypot(xFin - xDepart, yFin - yDepart);
    const duree = Math.min(820, Math.max(520, distance * 0.9));
    // Point de contrôle au-dessus du milieu : la note monte avant de redescendre.
    const cx = (xDepart + xFin) / 2 + (xFin > xDepart ? -1 : 1) * distance * 0.12;
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

    // 5. L'impact : le point se fond dans le chiffre, qui monte.
    annoncer({ cible: nomCible, compte: opts.compte && cible.carte, t0 });
    for (const el of trainee) el.remove();
    const impact = tete.animate(
      [
        { opacity: 1, transform: `${tete.style.transform}` },
        { opacity: 0, transform: `${tete.style.transform} scale(2.2)` },
      ],
      { duration: 260, easing: 'ease-out', fill: 'forwards' },
    );
    await impact.finished.catch(() => undefined);
    calque.remove();
  })();
}
