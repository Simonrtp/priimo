import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import type { IdentiteAgenceRapport, IdentiteAgentRapport } from '@/lib/rapport/identite';
import type { VenteComparable } from '@/lib/rapport/genere/comparables';
import type { ContradictionRapport } from '@/lib/rapport/genere/contradictions';

export type ClientRapport = {
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  email: string | null;
};

export type PhotoRapport = {
  url: string;
  kind: 'photo' | 'plan';
  couverture: boolean;
};

export type AnnexeRapport = {
  libelle: string;
  surfaceM2: number | null;
};

export type AnnonceMarche = {
  id: string;
  typeLocal: string | null;
  surfaceM2: number | null;
  pieces: number | null;
  prix: number | null;
  prixM2: number | null;
  dateReleve: string;
  datePremiereVue: string | null;
  prixInitial: number | null;
  statut: 'active' | 'vendue' | 'retiree';
};

export type IrisLogement = {
  irisCode: string;
  commune: string | null;
  partAppartements: number | null;
  piecesDominant: number | null;
  epoque: string | null;
  partProprietaires: number | null;
  partLocataires: number | null;
};

export type EquipementProximite = {
  id: string;
  categorie: 'administration' | 'enseignement' | 'transports' | 'sante';
  nom: string;
  distanceM: number;
  latitude: number | null;
  longitude: number | null;
};

export type LigneFixe = {
  technologie: string;
  operateur: string;
  eligible: boolean;
  debitMaxMbps: number | null;
};

export type LigneMobile = {
  operateur: string;
  generation: '2g' | '3g' | '4g' | '5g';
  niveau: 'tres_bonne' | 'bonne' | 'moyenne' | 'limitee' | 'nulle';
};

export type PermisUrbanisme = {
  id: string;
  numero: string;
  type: string | null;
  dateDecision: string | null;
  adresse: string | null;
  commune: string | null;
  distanceM: number | null;
  latitude: number | null;
  longitude: number | null;
};

export type PointOat = {
  date: string;
  taux: number;
};

export type EffortAchat = {
  secteur: number | null;
  departement: number | null;
  france: number | null;
};

export type DossierRapport = {
  titreCouverture: string;
  ctaProchaineEtape: string;
  dateEvaluation: string | null;
  adresse: string | null;
  city: string | null;
  postalCode: string | null;
  propertyType: 'appartement' | 'maison' | null;
  surfaceM2: number | null;
  surfaceCarrez: number | null;
  rooms: number | null;
  floor: string | null;
  occupation: 'libre' | 'occupe';
  dpeClass: string | null;
  commentairesPublics: string | null;
  remarquesExpert: string | null;
  etagesImmeuble: number | null;
  anneeConstruction: number | null;
  ascenseur: boolean | null;
  chambres: number | null;
  annexes: AnnexeRapport[];
  photos: PhotoRapport[];
  photoCouverture: PhotoRapport | null;
  latitude: number | null;
  longitude: number | null;
  priceValue: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  pricePerM2: number | null;
  surfacePrixLibelle: 'Carrez' | 'habitable' | null;
  fourchetteAjoutee: boolean;
  client: ClientRapport;
  agence: IdentiteAgenceRapport;
  agent: IdentiteAgentRapport;
  comparables: VenteComparable[];
  comparablesReserve: VenteComparable[];
  annonces: AnnonceMarche[];
  annoncesReserve: AnnonceMarche[];
  iris: IrisLogement | null;
  equipements: EquipementProximite[];
  fixe: LigneFixe[];
  mobile: LigneMobile[];
  permis: PermisUrbanisme[];
  oat: PointOat[];
  effort: EffortAchat | null;
  fluiditeJoursMedian: number | null;
  negotiationPctMedian: number | null;
  contradictions: ContradictionRapport[];
};

export type CompletudePage = {
  kind: KindGeneree;
  manques: string[];
};

export function pageComplete(c: CompletudePage): boolean {
  return c.manques.length === 0;
}
