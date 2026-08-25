import { geocodeAdresse, searchBan, type BanSearchFeature } from '@/lib/geo/ban';

export type SelectedAddress = {
  label: string;
  latitude: number;
  longitude: number;
  city: string;
  postcode: string;
  /** Code INSEE commune (BAN `citycode`). */
  citycode?: string;
};

export type BanFeature = {
  properties: {
    label: string;
    score: number;
    city: string;
    postcode: string;
    citycode?: string;
    context: string;
    id?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
};

function asBanFeature(feature: BanSearchFeature): BanFeature | null {
  const props = feature.properties;
  const coords = feature.geometry?.coordinates;
  if (!props || !coords) return null;
  if (typeof props.label !== 'string' || typeof props.score !== 'number') return null;
  return {
    properties: {
      label: props.label,
      score: props.score,
      city: props.city ?? '',
      postcode: props.postcode ?? '',
      citycode: props.citycode,
      context: props.context ?? '',
      id: props.id,
    },
    geometry: { coordinates: coords },
  };
}

export async function searchBanAddresses(query: string, limit = 5): Promise<BanFeature[]> {
  const features = await searchBan(query, { limit });
  return features.flatMap((feature) => {
    const mapped = asBanFeature(feature);
    return mapped ? [mapped] : [];
  });
}

/** Géocode une adresse complète via le service partagé (seuil BAN 0.4). */
export async function geocodeBanQuery(
  query: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const hit = await geocodeAdresse(query);
  if (!hit) return null;
  return { latitude: hit.lat, longitude: hit.lng };
}

export function banFeatureToSelectedAddress(feature: BanFeature): SelectedAddress {
  const [lng, lat] = feature.geometry.coordinates;
  return {
    label: feature.properties.label,
    latitude: lat,
    longitude: lng,
    city: feature.properties.city,
    postcode: feature.properties.postcode,
    citycode: feature.properties.citycode ?? '',
  };
}
