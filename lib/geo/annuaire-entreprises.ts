/**
 * Annuaire des entreprises (API recherche-entreprises.api.gouv.fr).
 *
 * Enrichit les SCI / sociétés de la fiche parcelle : gérants, siège, date de
 * création, état. Donnée ouverte, sans clé. Ne lève jamais — un échec laisse
 * la fiche avec le seul nom BDNB.
 */

import { toDisplayCompanyName, toDisplayPersonName } from '@/lib/lead-person-display';

const BASE = process.env.ANNUAIRE_ENTREPRISES_BASE ?? 'https://recherche-entreprises.api.gouv.fr';
const DELAI_MS = 6000;
const TTL_MS = 24 * 60 * 60 * 1000;
const ENTETES = { accept: 'application/json', 'user-agent': 'Priimo/1.0 (fiche parcelle)' } as const;

export type DirigeantEntreprise = {
  nom: string;
  qualite: string | null;
};

export type FicheEntreprise = {
  siren: string;
  dirigeants: DirigeantEntreprise[];
  siege: string | null;
  dateCreation: string | null;
  active: boolean | null;
};

type DirigeantApi = {
  nom?: string | null;
  prenoms?: string | null;
  denomination?: string | null;
  qualite?: string | null;
  type_dirigeant?: string | null;
};

type ResultatApi = {
  siren?: string;
  etat_administratif?: string | null;
  date_creation?: string | null;
  dirigeants?: DirigeantApi[] | null;
  siege?: {
    geo_adresse?: string | null;
    adresse?: string | null;
    libelle_voie?: string | null;
    code_postal?: string | null;
    libelle_commune?: string | null;
  } | null;
};

const memoire = new Map<string, { at: number; fiche: FicheEntreprise | null }>();

/** Qualités inutiles pour un agent (commissaires, liquidateurs…). */
const IGNORER =
  /commissaire|liquidateur|contr[oô]leur|mandataire|repr[eé]sentant des cr[eé]anciers/i;

/** Ordre d’intérêt terrain : qui décider / signer. */
function scoreQualite(q: string | null | undefined): number {
  if (!q) return 50;
  const s = q.toLocaleLowerCase('fr');
  if (/g[eé]rant/.test(s)) return 0;
  if (/pr[eé]sident/.test(s) && !/surveillance/.test(s)) return 1;
  if (/directeur g[eé]n[eé]ral|dg\b/.test(s)) return 2;
  if (/directeur/.test(s)) return 3;
  if (/associ[eé]/.test(s)) return 4;
  if (/autre/i.test(s)) return 80;
  return 40;
}

/** « Gérant et associé indéfiniment responsable » → « Gérant ». */
export function raccourcirQualite(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().toLocaleLowerCase('fr');
  if (/g[eé]rant/.test(s)) return 'Gérant';
  if (/pr[eé]sident du conseil d.administration/.test(s)) return 'Président';
  if (/pr[eé]sident du directoire/.test(s)) return 'Président';
  if (/pr[eé]sident/.test(s) && !/surveillance/.test(s)) return 'Président';
  if (/directeur g[eé]n[eé]ral/.test(s)) return 'Directeur général';
  if (/directeur/.test(s)) return 'Directeur';
  if (/associ[eé]/.test(s) && !/g[eé]rant/.test(s)) return 'Associé';
  if (/^autre$/i.test(s.trim())) return null;
  return toDisplayPersonName(raw.trim());
}

function nomDirigeant(d: DirigeantApi): string | null {
  if (d.type_dirigeant === 'personne morale') {
    const den = d.denomination?.trim();
    return den ? toDisplayCompanyName(den) : null;
  }
  // « CADOT (BLONDELET) » → nom d’usage seul ; premier prénom seulement.
  const nom = (d.nom ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const prenom = (d.prenoms ?? '').trim().split(/\s+/)[0] ?? '';
  const brut = `${prenom} ${nom}`.trim();
  return brut ? toDisplayPersonName(brut) : null;
}

function formaterSiege(siege: ResultatApi['siege']): string | null {
  if (!siege) return null;
  const brut = (siege.geo_adresse || siege.adresse || '').trim();
  if (brut) {
    return brut
      .split(/\s+/)
      .map((mot, i) => {
        if (/^\d/.test(mot)) return mot;
        if (i > 0 && /^(de|des|du|la|le|les|et|en|sur|sous|a|à)$/i.test(mot)) {
          return mot.toLocaleLowerCase('fr');
        }
        return toDisplayPersonName(mot);
      })
      .join(' ');
  }
  const bits = [siege.libelle_voie, siege.code_postal, siege.libelle_commune]
    .map((x) => x?.trim())
    .filter(Boolean);
  return bits.length > 0 ? bits.join(' ') : null;
}

export function ficheDepuisResultat(r: ResultatApi, siren: string): FicheEntreprise {
  const dirigeants = (r.dirigeants ?? [])
    .filter((d) => !IGNORER.test(d.qualite ?? ''))
    .map((d) => {
      const nom = nomDirigeant(d);
      if (!nom) return null;
      return { nom, qualite: raccourcirQualite(d.qualite), _score: scoreQualite(d.qualite) };
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .sort((a, b) => a._score - b._score || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, 3)
    .map(({ nom, qualite }) => ({ nom, qualite }));

  const etat = r.etat_administratif?.toUpperCase() ?? null;
  return {
    siren,
    dirigeants,
    siege: formaterSiege(r.siege),
    dateCreation: r.date_creation?.slice(0, 10) || null,
    active: etat === 'A' ? true : etat === 'C' ? false : null,
  };
}

async function interroger(siren: string): Promise<FicheEntreprise | null> {
  const url = `${BASE}/search?q=${encodeURIComponent(siren)}&page=1&per_page=1`;
  const res = await fetch(url, {
    headers: ENTETES,
    signal: AbortSignal.timeout(DELAI_MS),
    // Cache Next 24 h — l’Annuaire ne bouge presque pas au quotidien.
    next: { revalidate: 86_400 },
    cache: 'force-cache',
  });
  if (!res.ok) {
    if (res.status === 429) console.warn('[annuaire] quota');
    else console.error('[annuaire] réponse', res.status);
    return null;
  }
  const json = (await res.json()) as { results?: ResultatApi[] };
  const r = json.results?.[0];
  if (!r || (r.siren && r.siren !== siren)) return null;
  return ficheDepuisResultat(r, siren);
}

/** Fiche publique d’un SIREN. Cache mémoire 24 h. */
export async function lireEntrepriseParSiren(siren: string): Promise<FicheEntreprise | null> {
  if (!/^\d{9}$/.test(siren)) return null;
  const enMemoire = memoire.get(siren);
  if (enMemoire && Date.now() - enMemoire.at < TTL_MS) return enMemoire.fiche;
  try {
    const fiche = await interroger(siren);
    memoire.set(siren, { at: Date.now(), fiche });
    return fiche;
  } catch (err) {
    console.error('[annuaire] échec', siren, err instanceof Error ? err.message : err);
    memoire.set(siren, { at: Date.now(), fiche: null });
    return null;
  }
}

/** Enrichit en parallèle les SIREN demandés (borné). */
export async function lireEntreprisesParSirens(
  sirens: readonly string[],
  max = 6,
): Promise<Map<string, FicheEntreprise>> {
  const uniques = [...new Set(sirens.filter((s) => /^\d{9}$/.test(s)))].slice(0, max);
  const out = new Map<string, FicheEntreprise>();
  await Promise.all(
    uniques.map(async (s) => {
      const f = await lireEntrepriseParSiren(s);
      if (f) out.set(s, f);
    }),
  );
  return out;
}
