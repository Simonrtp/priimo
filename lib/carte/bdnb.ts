/**
 * Ce que la Base de données nationale des bâtiments (BDNB, CSTB, Licence
 * Ouverte) dit des constructions d'une parcelle : usage, âge, hauteur,
 * nombre de logements, et propriétaires personnes morales (fichiers fonciers
 * DGFiP — jamais de particulier).
 *
 * Une parcelle porte souvent plusieurs « groupes de bâtiments » BDNB ; on les
 * résume en un immeuble, en gardant l'usage et l'âge du plus grand.
 */

export type GenreProprietaire = 'copropriete' | 'social' | 'public' | 'sci' | 'societe';

/** Dirigeant utile au terrain (gérant, président…), issu de l’Annuaire. */
export type DirigeantProprietaire = {
  nom: string;
  qualite: string | null;
};

export type ProprietaireMorale = {
  nom: string;
  siren: string | null;
  genre: GenreProprietaire;
  /** Enrichissement Annuaire des entreprises — absent si pas de SIREN / échec API. */
  dirigeants?: DirigeantProprietaire[];
  siege?: string | null;
  /** YYYY-MM-DD */
  dateCreation?: string | null;
  /** false = radiée / cessée */
  active?: boolean | null;
  /** Fichier DGFiP : nombre de lots détenus sur la parcelle (appartements, caves, parkings…). */
  nbLots?: number;
  /** Étages de ces lots, 0 = rez-de-chaussée. */
  niveaux?: number[];
  /** « P » propriétaire, « U » usufruitier, « N » nu-propriétaire… */
  droit?: string;
};

export type BatimentParcelle = {
  nbBatiments: number;
  /** Surface au sol bâtie, tous bâtiments confondus. */
  empriseM2: number | null;
  usage: string | null;
  anneeConstruction: number | null;
  niveaux: number | null;
  logements: number | null;
  materiaux: string | null;
  proprietaires: ProprietaireMorale[];
  /** DPE recensés par la BDNB, méthode 2021 puis ancienne méthode. */
  dpeRecents: number;
  dpeRecentsFG: number;
  dpeAnciens: number;
  dpeAnciensFG: number;
  dpeTertiaire: string | null;
  /** Monument historique dans le rayon des abords (500 m). */
  monumentHistorique: { nom: string; distanceM: number } | null;
  quartierPrioritaire: string | null;
  /** Adresses BAN des bâtiments : un filet quand l'index parcelle ↔ adresse manque. */
  adressesBan: string[];
  /** « 97 Rue de Charonne 75011 Paris 11e Arrondissement », quand Priimo n'a aucune adresse. */
  adressePrincipale: string | null;
};

/** Une ligne de `batiment_groupe_complet`, réduite aux champs lus. */
export type LigneBdnb = {
  batiment_groupe_id?: string | null;
  surface_emprise_sol?: number | null;
  usage_niveau_1_txt?: string | null;
  usage_principal_bdnb_open?: string | null;
  nb_log?: number | null;
  nb_log_rnc?: number | null;
  nb_niveau?: number | null;
  annee_construction?: number | null;
  mat_mur_txt?: string | null;
  l_denomination_proprietaire?: string[] | null;
  l_siren?: string[] | null;
  quartier_prioritaire?: boolean | null;
  nom_quartier_qpv?: string | null;
  distance_monument_historique?: number | null;
  denomination_monument_historique?: string | null;
  perimetre_bat_historique?: boolean | null;
  classe_conso_energie_dpe_tertiaire?: string | null;
  cle_interop_adr_principale_ban?: string | null;
  libelle_adr_principale_ban?: string | null;
  l_cle_interop_adr?: string[] | null;
} & Partial<Record<`nb_classe_bilan_dpe_${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'}`, number | null>> &
  Partial<Record<`nb_classe_conso_energie_arrete_2012_${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g'}`, number | null>>;

const LETTRES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
const RAYON_ABORDS_M = 500;

const SOCIAL =
  /\b(HLM|OPH|ADOMA|HABITAT|HABITATION|LOGEMENT|LOGEMENTS|LOGIS|ELOGIE|SIEMP|RIVP|3F|ICF|EFIDIS|SEQENS|BATIGERE|VILOGIA|ERILIA|HALPADES|SOLLAR|COALLIA|OFFICE PUBLIC|SOCIETE ANONYME D HLM)\b/;
const PUBLIC =
  /\b(VILLE DE|COMMUNE D|COMMUNE DE|DEPARTEMENT|REGION|ETAT|MINISTERE|ASSISTANCE PUBLIQUE|CENTRE HOSPITALIER|UNIVERSITE|SNCF|RATP|LA POSTE|METROPOLE|CAISSE DES DEPOTS|DOMAINE PUBLIC|ETABLISSEMENT PUBLIC)\b/;

function normaliser(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/['’.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function genreProprietaire(nom: string): GenreProprietaire {
  const n = normaliser(nom);
  if (/^SYND(ICAT)?\b/.test(n) && /\bCOPR/.test(n)) return 'copropriete';
  if (PUBLIC.test(n)) return 'public';
  if (SOCIAL.test(n)) return 'social';
  if (/^SCI\b|\bSCI\b|SOCIETE CIVILE IMMOBILIERE/.test(n)) return 'sci';
  return 'societe';
}

const ORDRE_GENRE: Record<GenreProprietaire, number> = {
  public: 0,
  social: 1,
  sci: 2,
  societe: 3,
  copropriete: 4,
};

function nombre(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function somme(lignes: readonly LigneBdnb[], cle: keyof LigneBdnb): number {
  return lignes.reduce((n, l) => n + (nombre(l[cle]) ?? 0), 0);
}

export function syntheseBdnb(lignes: readonly LigneBdnb[]): BatimentParcelle | null {
  if (lignes.length === 0) return null;
  const parTaille = [...lignes].sort((a, b) => (nombre(b.surface_emprise_sol) ?? 0) - (nombre(a.surface_emprise_sol) ?? 0));
  const principal = parTaille.find((l) => l.usage_principal_bdnb_open || l.usage_niveau_1_txt) ?? parTaille[0]!;

  const proprietaires: ProprietaireMorale[] = [];
  const vus = new Set<string>();
  for (const l of lignes) {
    const noms = l.l_denomination_proprietaire ?? [];
    const sirens = l.l_siren ?? [];
    // Les deux listes vont de pair quand elles ont la même longueur.
    const alignees = sirens.length === noms.length;
    noms.forEach((nom, i) => {
      const net = nom?.trim();
      if (!net) return;
      const cle = normaliser(net);
      if (vus.has(cle)) return;
      vus.add(cle);
      const siren = alignees ? sirens[i]?.trim() || null : null;
      proprietaires.push({ nom: net, siren: siren && /^\d{9}$/.test(siren) ? siren : null, genre: genreProprietaire(net) });
    });
  }
  proprietaires.sort((a, b) => ORDRE_GENRE[a.genre] - ORDRE_GENRE[b.genre]);

  const logementsParGroupe = lignes.map((l) => Math.max(nombre(l.nb_log) ?? 0, nombre(l.nb_log_rnc) ?? 0));
  const logements = logementsParGroupe.reduce((n, v) => n + v, 0);
  const niveaux = Math.max(0, ...lignes.map((l) => nombre(l.nb_niveau) ?? 0));
  const emprise = somme(lignes, 'surface_emprise_sol');

  const monument = lignes
    .filter((l) => nombre(l.distance_monument_historique) != null && l.denomination_monument_historique)
    .sort((a, b) => (a.distance_monument_historique ?? 0) - (b.distance_monument_historique ?? 0))[0];

  const qpv = lignes.find((l) => l.quartier_prioritaire);
  const adresses = new Set<string>();
  for (const l of lignes) {
    if (l.cle_interop_adr_principale_ban) adresses.add(l.cle_interop_adr_principale_ban);
    for (const a of l.l_cle_interop_adr ?? []) if (a) adresses.add(a);
  }

  return {
    nbBatiments: lignes.length,
    empriseM2: emprise > 0 ? Math.round(emprise) : null,
    usage: principal.usage_principal_bdnb_open ?? principal.usage_niveau_1_txt ?? null,
    anneeConstruction: nombre(principal.annee_construction),
    niveaux: niveaux > 0 ? niveaux : null,
    logements: logements > 0 ? logements : null,
    materiaux: principal.mat_mur_txt && !/INDETERMIN/i.test(principal.mat_mur_txt) ? principal.mat_mur_txt : null,
    proprietaires,
    dpeRecents: LETTRES.reduce((n, x) => n + somme(lignes, `nb_classe_bilan_dpe_${x}`), 0),
    dpeRecentsFG: somme(lignes, 'nb_classe_bilan_dpe_f') + somme(lignes, 'nb_classe_bilan_dpe_g'),
    dpeAnciens: LETTRES.reduce((n, x) => n + somme(lignes, `nb_classe_conso_energie_arrete_2012_${x}`), 0),
    dpeAnciensFG:
      somme(lignes, 'nb_classe_conso_energie_arrete_2012_f') + somme(lignes, 'nb_classe_conso_energie_arrete_2012_g'),
    dpeTertiaire: lignes.find((l) => l.classe_conso_energie_dpe_tertiaire)?.classe_conso_energie_dpe_tertiaire ?? null,
    monumentHistorique:
      monument && (monument.distance_monument_historique ?? Infinity) <= RAYON_ABORDS_M
        ? { nom: monument.denomination_monument_historique!.replace(/^"|"$/g, '').trim(), distanceM: Math.round(monument.distance_monument_historique!) }
        : null,
    quartierPrioritaire: qpv ? qpv.nom_quartier_qpv?.trim() || 'Quartier prioritaire' : null,
    adressesBan: [...adresses],
    adressePrincipale:
      principal.libelle_adr_principale_ban?.trim() ||
      parTaille.find((l) => l.libelle_adr_principale_ban?.trim())?.libelle_adr_principale_ban?.trim() ||
      null,
  };
}

/** Usage résidentiel au sens de la BDNB : là où DPE et ventes de logements ont un sens. */
export function estResidentiel(usage: string | null): boolean {
  return Boolean(usage && /r[ée]sidentiel/i.test(usage));
}
