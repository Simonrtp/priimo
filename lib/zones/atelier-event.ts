/** Ouvre l’atelier secteur depuis n’importe où sur l’Accueil. */
export const EVENEMENT_ATELIER_SECTEUR = 'priimo:atelier-secteur';

export function ouvrirAtelierSecteur() {
  window.dispatchEvent(new Event(EVENEMENT_ATELIER_SECTEUR));
}
