import { MAP_3D_BEARING, MAP_3D_PITCH } from '@/lib/map/camera';

/** 2D = plan à plat. 3D = relief des immeubles, caméra inclinée. */
export type MapDimension = '2d' | '3d';

export const MAP_DIMENSION_STORAGE_KEY = 'priimo-carte-dimension';

export type MapCamera = { pitch: number; bearing: number };

const FLAT: MapCamera = { pitch: 0, bearing: 0 };
const TILTED: MapCamera = { pitch: MAP_3D_PITCH, bearing: MAP_3D_BEARING };

export function cameraFor(dimension: MapDimension): MapCamera {
  return dimension === '3d' ? TILTED : FLAT;
}

export function toggleDimension(dimension: MapDimension): MapDimension {
  return dimension === '3d' ? '2d' : '3d';
}

export function parseMapDimension(raw: unknown): MapDimension {
  return raw === '3d' ? '3d' : '2d';
}

export function readMapDimension(): MapDimension {
  if (typeof window === 'undefined') return '2d';
  try {
    return parseMapDimension(window.localStorage.getItem(MAP_DIMENSION_STORAGE_KEY));
  } catch {
    return '2d';
  }
}

export function persistMapDimension(dimension: MapDimension): void {
  try {
    window.localStorage.setItem(MAP_DIMENSION_STORAGE_KEY, dimension);
  } catch {
    // quota / mode privé
  }
}
