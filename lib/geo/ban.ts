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
    /** Arrondissement / quartier BAN (Paris, Lyon, Marseille…). */
    district?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type BanSearchResponse = {
  features?: BanSearchFeature[];
};

/** Géocode / reverse : court. Autocomplete client : plus long (cold compile / BAN lente). */
const FETCH_MS = 5000;
const SEARCH_FETCH_MS = 20_000;

function fetchAbortSignal(ms: number, external?: AbortSignal): AbortSignal {
  if (external) return external;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export type BanSearchOptions = {
  limit?: number;
  postcode?: string;
  autocomplete?: boolean;
  /** Favorise les adresses proches (l'agence) : « rue de la Paix » d'abord chez soi. */
  proche?: { latitude: number; longitude: number } | null;
  /** Annule la requête (ex. nouvelle saisie). Sinon timeout interne. */
  signal?: AbortSignal;
};

/** Appel direct api-adresse (serveur uniquement). */
export async function searchBanDirect(
  query: string,
  options: BanSearchOptions = {},
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
  if (options.proche) {
    params.set('lat', options.proche.latitude.toFixed(5));
    params.set('lon', options.proche.longitude.toFixed(5));
  }

  const res = await fetch(`${BAN_SEARCH_URL}?${params.toString()}`, {
    signal: fetchAbortSignal(SEARCH_FETCH_MS, options.signal),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as BanSearchResponse;
  return data.features ?? [];
}

export async function searchBan(
  query: string,
  options: BanSearchOptions = {},
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
  if (options.proche) {
    params.set('lat', options.proche.latitude.toFixed(5));
    params.set('lon', options.proche.longitude.toFixed(5));
  }

    try {
      const res = await fetch(`/api/ban/search?${params.toString()}`, {
        signal: fetchAbortSignal(SEARCH_FETCH_MS, options.signal),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as BanSearchResponse;
      return data.features ?? [];
    } catch (err) {
      if (options.signal?.aborted) throw err;
      return [];
    }
  }

  return searchBanDirect(q, options);
}

async function geocodeUncached(
  adresse: string,
  codePostal?: string,
  proche?: { latitude: number; longitude: number } | null,
): Promise<BanGeocodeHit | null> {
  const q = adresse.trim();
  if (q.length < 3) return null;

  let features: BanSearchFeature[];
  try {
    features = await searchBan(q, { limit: 1, postcode: codePostal, autocomplete: false, proche });
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
  /** Favorise les adresses proches de ce point ; contourne le cache, dont la clé l'ignore. */
  proche?: { latitude: number; longitude: number } | null,
): Promise<BanGeocodeHit | null> {
  if (!cache || proche) return geocodeUncached(adresse, codePostal, proche);

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

const BAN_LOOKUP_URL = 'https://plateforme.adresse.data.gouv.fr/lookup/';

/** Ce que la BAN sait d'une adresse par son identifiant : position, code postal, parcelles cadastrales. */
export type FicheAdresseBan = {
  latitude: number;
  longitude: number;
  codePostal: string | null;
  parcelles: string[];
};

/** Serveur uniquement. Null si l'adresse est inconnue ou si la BAN ne répond pas. */
export async function ficheAdresseBan(banId: string): Promise<FicheAdresseBan | null> {
  const id = banId.trim();
  if (!id || id.startsWith('gps:')) return null;
  try {
    const res = await fetch(`${BAN_LOOKUP_URL}${encodeURIComponent(id)}`, {
      signal: fetchAbortSignal(FETCH_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat?: unknown;
      lon?: unknown;
      codePostal?: unknown;
      parcelles?: unknown;
    };
    if (typeof data.lat !== 'number' || typeof data.lon !== 'number') return null;
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lon)) return null;
    return {
      latitude: data.lat,
      longitude: data.lon,
      codePostal: typeof data.codePostal === 'string' ? data.codePostal : null,
      parcelles: Array.isArray(data.parcelles)
        ? data.parcelles.filter((p): p is string => typeof p === 'string')
        : [],
    };
  } catch {
    return null;
  }
}
