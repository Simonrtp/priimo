/**
 * Les annonces de particuliers à prospecter : la Liste de Prospection et
 * « Mes nouvelles adresses » (accueil) en lisent la même sélection, pour que
 * « Voir tout » retrouve exactement le compte annoncé. Pur.
 *
 * Un logement publié sur PAP et SeLoger ne compte qu'une fois.
 */
import type { Zone } from '@/lib/zones/types';
import { adresseVisible, regrouperAnnonces } from './presenter';
import { dansMonSecteur } from './secteur';
import type { Annonce, GroupeAnnonce } from './types';

export type Portee = 'mien' | 'agence';

export function aUnSecteur(zones: readonly Zone[], profileId: string): boolean {
  return zones.some((z) => z.assignedTo === profileId);
}

/** Adresse affirmée (retrouvée ou publiée), pas seulement la rue ou le quartier. */
export function adresseVerifiee(annonce: Annonce): boolean {
  return Boolean(annonce.adresse) && adresseVisible(annonce.confiance);
}

function date(a: Annonce): string {
  return a.publieeLe ?? a.premiereVueLe ?? '';
}

/**
 * Actives, de particuliers, dans mon secteur (ou toute l'agence) ; la plus
 * récente d'abord. Dans un logement à plusieurs portails, l'annonce qui porte
 * l'adresse passe devant.
 */
export function annoncesAProspecter(
  annonces: readonly Annonce[],
  zones: readonly Zone[],
  opts: { profileId: string; portee: Portee },
): GroupeAnnonce[] {
  const retenues = annonces.filter(
    (a) =>
      a.statut === 'active' &&
      a.typeVendeur === 'particulier' &&
      (opts.portee === 'agence' || dansMonSecteur(a, zones, { directeur: false, profileId: opts.profileId })),
  );
  return regrouperAnnonces(retenues)
    .map((g) => ({ ...g, principale: g.annonces.find(adresseVerifiee) ?? g.principale }))
    .sort((x, y) => {
      const dx = x.annonces.reduce((m, a) => (date(a) > m ? date(a) : m), '');
      const dy = y.annonces.reduce((m, a) => (date(a) > m ? date(a) : m), '');
      return dy.localeCompare(dx);
    });
}
