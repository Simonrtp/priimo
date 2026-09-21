/**
 * Ancienneté des diagnostics sur la carte.
 * Partitions disjointes, en jours calendaires locaux — pas d’UTC.
 * PUBLIC_DPE_MIN_AGE_MONTHS (livraison leads) n'intervient pas ici.
 */

export const DPE_AGE_BUCKETS = ['jours', 'semaine', 'mois', '1-6', '6-12', '1-3', '3+'] as const;
export type DpeAgeBucket = (typeof DPE_AGE_BUCKETS)[number];

const LEGACY_FULL: readonly string[] = ['semaine', 'mois', '1-6', '6-12', '1-3', '3+'];

export const DPE_AGE_LABELS: Record<DpeAgeBucket, string> = {
  jours: '1 à 3 jours',
  semaine: 'cette semaine',
  mois: 'ce mois',
  '1-6': '1 à 6 mois',
  '6-12': '6 à 12 mois',
  '1-3': '1 à 3 ans',
  '3+': 'plus de 3 ans',
};

export const DPE_AGE_TICK_LABELS: Record<DpeAgeBucket, string> = {
  jours: '1–3 j',
  semaine: 'Sem.',
  mois: 'Mois',
  '1-6': '1–6 m',
  '6-12': '6–12 m',
  '1-3': '1–3 a',
  '3+': '+3 a',
};

export const DPE_AGE_LAST = DPE_AGE_BUCKETS.length - 1;

/** Bornes du curseur : min et max des cases cochées, plage entière si vide. */
export function dpeAgeSpan(selected: readonly DpeAgeBucket[]): { from: number; to: number } {
  let from = DPE_AGE_LAST;
  let to = 0;
  let any = false;
  for (let i = 0; i < DPE_AGE_BUCKETS.length; i += 1) {
    if (!selected.includes(DPE_AGE_BUCKETS[i])) continue;
    any = true;
    if (i < from) from = i;
    if (i > to) to = i;
  }
  if (!any) return { from: 0, to: DPE_AGE_LAST };
  return { from, to };
}

export function dpeAgeBucketsInSpan(from: number, to: number): DpeAgeBucket[] {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(DPE_AGE_LAST, Math.max(from, to));
  return DPE_AGE_BUCKETS.slice(start, end + 1);
}

export function dpeAgeIndexFromRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.round(Math.max(0, Math.min(1, ratio)) * DPE_AGE_LAST);
}

/** Curseur à bouger pour coller `index` à la plage, sans trou. */
export function dpeAgeNearerHandle(index: number, from: number, to: number): 'from' | 'to' {
  const i = Math.max(0, Math.min(DPE_AGE_LAST, index));
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(DPE_AGE_LAST, Math.max(from, to));
  if (i <= a) return 'from';
  if (i >= b) return 'to';
  return i - a <= b - i ? 'from' : 'to';
}

export function dpeAgeRangePhrase(from: number, to: number): string {
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(DPE_AGE_LAST, Math.max(from, to));
  if (a === 0 && b === DPE_AGE_LAST) return 'Tous les DPE';
  if (a === b) return DPE_AGE_LABELS[DPE_AGE_BUCKETS[a]];
  return `${DPE_AGE_LABELS[DPE_AGE_BUCKETS[a]]} → ${DPE_AGE_LABELS[DPE_AGE_BUCKETS[b]]}`;
}

/** Au-dessous, un point par adresse ; au-delà, agrégat immeuble. */
export const DPE_FRESH_MONTHS = 6;

const DAY_MS = 86_400_000;

export const DEFAULT_DPE_AGE_BUCKETS: readonly DpeAgeBucket[] = DPE_AGE_BUCKETS;

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBack(now: Date, days: number): Date {
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - days);
  return start;
}

/** YYYY-MM-DD (ou préfixe) → minuit local, sans passer par UTC. */
function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return startOfLocalDay(new Date(t));
}

function calendarDaysAgo(dateIso: string | null | undefined, now: Date): number | null {
  const day = parseDateOnly(dateIso);
  if (!day) return null;
  return Math.round((startOfLocalDay(now).getTime() - day.getTime()) / DAY_MS);
}

export function parseDpeAgeBuckets(raw: unknown): DpeAgeBucket[] {
  if (!Array.isArray(raw)) return [...DEFAULT_DPE_AGE_BUCKETS];
  const allowed = new Set<string>(DPE_AGE_BUCKETS);
  const seen = new Set<DpeAgeBucket>();
  const out: DpeAgeBucket[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !allowed.has(item) || seen.has(item as DpeAgeBucket)) continue;
    seen.add(item as DpeAgeBucket);
    out.push(item as DpeAgeBucket);
  }
  if (out.length === LEGACY_FULL.length && LEGACY_FULL.every((b) => seen.has(b as DpeAgeBucket))) {
    return [...DEFAULT_DPE_AGE_BUCKETS];
  }
  return out;
}

export function parseDpeAgeParam(raw: string | null | undefined): DpeAgeBucket[] {
  if (raw == null) return [...DEFAULT_DPE_AGE_BUCKETS];
  if (raw.trim() === '') return [];
  return parseDpeAgeBuckets(raw.split(',').map((s) => s.trim()));
}

export function serializeDpeAgeBuckets(buckets: readonly DpeAgeBucket[]): string {
  return DPE_AGE_BUCKETS.filter((b) => buckets.includes(b)).join(',');
}

function timestamp(iso: string | null | undefined): number | null {
  const day = parseDateOnly(iso);
  return day ? day.getTime() : null;
}

/** Case unique d'une date. Date absente, invalide ou trop future → aucune case. */
export function dpeAgeBucketOf(dateIso: string | null | undefined, now: Date = new Date()): DpeAgeBucket | null {
  const days = calendarDaysAgo(dateIso, now);
  if (days == null || days < -1) return null;
  if (days <= 3) return 'jours';
  if (days <= 7) return 'semaine';
  if (days <= 31) return 'mois';
  if (days <= 183) return '1-6';
  if (days <= 365) return '6-12';
  if (days <= 365 * 3) return '1-3';
  return '3+';
}

export function dpeMatchesSelectedAges(
  dateIso: string | null | undefined,
  selected: readonly DpeAgeBucket[],
  now: Date = new Date(),
): boolean {
  if (selected.length === 0) return false;
  const bucket = dpeAgeBucketOf(dateIso, now);
  return bucket != null && selected.includes(bucket);
}

export function isFreshMapDpe(dateIso: string | null | undefined, now: Date = new Date()): boolean {
  const days = calendarDaysAgo(dateIso, now);
  if (days == null || days < -1) return false;
  return days <= 31 * DPE_FRESH_MONTHS;
}

const DETAIL_BUCKETS: ReadonlySet<DpeAgeBucket> = new Set(['jours', 'semaine', 'mois', '1-6', '6-12']);

export function needsDpeDetailRows(selected: readonly DpeAgeBucket[]): boolean {
  return selected.some((b) => DETAIL_BUCKETS.has(b));
}

function windowStart(bucket: DpeAgeBucket, now: Date): Date {
  switch (bucket) {
    case 'jours':
      return daysBack(now, 3);
    case 'semaine':
      return daysBack(now, 7);
    case 'mois':
      return daysBack(now, 31);
    case '1-6':
      return daysBack(now, 183);
    case '6-12':
      return daysBack(now, 365);
    case '1-3':
      return daysBack(now, 365 * 3);
    case '3+':
      return new Date(0);
  }
}

/** Plage unique pour la requête building_dpe (cases qui ne sont pas dans l'agrégat). */
export function dpeDetailQueryRange(
  selected: readonly DpeAgeBucket[],
  now: Date = new Date(),
): { from: Date; to: Date } | null {
  const detail = selected.filter((b) => DETAIL_BUCKETS.has(b));
  if (detail.length === 0) return null;
  let from = now;
  for (const bucket of detail) {
    const start = windowStart(bucket, now);
    if (start.getTime() < from.getTime()) from = start;
  }
  return { from, to: now };
}

export function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
