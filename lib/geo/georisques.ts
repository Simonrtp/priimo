/**
 * Géorisques — risques recensés sur un point.
 * API publique : https://georisques.gouv.fr/api
 */

export type RisqueRecense = {
  libelle: string;
  present: boolean;
};

const TIMEOUT_MS = 6_000;

export async function fetchRisquesParcelle(input: {
  latitude: number;
  longitude: number;
  signal?: AbortSignal;
}): Promise<RisqueRecense[]> {
  const url = new URL('https://www.georisques.gouv.fr/api/v1/resultats_risques');
  url.searchParams.set('latlon', `${input.longitude},${input.latitude}`);

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    const res = await fetch(url.toString(), {
      signal: input.signal ?? ac.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const body = (await res.json()) as Record<string, unknown>;
    return extraire(body);
  } catch {
    return [];
  }
}

function extraire(body: Record<string, unknown>): RisqueRecense[] {
  const out: RisqueRecense[] = [];
  const risque = body.risqueNatural ? asObj(body.risqueNatural) : body;
  for (const [cle, val] of Object.entries(risque)) {
    if (cle === 'codeInsee' || cle === 'libelle' || cle === 'commune') continue;
    if (typeof val === 'boolean') {
      out.push({ libelle: libelleRisque(cle), present: val });
      continue;
    }
    if (typeof val === 'string' && val.trim()) {
      const present = !/^(non|aucun|0|false)$/i.test(val.trim());
      out.push({ libelle: `${libelleRisque(cle)} — ${val.trim()}`, present });
    }
  }
  return out.filter((r) => r.present);
}

function asObj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function libelleRisque(cle: string): string {
  return cle
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}
