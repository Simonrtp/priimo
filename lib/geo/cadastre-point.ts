/**
 * Cadastre IGN — la parcelle qui contient un point.
 * API publique, sans clé : https://apicarto.ign.fr/api/cadastre
 *
 * Sert quand l'index adresse ↔ parcelle ne connaît pas l'adresse cherchée.
 */
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';

export type ParcelleAuPoint = {
  parcelleId: string;
  /** Contenance cadastrale, en m². */
  surfaceM2: number | null;
};

const TIMEOUT_MS = 6_000;

export async function fetchParcelleAuPoint(input: {
  latitude: number;
  longitude: number;
}): Promise<ParcelleAuPoint | null> {
  const url = new URL('https://apicarto.ign.fr/api/cadastre/parcelle');
  url.searchParams.set(
    'geom',
    JSON.stringify({ type: 'Point', coordinates: [input.longitude, input.latitude] }),
  );
  url.searchParams.set('_limit', '1');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: ac.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    return lireParcelleAuPoint(body.features?.[0]?.properties);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Pur : les propriétés d'une parcelle API Carto → identifiant canonique + surface. */
export function lireParcelleAuPoint(
  props: Record<string, unknown> | null | undefined,
): ParcelleAuPoint | null {
  const parcelleId = normalizeParcelleId(typeof props?.idu === 'string' ? props.idu : null);
  if (!parcelleId) return null;
  const contenance = Number(props?.contenance);
  return {
    parcelleId,
    surfaceM2: Number.isFinite(contenance) && contenance > 0 ? contenance : null,
  };
}
