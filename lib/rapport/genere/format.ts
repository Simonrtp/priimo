import { formatEuro } from '@/lib/estimation/resultat';
import { libelleEtage, libelleEtagesImmeuble } from '@/lib/estimation/etages';

export { formatEuro };

export function formatSurface(m2: number): string {
  const n = Number.isInteger(m2) ? String(m2) : m2.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return `${n} m²`;
}

export function formatPrixM2(n: number): string {
  return `${formatEuro(Math.round(n))} / m²`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

export function formatDateCourte(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function formatPct(n: number): string {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`;
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
  return t.charAt(0).toUpperCase() + t.slice(1);
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
