import { zoneProspectionParDefaut } from '@/lib/zones/jour';
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

/** Secteurs proposés dans le panneau. Le directeur voit ceux de toute l'agence. */
export function secteursDeLaCarte(
  zones: readonly Zone[],
  profileId: string,
  directeur: boolean,
): Zone[] {
  const actives = zones.filter((z) => z.actif);
  if (directeur) return trierSecteurs(actives, profileId);
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
): string | null {
  if (directeur) {
    const proposes = secteursDeLaCarte(zones, profileId, true);
    if (proposes.length > 1) return ZONE_TOUS_SECTEURS;
    return proposes[0]?.id ?? null;
  }
  return zoneProspectionParDefaut(zones, profileId);
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
}): {
  proposes: Zone[];
  voirTous: boolean;
  zoneChoisie: Zone | null;
  affiches: Zone[];
} {
  const proposes = secteursDeLaCarte(params.zones, params.profileId, params.directeur);
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

/** Plusieurs secteurs : dedans si l'un d'eux contient le point. Rien à cadrer : tout passe. */
export function cadastreDansEmprises(
  row: { latitude: number | null; longitude: number | null },
  zones: readonly Zone[] | null,
): boolean {
  if (!zones || zones.length === 0) return true;
  return zones.some((zone) => cadastreDansEmprise(row, zone));
}
