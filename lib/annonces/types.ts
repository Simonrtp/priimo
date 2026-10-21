/** Lecture des annonces de secteur. L'écriture vit dans priimo-pipeline. */

export const PORTAILS = ['seloger', 'pap', 'leboncoin', 'bienici', 'logicimmo', 'figaro', 'autre'] as const;
export type Portail = (typeof PORTAILS)[number];

export const CONFIANCES = ['certaine', 'probable', 'adresse_publiee', 'incertaine'] as const;
export type Confiance = (typeof CONFIANCES)[number];

export type PrecisionLocalisation = 'logement' | 'immeuble' | 'quartier' | 'code_postal';

/** Une adresse possible quand plusieurs logements restent à départager (trois au plus). */
export type AdressePossible = { adresse: string; latitude: number; longitude: number };
export type StatutAnnonce = 'active' | 'retiree';
export type TypeVendeur = 'particulier' | 'professionnel';
export type TypeEvenementAnnonce =
  | 'nouvelle'
  | 'baisse_prix'
  | 'hausse_prix'
  | 'modification'
  | 'retiree'
  | 'remise_en_ligne';

export type Annonce = {
  id: string;
  idPortail: string | null;
  portail: Portail;
  url: string;
  typeVendeur: TypeVendeur;
  agenceNom: string | null;
  refusDemarchage: boolean;
  statut: StatutAnnonce;
  publieeLe: string | null;
  premiereVueLe: string | null;
  derniereVueLe: string | null;
  retireeLe: string | null;
  typeBien: string | null;
  titre: string | null;
  prixInitial: number | null;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  etage: string | null;
  dpe: string | null;
  codePostal: string | null;
  ville: string | null;
  quartier: string | null;
  confiance: Confiance;
  localisationPrecision: PrecisionLocalisation | null;
  adresse: string | null;
  adresseNumero: string | null;
  adresseVoie: string | null;
  parcelleIds: string[];
  numeroDpe: string | null;
  complementDpe: string | null;
  latitude: number | null;
  longitude: number | null;
  logementCle: string | null;
  scoreLocalisation: number | null;
  raisonsLocalisation: string[];
  /** Sans adresse sûre : les deux ou trois immeubles qui restent possibles. */
  adressesPossibles?: AdressePossible[];
  /** URLs des photos du portail, quand elles ont déjà été lues. */
  photos?: string[];
};

export type EvenementAnnonce = {
  id: string;
  annonceId: string;
  type: TypeEvenementAnnonce;
  survenuLe: string;
  avant: Record<string, unknown> | null;
  apres: Record<string, unknown> | null;
  createdAt: string;
};

export type RunAnnonce = {
  portail: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  startedAt: string;
  finishedAt: string | null;
};

/** Plusieurs portails, une seule carte. */
export type GroupeAnnonce = {
  cle: string;
  annonces: Annonce[];
  principale: Annonce;
};
