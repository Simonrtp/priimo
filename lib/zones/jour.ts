import { adresseAJuger } from './adresse';
import { zoneDeLAdresse } from './appartenance';
import type { Zone } from './types';

/**
 * La zone du jour.
 *
 * Une agence qui découpe par jour de semaine travaille un secteur à la fois :
 * l'Accueil et la tournée doivent alors filtrer d'eux-mêmes, sinon l'agent
 * refait le tri à la main chaque matin.
 *
 * Le vendredi sans secteur assigné n'est pas un oubli, c'est la méthode : on
 * ne prospecte pas, on rappelle ceux qu'on a rencontrés dans la semaine.
 */

const PARIS = 'Europe/Paris';

/** 1 = lundi … 7 = dimanche, en heure de Paris. */
export function jourSemaineParis(maintenant: Date = new Date()): number {
  const nom = new Intl.DateTimeFormat('en-GB', { timeZone: PARIS, weekday: 'short' }).format(
    maintenant,
  );
  const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(nom);
  return index === -1 ? 1 : index + 1;
}

export type ModeDuJour =
  /** Un secteur est prévu aujourd'hui : on filtre dessus. */
  | { mode: 'secteur'; zone: Zone }
  /** L'agent a des secteurs, mais aucun aujourd'hui : place aux relances. */
  | { mode: 'relances'; jour: number }
  /** Aucun découpage par jour : rien ne change, l'écran reste complet. */
  | { mode: 'libre' };

/**
 * Ce que l'agent doit faire aujourd'hui, d'après son découpage.
 *
 * On ne bascule en relances que si l'agent a bien un calendrier de secteurs :
 * sans calendrier, un vendredi n'a aucune raison d'être différent d'un mardi.
 */
export function modeDuJour(
  zones: readonly Zone[],
  profileId: string,
  maintenant: Date = new Date(),
): ModeDuJour {
  const siennes = zones.filter((z) => z.actif && z.assignedTo === profileId);
  const avecJour = siennes.filter((z) => z.jourSemaine !== null);
  if (avecJour.length === 0) return { mode: 'libre' };

  const jour = jourSemaineParis(maintenant);
  const duJour = avecJour.find((z) => z.jourSemaine === jour);
  if (duJour) return { mode: 'secteur', zone: duJour };
  return { mode: 'relances', jour };
}

/** La zone à travailler aujourd'hui, ou null s'il n'y en a pas. */
export function zoneDuJour(
  zones: readonly Zone[],
  profileId: string,
  maintenant: Date = new Date(),
): Zone | null {
  const mode = modeDuJour(zones, profileId, maintenant);
  return mode.mode === 'secteur' ? mode.zone : null;
}

/**
 * Les adresses sur lesquelles construire la tournée du jour.
 *
 * S'il y a un secteur prévu, on s'y tient : une tournée qui traverse la ville
 * n'est pas une tournée. Sinon — pas de calendrier, ou journée de relances —
 * on ne retire rien : mieux vaut une tournée large qu'un agent bloqué.
 */
export function leadsDuJour<
  T extends {
    address: string;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
  },
>(
  leads: readonly T[],
  zones: readonly Zone[],
  profileId: string,
  maintenant: Date = new Date(),
): T[] {
  const zone = zoneDuJour(zones, profileId, maintenant);
  if (!zone) return [...leads];
  return leads.filter((lead) => zoneDeLAdresse(adresseAJuger(lead), [zone]) !== null);
}

export function libelleModeDuJour(mode: ModeDuJour): string | null {
  if (mode.mode === 'secteur') return `Aujourd’hui : ${mode.zone.nom}`;
  if (mode.mode === 'relances') return 'Aucun secteur aujourd’hui : journée de relances';
  return null;
}
