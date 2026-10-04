import { toGeoCoord } from '@/lib/carte/coords';

/** `carre` : la vue « regarder autour », sans rogner les côtés de la photo. */
export type FacadeFormat = 'liste' | 'detail' | 'carre';

const SIZES: Record<FacadeFormat, { width: number; height: number }> = {
  liste: { width: 240, height: 160 },
  detail: { width: 640, height: 400 },
  carre: { width: 640, height: 640 },
};

export function parseFacadeFormat(raw: string | null): FacadeFormat {
  return raw === 'detail' ? 'detail' : raw === 'carre' ? 'carre' : 'liste';
}

export function parseFacadeGeoParams(searchParams: URLSearchParams): {
  latitude: number;
  longitude: number;
  format: FacadeFormat;
  vue: 'street' | 'satellite';
  /** Degrés de rotation depuis la façade (« regarder autour »). Null : vue par défaut. */
  tourner: number | null;
} | null {
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lng'));
  const coord = toGeoCoord(latitude, longitude);
  if (!coord) return null;
  const tournerBrut = searchParams.get('tourner');
  const tourner = tournerBrut === null ? null : Math.round(Number(tournerBrut));
  return {
    ...coord,
    format: parseFacadeFormat(searchParams.get('format')),
    vue: searchParams.get('vue') === 'satellite' ? 'satellite' : 'street',
    tourner: tourner !== null && Number.isFinite(tourner) && Math.abs(tourner) <= 180 ? tourner : null,
  };
}

/** Cap (0 = nord, 90 = est) pour regarder de `depuis` vers `vers`. */
export function capVers(
  depuis: { latitude: number; longitude: number },
  vers: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const p1 = depuis.latitude * rad;
  const p2 = vers.latitude * rad;
  const dl = (vers.longitude - depuis.longitude) * rad;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return Math.round(((Math.atan2(y, x) / rad) + 360) % 360);
}

type Orientation = { pano: string; cap: number; expire: number };
const ORIENTATIONS = new Map<string, Orientation>();
const ORIENTATIONS_MAX = 500;
const ORIENTATION_TTL_MS = 24 * 3_600_000;

/**
 * D'où la photo de la façade a été prise, et dans quelle direction regarder
 * l'immeuble. Les métadonnées Street View ne sont pas facturées ; on les garde
 * un jour pour que chaque rotation reste sur le même panorama.
 */
export async function orientationFacade(
  latitude: number,
  longitude: number,
): Promise<{ pano: string; cap: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;
  const cle = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const connue = ORIENTATIONS.get(cle);
  if (connue && connue.expire > Date.now()) return { pano: connue.pano, cap: connue.cap };

  const params = new URLSearchParams({ location: `${latitude},${longitude}`, source: 'outdoor', key: apiKey });
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`);
    if (!res.ok) return null;
    const meta = (await res.json()) as { status?: string; pano_id?: string; location?: { lat: number; lng: number } };
    if (meta.status !== 'OK' || !meta.pano_id || !meta.location) return null;
    const cap = capVers({ latitude: meta.location.lat, longitude: meta.location.lng }, { latitude, longitude });
    if (ORIENTATIONS.size >= ORIENTATIONS_MAX) {
      const plusAncienne = ORIENTATIONS.keys().next().value;
      if (plusAncienne !== undefined) ORIENTATIONS.delete(plusAncienne);
    }
    ORIENTATIONS.set(cle, { pano: meta.pano_id, cap, expire: Date.now() + ORIENTATION_TTL_MS });
    return { pano: meta.pano_id, cap };
  } catch {
    return null;
  }
}

export function streetViewStaticUrl(
  latitude: number,
  longitude: number,
  format: FacadeFormat,
  /** Un panorama précis et une direction : pour tourner la tête sans changer de point de vue. */
  regard?: { pano: string; heading: number },
): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const { width, height } = SIZES[format];
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    ...(regard
      ? { pano: regard.pano, heading: String(regard.heading) }
      : { location: `${latitude},${longitude}` }),
    fov: '80',
    pitch: '10',
    source: 'outdoor',
    return_error_code: 'true',
    key: apiKey,
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

export function satelliteStaticUrl(
  latitude: number,
  longitude: number,
  format: FacadeFormat,
): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;
  const { width, height } = SIZES[format];
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    center: `${latitude},${longitude}`,
    zoom: '19',
    maptype: 'satellite',
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Proxy Street View / satellite. La clé Google ne sort jamais du serveur. */
export async function fetchStreetViewImage(
  latitude: number,
  longitude: number,
  format: FacadeFormat,
  vue: 'street' | 'satellite' = 'street',
  tourner: number | null = null,
): Promise<Response> {
  let regard: { pano: string; heading: number } | undefined;
  if (vue === 'street' && tourner !== null) {
    const orientation = await orientationFacade(latitude, longitude);
    if (!orientation) return new Response(null, { status: 404 });
    regard = { pano: orientation.pano, heading: (((orientation.cap + tourner) % 360) + 360) % 360 };
  }
  const googleUrl =
    vue === 'satellite'
      ? satelliteStaticUrl(latitude, longitude, format)
      : streetViewStaticUrl(latitude, longitude, format, regard);
  if (!googleUrl) return new Response(null, { status: 503 });

  let googleRes: Response;
  try {
    googleRes = await fetch(googleUrl);
  } catch (e) {
    console.error('[facade] fetch Street View', e);
    return new Response(null, { status: 502 });
  }

  if (googleRes.status === 404) return new Response(null, { status: 404 });
  if (!googleRes.ok) {
    if (process.env.NODE_ENV === 'development') {
      const preview = (await googleRes.text()).slice(0, 280);
      console.error('[facade] Street View refusé', googleRes.status, preview);
    }
    return new Response(null, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Cache-Control', googleRes.headers.get('Cache-Control') ?? 'private, max-age=86400');
  const contentType = googleRes.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  return new Response(googleRes.body, { status: 200, headers });
}
