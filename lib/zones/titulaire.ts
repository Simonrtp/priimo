/**
 * Un agent, un secteur. Les secteurs déjà en place restent : on empêche
 * seulement d'en attribuer un second.
 */
export function secteurDejaTenu(
  zones: readonly { id: string; assignedTo: string | null; actif?: boolean }[],
  agentId: string,
  saufZoneId: string | null = null,
): boolean {
  if (!agentId) return false;
  return zones.some(
    (zone) => (zone.actif ?? true) && zone.assignedTo === agentId && zone.id !== saufZoneId,
  );
}

export function messageSecteurUnique(pourSoi: boolean): string {
  return pourSoi ? 'Vous avez déjà un secteur.' : 'Cet agent a déjà un secteur.';
}
