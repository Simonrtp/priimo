import type { ParcelleCopro, ParcelleLogement, ParcelleVente } from '@/lib/carte/parcelle';
import { DPE_LETTERS, formatDpeEtage, parseDpeLetter, type DpeLetter } from '@/lib/carte/dpe-public';
import { medianNumerique } from '@/lib/carte/cadastre-overlay';

/**
 * Ce que la fiche parcelle dit d'un coup d'œil : les faits qui décident
 * d'aller sonner, avant le détail des ventes et des diagnostics.
 *
 * Tout est calculé ici, sans réseau, pour rester testable et identique
 * entre le volet desktop et le plein écran mobile.
 */

const JOUR_MS = 86_400_000;
/** Un DPE de moins de six mois : le logement se prépare souvent à changer de main. */
export const DPE_RECENT_JOURS = 183;
/** Fenêtre des ventes « récentes » et du prix médian. */
export const FENETRE_VENTES_ANS = 3;
/** Au-delà de 8 % des lots vendus chaque année, l'immeuble « tourne ». */
const ROTATION_FORTE = 0.08;
/** Une vente de moins d'un an se signale dans l'en-tête. */
const VENTE_RECENTE_MOIS = 12;
/** DVF porte quelques prix aberrants (cessions à l'euro, erreurs de surface). */
const PRIX_M2_MIN = 500;
const PRIX_M2_MAX = 40_000;

export type FaitParcelle = { cle: string; texte: string };

export type PastilleParcelle = {
  cle: string;
  libelle: string;
  ton: 'passoire' | 'recent' | 'alerte' | 'neutre';
};

export type PrixParcelle = {
  valeur: number;
  /** Année de la plus ancienne vente retenue. */
  depuis: number;
  /** Vrai quand la médiane couvre la fenêtre de trois ans. */
  recent: boolean;
  n: number;
};

export type SyntheseParcelle = {
  /** Logements distincts, passoires d'abord. */
  logements: ParcelleLogement[];
  repartition: { lettre: DpeLetter; n: number }[];
  passoires: ParcelleLogement[];
  dpeRecent: ParcelleLogement | null;
  /** Ventes, la plus récente en tête. */
  ventes: ParcelleVente[];
  ventesFenetre: number;
  prix: PrixParcelle | null;
  /** Écart du prix médian de l'immeuble au secteur, en %. */
  ecartSecteurPct: number | null;
  lots: number | null;
  faits: FaitParcelle[];
  pastilles: PastilleParcelle[];
};

export function lettreDpe(logement: Pick<ParcelleLogement, 'etiquette'>): DpeLetter | null {
  return parseDpeLetter(logement.etiquette);
}

export function estPassoire(logement: Pick<ParcelleLogement, 'etiquette'>): boolean {
  const lettre = lettreDpe(logement);
  return lettre === 'F' || lettre === 'G';
}

/**
 * Un logement re-diagnostiqué ne compte qu'une fois, avec son DPE le plus
 * récent : un G refait en D après travaux n'est plus une passoire. Sans
 * étage ni surface, rien ne permet de rapprocher deux diagnostics : ils
 * restent distincts. Deux logements identiques diagnostiqués le même jour
 * aussi.
 */
export function logementsDistincts(logements: readonly ParcelleLogement[]): ParcelleLogement[] {
  const parCle = new Map<string, ParcelleLogement>();
  const isoles: ParcelleLogement[] = [];
  for (const logement of logements) {
    if (logement.etage == null || logement.surface == null) {
      isoles.push(logement);
      continue;
    }
    const cle = `${logement.banId ?? ''}|${Math.round(logement.etage)}|${Math.round(logement.surface * 10)}`;
    const deja = parCle.get(cle);
    // Le même jour, ce sont deux logements jumeaux (campagne d'un bailleur),
    // pas un logement refait.
    if (deja && deja.date === logement.date) {
      isoles.push(logement);
      continue;
    }
    if (!deja || (logement.date ?? '') > (deja.date ?? '')) parCle.set(cle, logement);
  }
  return [...parCle.values(), ...isoles];
}

/** Du DPE le plus récent au plus ancien. */
export function trierLogements(logements: readonly ParcelleLogement[]): ParcelleLogement[] {
  return [...logements].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export function repartitionDpe(logements: readonly ParcelleLogement[]): { lettre: DpeLetter; n: number }[] {
  return DPE_LETTERS.map((lettre) => ({
    lettre,
    n: logements.filter((l) => lettreDpe(l) === lettre).length,
  }));
}

/** Espace insécable : « 62 m² » ou « 4e étage » ne se coupent jamais en fin de ligne. */
const NBSP = ' ';

/** « 4e étage · 62 m² » : ce qui permet de trouver la porte. */
export function decrireLogement(logement: Pick<ParcelleLogement, 'etage' | 'surface'>): string {
  const morceaux = [
    formatDpeEtage(logement.etage)?.replace(/ /g, NBSP) ?? null,
    logement.surface != null ? `${Math.round(logement.surface)}${NBSP}m²` : null,
  ].filter(Boolean);
  return morceaux.join(' · ') || 'Logement';
}

/** « T3 · 62 m² » ou « Maison · 120 m² ». */
export function decrireVente(vente: Pick<ParcelleVente, 'typeLocal' | 'nombrePieces' | 'surface'>): string {
  const type =
    vente.typeLocal === 'Appartement' && vente.nombrePieces
      ? `T${Math.round(vente.nombrePieces)}`
      : vente.typeLocal === 'Maison' && vente.nombrePieces
        ? `Maison ${Math.round(vente.nombrePieces)}${NBSP}p.`
        : vente.typeLocal ?? null;
  const surface = vente.surface != null ? `${Math.round(vente.surface)}${NBSP}m²` : null;
  return [type, surface].filter(Boolean).join(' · ') || 'Vente';
}

function prixM2Plausible(n: number | null): n is number {
  return n != null && Number.isFinite(n) && n >= PRIX_M2_MIN && n <= PRIX_M2_MAX;
}

function anneeDe(iso: string): number {
  return Number(iso.slice(0, 4));
}

function moisEcoules(iso: string, maintenant: Date): number {
  const d = new Date(iso);
  return (maintenant.getFullYear() - d.getFullYear()) * 12 + (maintenant.getMonth() - d.getMonth());
}

/** « il y a 4 mois », « il y a 2 ans », « ce mois-ci ». */
export function depuisQuand(iso: string, maintenant: Date = new Date()): string {
  const mois = moisEcoules(iso, maintenant);
  if (mois <= 0) return 'ce mois-ci';
  if (mois < 12) return `il y a ${mois} mois`;
  const ans = Math.floor(mois / 12);
  return `il y a ${ans} an${ans > 1 ? 's' : ''}`;
}

/** Appartement ou maison : on ne compare jamais un prix au m² entre les deux. */
export function typeDominant(ventes: readonly Pick<ParcelleVente, 'typeLocal'>[]): string | null {
  const compte = new Map<string, number>();
  for (const v of ventes) {
    if (!v.typeLocal) continue;
    compte.set(v.typeLocal, (compte.get(v.typeLocal) ?? 0) + 1);
  }
  let meilleur: string | null = null;
  let max = 0;
  for (const [type, n] of compte) {
    if (n > max) {
      meilleur = type;
      max = n;
    }
  }
  return meilleur;
}

/**
 * Médiane €/m² de l'immeuble : sur trois ans s'il y a de quoi, sinon sur
 * tout l'historique, en disant depuis quand. Un seul type de bien.
 */
export function prixDeLImmeuble(
  ventes: readonly ParcelleVente[],
  maintenant: Date = new Date(),
): PrixParcelle | null {
  const type = typeDominant(ventes);
  const retenues = ventes.filter((v) => (!type || v.typeLocal === type) && prixM2Plausible(v.prixM2));
  if (retenues.length === 0) return null;

  const borne = new Date(maintenant.getTime() - FENETRE_VENTES_ANS * 365 * JOUR_MS).toISOString().slice(0, 10);
  const recentes = retenues.filter((v) => v.date >= borne);
  const base = recentes.length >= 2 ? recentes : retenues;
  const valeur = medianNumerique(base.map((v) => v.prixM2 as number));
  if (valeur == null) return null;
  return {
    valeur,
    depuis: Math.min(...base.map((v) => anneeDe(v.date))),
    recent: base === recentes,
    n: base.length,
  };
}

/** Un prix au m² médian se lit à la dizaine : « 10 300 », pas « 10 302 ». */
function euros(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n / 10) * 10);
}

function pluriel(n: number, mot: string, motPluriel = `${mot}s`): string {
  return `${n} ${n > 1 ? motPluriel : mot}`;
}

export function syntheseParcelle(
  input: {
    ventes: readonly ParcelleVente[];
    logements: readonly ParcelleLogement[];
    coproprietes: readonly ParcelleCopro[];
    prixM2Secteur: number | null;
  },
  maintenant: Date = new Date(),
): SyntheseParcelle {
  const logements = trierLogements(logementsDistincts(input.logements));
  const passoires = logements.filter(estPassoire);
  const limiteRecent = new Date(maintenant.getTime() - DPE_RECENT_JOURS * JOUR_MS).toISOString().slice(0, 10);
  const dpeRecent =
    [...logements]
      .filter((l) => l.date && l.date.slice(0, 10) >= limiteRecent)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0] ?? null;

  const ventes = [...input.ventes].sort((a, b) => b.date.localeCompare(a.date));
  const borneVentes = new Date(maintenant.getTime() - FENETRE_VENTES_ANS * 365 * JOUR_MS).toISOString().slice(0, 10);
  const ventesFenetre = ventes.filter((v) => v.date >= borneVentes).length;
  const prix = prixDeLImmeuble(ventes, maintenant);
  const ecartSecteurPct =
    prix && prix.recent && input.prixM2Secteur
      ? Math.round(((prix.valeur - input.prixM2Secteur) / input.prixM2Secteur) * 100)
      : null;

  const lotsConnus = input.coproprietes.filter((c) => c.lots != null);
  const lots = lotsConnus.length > 0 ? lotsConnus.reduce((n, c) => n + (c.lots ?? 0), 0) : null;
  const procedure = input.coproprietes.some((c) => c.procedureEnCours);

  /* ------------------------------------------------------------ à retenir */
  const faits: FaitParcelle[] = [];

  if (passoires.length > 0) {
    const exemples = passoires
      .slice(0, 2)
      .map((l) => `${decrireLogement(l)} (${lettreDpe(l)})`)
      .join(' ; ');
    const suite = passoires.length > 2 ? '…' : '';
    faits.push({
      cle: 'passoires',
      texte: `${pluriel(passoires.length, 'logement classé', 'logements classés')} F ou G : ${exemples}${suite}`,
    });
  }

  if (dpeRecent?.date) {
    faits.push({
      cle: 'dpe-recent',
      texte: `DPE fait ${depuisQuand(dpeRecent.date, maintenant)} (${decrireLogement(dpeRecent)}) : souvent le signe d’une vente ou d’une location qui se prépare`,
    });
  }

  if (ventesFenetre > 0) {
    const rotation = lots && lots > 0 ? ventesFenetre / lots / FENETRE_VENTES_ANS : null;
    faits.push({
      cle: 'ventes',
      texte:
        `${pluriel(ventesFenetre, 'vente')} en ${FENETRE_VENTES_ANS} ans` +
        (lots ? ` pour ${lots} lots` : '') +
        (rotation != null && rotation >= ROTATION_FORTE ? ' : un immeuble qui tourne' : ''),
    });
  } else if (ventes.length > 0) {
    faits.push({
      cle: 'ventes',
      texte: `Aucune vente depuis ${anneeDe(ventes[0]!.date)} : des propriétaires installés de longue date`,
    });
  }

  if (prix) {
    const periode = prix.recent ? `sur ${FENETRE_VENTES_ANS} ans` : `depuis ${prix.depuis}`;
    const secteur =
      ecartSecteurPct != null && input.prixM2Secteur
        ? ` · secteur ${euros(input.prixM2Secteur)}${NBSP}€/m² (${ecartSecteurPct > 0 ? '+' : ecartSecteurPct < 0 ? '−' : ''}${Math.abs(ecartSecteurPct)}${NBSP}%)`
        : '';
    faits.push({ cle: 'prix', texte: `${euros(prix.valeur)}${NBSP}€/m² médian ${periode}${secteur}` });
  }

  if (procedure) {
    faits.push({
      cle: 'procedure',
      texte: 'Copropriété sous procédure administrative ou judiciaire',
    });
  }

  /* -------------------------------------------------------------- pastilles */
  const pastilles: PastilleParcelle[] = [];
  if (passoires.length > 0) {
    pastilles.push({
      cle: 'passoires',
      libelle: pluriel(passoires.length, 'passoire'),
      ton: 'passoire',
    });
  }
  if (dpeRecent) pastilles.push({ cle: 'dpe-recent', libelle: 'DPE récent', ton: 'recent' });
  const derniere = ventes[0];
  if (derniere && moisEcoules(derniere.date, maintenant) < VENTE_RECENTE_MOIS) {
    pastilles.push({
      cle: 'vente-recente',
      libelle: `Vendu ${depuisQuand(derniere.date, maintenant)}`,
      ton: 'recent',
    });
  }
  if (procedure) pastilles.push({ cle: 'procedure', libelle: 'Copro en procédure', ton: 'alerte' });
  if (lots) pastilles.push({ cle: 'lots', libelle: pluriel(lots, 'lot'), ton: 'neutre' });

  return {
    logements,
    repartition: repartitionDpe(logements),
    passoires,
    dpeRecent,
    ventes,
    ventesFenetre,
    prix,
    ecartSecteurPct,
    lots,
    faits,
    pastilles,
  };
}
