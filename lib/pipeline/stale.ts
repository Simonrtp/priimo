const DAY_MS = 86_400_000;
export const ENTREE_STALE_DAYS = 7;

export function daysSinceTaken(takenAt: string | null | undefined, now = new Date()): number | null {
  if (!takenAt) return null;
  const t = Date.parse(takenAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

/** Lead en étape `entree` depuis plus de 7 jours, jamais contacté. */
export function isStaleEntree(
  stageType: string | undefined,
  takenAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (stageType !== 'entree') return false;
  const days = daysSinceTaken(takenAt, now);
  return days != null && days > ENTREE_STALE_DAYS;
}
