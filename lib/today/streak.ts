import { dateKeyParis, isWorkday, parisYmd, prevYmd, ymdKey } from './calendar';
import { TODAY_WORKDAYS as DEFAULT_WORKDAYS } from './field';

/**
 * Jours ouvrés consécutifs avec au moins une note.
 * Un jour de fermeture (défaut : dimanche) est sauté, jamais une rupture.
 * Si le jour courant est ouvré et encore sans note, il ne casse pas la série.
 */
export function dictationStreak(
  noteDays: readonly string[],
  now: Date,
  workdays: readonly number[] = DEFAULT_WORKDAYS,
): number {
  const set = new Set(noteDays);
  let cursor = parisYmd(now);
  let streak = 0;

  if (isWorkday(cursor.weekday, workdays) && !set.has(ymdKey(cursor))) {
    cursor = prevYmd(cursor);
  }

  for (let i = 0; i < 400; i++) {
    if (!isWorkday(cursor.weekday, workdays)) {
      cursor = prevYmd(cursor);
      continue;
    }
    if (!set.has(ymdKey(cursor))) break;
    streak += 1;
    cursor = prevYmd(cursor);
  }

  return streak;
}

export function noteDayKeys(createdAtIso: readonly string[], now = new Date()): string[] {
  void now;
  const keys = new Set<string>();
  for (const iso of createdAtIso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    keys.add(dateKeyParis(new Date(t)));
  }
  return [...keys];
}
