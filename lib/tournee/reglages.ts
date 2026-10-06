import type { GeoCoord } from '@/lib/carte/coords';
import type { SortieStop } from '@/lib/today/sortie';

export const DUREES_TOURNEE = [30, 60, 90, 120, 180] as const;
export const DUREE_TOURNEE_DEFAUT = 60;
export const MAX_ARRETS_TOURNEE = 20;

export type DepartTournee = 'ancre' | 'position' | 'agence' | 'secteur';

/** Ce que renvoie POST /api/dashboard/tournee. */
export type TourneeReponse = {
  arrets: SortieStop[];
  depart: GeoCoord | null;
  departSource: DepartTournee | null;
  minutes: number;
  distanceM: number;
  secteur: string | null;
  /** Adresses du secteur avec un DPE récent (ou un lead) et pas encore prospectées. */
  adressesAFaire: number;
  dejaFaites: number;
};

export function libelleDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}
