import type { GeoCoord } from '@/lib/carte/coords';
import type { SortieStop } from '@/lib/today/sortie';

export const DUREES_TOURNEE = [30, 60, 90, 120, 180] as const;
export const DUREE_TOURNEE_DEFAUT = 60;
export const MAX_ARRETS_TOURNEE = 20;
export const MAX_ADRESSES_IMPOSEES = 6;
export const MINUTES_PAR_PORTE = 5;

export type PerimetreTournee = 'secteur' | 'code_postal';

export type DepartTournee = 'ancre' | 'position' | 'agence' | 'secteur';

/** Ce qui justifie une porte, tel que l'agent le lit en touchant l'adresse. */
export type DetailArret = {
  dpe: {
    lettre: string | null;
    /** YYYY-MM-DD */
    date: string | null;
    nombre: number;
    passoire: boolean;
    surfaceM2: number | null;
    type: string | null;
  } | null;
  lead: { score: number; signal: string | null } | null;
  /** YYYY-MM-DD : passage avant le dernier DPE, la porte est rouverte. */
  dernierPassage: string | null;
  /** Ajoutée par l'agent à la préparation. */
  choisie: boolean;
};

export type ArretTournee = SortieStop & { detail: DetailArret };

/** Ce que renvoie POST /api/dashboard/tournee. */
export type TourneeReponse = {
  arrets: ArretTournee[];
  depart: GeoCoord | null;
  departSource: DepartTournee | null;
  /** Écart entre l'agent et le début de la tournée, quand elle ne part pas de lui. */
  distanceDepartM: number | null;
  minutes: number;
  distanceM: number;
  secteur: string | null;
  /** Adresses du périmètre avec un DPE récent (ou un lead) et pas encore faites. */
  adressesAFaire: number;
  dejaFaites: number;
};

export function libelleDuree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}

export function arrondiCinqMinutes(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function ilYa(jours: number): string {
  if (!Number.isFinite(jours)) return '';
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  if (jours < 14) return 'la semaine dernière';
  if (jours < 60) return `il y a ${Math.round(jours / 7)} semaines`;
  if (jours < 365) return `il y a ${Math.round(jours / 30.4)} mois`;
  return 'il y a plus d’un an';
}

/** Jours entre une date YYYY-MM-DD et aujourd'hui, au calendrier local du téléphone. */
export function joursDepuisLe(jour: string, maintenant: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(jour);
  if (!m) return Number.POSITIVE_INFINITY;
  const debut = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate()).getTime();
  return Math.max(0, Math.round((aujourdhui - debut) / 86_400_000));
}

export function libelleTemps(ms: number): string {
  return libelleDuree(Math.max(0, Math.floor(ms / 60_000)));
}
