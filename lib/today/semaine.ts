import { dateKeyParis, isKeyInRange, weekRangeKeys } from './calendar';
import { TODAY_WEEK_NOTE_GOAL } from './field';
import { dictationStreak, noteDayKeys } from './streak';

export type FieldWeekInput = {
  noteCreatedAt: readonly string[];
  noteBanIds: readonly (string | null)[];
  noteStructured?: readonly unknown[];
  contactCreatedAt: readonly string[];
  leadDeliveredAt: readonly string[];
  now?: Date;
  weekNoteGoal?: number;
};

function countNotesReturn(structured: readonly unknown[]): { relances: number; rapprochements: number } {
  let relances = 0;
  let rapprochements = 0;
  for (const raw of structured) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (o.relance_jours || o.relance) relances += 1;
    if (o.promesse) relances += 1;
    if (o.rapprochement || o.match || o.acquereur_match) rapprochements += 1;
  }
  return { relances, rapprochements };
}

export type FieldWeekSnapshot = {
  notes: number;
  contacts: number;
  immeubles: number;
  adressesDetectees: number;
  streak: number;
  weekNoteGoal: number;
  /** Relances et promesses issues des dictées cette semaine. */
  relancesProgrammees: number;
  /** Rapprochements détectés depuis les notes cette semaine. */
  rapprochements: number;
};

export function buildFieldWeek({
  noteCreatedAt,
  noteBanIds,
  noteStructured = [],
  contactCreatedAt,
  leadDeliveredAt,
  now = new Date(),
  weekNoteGoal = TODAY_WEEK_NOTE_GOAL,
}: FieldWeekInput): FieldWeekSnapshot {
  const { start, end } = weekRangeKeys(now);
  const inWeek = (iso: string) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    return isKeyInRange(dateKeyParis(new Date(t)), start, end);
  };

  let notes = 0;
  const immeubles = new Set<string>();
  const weekStructured: unknown[] = [];
  noteCreatedAt.forEach((iso, i) => {
    if (!inWeek(iso)) return;
    notes += 1;
    const ban = noteBanIds[i];
    if (ban) immeubles.add(ban);
    if (noteStructured[i] !== undefined) weekStructured.push(noteStructured[i]);
  });

  const { relances, rapprochements } = countNotesReturn(weekStructured);

  return {
    notes,
    contacts: contactCreatedAt.filter(inWeek).length,
    immeubles: immeubles.size,
    adressesDetectees: leadDeliveredAt.filter(inWeek).length,
    streak: dictationStreak(noteDayKeys(noteCreatedAt, now), now),
    weekNoteGoal,
    relancesProgrammees: relances,
    rapprochements,
  };
}
