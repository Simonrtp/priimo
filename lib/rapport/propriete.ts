/** Bibliothèque et modèle : le directeur écrit, l’équipe lit. */

export function peutEditerBibliotheque(role: string): boolean {
  return role === 'directeur';
}
