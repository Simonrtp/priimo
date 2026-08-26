import type { HonorairesAChargeDb, MandatStatutDb } from '@/types/database';

export type MandatStatut = MandatStatutDb;
export type HonorairesACharge = HonorairesAChargeDb;
export type DpeLettre = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface Bien {
  id: string;
  agencyId: string;
  createdBy: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  rooms: number | null;
  price: number | null;
  mandatStatut: MandatStatut;
  proprietaireContactId: string | null;
  /** Nom du propriétaire rattaché, résolu à la lecture. */
  proprietaireName: string | null;
  proprietairePhone: string | null;
  proprietaireEmail: string | null;
  leadId: string | null;
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  listingTitle: string | null;
  listingDescription: string | null;
  photos: string[];
  dpeLettre: DpeLettre | null;
  dpeKwh: number | null;
  gesLettre: DpeLettre | null;
  gesKgCo2: number | null;
  dpeVierge: boolean;
  dpeDate: string | null;
  honorairesMontant: number | null;
  honorairesACharge: HonorairesACharge | null;
  honorairesPourcent: number | null;
  mandatNumero: string | null;
  mandatDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MANDAT_STATUT_LABELS: Record<MandatStatut, string> = {
  estimation: 'Estimation',
  mandat_simple: 'Mandat simple',
  mandat_exclusif: 'Mandat exclusif',
  compromis: 'Compromis signé',
  vendu: 'Vendu',
  archive: 'Archivé',
};

export const MANDAT_STATUT_ORDER: readonly MandatStatut[] = [
  'estimation',
  'mandat_simple',
  'mandat_exclusif',
  'compromis',
  'vendu',
  'archive',
];

/** Un bien encore à vendre : seuls ceux-là déclenchent un rapprochement. */
export function bienIsActive(statut: MandatStatut): boolean {
  return statut === 'estimation' || statut === 'mandat_simple' || statut === 'mandat_exclusif';
}

/** Mandat de vente au sens de la loi Hoguet : seul cas où une annonce peut partir. */
export function mandatPermetDiffusion(statut: MandatStatut): boolean {
  return statut === 'mandat_simple' || statut === 'mandat_exclusif';
}

export const DPE_LETTRE_ORDER: readonly DpeLettre[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const HONORAIRES_A_CHARGE_LABELS: Record<HonorairesACharge, string> = {
  vendeur: 'À la charge du vendeur',
  acquereur: "À la charge de l'acquéreur",
  partage: 'Partagés',
};

export const HONORAIRES_A_CHARGE_ORDER: readonly HonorairesACharge[] = [
  'vendeur',
  'acquereur',
  'partage',
];

/** Types attendus par les flux français. Le libellé est stocké tel quel. */
export const PROPERTY_TYPE_OPTIONS: readonly string[] = [
  'Appartement',
  'Maison',
  'Terrain',
  'Immeuble',
  'Local commercial',
  'Parking / box',
  'Autre',
];
