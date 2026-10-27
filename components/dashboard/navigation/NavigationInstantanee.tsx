'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  changement,
  cleEmplacement,
  emplacementDe,
  normaliserChemin,
  type Changement,
  type Emplacement,
} from '@/lib/navigation/cible';

/**
 * Un clic change l'écran tout de suite, sans attendre le serveur : l'onglet
 * actif bascule, puis un squelette prend la place de la page jusqu'à ce que
 * la vraie arrive. Rien n'est préchargé au démarrage.
 */

type Cible = {
  vers: Emplacement;
  /** L'adresse au moment du clic : dès qu'elle change, la nouvelle page est là. */
  depuis: string;
  changement: Changement;
};

/**
 * Délai avant le squelette. Un écran déjà en cache arrive avant : pas de
 * squelette qui clignote. Une vue attend que la pastille ait glissé (300 ms).
 */
const DELAI_SQUELETTE: Record<'page' | 'vue', number> = { page: 90, vue: 300 };
/** Une navigation qui n'aboutit pas rend la page d'avant. */
const ABANDON_MS = 15_000;

type Valeur = {
  ici: Emplacement;
  cible: Cible | null;
  squelette: Cible | null;
  annoncer: (href: string) => void;
  naviguer: (href: string, opts?: { remplacer?: boolean }) => void;
};

const Contexte = createContext<Valeur | null>(null);

export function NavigationInstantaneeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const ici = useMemo(() => ({ pathname: normaliserChemin(pathname), search }), [pathname, search]);
  const cleIci = cleEmplacement(ici);

  const [cible, setCible] = useState<Cible | null>(null);
  const [squelette, setSquelette] = useState<Cible | null>(null);

  // L'adresse a changé (la page est arrivée, ou une redirection, ou un retour
  // arrière) : l'attente est finie.
  const [vu, setVu] = useState(cleIci);
  if (vu !== cleIci) {
    setVu(cleIci);
    setCible(null);
    setSquelette(null);
  }

  useEffect(() => {
    if (!cible) return;
    const attente =
      cible.changement === 'page' || cible.changement === 'vue'
        ? window.setTimeout(() => setSquelette(cible), DELAI_SQUELETTE[cible.changement])
        : 0;
    const abandon = window.setTimeout(() => {
      setCible(null);
      setSquelette(null);
    }, ABANDON_MS);
    return () => {
      window.clearTimeout(attente);
      window.clearTimeout(abandon);
    };
  }, [cible]);

  const annoncer = useCallback(
    (href: string) => {
      const vers = emplacementDe(href);
      const quoi = changement(ici, vers);
      if (quoi === 'aucun') return;
      setCible({ vers, depuis: cleIci, changement: quoi });
    },
    [ici, cleIci],
  );

  const naviguer = useCallback(
    (href: string, opts?: { remplacer?: boolean }) => {
      annoncer(href);
      if (opts?.remplacer) router.replace(href, { scroll: false });
      else router.push(href);
    },
    [annoncer, router],
  );

  const valeur = useMemo<Valeur>(
    () => ({ ici, cible, squelette: squelette === cible ? squelette : null, annoncer, naviguer }),
    [ici, cible, squelette, annoncer, naviguer],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useNavigationInstantanee(): Pick<Valeur, 'annoncer' | 'naviguer'> {
  const ctx = useContext(Contexte);
  const router = useRouter();
  return useMemo(
    () =>
      ctx ?? {
        annoncer: () => undefined,
        naviguer: (href, opts) => (opts?.remplacer ? router.replace(href, { scroll: false }) : router.push(href)),
      },
    [ctx, router],
  );
}

/** L'écran que l'agent a demandé : la cible du clic tant que la page n'est pas là. */
export function useEmplacementAffiche(): Emplacement {
  const ctx = useContext(Contexte);
  const pathname = usePathname();
  if (!ctx) return { pathname: normaliserChemin(pathname), search: '' };
  return ctx.cible?.vers ?? ctx.ici;
}

/**
 * L'écran que montre la zone de contenu : le squelette demandé, sinon la page.
 * Ce qui encadre la page (bandeau mobile) suit celui-ci, pas le clic : il ne
 * change pas pendant que la pastille glisse.
 */
export function useEmplacementDeLaPage(): Emplacement {
  const ctx = useContext(Contexte);
  const pathname = usePathname();
  if (!ctx) return { pathname: normaliserChemin(pathname), search: '' };
  return ctx.squelette?.vers ?? ctx.ici;
}

/** L'écran dont il faut montrer le squelette à la place de la page, ou null. */
export function useSqueletteEnAttente(): Emplacement | null {
  return useContext(Contexte)?.squelette?.vers ?? null;
}
