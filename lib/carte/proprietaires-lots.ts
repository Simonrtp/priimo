/**
 * Fichier des locaux des personnes morales (DGFiP, Licence Ouverte) : une
 * ligne par local — appartement, cave, parking ou commerce, le fichier ne le
 * dit pas — avec sa parcelle, son étage et la société qui le détient.
 * Jamais de particulier : la DGFiP ne publie que les personnes morales.
 *
 * On regroupe par parcelle et par propriétaire : « SCI X, 2 lots, RDC et
 * 3e étage ». Pur : le script d'import et les tests s'en servent.
 */

import { genreProprietaire, type GenreProprietaire, type ProprietaireMorale } from '@/lib/carte/bdnb';

export type LigneLocal = {
  departement: string;
  commune: string;
  prefixe: string;
  section: string;
  plan: string;
  niveau: string;
  droit: string;
  siren: string;
  groupe: string;
  forme: string;
  denomination: string;
};

export type LotsProprietaire = {
  parcelle_id: string;
  siren: string;
  denomination: string;
  forme: string | null;
  groupe: number | null;
  droit: string;
  nb_lots: number;
  niveaux: number[];
};

/**
 * Référence cadastrale à 14 caractères : INSEE (5) + préfixe (3) + section
 * (2) + numéro de plan (4). Paris : département 75, commune 101 à 120.
 */
export function parcelleDuLocal(l: Pick<LigneLocal, 'departement' | 'commune' | 'prefixe' | 'section' | 'plan'>): string | null {
  if (!l.section.trim() || !l.plan.trim() || Number(l.plan.trim()) === 0) return null;
  const dep = l.departement.trim().toUpperCase();
  const com = l.commune.trim().padStart(3, '0');
  const prefixe = (l.prefixe.trim() || '0').padStart(3, '0');
  const section = l.section.trim().toUpperCase().padStart(2, '0');
  const plan = l.plan.trim().padStart(4, '0');
  const id = `${dep}${com}${prefixe}${section}${plan}`;
  return /^[0-9][0-9AB][0-9]{3}[0-9]{3}[0-9A-Z]{2}[0-9]{4}$/.test(id) ? id : null;
}

/** « P - Propriétaire » → « P » ; « 0 - Personnes morales… » → 0. */
export function codeEnTete(brut: string): string {
  return brut.trim().split(/\s*-\s*/)[0]?.trim() ?? '';
}

/**
 * Niveau DGFiP → étage : 0 le RDC, 1 à 60 les étages, 81 à 89 les sous-sols
 * (81 = 1er sous-sol, rangé en -1). Le reste (80, 90 à 99) ne dit pas
 * d'étage. Idempotent : un étage déjà converti ressort tel quel.
 */
export function etageDuNiveau(n: number): number | null {
  if (!Number.isInteger(n)) return null;
  if (n >= -9 && n <= 60) return n;
  if (n >= 81 && n <= 89) return 80 - n;
  return null;
}

export function lireNiveau(brut: string): number | null {
  const n = Number(brut.trim());
  return Number.isFinite(n) && brut.trim() !== '' ? etageDuNiveau(n) : null;
}

/** Des lots tous en sous-sol : un parking ou une cave, pas un logement. */
export function seulementSousSol(niveaux: readonly number[]): boolean {
  const etages = niveaux.map(etageDuNiveau).filter((x): x is number => x != null);
  return etages.length > 0 && etages.every((x) => x < 0);
}

export class AgregatLots {
  private parCle = new Map<string, LotsProprietaire & { _niveaux: Set<number> }>();

  ajouter(l: LigneLocal): boolean {
    const parcelle_id = parcelleDuLocal(l);
    const denomination = l.denomination.trim().replace(/\s+/g, ' ');
    if (!parcelle_id || !denomination) return false;
    const siren = /^\d{9}$/.test(l.siren.trim()) ? l.siren.trim() : '';
    const droit = codeEnTete(l.droit) || 'P';
    const cle = `${parcelle_id}|${siren}|${denomination}|${droit}`;
    let a = this.parCle.get(cle);
    if (!a) {
      const groupe = Number(codeEnTete(l.groupe));
      a = {
        parcelle_id,
        siren,
        denomination,
        forme: l.forme.trim() || null,
        groupe: Number.isFinite(groupe) && l.groupe.trim() !== '' ? groupe : null,
        droit,
        nb_lots: 0,
        niveaux: [],
        _niveaux: new Set<number>(),
      };
      this.parCle.set(cle, a);
    }
    a.nb_lots += 1;
    const niveau = lireNiveau(l.niveau);
    if (niveau != null) a._niveaux.add(niveau);
    return true;
  }

  get taille(): number {
    return this.parCle.size;
  }

  resultat(): LotsProprietaire[] {
    return [...this.parCle.values()].map(({ _niveaux, ...reste }) => ({
      ...reste,
      niveaux: [..._niveaux].sort((x, y) => x - y),
    }));
  }
}

/**
 * « RDC, 2e et 4e étages », « sous-sol et 3e étage » ; au-delà de quatre
 * étages, « du RDC au 7e ». Les sous-sols, quel que soit leur rang, se
 * disent « sous-sol » : un agent n'a pas besoin du -2.
 */
export function decrireNiveaux(niveaux: readonly number[]): string | null {
  const reels = [...new Set(niveaux.map(etageDuNiveau).filter((x): x is number => x != null))];
  const sousSol = reels.some((x) => x < 0);
  const etages = reels.filter((x) => x >= 0).sort((a, b) => a - b);
  if (etages.length === 0) return sousSol ? 'sous-sol' : null;
  const nom = (x: number) => (x === 0 ? 'RDC' : x === 1 ? '1er' : `${x}e`);
  if (etages.length > 4) return `du ${sousSol ? 'sous-sol' : nom(etages[0]!)} au ${nom(etages[etages.length - 1]!)}`;
  if (etages.length === 1 && !sousSol) return etages[0] === 0 ? 'rez-de-chaussée' : `${nom(etages[0]!)} étage`;
  const noms = [...(sousSol ? ['sous-sol'] : []), ...etages.map(nom)];
  const enHauteur = etages.filter((x) => x > 0).length;
  const suffixe = enHauteur === 0 ? '' : enHauteur === 1 ? ' étage' : ' étages';
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}${suffixe}`;
}

/** Groupes de personnes DGFiP : 1 à 4 et 9 publics, 5 HLM, 7 copropriété. */
function genreDuGroupe(groupe: number | null, forme: string | null, nom: string): GenreProprietaire {
  if (groupe != null && [1, 2, 3, 4, 9].includes(groupe)) return 'public';
  if (groupe === 5) return 'social';
  if (groupe === 7) return 'copropriete';
  if ((forme ?? '').toUpperCase() === 'SCI') return 'sci';
  return genreProprietaire(nom);
}

const ORDRE: Record<GenreProprietaire, number> = { public: 0, social: 1, sci: 2, societe: 3, copropriete: 4 };

/** « SOCIETE CIVILE IMMOBILIERE DU PORT » → « SCI DU PORT », comme on la nomme. */
export function abregerDenomination(nom: string): string {
  return nom.replace(/\bSOCI[EÉ]T[EÉ] CIVILE IMMOBILI[EÈ]RE\b/giu, 'SCI').replace(/\s+/g, ' ').trim();
}

/**
 * Lignes de `parcelle_proprietaires` → propriétaires de la fiche. Un même
 * propriétaire n'apparaît qu'une fois, même s'il cumule pleine propriété et
 * usufruit ; les plus gros détenteurs d'abord.
 */
export function versProprietaires(lignes: readonly LotsProprietaire[]): ProprietaireMorale[] {
  const parCle = new Map<string, ProprietaireMorale & { _niveaux: Set<number> }>();
  for (const l of lignes) {
    const cle = l.siren || l.denomination.toUpperCase();
    let p = parCle.get(cle);
    if (!p) {
      p = {
        nom: abregerDenomination(l.denomination),
        siren: l.siren || null,
        genre: genreDuGroupe(l.groupe, l.forme, l.denomination),
        nbLots: 0,
        niveaux: [],
        droit: l.droit,
        _niveaux: new Set<number>(),
      };
      parCle.set(cle, p);
    }
    p.nbLots = (p.nbLots ?? 0) + l.nb_lots;
    if (l.droit === 'P') p.droit = 'P';
    for (const n of l.niveaux) {
      const etage = etageDuNiveau(n);
      if (etage != null) p._niveaux.add(etage);
    }
  }
  return [...parCle.values()]
    .map(({ _niveaux, ...p }) => ({ ...p, niveaux: [..._niveaux].sort((a, b) => a - b) }))
    .sort((a, b) => ORDRE[a.genre] - ORDRE[b.genre] || (b.nbLots ?? 0) - (a.nbLots ?? 0));
}
