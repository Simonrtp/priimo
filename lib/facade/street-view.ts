import { toGeoCoord } from '@/lib/carte/coords';

export type FacadeFormat = 'liste' | 'detail';

const SIZES: Record<FacadeFormat, { width: number; height: number }> = {
  liste: { width: 240, height: 160 },
  detail: { width: 640, height: 400 },
};

export function parseFacadeFormat(raw: string | null): FacadeFormat {
  return raw === 'detail' ? 'detail' : 'liste';
}

export function parseFacadeGeoParams(searchParams: URLSearchParams): {
  latitude: number;
  longitude: number;
  format: FacadeFormat;
} | null {
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lng'));
  const coord = toGeoCoord(latitude, longitude);
  if (!coord) return null;
  return { ...coord, format: parseFacadeFormat(searchParams.get('format')) };
}

export function streetViewStaticUrl(
  latitude: number,
  longitude: number,
  format: FacadeFormat,
): string | null {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const { width, height } = SIZES[format];
  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${latitude},${longitude}`,
    fov: '80',
    pitch: '10',
    source: 'outdoor',
    return_error_code: 'true',
    key: apiKey,
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/** Proxy Street View. La clé Google ne sort jamais du serveur. */
export async function fetchStreetViewImage(
  latitude: number,
  longitude: number,
  format: FacadeFormat,
): Promise<Response> {
  const googleUrl = streetViewStaticUrl(latitude, longitude, format);
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
