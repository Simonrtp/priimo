const TZ = 'Europe/Paris';

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type Ymd = { y: number; m: number; d: number; weekday: number };

export function parisYmd(date: Date): Ymd {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(date);
  const [y, m, d] = ymd.split('-').map(Number);
  return { y: y ?? 0, m: m ?? 1, d: d ?? 1, weekday: WEEKDAY[weekdayName] ?? 0 };
}

export function ymdKey(parts: Ymd): string {
  return `${String(parts.y).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
}

export function dateKeyParis(date: Date): string {
  return ymdKey(parisYmd(date));
}

function shiftYmd(parts: Ymd, deltaDays: number): Ymd {
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d + deltaDays, 12, 0, 0);
  const d = new Date(utc);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

/** Recule d’un jour civil (calendrier grégorien). */
export function prevYmd(parts: Ymd): Ymd {
  return shiftYmd(parts, -1);
}

export function startOfWeekYmd(date: Date): Ymd {
  const parts = parisYmd(date);
  const offset = parts.weekday === 0 ? 6 : parts.weekday - 1;
  return shiftYmd(parts, -offset);
}

/** Lundi → dimanche de la semaine Paris contenant `date`. */
export function weekRangeKeys(date: Date): { start: string; end: string } {
  const start = startOfWeekYmd(date);
  return { start: ymdKey(start), end: ymdKey(shiftYmd(start, 6)) };
}

export function isKeyInRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export function isWorkday(weekday: number, workdays: readonly number[]): boolean {
  return workdays.includes(weekday);
}
