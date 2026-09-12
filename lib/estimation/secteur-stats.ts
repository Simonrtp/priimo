import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AxeRadar, FamilleGrilleId } from '@/lib/estimation/grille';
import { FAMILLES_GRILLE } from '@/lib/estimation/grille';

type Db = SupabaseClient<Database>;

export type SecteurStatsObserves = {
  immeubles: number;
  dpeRepartition: { letter: string; count: number }[];
  surfaces: { p25: number | null; mediane: number | null; p75: number | null };
  epoqueConstruction: string | null;
  partAscenseur: number | null;
  logementsSociaux: number | null;
  partProprietaires: number | null;
  partLocataires: number | null;
  profilsBiens: { type: string; count: number }[];
};

export type LigneStatSecteur = { libelle: string; valeur: string };

/** Une donnée absente ne s’affiche pas — surtout l’ascenseur, absent d’IRIS. */
export function lignesStatsSecteur(stats: SecteurStatsObserves): LigneStatSecteur[] {
  const out: LigneStatSecteur[] = [];
  out.push({ libelle: 'Immeubles', valeur: String(stats.immeubles) });
  if (stats.surfaces.mediane != null) {
    out.push({ libelle: 'Surface médiane', valeur: `${Math.round(stats.surfaces.mediane)} m²` });
  }
  if (stats.epoqueConstruction) {
    out.push({ libelle: 'Époque', valeur: stats.epoqueConstruction });
  }
  if (stats.logementsSociaux != null) {
    out.push({ libelle: 'Logements sociaux', valeur: String(stats.logementsSociaux) });
  }
  if (stats.partProprietaires != null) {
    out.push({ libelle: 'Propriétaires', valeur: `${Math.round(stats.partProprietaires * 100)} %` });
  }
  if (stats.partLocataires != null) {
    out.push({ libelle: 'Locataires', valeur: `${Math.round(stats.partLocataires * 100)} %` });
  }
  if (stats.partAscenseur != null) {
    out.push({ libelle: 'Ascenseur', valeur: `${Math.round(stats.partAscenseur * 100)} %` });
  }
  if (stats.dpeRepartition.length > 0) {
    out.push({
      libelle: 'DPE du secteur',
      valeur: stats.dpeRepartition.map((d) => `${d.letter} ${d.count}`).join(' · '),
    });
  }
  for (const p of stats.profilsBiens.slice(0, 4)) {
    out.push({ libelle: p.type, valeur: String(p.count) });
  }
  return out;
}

/** Baseline radar : seulement les familles où le parc dit quelque chose. */
export function baselineRadarSecteur(stats: SecteurStatsObserves): AxeRadar[] {
  const energie = scoreDpe(stats.dpeRepartition);
  const autres = stats.partAscenseur != null ? 1 + stats.partAscenseur * 4 : null;
  const principaux = scoreEpoque(stats.epoqueConstruction);

  const parFamille: Partial<Record<FamilleGrilleId, number | null>> = {
    energie,
    autres_elements: autres,
    elements_principaux: principaux,
  };

  return FAMILLES_GRILLE.map((f) => ({
    famille: f.id,
    libelle: f.libelle,
    score: parFamille[f.id] ?? null,
  }));
}

function scoreDpe(repartition: { letter: string; count: number }[]): number | null {
  const poids: Record<string, number> = { A: 5, B: 4.5, C: 4, D: 3, E: 2, F: 1.5, G: 1 };
  let n = 0;
  let s = 0;
  for (const row of repartition) {
    const p = poids[row.letter.toUpperCase()];
    if (p == null || row.count <= 0) continue;
    s += p * row.count;
    n += row.count;
  }
  return n > 0 ? s / n : null;
}

function scoreEpoque(raw: string | null): number | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t.includes('2001') || t.includes('2013') || t.includes('récen') || t.includes('recen')) return 4.2;
  if (t.includes('1981') || t.includes('1990')) return 3.4;
  if (t.includes('1949') || t.includes('1974')) return 2.6;
  if (t.includes('avant') || t.includes('1919')) return 3.2;
  return 3;
}

export async function statsSecteurObserves(
  admin: Db,
  postalCode: string,
): Promise<SecteurStatsObserves> {
  const vide: SecteurStatsObserves = {
    immeubles: 0,
    dpeRepartition: [],
    surfaces: { p25: null, mediane: null, p75: null },
    epoqueConstruction: null,
    partAscenseur: null,
    logementsSociaux: null,
    partProprietaires: null,
    partLocataires: null,
    profilsBiens: [],
  };
  if (!/^\d{5}$/.test(postalCode)) return vide;

  const banIds = await banIdsDuSecteur(admin, postalCode);
  const [{ count }, { data: dpes }, { data: tx }] = await Promise.all([
    admin.from('buildings').select('ban_id', { count: 'exact', head: true }).eq('code_postal', postalCode),
    banIds.length > 0
      ? admin.from('building_dpe').select('etiquette_dpe, surface').in('ban_id', banIds).limit(400)
      : Promise.resolve({ data: [] as { etiquette_dpe: string | null; surface: number | null }[] }),
    banIds.length > 0
      ? admin
          .from('building_transactions')
          .select('type_local, surface_reelle_bati')
          .in('ban_id', banIds)
          .limit(400)
      : Promise.resolve({ data: [] as { type_local: string | null; surface_reelle_bati: number | null }[] }),
  ]);

  const dpeRepartition = compterLettres((dpes ?? []).map((d) => d.etiquette_dpe));
  const surfaces = quantiles(
    (dpes ?? [])
      .map((d) => d.surface)
      .filter((n): n is number => typeof n === 'number' && n > 0),
  );
  const profils = new Map<string, number>();
  for (const row of tx ?? []) {
    const t = (row.type_local ?? '').trim() || 'Autre';
    profils.set(t, (profils.get(t) ?? 0) + 1);
  }
  return {
    immeubles: count ?? 0,
    dpeRepartition,
    surfaces,
    epoqueConstruction: null,
    partAscenseur: null,
    logementsSociaux: null,
    partProprietaires: null,
    partLocataires: null,
    profilsBiens: [...profils.entries()].map(([type, n]) => ({ type, count: n })),
  };
}

async function banIdsDuSecteur(admin: Db, postalCode: string): Promise<string[]> {
  const { data } = await admin
    .from('buildings')
    .select('ban_id')
    .eq('code_postal', postalCode)
    .limit(400);
  return [...new Set((data ?? []).map((b) => b.ban_id).filter(Boolean))];
}

export async function medianeParkingSecteur(admin: Db, postalCode: string): Promise<number | null> {
  if (!/^\d{5}$/.test(postalCode)) return null;
  const banIds = await banIdsDuSecteur(admin, postalCode);
  if (banIds.length === 0) return null;
  const { data } = await admin
    .from('building_transactions')
    .select('valeur_fonciere, type_local')
    .in('ban_id', banIds)
    .limit(400);
  const prix = (data ?? [])
    .filter((r) => /parking|garage|box/i.test(r.type_local ?? ''))
    .map((r) => r.valeur_fonciere)
    .filter((n): n is number => typeof n === 'number' && n > 1_000 && n < 80_000)
    .sort((a, b) => a - b);
  if (prix.length === 0) return null;
  return prix[Math.floor(prix.length / 2)] ?? null;
}

function compterLettres(raw: (string | null)[]): { letter: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of raw) {
    const l = (v ?? '').trim().toUpperCase();
    if (!/^[A-G]$/.test(l)) continue;
    map.set(l, (map.get(l) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

function quantiles(values: number[]): { p25: number | null; mediane: number | null; p75: number | null } {
  if (values.length === 0) return { p25: null, mediane: null, p75: null };
  const s = [...values].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] ?? null;
  return { p25: at(0.25), mediane: at(0.5), p75: at(0.75) };
}
