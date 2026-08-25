/**
 * Position fractionnaire dans une colonne kanban.
 * Première = suivante - 1, dernière = précédente + 1, colonne vide = 1000.
 */
export function fractionalPosition(previous: number | null, next: number | null): number {
  if (previous == null && next == null) return 1000;
  if (previous == null) return next! - 1;
  if (next == null) return previous + 1;
  return (previous + next) / 2;
}

export function positionNeighbors(
  ordered: readonly { id: string; stagePosition: number | null }[],
  insertIndex: number,
  movingId?: string,
): { previous: number | null; next: number | null } {
  const rest = movingId ? ordered.filter((item) => item.id !== movingId) : [...ordered];
  const before = rest[insertIndex - 1] ?? null;
  const after = rest[insertIndex] ?? null;
  return {
    previous: before?.stagePosition ?? null,
    next: after?.stagePosition ?? null,
  };
}

/** Fin de colonne : vide → 1000, sinon max(positions) + 1. */
export function nextStagePosition(
  leads: readonly { stageId: string | null; stagePosition: number | null }[],
  stageId: string,
): number {
  const positions = leads
    .filter((lead) => lead.stageId === stageId)
    .map((lead) => lead.stagePosition)
    .filter((n): n is number => n != null);
  if (positions.length === 0) return fractionalPosition(null, null);
  return fractionalPosition(Math.max(...positions), null);
}
