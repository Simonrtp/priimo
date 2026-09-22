import { libelleEtage, libelleEtagesImmeuble } from '@/lib/estimation/etages';

const FINE = '\u202f';
const NBSP = '\u00a0';

function grouper(n: number): string {
  const abs = Math.round(Math.abs(n));
  const signed = n < 0 ? '−' : '';
  return `${signed}${String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, FINE)}`;
}

/** 546 000 € — espaces insécables, jamais 546000. */
export function formatEuro(n: number): string {
  return `${grouper(n)}${NBSP}€`;
}

/** 76 m² */
export function formatSurface(m2: number): string {
  const n = Number.isInteger(m2)
    ? grouper(m2)
    : m2.toLocaleString('fr-FR', { maximumFractionDigits: 1 }).replace(/\s/g, FINE);
  return `${n}${NBSP}m²`;
}

/** 7 579 €/m² */
export function formatPrixM2(n: number): string {
  return `${grouper(Math.round(n))}${NBSP}€/m²`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}${NBSP}m`;
  const km = m / 1000;
  const n = km.toLocaleString('fr-FR', { maximumFractionDigits: km < 10 ? 1 : 0 }).replace(/\s/g, FINE);
  return `${n}${NBSP}km`;
}

/** 12 sept. 2026 */
export function formatDateCourte(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function formatPct(n: number, digits = 0): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: digits }).replace(/\s/g, FINE)}${NBSP}%`;
}

/** Marie Durand — capitale initiale, jamais TOUT CAPS. */
export function nomPersonne(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  return s
    .split(/(\s+|-)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-') return part;
      const lower = part.toLocaleLowerCase('fr-FR');
      return lower.charAt(0).toLocaleUpperCase('fr-FR') + lower.slice(1);
    })
    .join('');
}

export function intituleBien(input: {
  propertyType: 'appartement' | 'maison' | null;
  rooms: number | null;
  city: string | null;
}): string | null {
  if (!input.propertyType) return null;
  const type = input.propertyType === 'maison' ? 'Maison' : 'Appartement';
  const pieces =
    input.rooms != null && input.rooms > 0
      ? ` ${input.rooms} pièce${input.rooms > 1 ? 's' : ''}`
      : '';
  const ville = input.city?.trim() ? ` à ${input.city.trim()}` : '';
  return `${type}${pieces}${ville}`;
}

export function libelleOccupation(occupation: 'libre' | 'occupe'): string {
  return occupation === 'occupe' ? 'Occupé' : 'Libre';
}

export function libelleTypeLocal(type: string | null | undefined): string | null {
  if (!type?.trim()) return null;
  const t = type.trim();
  if (/appart/i.test(t)) return 'Appartement';
  if (/maison/i.test(t)) return 'Maison';
  if (/depend/i.test(t) || /garage/i.test(t) || /cave/i.test(t)) return 'Dépendance';
  return t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1);
}

export function libelleEtageAffiche(floor: string | null | undefined): string | null {
  if (!floor?.trim()) return null;
  return libelleEtage(floor.trim());
}

export function libelleEtagesImmeubleAffiche(n: number | null | undefined): string | null {
  if (n == null || n <= 0) return null;
  return libelleEtagesImmeuble(n);
}

export function libelleAscenseur(v: boolean | null | undefined): string | null {
  if (v === true) return 'Avec ascenseur';
  if (v === false) return 'Sans ascenseur';
  return null;
}

export function arrondirMillier(n: number): number {
  return Math.round(n / 1000) * 1000;
}

export function memeContact(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a?.trim().toLowerCase().replace(/\s+/g, '') ?? '';
  const nb = b?.trim().toLowerCase().replace(/\s+/g, '') ?? '';
  return na.length > 0 && na === nb;
}
