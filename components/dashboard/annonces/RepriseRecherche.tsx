'use client';

import { useSessionRecherche } from '@/lib/annonces/import/recherche';

/** Garde la lecture vivante quand le panneau Annonces n'est pas à l'écran. */
export default function RepriseRecherche() {
  useSessionRecherche();
  return null;
}
