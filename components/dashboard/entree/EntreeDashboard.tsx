'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { CLE_CONNEXION, CLE_JOUR, CLE_LOGO, connexionRecente, deciderEntree, jourParis } from '@/lib/entree/entree';

/** Le voile s'est dissipé : la superposition peut partir. */
const DUREE_VOILE_MS = 1200;
/** Après l'arrivée du vrai contenu de l'Accueil, le temps de sa cascade. */
const APRES_CONTENU_MS = 2400;
/** Au plus tard, la coque redevient immobile. */
const DUREE_MAX_MS = 6500;

const abonnerRien = () => () => undefined;

/**
 * Le mode strict monte le composant deux fois et le premier passage vide le
 * stockage. Sans cette retenue, le second montage n'aurait plus de scène.
 */
let sceneRetenue: boolean | undefined;

function retenirScene(): boolean {
  if (sceneRetenue === undefined) sceneRetenue = preparerScene();
  return sceneRetenue;
}

function lire(stockage: 'local' | 'session', cle: string): string | null {
  try {
    return (stockage === 'local' ? window.localStorage : window.sessionStorage).getItem(cle);
  } catch {
    return null;
  }
}

/** Le voile de la superposition, décidé au premier rendu dans le navigateur (jamais à l'hydratation). */
function preparerScene(): boolean {
  const mouvementReduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const connexion = connexionRecente(lire('session', CLE_CONNEXION));
  // La superposition prolonge la page de connexion : elle n'a de sens que juste après.
  return Boolean(
    connexion &&
      deciderEntree({ connexion, dernierJour: lire('local', CLE_JOUR), aujourdhui: jourParis(), mouvementReduit }) === 'grande',
  );
}

/**
 * L'entrée dans l'outil. Après une connexion, la page de connexion se fond dans
 * la coque. Le logo de la barre apparaît sur place : il ne voyage pas.
 * À la première ouverture du jour, la coque et l'Accueil s'animent seuls.
 * Rien ne bloque les clics.
 */
export default function EntreeDashboard() {
  const pathname = usePathname();
  const estClient = useSyncExternalStore(abonnerRien, () => true, () => false);
  const [scene, setScene] = useState(false);
  const [prete, setPrete] = useState(false);
  const [fini, setFini] = useState(false);
  const voile = useRef<HTMLDivElement>(null);
  const cheminDepart = useRef(pathname);

  // Après l'hydratation : la scène se décide ici, là où le stockage est lisible.
  useLayoutEffect(() => {
    if (!estClient) return;
    setScene(retenirScene());
    setPrete(true);
  }, [estClient]);

  // Avant la première image : la coque prend le marqueur, la superposition s'anime.
  useLayoutEffect(() => {
    if (!prete) return;
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
    if (scene && voile.current) {
      // Le voile reste un instant : on voit la carte de connexion devenir la coque.
      animations.push(
        voile.current.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 900,
          delay: 160,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
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
    const finScene = scene ? window.setTimeout(() => setFini(true), DUREE_VOILE_MS) : undefined;

    return () => {
      observateur?.disconnect();
      window.clearTimeout(arret);
      window.clearTimeout(finScene);
      for (const a of animations) a.cancel();
      // Le marqueur reste : la coque part avec ce composant, et un second montage (mode strict) le reprend.
    };
    // Relancé quand la scène est prête : les refs du portail existent alors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prete, scene]);

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
    </div>,
    document.body,
  );
}
