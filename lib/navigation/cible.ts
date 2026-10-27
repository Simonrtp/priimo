/**
 * Navigation instantanée : ce qu'un clic annonce, avant que le serveur ait
 * répondu. L'écran change tout de suite (onglet actif, squelette) ; la vraie
 * page prend la place du squelette dès qu'elle arrive.
 */

import { resoudreProspectionVue, type ProspectionVue } from '@/lib/prospection/vue';

export type Emplacement = { pathname: string; search: string };

/** « /dashboard/ » et « /dashboard » sont le même écran. */
export function normaliserChemin(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function emplacementDe(href: string): Emplacement {
  const url = new URL(href, 'http://priimo.local');
  return { pathname: normaliserChemin(url.pathname), search: url.search.replace(/^\?/, '') };
}

export function cleEmplacement(e: Emplacement): string {
  return `${e.pathname}?${e.search}`;
}

/**
 * La vue de prospection affichée à cet emplacement, ou null hors prospection.
 * `/dashboard/carte` et `/dashboard/annonces` redirigent vers la prospection.
 */
export function vueProspection(e: Emplacement): ProspectionVue | null {
  if (e.pathname === '/dashboard/carte') return 'carte';
  if (e.pathname === '/dashboard/annonces') return 'liste';
  if (e.pathname !== '/dashboard/prospection') return null;
  const p = new URLSearchParams(e.search);
  return resoudreProspectionVue({
    vue: p.get('vue'),
    lead: p.get('lead'),
    filtre: p.get('filtre'),
    fraicheur: p.get('fraicheur'),
  });
}

/**
 * - `page` : un autre écran — le squelette remplace la page presque aussitôt.
 * - `vue` : Carte ↔ Liste ou Pipeline — la pastille glisse d'abord, puis squelette.
 * - `sur-place` : Liste ↔ Pipeline, un filtre, une fiche ouverte — l'écran se
 *   met à jour seul, sans squelette.
 * - `aucun` : on y est déjà.
 */
export type Changement = 'aucun' | 'sur-place' | 'vue' | 'page';

export function changement(ici: Emplacement, vers: Emplacement): Changement {
  const a = vueProspection(ici);
  const b = vueProspection(vers);
  if (a && b) {
    if (ici.pathname === vers.pathname && ici.search === vers.search) return 'aucun';
    return (a === 'carte') !== (b === 'carte') ? 'vue' : 'sur-place';
  }
  if (ici.pathname !== vers.pathname) return 'page';
  return ici.search === vers.search ? 'aucun' : 'sur-place';
}
