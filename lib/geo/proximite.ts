/**
 * Habitants de la commune et points d’intérêt autour d’une adresse.
 * APIs publiques, sans clé — un échec laisse le champ vide.
 */

export type ProximiteAdresse = {
  commune: string | null;
  habitants: number | null;
  commerces: number | null;
  transports: number | null;
};

const TIMEOUT_MS = 7_000;
const RAYON_COMMERCES_M = 400;
const RAYON_TRANSPORTS_M = 500;

export async function fetchProximiteAdresse(input: {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
}): Promise<ProximiteAdresse> {
  const vide: ProximiteAdresse = {
    commune: null,
    habitants: null,
    commerces: null,
    transports: null,
  };
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return vide;

  const [commune, pois] = await Promise.all([
    fetchCommune(input.latitude, input.longitude, input.signal),
    fetchPois(input.latitude, input.longitude, input.signal),
  ]);

  return {
    commune: commune.nom,
    habitants: commune.population,
    commerces: pois.commerces,
    transports: pois.transports,
  };
}

async function fetchCommune(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ nom: string | null; population: number | null }> {
  const url = new URL('https://geo.api.gouv.fr/communes');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('fields', 'nom,population');
  url.searchParams.set('format', 'json');

  try {
    const res = await getJson(url.toString(), signal);
    const row = Array.isArray(res) ? asObj(res[0]) : asObj(res);
    const nom = typeof row.nom === 'string' && row.nom.trim() ? row.nom.trim() : null;
    const population =
      typeof row.population === 'number' && Number.isFinite(row.population) && row.population > 0
        ? Math.round(row.population)
        : null;
    return { nom, population };
  } catch {
    return { nom: null, population: null };
  }
}

async function fetchPois(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ commerces: number | null; transports: number | null }> {
  const shops = `(
  node["shop"](around:${RAYON_COMMERCES_M},${lat},${lng});
  node["amenity"~"^(restaurant|cafe|bar|bakery|pharmacy|supermarket|convenience)$"](around:${RAYON_COMMERCES_M},${lat},${lng});
);`;
  const transit = `(
  node["highway"="bus_stop"](around:${RAYON_TRANSPORTS_M},${lat},${lng});
  node["railway"~"^(station|halt|tram_stop)$"](around:${RAYON_TRANSPORTS_M},${lat},${lng});
  node["public_transport"="platform"](around:${RAYON_TRANSPORTS_M},${lat},${lng});
  node["station"="subway"](around:${RAYON_TRANSPORTS_M},${lat},${lng});
);`;

  const [commerces, transports] = await Promise.all([
    countOverpass(shops, signal),
    countOverpass(transit, signal),
  ]);
  return { commerces, transports };
}

async function countOverpass(filtre: string, signal?: AbortSignal): Promise<number | null> {
  const query = `[out:json][timeout:6];${filtre}out count;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { elements?: Array<{ tags?: Record<string, string> }> };
    const total = body.elements?.[0]?.tags?.total;
    const n = total != null ? Number(total) : NaN;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const onAbort = () => ac.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } finally {
    clearTimeout(t);
    signal?.removeEventListener('abort', onAbort);
  }
}

function asObj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}
