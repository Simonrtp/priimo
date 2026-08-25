/**
 * Un destinataire n'est jamais un nom tapé : uniquement un id présent
 * dans la liste des membres de l'agence active.
 */

export type AssigneeParse =
  | { provided: false }
  | { provided: true; id: string | null }
  | { provided: true; invalid: true };

export function parseAssigneeId(raw: unknown, memberIds: ReadonlySet<string>): AssigneeParse {
  if (raw === undefined) return { provided: false };
  if (raw === null || raw === '') return { provided: true, id: null };
  if (typeof raw !== 'string' || !memberIds.has(raw)) return { provided: true, invalid: true };
  return { provided: true, id: raw };
}

export function assignmentMeta(
  assigneeId: string | null,
  actorId: string,
): { assigned_to: string | null; assigned_by: string | null; assigned_at: string | null } {
  if (!assigneeId) {
    return { assigned_to: null, assigned_by: null, assigned_at: null };
  }
  if (assigneeId === actorId) {
    return { assigned_to: assigneeId, assigned_by: null, assigned_at: null };
  }
  return {
    assigned_to: assigneeId,
    assigned_by: actorId,
    assigned_at: new Date().toISOString(),
  };
}
