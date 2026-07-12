import type { AgencyRow } from '@/types/database';
import { resolveAgencyZoneType } from '@/lib/agency-zone';

/** Libellé court pour la sidebar (max 3 codes postaux visibles). */
export function formatZoneSidebarLabel(agency: AgencyRow): string | null {
  const agencyCodes = agency.codes_postaux;
  if (agencyCodes && agencyCodes.length > 0) {
    const codes = [...agencyCodes].sort();
    if (codes.length <= 3) return `Zone : ${codes.join(', ')}`;
    return `Zone : ${codes.slice(0, 3).join(', ')} +${codes.length - 3}`;
  }

  const zoneType = resolveAgencyZoneType(agency);

  if (zoneType === 'postal_codes') {
    const codes = [...(agency.zone_postal_codes ?? [])].sort();
    if (codes.length === 0) return null;
    if (codes.length <= 3) return `Zone : ${codes.join(', ')}`;
    return `Zone : ${codes.slice(0, 3).join(', ')} +${codes.length - 3}`;
  }

  const address = agency.zone_center_address?.trim();
  const radius = agency.zone_radius_km;
  if (!address || radius == null || Number(radius) <= 0) return null;

  const short =
    address.length > 32 ? `${address.slice(0, 29).trim()}…` : address;
  const radiusLabel = Number(radius) % 1 === 0 ? String(radius) : Number(radius).toFixed(1);
  return `Zone : ${short} (rayon ${radiusLabel} km)`;
}
