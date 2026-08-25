/**
 * Contrat de diffusion d'une annonce.
 *
 * Isolé de React, de Supabase et de toute passerelle tierce. Une nouvelle
 * implémentation (SeLoger, Leboncoin, Adictiz, etc.) n'a qu'à respecter cette
 * interface : le reste de l'application ne change pas.
 */

import type { DpeLettre, HonorairesACharge, MandatStatut } from '@/types/bien';

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
};

export type DiffusionResult = DiffusionFile | DiffusionAck;

export interface DiffusionProvider {
  /** Identifiant stable, utilisé par le registre. */
  readonly id: string;
  /** Libellé interne, jamais montré comme une promesse de publication. */
  readonly label: string;
  diffuser(annonce: Annonce): Promise<DiffusionResult>;
  retirer(annonce: Annonce): Promise<DiffusionResult>;
}
