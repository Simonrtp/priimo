export type ZoneType = 'radius' | 'postal_codes';

export type RadiusZoneValue = {
  type: 'radius';
  address: string;
  latitude: number;
  longitude: number;
  radius_km: number;
};

export type PostalCodesZoneValue = {
  type: 'postal_codes';
  codes: string[];
};

export type ZoneValue = RadiusZoneValue | PostalCodesZoneValue;
