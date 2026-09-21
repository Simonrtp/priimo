/** NULL = modèle d’agence. Sinon, rapport personnel de l’agent. */

export function estModeleAgence(ownerId: string | null | undefined): boolean {
  return ownerId == null;
}

export function peutModifierPage(
  role: string,
  profileId: string,
  ownerId: string | null | undefined,
): boolean {
  if (ownerId === profileId) return true;
  return estModeleAgence(ownerId) && role === 'directeur';
}

/** Agent : toujours son rapport. Directeur + modèle : template d’agence. */
export function ownerPourCreation(
  role: string,
  profileId: string,
  modeleAgence: boolean,
): string | null {
  if (modeleAgence && role === 'directeur') return null;
  return profileId;
}
