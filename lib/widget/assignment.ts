/**
 * À qui revient une demande d'estimation arrivée du site de l'agence.
 *
 * L'agence n'a pas de table de règles : la règle en vigueur est celle de la
 * répartition équitable. La demande va au membre qui suit le moins de demandes
 * du site aujourd'hui ; à égalité, au premier par ordre alphabétique pour que
 * la rotation soit prévisible et vérifiable ; et à défaut de collaborateur, au
 * directeur, qui reste responsable du rappel.
 */

export type AssignableMember = {
  id: string;
  fullName: string;
  role: 'directeur' | 'collaborateur';
};

export function chooseAssignee(
  members: readonly AssignableMember[],
  chargeById: ReadonlyMap<string, number>,
): string | null {
  if (members.length === 0) return null;

  const collaborateurs = members.filter((m) => m.role === 'collaborateur');
  const pool = collaborateurs.length > 0 ? collaborateurs : members;

  return [...pool].sort((a, b) => {
    const chargeA = chargeById.get(a.id) ?? 0;
    const chargeB = chargeById.get(b.id) ?? 0;
    if (chargeA !== chargeB) return chargeA - chargeB;
    return a.fullName.localeCompare(b.fullName, 'fr');
  })[0]!.id;
}
