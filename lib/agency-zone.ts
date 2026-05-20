import {
  PARIS_ARRONDISSEMENT_MAX,
  PARIS_ARRONDISSEMENT_MIN,
  PARIS_POSTAL_CODE_SET,
} from '@/lib/paris-arrondissements';
import {
  ZONE_RADIUS_KM_DEFAULT,
  ZONE_RADIUS_KM_MAX,
  ZONE_RADIUS_KM_MIN,
  clampZoneRadiusKm,
} from '@/lib/zone-config';
import type { AgencyRow } from '@/types/database';
import type { PostalCodesZoneValue, RadiusZoneValue, ZoneType, ZoneValue } from '@/types/zone';

export function resolveAgencyZoneType(agency: {
  zone_type?: string | null;
  zone_postal_codes?: string[] | null;
}): ZoneType {
  if (agency.zone_type === 'postal_codes' || agency.zone_type === 'radius') {
    return agency.zone_type;
  }
  if (agency.zone_postal_codes && agency.zone_postal_codes.length > 0) {
    return 'postal_codes';
  }
  return 'radius';
}

export function agencyRowToZoneValue(agency: AgencyRow): ZoneValue | null {
  const zoneType = resolveAgencyZoneType(agency);

  if (zoneType === 'postal_codes') {
    const codes = (agency.zone_postal_codes ?? []).filter((c) => PARIS_POSTAL_CODE_SET.has(c));
    if (codes.length === 0) return null;
    return {
      type: 'postal_codes',
      codes: [...codes].sort(),
    };
  }

  const address = agency.zone_center_address?.trim();
  const lat = agency.zone_latitude;
  const lng = agency.zone_longitude;
  const radius = agency.zone_radius_km;

  if (!address || lat == null || lng == null || radius == null || Number(radius) <= 0) {
    return null;
  }

  return {
    type: 'radius',
    address,
    latitude: lat,
    longitude: lng,
    radius_km: clampZoneRadiusKm(Number(radius)),
  };
}

export function defaultRadiusZoneValue(): RadiusZoneValue {
  return {
    type: 'radius',
    address: '',
    latitude: 0,
    longitude: 0,
    radius_km: ZONE_RADIUS_KM_DEFAULT,
  };
}

export function defaultPostalCodesZoneValue(): PostalCodesZoneValue {
  return { type: 'postal_codes', codes: [] };
}

export type AgencyZoneUpdatePayload = {
  zone_type: ZoneType;
  zone_center_address: string | null;
  zone_latitude: number | null;
  zone_longitude: number | null;
  zone_radius_km: number | null;
  zone_postal_codes: string[] | null;
};

export function zoneValueToAgencyPayload(zone: ZoneValue): AgencyZoneUpdatePayload {
  if (zone.type === 'postal_codes') {
    return {
      zone_type: 'postal_codes',
      zone_postal_codes: zone.codes,
      zone_center_address: null,
      zone_latitude: null,
      zone_longitude: null,
      zone_radius_km: null,
    };
  }

  return {
    zone_type: 'radius',
    zone_postal_codes: null,
    zone_center_address: zone.address,
    zone_latitude: zone.latitude,
    zone_longitude: zone.longitude,
    zone_radius_km: zone.radius_km,
  };
}

export function validateZoneValue(zone: ZoneValue | null): string | null {
  if (!zone) return 'Définissez votre zone de prospection.';

  if (zone.type === 'postal_codes') {
    if (zone.codes.length < PARIS_ARRONDISSEMENT_MIN) {
      return 'Sélectionnez au moins un arrondissement.';
    }
    if (zone.codes.length > PARIS_ARRONDISSEMENT_MAX) {
      return `Maximum ${PARIS_ARRONDISSEMENT_MAX} arrondissements.`;
    }
    const invalid = zone.codes.find((c) => !PARIS_POSTAL_CODE_SET.has(c));
    if (invalid) return `Code postal invalide : ${invalid}.`;
    return null;
  }

  if (!zone.address.trim() || zone.address.trim().length < 5) {
    return 'Sélectionnez une adresse dans la liste de suggestions.';
  }
  if (
    !Number.isFinite(zone.latitude) ||
    !Number.isFinite(zone.longitude) ||
    zone.latitude < -90 ||
    zone.latitude > 90 ||
    zone.longitude < -180 ||
    zone.longitude > 180 ||
    (zone.latitude === 0 && zone.longitude === 0)
  ) {
    return 'Adresse invalide : choisissez une adresse dans la liste.';
  }
  if (
    !Number.isFinite(zone.radius_km) ||
    zone.radius_km < ZONE_RADIUS_KM_MIN ||
    zone.radius_km > ZONE_RADIUS_KM_MAX
  ) {
    return `Le rayon doit être entre ${ZONE_RADIUS_KM_MIN} et ${ZONE_RADIUS_KM_MAX} km.`;
  }

  return null;
}
