'use client';

import { masquerSurLaCarte } from '@/lib/annonces/import/recherche';
import { oublierAnnonceAjoutee, relireAnnoncesAjoutees } from '@/lib/annonces/useAnnoncesSecteur';

const enCours = new Set<string>();

/** Retire le point de la carte de l'agence. La fiche du panneau, s'il y en a une, reste. */
export async function retirerAnnonceDeLaCarte(annonceId: string): Promise<boolean> {
  if (enCours.has(annonceId)) return true;
  enCours.add(annonceId);
  try {
    const r = await fetch('/api/dashboard/annonces/retirer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ annonceId }),
    });
    if (!r.ok) return false;
    oublierAnnonceAjoutee(annonceId);
    masquerSurLaCarte(annonceId);
    return true;
  } catch {
    return false;
  } finally {
    enCours.delete(annonceId);
  }
}

export async function retirerOuPrevenir(annonceId: string, prevenir: (message: string) => void): Promise<boolean> {
  const ok = await retirerAnnonceDeLaCarte(annonceId);
  if (!ok) {
    relireAnnoncesAjoutees();
    prevenir('Impossible de retirer cette annonce de la carte.');
  }
  return ok;
}
