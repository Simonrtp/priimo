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
  };
  geometry: {
    coordinates: [number, number];
  };
};

type BanSearchResponse = {
  features?: BanFeature[];
};

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/';

export async function searchBanAddresses(query: string, limit = 5): Promise<BanFeature[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    autocomplete: '1',
  });
  const response = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Recherche adresse indisponible.');
  }
  const data = (await response.json()) as BanSearchResponse;
  return data.features ?? [];
}

/** Géocode une adresse complète (1er résultat BAN). */
export async function geocodeBanQuery(
  query: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const features = await searchBanAddresses(q, 1);
  const feature = features[0];
  if (!feature) return null;
  const [lng, lat] = feature.geometry.coordinates;
  return { latitude: lat, longitude: lng };
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
