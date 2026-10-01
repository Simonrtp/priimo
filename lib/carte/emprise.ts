import { pointDansZone } from '@/lib/zones/leads';
import type { Zone } from '@/lib/zones/types';

/** Secteur = uniquement mon périmètre. Code postal = tout le territoire actuel. */
export type MapEmprise = 'secteur' | 'code_postal';

export function empriseDepuisZoneId(zoneId: string): MapEmprise {
  if (!zoneId || zoneId === 'aucun' || zoneId === 'tous') return 'code_postal';
  return 'secteur';
}

export function cadastreDansEmprise(
  row: { latitude: number | null; longitude: number | null },
  zone: Zone | null,
): boolean {
  if (!zone) return true;
  if (row.latitude == null || row.longitude == null) return false;
  return pointDansZone({ latitude: row.latitude, longitude: row.longitude }, zone);
}
