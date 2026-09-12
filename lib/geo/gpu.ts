/**
 * Géoportail de l'urbanisme — zonage PLU d'un point.
 * API publique, sans clé : https://apicarto.ign.fr/api/gpu
 */

export type ZonePlu = {
  libelle: string | null;
  typezone: string | null;
  libelleType: string | null;
  urlDocument: string | null;
};

export type ContexteGpu = {
  zones: ZonePlu[];
  communeUrl: string | null;
};

const TIMEOUT_MS = 6_000;

export async function fetchZonagePlu(input: {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
}): Promise<ContexteGpu> {
  const geom = JSON.stringify({
    type: 'Point',
    coordinates: [input.longitude, input.latitude],
  });
  const url = new URL('https://apicarto.ign.fr/api/gpu/zone-urba');
  url.searchParams.set('geom', geom);

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    const res = await fetch(url.toString(), {
      signal: input.signal ?? ac.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return { zones: [], communeUrl: null };
    const body = (await res.json()) as {
      features?: Array<{ properties?: Record<string, unknown> }>;
    };
    const zones: ZonePlu[] = (body.features ?? []).map((f) => {
      const p = f.properties ?? {};
      return {
        libelle: texte(p.libelle) ?? texte(p.LIBELLE),
        typezone: texte(p.typezone) ?? texte(p.TYPEZONE),
        libelleType: texte(p.libelong) ?? texte(p.LIBELONG),
        urlDocument: texte(p.urlfic) ?? texte(p.URLFIC),
      };
    });
    const communeUrl = zones.find((z) => z.urlDocument)?.urlDocument ?? null;
    return { zones, communeUrl };
  } catch {
    return { zones: [], communeUrl: null };
  }
}

function texte(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}
