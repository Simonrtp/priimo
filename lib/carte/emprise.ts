import { zoneDuJour } from '@/lib/zones/jour';
import { pointDansZone } from '@/lib/zones/leads';
import { trierSecteurs } from '@/lib/zones/nom';
import type { Zone } from '@/lib/zones/types';

/** Secteur = uniquement mon périmètre. Code postal = tout le territoire actuel. */
export type MapEmprise = 'secteur' | 'code_postal';

/**
 * Tous les secteurs des agents, d'un coup. Distinct de `tous`, qui veut dire
 * « pas de secteur » (le code postal).
 */
export const ZONE_TOUS_SECTEURS = 'secteurs';

export function empriseDepuisZoneId(zoneId: string): MapEmprise {
  if (!zoneId || zoneId === 'aucun' || zoneId === 'tous') return 'code_postal';
  return 'secteur';
}

/** Un nom seul ne suffit pas : le secteur est défini dès qu'une rue, un contour ou un code postal y est posé. */
export function secteurDefini(zone: Zone): boolean {
  return zone.actif && zone.regles.length > 0;
}

export function aUnSecteurDefini(zones: readonly Zone[]): boolean {
  return zones.some(secteurDefini);
}

/** Onglet de la carte : mes secteurs. `agence` n’est plus proposé à l’écran. */
export type PorteeSecteurs = 'mes' | 'agence';

/**
 * Secteurs proposés dans le panneau.
 * Le négociateur ne voit que les siens. Le directeur voit toute l’agence,
 * y compris un secteur encore sans titulaire : sinon il existe en base
 * et n’apparaît nulle part sur la carte.
 */
export function secteursDeLaCarte(
  zones: readonly Zone[],
  profileId: string,
  directeur: boolean,
  portee: PorteeSecteurs = 'mes',
): Zone[] {
  const actives = zones.filter((z) => z.actif);
  if (directeur || portee === 'agence') return trierSecteurs(actives, profileId);
  if (!profileId) return [];
  return trierSecteurs(
    actives.filter((z) => z.assignedTo === profileId),
    profileId,
  );
}

/** Secteur ouvert en arrivant sur Prospection, sauf si l'URL en nomme un. */
export function zoneParDefautProspection(
  zones: readonly Zone[],
  profileId: string,
  directeur: boolean,
  portee: PorteeSecteurs = 'mes',
): string | null {
  const proposes = secteursDeLaCarte(zones, profileId, directeur, portee);
  if (proposes.length <= 1) return proposes[0]?.id ?? null;
  // Plusieurs secteurs : tous ensemble, sauf celui que l'agent a prévu pour aujourd'hui.
  if (directeur || portee === 'agence') return ZONE_TOUS_SECTEURS;
  return zoneDuJour(proposes, profileId)?.id ?? ZONE_TOUS_SECTEURS;
}

export function zoneIdInitial(initial: string | null | undefined, zones: readonly { id: string }[]): string {
  if (initial === ZONE_TOUS_SECTEURS) return ZONE_TOUS_SECTEURS;
  if (initial && zones.some((z) => z.id === initial)) return initial;
  return 'aucun';
}

export function cadrageCarte(params: {
  zoneId: string;
  zones: readonly Zone[];
  profileId: string;
  directeur: boolean;
  portee?: PorteeSecteurs;
}): {
  proposes: Zone[];
  voirTous: boolean;
  zoneChoisie: Zone | null;
  affiches: Zone[];
} {
  const proposes = secteursDeLaCarte(params.zones, params.profileId, params.directeur, params.portee);
  const voirTous = params.zoneId === ZONE_TOUS_SECTEURS && proposes.length > 1;
  const zoneChoisie = voirTous ? null : params.zones.find((z) => z.id === params.zoneId && z.actif) ?? null;
  const affiches = voirTous ? proposes : zoneChoisie ? [zoneChoisie] : [];
  return { proposes, voirTous, zoneChoisie, affiches };
}

export function cadastreDansEmprise(
  row: { latitude: number | null; longitude: number | null },
  zone: Zone | null,
): boolean {
  if (!zone) return true;
  if (row.latitude == null || row.longitude == null) return false;
  return pointDansZone({ latitude: row.latitude, longitude: row.longitude }, zone);
}

/**
 * Le calque retient le point s'il est dans le contour, ou — pour une note —
 * si sa parcelle fait partie du secteur. Le géocodage tombe souvent dans la
 * rue, juste à côté de la parcelle : la note n'en est pas moins sur le secteur.
 */
export function retientDansSecteur(
  point: { latitude: number; longitude: number; postalCode?: string | null; parcelleId?: string | null },
  zone: Zone,
): boolean {
  const parcelleId = (point.parcelleId ?? '').trim();
  if (
    parcelleId &&
    zone.regles.some(
      (regle) =>
        regle.inclusion && regle.type === 'parcelles' && regle.valeur.parcelle_ids.includes(parcelleId),
    )
  ) {
    return true;
  }
  return pointDansZone(point, zone);
}

/** Plusieurs secteurs : dedans si l'un d'eux contient le point. Rien à cadrer : tout passe. */
export function cadastreDansEmprises(
  row: { latitude: number | null; longitude: number | null },
  zones: readonly Zone[] | null,
): boolean {
  if (!zones || zones.length === 0) return true;
  return zones.some((zone) => cadastreDansEmprise(row, zone));
}
