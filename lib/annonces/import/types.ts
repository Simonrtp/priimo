import type { AdressePossible, Confiance, PrecisionLocalisation } from '@/lib/annonces/types';
import type { PortailImport } from './url';

/** Ce qu'une annonce dit d'elle-même, quel que soit le portail ou le texte collé. */
export type FicheAnnonce = {
  portail: PortailImport;
  idPortail: string | null;
  url: string;
  typeVendeur: 'particulier' | 'professionnel';
  agenceNom: string | null;
  typeBien: 'appartement' | 'maison' | 'autre' | null;
  titre: string | null;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  etage: number | null;
  dpe: string | null;
  /** Consommation affichée (énergie primaire, kWh/m²/an). */
  consoKwhM2: number | null;
  ges: string | null;
  /** Émissions affichées (kg CO₂/m²/an). */
  gesKgM2: number | null;
  /** false : DPE d'avant juillet 2021, absent de la base ADEME v2. */
  dpeApresJuillet2021: boolean | null;
  dateDpe: string | null;
  /**
   * Dépenses annuelles d'énergie publiées (« entre 1 680 € et 2 310 € par an »),
   * obligatoires dans l'annonce depuis 2023 : leur milieu est le coût du DPE
   * (`cout_total_5_usages`) à quelques euros près, une empreinte du logement.
   */
  depensesEnergie?: { min: number; max: number } | null;
  anneeConstruction: number | null;
  chauffage: string | null;
  codePostal: string | null;
  ville: string | null;
  quartier: string | null;
  description: string | null;
  datePublication: string | null;
  /** Repère publié par le portail ; rayon 0 = point exact. */
  zone: { latitude: number; longitude: number; rayonM: number } | null;
  /** Adresse du bien écrite par le site (programme neuf…), retrouvée ensuite dans la BAN. */
  adressePubliee?: string | null;
  /**
   * La rue publiée par le portail (PAP : « Rue du Surmelin, 75020 Paris »), sous
   * son nom BAN — celui de la base DPE (`nom_rue_ban`). Le DPE se cherche dans
   * toute la rue, et un DPE d'une autre rue perd sa place.
   */
  voiePubliee?: string | null;
  photos: string[];
};

export type LocalisationImport = {
  confiance: Confiance;
  precision: PrecisionLocalisation | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Secteur, en mètres. Absent : le point est un immeuble. */
  rayonM?: number | null;
  /** Sans adresse sûre : les immeubles qui restent possibles (trois au plus). */
  adressesPossibles?: AdressePossible[];
  parcelleIds: string[];
  numeroDpe: string | null;
  complementDpe: string | null;
  score: number | null;
  raisons: string[];
};

/** Ce que la carte et le panneau montrent avant l'ajout. */
export type ApercuImport = {
  fiche: FicheAnnonce;
  localisation: LocalisationImport;
  /** Déjà dans les annonces de l'agence (veille ou ajout précédent). */
  annonceId: string | null;
};
