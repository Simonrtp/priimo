/**
 * Ancienneté des diagnostics sur la carte.
 * Partitions disjointes : toute date tombe dans une seule case.
 * PUBLIC_DPE_MIN_AGE_MONTHS (livraison leads) n'intervient pas ici.
 */

export const DPE_AGE_BUCKETS = ['semaine', 'mois', '1-6', '6-12', '1-3', '3+'] as const;
export type DpeAgeBucket = (typeof DPE_AGE_BUCKETS)[number];

export const DPE_AGE_LABELS: Record<DpeAgeBucket, string> = {
  semaine: 'cette semaine',
  mois: 'ce mois',
  '1-6': '1 à 6 mois',
  '6-12': '6 à 12 mois',
  '1-3': '1 à 3 ans',
  '3+': 'plus de 3 ans',
};

export const DPE_AGE_TICK_LABELS: Record<DpeAgeBucket, string> = {
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

/** Au-dessous, un point par adresse ; au-delà, agrégat immeuble. */
export const DPE_FRESH_MONTHS = 6;

const DAY_MS = 86_400_000;

export const DEFAULT_DPE_AGE_BUCKETS: readonly DpeAgeBucket[] = DPE_AGE_BUCKETS;

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
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
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Case unique d'une date. Date absente ou invalide → aucune case. */
export function dpeAgeBucketOf(dateIso: string | null | undefined, now: Date = new Date()): DpeAgeBucket | null {
  const t = timestamp(dateIso);
  if (t == null) return null;
  const age = now.getTime() - t;
  if (age < -DAY_MS) return null;
  if (age < 7 * DAY_MS) return 'semaine';
  if (t >= addMonths(now, -1).getTime()) return 'mois';
  if (t >= addMonths(now, -DPE_FRESH_MONTHS).getTime()) return '1-6';
  if (t >= addMonths(now, -12).getTime()) return '6-12';
  if (t >= addMonths(now, -36).getTime()) return '1-3';
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
  const t = timestamp(dateIso);
  if (t == null) return false;
  return t > addMonths(now, -DPE_FRESH_MONTHS).getTime();
}

const DETAIL_BUCKETS: ReadonlySet<DpeAgeBucket> = new Set(['semaine', 'mois', '1-6', '6-12']);

export function needsDpeDetailRows(selected: readonly DpeAgeBucket[]): boolean {
  return selected.some((b) => DETAIL_BUCKETS.has(b));
}

function windowStart(bucket: DpeAgeBucket, now: Date): Date {
  switch (bucket) {
    case 'semaine':
      return new Date(now.getTime() - 7 * DAY_MS);
    case 'mois':
      return addMonths(now, -1);
    case '1-6':
      return addMonths(now, -DPE_FRESH_MONTHS);
    case '6-12':
      return addMonths(now, -12);
    case '1-3':
      return addMonths(now, -36);
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
  return date.toISOString().slice(0, 10);
}
