import type { ParcelleCopro, ParcelleLogement, ParcelleVente } from '@/lib/carte/parcelle';
import { DPE_LETTERS, formatDpeEtage, parseDpeLetter, type DpeLetter } from '@/lib/carte/dpe-public';
import { medianNumerique } from '@/lib/carte/cadastre-overlay';
import { estResidentiel, type BatimentParcelle, type ProprietaireMorale } from '@/lib/carte/bdnb';
import type { AuditEnergetique } from '@/lib/carte/audits';
import { decrireNiveaux, seulementSousSol } from '@/lib/carte/proprietaires-lots';
import { toDisplayCompanyName } from '@/lib/lead-person-display';

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
  /** « Résidentiel collectif · construit en 1928 · 8 niveaux · 268 logements » */
  immeuble: string | null;
  /** Pourquoi il manque ventes ou DPE, quand il en manque. */
  pourquoi: string[];
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

function surface(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))}${NBSP}m²`;
}

/** Un audit de moins de dix-huit mois reste un signal ; au-delà, l'affaire est faite ou abandonnée. */
const AUDIT_RECENT_MOIS = 18;

/**
 * Les SCI de la parcelle, dites comme un agent les compterait. Une SCI qui
 * détient un studio n'est pas une SCI propriétaire de l'immeuble : avec le
 * fichier DGFiP on sait faire la différence, sans lui on reste prudent.
 */
export function faitSci(proprietaires: readonly ProprietaireMorale[], copropriete: boolean): string | null {
  const sci = proprietaires.filter((x) => x.genre === 'sci');
  if (sci.length === 0) return null;
  const verbe = sci.length > 1 ? 'détiennent' : 'détient';
  const qui = sci.length > 1 ? 'des investisseurs, joignables par leur gérant' : 'un investisseur, joignable par son gérant';
  if (!sci.every((x) => x.nbLots != null)) {
    return `${pluriel(sci.length, 'SCI', 'SCI')} ${verbe} des lots ici : ${qui}`;
  }

  // Une SCI qui n'a que des lots en sous-sol tient un parking ou une cave :
  // elle reste dans la liste des propriétaires, pas dans « À retenir ».
  const utiles = sci.filter((x) => !seulementSousSol(x.niveaux ?? []));
  if (utiles.length === 0) return null;
  const plusieurs = utiles.length > 1;
  const quiLots = plusieurs ? 'des investisseurs, joignables par leur gérant' : 'un investisseur, joignable par son gérant';
  const seule = plusieurs ? null : utiles[0]!;
  const autres = proprietaires.filter((x) => x !== seule && x.genre !== 'copropriete');
  if (seule && autres.length === 0 && !copropriete && (seule.nbLots ?? 0) >= 2) {
    return `${toDisplayCompanyName(seule.nom)} est la seule propriétaire connue (${pluriel(seule.nbLots!, 'lot')}, aucune copropriété déclarée) : probablement l’immeuble entier, un seul interlocuteur`;
  }
  if (seule) {
    const ou = decrireNiveaux(seule.niveaux ?? []);
    const combien = seule.nbLots === 1 ? 'un lot' : pluriel(seule.nbLots!, 'lot');
    return `Une SCI détient ${combien} ici${ou ? ` (${ou})` : ''} : ${quiLots}`;
  }
  const lots = utiles.reduce((n, x) => n + (x.nbLots ?? 0), 0);
  return `${pluriel(utiles.length, 'SCI', 'SCI')} détiennent ${pluriel(lots, 'lot')} ici : ${quiLots}`;
}

/** « Audit énergétique il y a 3 mois (T3 · 62 m² · 4e étage, F → A après travaux) : … » */
export function decrireAudit(audit: AuditEnergetique, maintenant: Date = new Date()): string {
  const logement = [
    audit.typologie,
    audit.surface ? `${Math.round(audit.surface)}${NBSP}m²` : null,
    formatDpeEtage(audit.etage)?.replace(/ /g, NBSP) ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  const classes = audit.classeActuelle
    ? audit.classeVisee
      ? `${audit.classeActuelle} → ${audit.classeVisee} après travaux`
      : `classé ${audit.classeActuelle}`
    : null;
  const entre = [logement, classes].filter(Boolean).join(', ');
  return `Audit énergétique ${depuisQuand(audit.date, maintenant)}${entre ? ` (${entre})` : ''} : le propriétaire prépare une vente ou des travaux`;
}

/** « Résidentiel collectif · construit en 1928 · 8 niveaux · 268 logements » */
export function decrireImmeuble(b: BatimentParcelle | null): string | null {
  if (!b) return null;
  const morceaux = [
    b.usage,
    b.anneeConstruction ? `construit en ${b.anneeConstruction}` : null,
    b.niveaux ? pluriel(b.niveaux, 'niveau', 'niveaux') : null,
    b.logements ? pluriel(b.logements, 'logement') : null,
  ].filter(Boolean);
  return morceaux.length > 0 ? morceaux.join(' · ') : null;
}

export type PastilleEntete = {
  cle: string;
  libelle: string;
};

/** Usage BDNB en pastille courte : « Collectif », pas « Résidentiel collectif ». */
export function raccourcirUsage(usage: string | null): string | null {
  if (!usage) return null;
  const u = usage.trim();
  if (/r[ée]sidentiel\s+collectif/i.test(u)) return 'Collectif';
  if (/r[ée]sidentiel\s+individuel/i.test(u)) return 'Individuel';
  const sansPrefixe = u.replace(/^r[ée]sidentiel\s+/i, '').trim();
  if (!sansPrefixe) return u;
  return sansPrefixe.length <= 18 ? sansPrefixe : `${sansPrefixe.slice(0, 16)}…`;
}

/**
 * Ligne dense du volet parcelle : localité, surface, usage, année, niveaux,
 * logements. Les adresses restent un bouton à part (interactif).
 */
export function pastillesEnteteParcelle(p: {
  localite: string | null;
  surfaceM2: number | null;
  batiment: BatimentParcelle | null;
}): PastilleEntete[] {
  const chips: PastilleEntete[] = [];
  if (p.localite?.trim()) chips.push({ cle: 'localite', libelle: p.localite.trim() });
  if (p.surfaceM2 != null && Number.isFinite(p.surfaceM2)) {
    chips.push({ cle: 'surface', libelle: surface(p.surfaceM2) });
  }
  const b = p.batiment;
  if (!b) return chips;
  const usage = raccourcirUsage(b.usage);
  if (usage) chips.push({ cle: 'usage', libelle: usage });
  if (b.anneeConstruction) chips.push({ cle: 'annee', libelle: String(b.anneeConstruction) });
  if (b.niveaux) chips.push({ cle: 'niveaux', libelle: `${b.niveaux}${NBSP}niv.` });
  if (b.logements) chips.push({ cle: 'logements', libelle: `${b.logements}${NBSP}log.` });
  return chips;
}

/**
 * Pourquoi une parcelle n'a ni vente ni DPE. Chaque raison s'appuie sur un
 * fait (bâti, propriétaire, usage) ; à défaut, on dit ce que couvrent les
 * données publiques plutôt que de laisser croire à un oubli.
 */
export function pourquoiSiPeu(p: {
  ventes: number;
  logements: number;
  adresses: number;
  surfaceM2: number | null;
  batiment: BatimentParcelle | null;
  batimentConnu: boolean;
  /** Propriétaires DGFiP s'ils sont connus ; sinon ceux de la BDNB. */
  proprietaires?: readonly ProprietaireMorale[];
}): string[] {
  if (p.ventes > 0 && p.logements > 0) return [];
  const raisons: string[] = [];
  const b = p.batiment;
  const proprietaires = p.proprietaires?.length ? p.proprietaires : (b?.proprietaires ?? []);

  if (p.batimentConnu && !b) {
    return [
      p.adresses === 0
        ? 'Ni bâtiment ni adresse : voie, cour, jardin ou terrain nu. DPE et ventes se rattachent à des logements.'
        : 'Aucun bâtiment recensé ici par la base nationale des bâtiments.',
    ];
  }

  const ratio = b && p.surfaceM2 && b.empriseM2 ? b.empriseM2 / p.surfaceM2 : null;
  if (b && ratio != null && ratio < 0.1 && !(b.logements && b.logements > 1)) {
    raisons.push(
      `Presque pas de bâti : ${surface(b.empriseM2!)} construits sur ${surface(p.surfaceM2!)}. Jardin, square ou espace ouvert.`,
    );
  }
  // Le propriétaire public ou social explique tout, BDNB ou pas.
  const publique = proprietaires.find((x) => x.genre === 'public');
  const sociale = proprietaires.find((x) => x.genre === 'social');
  if (publique) {
    raisons.push(`Propriété de ${toDisplayCompanyName(publique.nom)} : bâtiment public, hors marché.`);
  } else if (sociale) {
    raisons.push(`Logements sociaux (${toDisplayCompanyName(sociale.nom)}) : ils ne se vendent presque jamais à l’unité.`);
  }

  if (b) {
    // L'usage BDNB est parfois « tertiaire » pour un immeuble mixte plein de
    // logements : on ne l'invoque que si rien n'y indique d'habitation.
    const habite = p.logements > 0 || (b.logements ?? 0) >= 2;
    if (b.usage && !estResidentiel(b.usage) && !habite) {
      raisons.push(
        `Usage ${b.usage.toLowerCase()} : ni DPE de logement ni vente d’appartement.` +
          (b.dpeTertiaire ? ` DPE tertiaire classé ${b.dpeTertiaire}.` : ''),
      );
    }
    if (p.logements === 0 && b.dpeRecents > 0) {
      raisons.push(
        `La base nationale des bâtiments recense ${pluriel(b.dpeRecents, 'DPE récent', 'DPE récents')} ici, pas encore dans nos données.`,
      );
    }
  } else if (p.adresses === 0 && raisons.length === 0) {
    raisons.push('Aucune adresse rattachée à cette parcelle : DPE et ventes sont enregistrés à l’adresse des logements.');
  }

  if (raisons.length === 0) {
    if (p.logements === 0) {
      raisons.push('Aucun DPE depuis juillet 2021 : il n’est exigé qu’à la vente ou à la mise en location.');
    }
    if (p.ventes === 0) {
      raisons.push('Aucune vente d’appartement ni de maison depuis janvier 2021 : les données DVF couvrent cinq ans.');
    }
  }
  return raisons.slice(0, 3);
}

export function syntheseParcelle(
  input: {
    ventes: readonly ParcelleVente[];
    logements: readonly ParcelleLogement[];
    coproprietes: readonly ParcelleCopro[];
    prixM2Secteur: number | null;
    batiment?: BatimentParcelle | null;
    batimentConnu?: boolean;
    adresses?: number;
    surfaceM2?: number | null;
    horsSecteur?: boolean;
    /** Au lot près quand le fichier DGFiP est importé ; sinon ceux de la BDNB. */
    proprietaires?: readonly ProprietaireMorale[];
    audits?: readonly AuditEnergetique[];
  },
  maintenant: Date = new Date(),
): SyntheseParcelle {
  const batiment = input.batiment ?? null;
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

  const proprietaires = input.proprietaires ?? batiment?.proprietaires ?? [];
  const sci = faitSci(proprietaires, input.coproprietes.length > 0);
  if (sci) faits.push({ cle: 'sci', texte: sci });

  const audit = (input.audits ?? [])[0];
  if (audit && moisEcoules(audit.date, maintenant) <= AUDIT_RECENT_MOIS) {
    faits.push({ cle: 'audit', texte: decrireAudit(audit, maintenant) });
  }

  // Les DPE d'avant juillet 2021 ne sont pas dans nos données, mais la BDNB
  // les compte : une passoire jamais rediagnostiquée reste une piste.
  if (passoires.length === 0 && batiment && batiment.dpeAnciensFG > 0) {
    const n = batiment.dpeAnciensFG;
    faits.push({
      cle: 'passoires-anciennes',
      texte: `${pluriel(n, 'DPE', 'DPE')} ${n > 1 ? 'classés' : 'classé'} F ou G avant juillet 2021 (ancienne méthode) : des logements peut-être jamais rénovés`,
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
  if (audit && moisEcoules(audit.date, maintenant) < VENTE_RECENTE_MOIS) {
    pastilles.push({ cle: 'audit', libelle: 'Audit énergétique', ton: 'recent' });
  }
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
  // Les abords de monument historique (500 m) couvrent presque tout Paris :
  // en pastille, ce serait du bruit. Le quartier prioritaire, lui, change le marché.
  if (batiment?.quartierPrioritaire) {
    pastilles.push({ cle: 'qpv', libelle: 'Quartier prioritaire', ton: 'neutre' });
  }

  const pourquoi = input.horsSecteur
    ? []
    : pourquoiSiPeu({
        ventes: ventes.length,
        logements: logements.length,
        adresses: input.adresses ?? 0,
        surfaceM2: input.surfaceM2 ?? null,
        batiment,
        batimentConnu: input.batimentConnu ?? false,
        proprietaires,
      });

  return {
    immeuble: decrireImmeuble(batiment),
    pourquoi,
    logements,
    repartition: repartitionDpe(logements),
    passoires,
    dpeRecent,
    ventes,
    ventesFenetre,
    prix,
    ecartSecteurPct,
    lots,
    // « : » ne commence jamais une ligne.
    faits: faits.map((f) => ({ ...f, texte: f.texte.replace(/ :/g, `${NBSP}:`) })),
    pastilles,
  };
}
