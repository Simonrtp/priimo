import type { GeoCoord } from '@/lib/carte/coords';
import { dateKeyParis } from '@/lib/today/calendar';
import type { ArretTournee } from './reglages';
import type { SuiviTournee } from './suivi';

/** Le tracé déjà calculé : on le garde tel quel pour que rien ne bouge au retour. */
export type TrajetSauve = {
  cle: string;
  keys: string[];
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
};

export type TourneeSauvee = {
  v: 1;
  /** Jour parisien : une tournée de la veille ne se reprend pas. */
  jour: string;
  phase: 'route' | 'pause';
  arrets: ArretTournee[];
  depart: GeoCoord | null;
  trajet: TrajetSauve | null;
  faits: string[];
  suivi: SuiviTournee;
  prevuMinutes: number;
  sansPosition: boolean;
};

export function cleSauvegardeTournee(profileId: string): string {
  return `priimo-tournee:${profileId}`;
}

function estNombre(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function estCoord(v: unknown): v is GeoCoord {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return estNombre(c.latitude) && estNombre(c.longitude);
}

function lireSuivi(v: unknown): SuiviTournee | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (!estNombre(s.actifMs) || !estNombre(s.distanceM)) return null;
  if (s.repriseLe !== null && !estNombre(s.repriseLe)) return null;
  const dernier =
    estCoord(s.dernier) && estNombre((s.dernier as { t?: unknown }).t)
      ? (s.dernier as SuiviTournee['dernier'])
      : null;
  return { actifMs: s.actifMs, repriseLe: s.repriseLe as number | null, distanceM: s.distanceM, dernier };
}

function lireTrajet(v: unknown): TrajetSauve | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;
  const geometry = t.geometry as GeoJSON.LineString | undefined;
  if (
    typeof t.cle !== 'string' ||
    !Array.isArray(t.keys) ||
    !geometry ||
    geometry.type !== 'LineString' ||
    !Array.isArray(geometry.coordinates) ||
    !estNombre(t.distanceM) ||
    !estNombre(t.durationS)
  ) {
    return null;
  }
  return { cle: t.cle, keys: t.keys.map(String), geometry, distanceM: t.distanceM, durationS: t.durationS };
}

/** Relit une tournée enregistrée ; tout ce qui est abîmé ou d'un autre jour est oublié. */
export function lireTourneeSauvee(brut: string | null, maintenant: Date): TourneeSauvee | null {
  if (!brut) return null;
  let donnees: unknown;
  try {
    donnees = JSON.parse(brut);
  } catch {
    return null;
  }
  if (!donnees || typeof donnees !== 'object') return null;
  const d = donnees as Record<string, unknown>;
  if (d.v !== 1 || d.jour !== dateKeyParis(maintenant)) return null;
  if (d.phase !== 'route' && d.phase !== 'pause') return null;
  if (!Array.isArray(d.arrets) || d.arrets.length === 0) return null;
  const arrets = d.arrets.filter(
    (a): a is ArretTournee =>
      !!a && typeof a === 'object' && typeof (a as ArretTournee).key === 'string' && estCoord(a),
  );
  const suivi = lireSuivi(d.suivi);
  if (arrets.length === 0 || !suivi) return null;
  return {
    v: 1,
    jour: d.jour,
    phase: d.phase,
    arrets,
    depart: estCoord(d.depart) ? d.depart : null,
    trajet: lireTrajet(d.trajet),
    faits: Array.isArray(d.faits) ? d.faits.map(String) : [],
    suivi,
    prevuMinutes: estNombre(d.prevuMinutes) ? d.prevuMinutes : 0,
    sansPosition: d.sansPosition === true,
  };
}

export function chargerTournee(profileId: string, maintenant: Date = new Date()): TourneeSauvee | null {
  try {
    return lireTourneeSauvee(window.localStorage.getItem(cleSauvegardeTournee(profileId)), maintenant);
  } catch {
    return null;
  }
}

export function enregistrerTournee(profileId: string, tournee: TourneeSauvee): void {
  try {
    window.localStorage.setItem(cleSauvegardeTournee(profileId), JSON.stringify(tournee));
  } catch {
    /* quota ou mode privé : la tournée reste en mémoire */
  }
}

export function oublierTournee(profileId: string): void {
  try {
    window.localStorage.removeItem(cleSauvegardeTournee(profileId));
  } catch {
    /* rien à oublier */
  }
}
