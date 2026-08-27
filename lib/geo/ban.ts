/**
 * Géocodage BAN (api-adresse.data.gouv.fr).
 * Une adresse → un immeuble, ou rien. Jamais un rattachement au mauvais bâtiment.
 */

export const BAN_MIN_SCORE = 0.4;
export const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/';

export type BanGeocodeHit = {
  ban_id: string;
  lat: number;
  lng: number;
  adresse_normalisee: string;
  score: number;
};

export type BanGeocodeCache = Map<string, Promise<BanGeocodeHit | null>>;

export function createBanGeocodeCache(): BanGeocodeCache {
  return new Map();
}

export function banCacheKey(adresse: string, codePostal?: string): string {
  return `${adresse.trim().toLocaleLowerCase('fr')}|${(codePostal ?? '').trim()}`;
}

export type BanSearchFeature = {
  properties?: {
    id?: string;
    label?: string;
    score?: number;
    city?: string;
    postcode?: string;
    citycode?: string;
    context?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type BanSearchResponse = {
  features?: BanSearchFeature[];
};

const FETCH_MS = 5000;

function fetchAbortSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Appel direct api-adresse (serveur uniquement). */
export async function searchBanDirect(
  query: string,
  options: { limit?: number; postcode?: string; autocomplete?: boolean } = {},
): Promise<BanSearchFeature[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    limit: String(options.limit ?? 5),
    autocomplete: options.autocomplete === false ? '0' : '1',
  });
  const postcode = options.postcode?.trim();
  if (postcode && /^\d{5}$/.test(postcode)) params.set('postcode', postcode);

  const res = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`, {
    signal: fetchAbortSignal(FETCH_MS),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as BanSearchResponse;
  return data.features ?? [];
}

export async function searchBan(
  query: string,
  options: { limit?: number; postcode?: string; autocomplete?: boolean } = {},
): Promise<BanSearchFeature[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams({
      q,
      limit: String(options.limit ?? 5),
      autocomplete: options.autocomplete === false ? '0' : '1',
    });
    const postcode = options.postcode?.trim();
    if (postcode && /^\d{5}$/.test(postcode)) params.set('postcode', postcode);

    try {
      const res = await fetch(`/api/ban/search?${params.toString()}`, {
        signal: fetchAbortSignal(FETCH_MS),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as BanSearchResponse;
      return data.features ?? [];
    } catch {
      return [];
    }
  }

  return searchBanDirect(q, options);
}

async function geocodeUncached(
  adresse: string,
  codePostal?: string,
): Promise<BanGeocodeHit | null> {
  const q = adresse.trim();
  if (q.length < 3) return null;

  let features: BanSearchFeature[];
  try {
    features = await searchBan(q, { limit: 1, postcode: codePostal, autocomplete: false });
  } catch {
    return null;
  }

  const feature = features[0];
  const props = feature?.properties;
  const coords = feature?.geometry?.coordinates;
  if (!props || !coords) return null;

  const banId = typeof props.id === 'string' ? props.id.trim() : '';
  const score = typeof props.score === 'number' ? props.score : 0;
  const label = typeof props.label === 'string' ? props.label.trim() : '';
  const [lng, lat] = coords;

  if (!banId || !label) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (score < BAN_MIN_SCORE) return null;

  return {
    ban_id: banId,
    lat,
    lng,
    adresse_normalisee: label,
    score,
  };
}

/**
 * Premier résultat BAN, ou null si le score est sous 0.4.
 * `cache` : une Map par requête HTTP / import, pour ne pas rappeler la BAN
 * sur la même adresse.
 */
export async function geocodeAdresse(
  adresse: string,
  codePostal?: string,
  cache?: BanGeocodeCache,
): Promise<BanGeocodeHit | null> {
  if (!cache) return geocodeUncached(adresse, codePostal);

  const key = banCacheKey(adresse, codePostal);
  const existing = cache.get(key);
  if (existing) return existing;

  const pending = geocodeUncached(adresse, codePostal);
  cache.set(key, pending);
  try {
    return await pending;
  } catch {
    cache.delete(key);
    return null;
  }
}

const BAN_REVERSE_URL = 'https://api-adresse.data.gouv.fr/reverse/';

/** Adresse BAN la plus proche d’un point GPS, ou null. */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<BanGeocodeHit | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
    });
    const res = await fetch(`${BAN_REVERSE_URL}?${params.toString()}`, {
      signal: fetchAbortSignal(FETCH_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BanSearchResponse;
    const feature = data.features?.[0];
    const props = feature?.properties;
    const coords = feature?.geometry?.coordinates;
    if (!props || !coords) return null;
    const banId = typeof props.id === 'string' ? props.id.trim() : '';
    const label = typeof props.label === 'string' ? props.label.trim() : '';
    const score = typeof props.score === 'number' ? props.score : 0;
    const [lng, lat] = coords;
    if (!banId || !label) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      ban_id: banId,
      lat,
      lng,
      adresse_normalisee: label,
      score,
    };
  } catch {
    return null;
  }
}
