export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(iso: string): Date | null {
  const t = Date.parse(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isFinite(t) ? new Date(t) : null;
}

export function formatDatePickerLabel(iso: string | null, compact: boolean): string {
  if (!iso) return compact ? 'Planifier' : 'Choisir une date';
  const d = parseIsoDate(iso);
  if (!d) return iso;
  if (compact) {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
}

/** Lundi = première colonne. */
export function mondayBasedWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function buildMonthCells(viewMonth: Date): { iso: string; inMonth: boolean }[] {
  const first = startOfMonth(viewMonth);
  const pad = mondayBasedWeekday(first);
  const cells: { iso: string; inMonth: boolean }[] = [];
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - pad);

  for (let i = 0; i < 42; i++) {
    cells.push({
      iso: isoDate(cursor),
      inMonth: cursor.getMonth() === viewMonth.getMonth(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}
