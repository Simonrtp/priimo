/**
 * Chargement unique du recensement communal.
 *
 * Population : API Géo (population municipale INSEE), toutes les communes.
 * Âges, CSP, chômage : uniquement si un CSV est passé en argument.
 * Colonnes attendues, séparateur « ; » :
 *   code;nom;population;taux_chomage;millesime;ages_json;csp_json;serie_json
 * Les parts sont des pourcentages (12,3 = 12,3 %). Une cellule vide reste nulle.
 * Rien n’est inventé.
 *
 *   npx tsx scripts/importer-insee-communes.ts
 *   npx tsx scripts/importer-insee-communes.ts chemin/recensement.csv
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

type Ligne = {
  code: string;
  nom: string | null;
  population: number | null;
  serie: unknown[];
  ages: unknown[];
  csp: unknown[];
  taux_chomage: number | null;
  millesime: number | null;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function nombre(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim().replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

function jsonCell(raw: string | undefined): unknown[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function ligneGeo(r: { code?: string; nom?: string; population?: number }): Ligne | null {
  if (typeof r.code !== 'string' || r.code.length < 5) return null;
  return {
    code: r.code,
    nom: r.nom?.trim() || null,
    population: typeof r.population === 'number' && r.population > 0 ? Math.round(r.population) : null,
    serie: [],
    ages: [],
    csp: [],
    taux_chomage: null,
    millesime: null,
  };
}

/** Paris, Lyon, Marseille : l’API « communes » ne rend que la ville, pas l’arrondissement. */
const CODES_ARRONDISSEMENT = [
  ...Array.from({ length: 20 }, (_, i) => `751${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `6938${i + 1}`),
  ...Array.from({ length: 16 }, (_, i) => `132${String(i + 1).padStart(2, '0')}`),
];

async function populationFrance(): Promise<Ligne[]> {
  const res = await fetch('https://geo.api.gouv.fr/communes?fields=nom,code,population');
  if (!res.ok) throw new Error(`API Géo ${res.status}`);
  const rows = (await res.json()) as Array<{ code?: string; nom?: string; population?: number }>;
  const lignes = rows.map(ligneGeo).filter((l): l is Ligne => l != null);
  const arr = await Promise.all(
    CODES_ARRONDISSEMENT.map(async (code) => {
      const un = await fetch(
        `https://geo.api.gouv.fr/communes/${code}?fields=nom,code,population`,
      );
      if (!un.ok) return null;
      return ligneGeo((await un.json()) as { code?: string; nom?: string; population?: number });
    }),
  );
  for (const extra of arr) {
    if (!extra) continue;
    const i = lignes.findIndex((l) => l.code === extra.code);
    if (i >= 0) lignes[i] = extra;
    else lignes.push(extra);
  }
  return lignes;
}

function lireCsv(chemin: string): Map<string, Ligne> {
  const texte = readFileSync(chemin, 'utf8').replace(/^\uFEFF/, '');
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim());
  const entete = lignes.shift()?.split(';').map((c) => c.trim()) ?? [];
  const idx = (nom: string) => entete.indexOf(nom);
  const out = new Map<string, Ligne>();
  for (const ligne of lignes) {
    const c = ligne.split(';');
    const code = c[idx('code')]?.trim();
    if (!code) continue;
    out.set(code, {
      code,
      nom: c[idx('nom')]?.trim() || null,
      population: nombre(c[idx('population')]),
      taux_chomage: nombre(c[idx('taux_chomage')]),
      millesime: nombre(c[idx('millesime')]),
      ages: jsonCell(c[idx('ages_json')]),
      csp: jsonCell(c[idx('csp_json')]),
      serie: jsonCell(c[idx('serie_json')]),
    });
  }
  return out;
}

async function ecrire(lignes: Ligne[]) {
  const taille = 500;
  for (let i = 0; i < lignes.length; i += taille) {
    const lot = lignes.slice(i, i + taille);
    const { error } = await supabase.from('insee_communes').upsert(lot, { onConflict: 'code' });
    if (error) throw new Error(error.message);
    console.log(`${Math.min(i + taille, lignes.length)} / ${lignes.length}`);
  }
}

async function main() {
  const csv = process.argv[2];
  const base = await populationFrance();
  if (csv) {
    const extra = lireCsv(csv);
    for (const ligne of base) {
      const plus = extra.get(ligne.code);
      if (!plus) continue;
      ligne.nom = plus.nom ?? ligne.nom;
      ligne.population = plus.population ?? ligne.population;
      ligne.taux_chomage = plus.taux_chomage;
      ligne.millesime = plus.millesime;
      ligne.ages = plus.ages;
      ligne.csp = plus.csp;
      ligne.serie = plus.serie;
    }
  }
  await ecrire(base);
  console.log(`Communes écrites : ${base.length}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
