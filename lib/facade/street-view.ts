export type FacadeFormat = 'liste' | 'detail';

const SIZES: Record<FacadeFormat, { width: number; height: number }> = {
  liste: { width: 240, height: 160 },
  detail: { width: 640, height: 400 },
};

export function parseFacadeFormat(raw: string | null): FacadeFormat {
  return raw === 'detail' ? 'detail' : 'liste';
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
