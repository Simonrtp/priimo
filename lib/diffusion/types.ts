/**
 * Contrat de diffusion d'une annonce.
 *
 * Isolé de React, de Supabase et de toute passerelle tierce. Une nouvelle
 * implémentation (Ubiflow, Diffuze, SeLoger direct…) n'a qu'à respecter
 * cette interface : le reste de l'application ne change pas.
 */

import type { DpeLettre, HonorairesACharge, MandatStatut } from '@/types/bien';

export type PortailId =
  | 'seloger'
  | 'bienici'
  | 'logicimmo'
  | 'leboncoin'
  | 'ouestfrance'
  | 'autre';

export const PORTAIL_LABELS: Record<PortailId, string> = {
  seloger: 'SeLoger',
  bienici: "Bien'ici",
  logicimmo: 'Logic-Immo',
  leboncoin: 'Leboncoin',
  ouestfrance: 'Ouest-France Immo',
  autre: 'Autre portail',
};

/** Annonce normalisée, indépendante du modèle « bien » interne. */
export interface Annonce {
  reference: string;
  titre: string | null;
  description: string | null;
  type: string | null;
  adresse: string;
  codePostal: string | null;
  ville: string | null;
  prix: number | null;
  surfaceM2: number | null;
  pieces: number | null;
  photos: string[];
  dpeLettre: DpeLettre | null;
  dpeKwh: number | null;
  gesLettre: DpeLettre | null;
  gesKgCo2: number | null;
  dpeVierge: boolean;
  dpeDate: string | null;
  mandatStatut: MandatStatut;
  mandatNumero: string | null;
  mandatDate: string | null;
  honorairesMontant: number | null;
  honorairesACharge: HonorairesACharge | null;
  honorairesPourcent: number | null;
  /** Copropriété — obligations FR si applicable. */
  estCopropriete: boolean;
  nombreLots: number | null;
  chargesAnnuelles: number | null;
  procedureEnCours: boolean | null;
  agenceNom: string | null;
}

export type DiffusionFile = {
  kind: 'file';
  filename: string;
  mimeType: string;
  content: string;
};

export type DiffusionAck = {
  kind: 'ack';
  message: string;
  /** Référence renvoyée par la passerelle / le portail. */
  referencePortail?: string;
};

export type DiffusionResult = DiffusionFile | DiffusionAck;

/**
 * Transport générique (passerelle ou connexion directe).
 * Le format d'export interne reste Annonce ; la traduction est un adaptateur.
 */
export interface DiffusionTransport {
  readonly id: string;
  readonly label: string;
  publier(annonce: Annonce, portail: PortailId): Promise<DiffusionAck>;
  mettreAJour(annonce: Annonce, portail: PortailId, referencePortail: string): Promise<DiffusionAck>;
  retirer(annonce: Annonce, portail: PortailId, referencePortail: string): Promise<DiffusionAck>;
}

/** @deprecated Prefer DiffusionTransport — conservé pour l'export local XML/CSV. */
export interface DiffusionProvider {
  readonly id: string;
  readonly label: string;
  diffuser(annonce: Annonce): Promise<DiffusionResult>;
  retirer(annonce: Annonce): Promise<DiffusionResult>;
}
