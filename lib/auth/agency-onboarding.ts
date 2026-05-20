import { resolveAgencyZoneType } from '@/lib/agency-zone';

/** True when the agency has no configured prospection zone yet. */
export function agencyNeedsOnboarding(agency: {
  zone_type?: string | null;
  zone_center_address?: string | null;
  zone_latitude?: number | null;
  zone_longitude?: number | null;
  zone_radius_km?: number | null;
  zone_postal_codes?: string[] | null;
} | null): boolean {
  if (!agency) return false;

  const zoneType = resolveAgencyZoneType(agency);

  if (zoneType === 'postal_codes') {
    const codes = agency.zone_postal_codes;
    return !codes || codes.length === 0;
  }

  const address = agency.zone_center_address?.trim();
  const lat = agency.zone_latitude;
  const lng = agency.zone_longitude;
  const radius = agency.zone_radius_km;
  return (
    !address ||
    lat == null ||
    lng == null ||
    radius == null ||
    Number(radius) <= 0
  );
}
