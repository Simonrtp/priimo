/**
 * Un secteur ne se définit que sur la carte de prospection
 * (`useDessinSecteur` dans SectorMapClient / CarteMobile).
 * L’Accueil, la mise en place et les anciens ateliers n’ouvrent plus de
 * dessin : ils envoient ici.
 */
export function hrefAtelierSecteur(zoneId: string = 'nouveau'): string {
  return `/dashboard/prospection?vue=carte&atelier=${encodeURIComponent(zoneId)}`;
}

/** @deprecated Préférer `hrefAtelierSecteur` + `router.push`. */
export const EVENEMENT_ATELIER_SECTEUR = 'priimo:atelier-secteur';

export function ouvrirAtelierSecteur() {
  if (typeof window === 'undefined') return;
  window.location.assign(hrefAtelierSecteur());
}
