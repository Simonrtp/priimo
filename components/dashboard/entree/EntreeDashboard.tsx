'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { PRIIMO_LOGO_WORDMARK } from '@/components/brand/PriimoLogo';
import { useUser } from '@/lib/hooks/useUser';
import { CLE_CONNEXION, CLE_JOUR, CLE_LOGO, connexionRecente, deciderEntree, jourParis, salutation } from '@/lib/entree/entree';

type Cadre = { x: number; y: number; w: number; h: number };
type Scene = { salut: string; logo: Cadre };

/** Proportions du logo Priimo (wordmark). */
const RATIO_LOGO = 2446 / 1153;
/** Fin de la superposition (logo et salutation), en ms. */
const DUREE_SCENE_MS = 1300;
/** Après l'arrivée du vrai contenu de l'Accueil, le temps de sa cascade. */
const APRES_CONTENU_MS = 1800;
/** Au plus tard, la coque redevient immobile. */
const DUREE_MAX_MS = 6500;

const abonnerRien = () => () => undefined;

function lire(stockage: 'local' | 'session', cle: string): string | null {
  try {
    return (stockage === 'local' ? window.localStorage : window.sessionStorage).getItem(cle);
  } catch {
    return null;
  }
}

/** La scène de la superposition, décidée au premier rendu dans le navigateur (jamais à l'hydratation). */
function preparerScene(prenom: string | null): Scene | null {
  const mouvementReduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const connexion = connexionRecente(lire('session', CLE_CONNEXION));
  // La superposition prolonge la page de connexion : elle n'a de sens que juste après.
  if (!connexion || deciderEntree({ connexion, dernierJour: lire('local', CLE_JOUR), aujourdhui: jourParis(), mouvementReduit }) !== 'grande') {
    return null;
  }
  let logo: Cadre | null = null;
  try {
    const brut = JSON.parse(lire('session', CLE_LOGO) ?? 'null') as Cadre | null;
    if (brut && [brut.x, brut.y, brut.w, brut.h].every((n) => Number.isFinite(n)) && brut.w > 0 && brut.h > 0) logo = brut;
  } catch {
    logo = null;
  }
  if (!logo) {
    const h = 48;
    const w = h * RATIO_LOGO;
    logo = { x: window.innerWidth / 2 - w / 2, y: window.innerHeight / 2 - 190, w, h };
  }
  return { salut: salutation(prenom, new Date().getHours()), logo };
}

/** Le premier élément visible qui répond au sélecteur (barre latérale repliée ou non, bureau ou mobile). */
function cibleVisible(selecteur: string): { el: HTMLElement; r: DOMRect } | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selecteur))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { el, r };
  }
  return null;
}

/**
 * L'entrée dans l'outil. Après une connexion : la page de connexion se fond dans
 * la coque, le logo vole jusqu'à la barre latérale et « Bonjour Simon » file
 * vers l'avatar. À la première ouverture du jour (page chargée en entier), la
 * coque et l'Accueil s'animent seuls (posé avant rendu par le script d'entrée).
 * Rien ne bloque les clics ; tout est fini en moins de deux secondes.
 */
export default function EntreeDashboard() {
  const { profile } = useUser();
  const pathname = usePathname();
  const estClient = useSyncExternalStore(abonnerRien, () => true, () => false);
  const [scene] = useState<Scene | null>(() => (estClient ? preparerScene(profile.first_name ?? null) : null));
  const [fini, setFini] = useState(false);
  const voile = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLImageElement>(null);
  const salut = useRef<HTMLParagraphElement>(null);
  const cheminDepart = useRef(pathname);

  // Avant la première image : la coque prend le marqueur, la superposition s'anime.
  useLayoutEffect(() => {
    const racine = document.querySelector<HTMLElement>('[data-entree-racine]');
    if (!racine) return;
    if (scene) racine.setAttribute('data-entree', 'grande');
    if (racine.getAttribute('data-entree') !== 'grande') return;

    try {
      window.localStorage.setItem(CLE_JOUR, jourParis());
      window.sessionStorage.removeItem(CLE_CONNEXION);
      window.sessionStorage.removeItem(CLE_LOGO);
    } catch {
      // Stockage indisponible (navigation privée) : l'entrée rejouera, rien de plus.
    }

    const animations: Animation[] = [];
    if (scene && voile.current && logo.current && salut.current) {
      const doux = 'cubic-bezier(0.22, 1, 0.36, 1)';
      // Le voile part vite : on voit la carte de connexion devenir la coque.
      animations.push(voile.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 60, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }));

      const depart = scene.logo;
      const cible = cibleVisible('#dashboard-sidebar a[aria-label="Priimo"]');
      if (cible) {
        const arrivee = cible.r;
        // Le vrai logo attend l'atterrissage : jamais deux logos à l'écran.
        animations.push(cible.el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.99 }, { opacity: 1 }], { duration: 930 }));
        const dx = arrivee.left + arrivee.width / 2 - (depart.x + depart.w / 2);
        const dy = arrivee.top + arrivee.height / 2 - (depart.y + depart.h / 2);
        const s = Math.min(arrivee.width / depart.w, arrivee.height / depart.h);
        animations.push(
          logo.current.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], {
            duration: 760,
            delay: 140,
            easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
            fill: 'forwards',
          }),
          logo.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay: 920, fill: 'forwards' }),
        );
      } else {
        animations.push(
          logo.current.animate([{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(-28px) scale(0.92)', opacity: 0 }], {
            duration: 560,
            delay: 260,
            easing: doux,
            fill: 'forwards',
          }),
        );
      }

      animations.push(salut.current.animate([{ opacity: 0, transform: 'translate(-50%, 14px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 380, delay: 60, easing: doux, fill: 'both' }));
      const avatar = cibleVisible('a[aria-label="Mon profil"]')?.r;
      const p = salut.current.getBoundingClientRect();
      const vers = avatar
        ? `translate(calc(-50% + ${avatar.left + avatar.width / 2 - (p.left + p.width / 2)}px), ${avatar.top + avatar.height / 2 - (p.top + p.height / 2)}px) scale(0.22)`
        : 'translate(-50%, -24px) scale(0.96)';
      animations.push(
        salut.current.animate([{ opacity: 1, transform: 'translate(-50%, 0) scale(1)' }, { opacity: 0, transform: vers }], {
          duration: 520,
          delay: 640,
          easing: 'cubic-bezier(0.55, 0, 0.45, 1)',
          fill: 'forwards',
        }),
      );
    }

    // La coque redevient immobile une fois le vrai contenu de l'Accueil arrivé et déroulé.
    let arret: number | undefined;
    const finir = () => racine.removeAttribute('data-entree');
    const contenuArrive = () => racine.querySelector('[data-accueil]:not([data-accueil-amorce])') != null;
    const planifier = (ms: number) => {
      window.clearTimeout(arret);
      arret = window.setTimeout(finir, ms);
    };
    let observateur: MutationObserver | null = null;
    if (contenuArrive()) planifier(APRES_CONTENU_MS);
    else {
      planifier(DUREE_MAX_MS);
      observateur = new MutationObserver(() => {
        if (!contenuArrive()) return;
        observateur?.disconnect();
        planifier(APRES_CONTENU_MS);
      });
      observateur.observe(racine, { childList: true, subtree: true });
    }
    const finScene = window.setTimeout(() => setFini(true), DUREE_SCENE_MS);

    return () => {
      observateur?.disconnect();
      window.clearTimeout(arret);
      window.clearTimeout(finScene);
      for (const a of animations) a.cancel();
      // Le marqueur reste : la coque part avec ce composant, et un second montage (mode strict) le reprend.
    };
    // Une seule fois, au montage de la coque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changer de page pendant l'entrée : la nouvelle page arrive immobile.
  useEffect(() => {
    if (pathname === cheminDepart.current) return;
    document.querySelector('[data-entree-racine]')?.removeAttribute('data-entree');
  }, [pathname]);

  if (!scene || fini) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[95]">
      <div
        ref={voile}
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(900px 700px at 18% 22%, rgba(232, 116, 60, 0.07), transparent 65%)',
            'radial-gradient(820px 620px at 84% 70%, rgba(232, 116, 60, 0.055), transparent 65%)',
            '#FAFAF9',
          ].join(', '),
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={logo}
        src={PRIIMO_LOGO_WORDMARK}
        alt=""
        className="absolute rounded-xl object-contain"
        style={{ left: scene.logo.x, top: scene.logo.y, width: scene.logo.w, height: scene.logo.h, transformOrigin: 'center' }}
      />
      <p
        ref={salut}
        className="absolute left-1/2 top-[52%] whitespace-nowrap font-display text-[clamp(32px,4vw,54px)] font-extrabold tracking-tight text-text-strong opacity-0"
        style={{ transform: 'translate(-50%, 14px)', transformOrigin: 'center' }}
      >
        {scene.salut}
      </p>
    </div>,
    document.body,
  );
}
