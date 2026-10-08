import type { GeoCoord } from '@/lib/carte/coords';
import { haversineM } from '@/lib/geo/distance';

/** Ce que l'agent a vraiment marché : rien n'est compté tant qu'il ne bouge pas. */
export type SuiviTournee = {
  /** Temps de tournée cumulé avant la reprise en cours. */
  actifMs: number;
  /** Début de la séquence en cours ; null en pause. */
  repriseLe: number | null;
  distanceM: number;
  dernier: (GeoCoord & { t: number }) | null;
};

export type PointGps = GeoCoord & { accuracyM: number | null; t: number };

const PRECISION_MAX_M = 30;
/** En dessous, c'est le GPS qui tremble, pas l'agent qui marche. */
const PAS_MIN_M = 8;
/** Au-delà de ~9 km/h, l'agent n'est plus à pied : le trajet ne compte pas. */
const VITESSE_MAX_MS = 2.5;
const KCAL_PAR_KM = 55;

export function suiviNeuf(t: number): SuiviTournee {
  return { actifMs: 0, repriseLe: t, distanceM: 0, dernier: null };
}

export function avancerSuivi(suivi: SuiviTournee, point: PointGps): SuiviTournee {
  if (suivi.repriseLe === null) return suivi;
  if (point.accuracyM === null || point.accuracyM > PRECISION_MAX_M) return suivi;
  const ici = { latitude: point.latitude, longitude: point.longitude, t: point.t };
  if (!suivi.dernier) return { ...suivi, dernier: ici };

  const pas = haversineM(suivi.dernier, ici);
  if (pas < PAS_MIN_M) return suivi;
  const secondes = Math.max(1, (point.t - suivi.dernier.t) / 1000);
  const aPied = pas / secondes <= VITESSE_MAX_MS;
  return { ...suivi, distanceM: aPied ? suivi.distanceM + pas : suivi.distanceM, dernier: ici };
}

export function mettreEnPause(suivi: SuiviTournee, t: number): SuiviTournee {
  if (suivi.repriseLe === null) return suivi;
  return { ...suivi, actifMs: suivi.actifMs + Math.max(0, t - suivi.repriseLe), repriseLe: null, dernier: null };
}

/** Le chemin parcouru pendant la pause ne compte pas : on repart du prochain point. */
export function reprendreSuivi(suivi: SuiviTournee, t: number): SuiviTournee {
  if (suivi.repriseLe !== null) return suivi;
  return { ...suivi, repriseLe: t, dernier: null };
}

export function tempsActifMs(suivi: SuiviTournee, t: number): number {
  return suivi.actifMs + (suivi.repriseLe === null ? 0 : Math.max(0, t - suivi.repriseLe));
}

/** Calories de la marche réellement faite, jamais d'un trajet seulement prévu. */
export function caloriesMarchees(distanceM: number): number {
  return Math.round((distanceM / 1000) * KCAL_PAR_KM);
}

/** Assez pour qu'un bilan ait du sens : des portes faites ou de la marche. */
export function tourneeVraimentFaite(suivi: SuiviTournee, portesFaites: number): boolean {
  return portesFaites > 0 || suivi.distanceM >= 50;
}
