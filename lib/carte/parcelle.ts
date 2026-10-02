import { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
import type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';

export { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
export {
  PUBLIC_DPE_MIN_AGE_MONTHS,
  DPE_PALETTE,
  dpeFillColor,
  filterPublicDiagnostics,
  formatDpeEtage,
  isPublicDpeEligible,
  isPublicDpeTooRecent,
  parseDpeLetter,
  type PublicDiagnostic,
} from '@/lib/carte/dpe-public';
export type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';

export const PARCELLE_MIN_ZOOM = 14;
/** Zoom initial quand on veut voir et cliquer les parcelles (prise en main, cadastre). */
export const PARCELLE_FOCUS_ZOOM = 16;
/** DPE / ventes / copro : visibles dès la vue quartier. */
export const CADASTRE_OVERLAY_MIN_ZOOM = 12;
/** Étiquette €/m² des ventes : invisible en dessous. */
export const VENTE_PRICE_LABEL_MIN_ZOOM = 17;
export const PARCELLE_SLATE = '#1A2A56';
export const COPRO_PROCEDURE_FILL = '#1A2A56';
export const COPRO_FILL = '#5B7C8A';
export const VENTE_FILL = '#1A2A56';
export const VENTE_PRICE_HALO = '#FFFFFF';

export type ParcelleVente = {
  date: string;
  prix: number | null;
  surface: number | null;
  prixM2: number | null;
  typeLocal: string | null;
  nombrePieces: number | null;
  /** Adresse BAN de la vente, pour les parcelles à plusieurs entrées. */
  banId: string | null;
};

/** Un diagnostic DPE : ce qu'il dit du logement, pas seulement sa lettre. */
export type ParcelleLogement = {
  banId: string | null;
  date: string | null;
  etiquette: string | null;
  etiquetteGes: string | null;
  consoKwhM2: number | null;
  surface: number | null;
  etage: number | null;
};

export type ParcelleCopro = {
  lots: number | null;
  periodeConstruction: string | null;
  procedureEnCours: boolean;
  numeroImmatriculation: string | null;
};

export type ParcelleAdresse = {
  banId: string;
  libelle: string;
};

/** Prospect livré sur la parcelle, tel que l'agent le lit d'un coup d'œil. */
export type ParcelleProspect = {
  id: string;
  href: string;
  adresse: string;
  score: number;
  dpe: string | null;
  etage: number | null;
  surface: number | null;
  pieces: number | null;
  /** Trois faits max, tirés de `display_signals`. */
  signaux: string[];
  /** Société propriétaire, quand le propriétaire est une entreprise. */
  entreprise: string | null;
  /** Étape du pipeline ; null tant que personne ne l'a pris. */
  etape: string | null;
  contactabilite: 'direct' | 'nominatif' | 'immeuble' | null;
};

export type ParcelleContactAgence = {
  id: string;
  href: string;
  nom: string;
  type: string | null;
  telephone: string | null;
};

export type ParcelleBienAgence = {
  id: string;
  href: string;
  adresse: string;
  statut: string | null;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
};

/** Professionnel installé dans l'immeuble, repéré par le pipeline sur un lead. */
export type ParcelleEntreprise = {
  nom: string;
  telephone: string;
  activite: string | null;
  categorie: 'commerce' | 'professionnel' | 'domicile_pro';
  /** Lead d'origine : « Créer un contact » passe par lui. */
  leadId: string;
};

export type ParcellePassage = {
  jour: string;
  kind: 'rencontre' | 'absent' | 'passer';
  /** Prénom de l'agent ; null quand c'est le lecteur lui-même. */
  auteur: string | null;
};

export type ParcelleFiche = {
  parcelleId: string;
  reference: string;
  /** Voie lisible : « 10 rue des Maraichers ». */
  adresse: string | null;
  /** « 75020 Paris ». */
  localite: string | null;
  /** Immeuble principal : la note dictée ici s'y rattache d'office. */
  banId: string | null;
  adresses: ParcelleAdresse[];
  /** Point d'entrée de l'immeuble : façade et itinéraire. */
  position: { latitude: number; longitude: number } | null;
  /** Hors des codes postaux de l'agence : pas de données publiques. */
  horsSecteur: boolean;
  videPublic: boolean;
  surfaceCadastreM2: number | null;
  nbAdresses: number;
  /** Médiane €/m² de la commune sur trois ans, même type de bien. */
  prixM2Secteur: number | null;
  ventes: ParcelleVente[];
  logements: ParcelleLogement[];
  coproprietes: ParcelleCopro[];
  prospects: ParcelleProspect[];
  contacts: ParcelleContactAgence[];
  biens: ParcelleBienAgence[];
  entreprises: ParcelleEntreprise[];
  passages: ParcellePassage[];
};

export type ParcellePickExtra = {
  surfaceM2?: number | null;
};

export type ParcelleNoteMarker = {
  parcelleId: string;
  latitude: number | null;
  longitude: number | null;
};

export type CadastreDpeGrain = 'adresse' | 'immeuble';

export type CadastreImmeublePoint = {
  banId: string;
  parcelleId: string | null;
  longitude: number;
  latitude: number;
  adresse: string | null;
  etiquetteDpe: string | null;
  /** adresse = diagnostic < 6 mois ; immeuble = agrégat au-delà. */
  dpeGrain: CadastreDpeGrain | null;
  dateDpe: string | null;
  surfaceDpe: number | null;
  etageDpe: number | null;
  nbDpe: number;
  nbPassoires: number;
  nbTransactions: number;
  dernierPrix: number | null;
  derniereTransactionLe: string | null;
  prixM2: number | null;
  nbLots: number | null;
  procedureCopro: boolean;
};

export type ParcelleOverlay = {
  immeubles: CadastreImmeublePoint[];
  notes: ParcelleNoteMarker[];
  sources: CadastreSourceDates;
};

type Ring = readonly (readonly number[])[];

function firstRing(geometry: unknown): Ring | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === 'Polygon') {
    const coords = g.coordinates as Ring[] | undefined;
    return coords?.[0] ?? null;
  }
  if (g.type === 'MultiPolygon') {
    const coords = g.coordinates as Ring[][] | undefined;
    return coords?.[0]?.[0] ?? null;
  }
  return null;
}

/** Centroïde visuel d’un polygone de tuile — la géométrie ne quitte pas le client. */
export function centroidLngLat(geometry: unknown): { longitude: number; latitude: number } | null {
  const ring = firstRing(geometry);
  if (!ring || ring.length === 0) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const pt of ring) {
    if (typeof pt[0] !== 'number' || typeof pt[1] !== 'number') continue;
    sx += pt[0];
    sy += pt[1];
    n += 1;
  }
  if (n === 0) return null;
  return { longitude: sx / n, latitude: sy / n };
}

/** Contenance cadastrale en m², d’après l’anneau PCI (approx. locale). */
export function surfaceCadastreM2(geometry: unknown): number | null {
  const ring = firstRing(geometry);
  if (!ring || ring.length < 4) return null;
  const lat0 = ((ring[0]![1] ?? 0) * Math.PI) / 180;
  const kx = 111_320 * Math.cos(lat0);
  const ky = 110_540;
  let s = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const x1 = (ring[i]![0] ?? 0) * kx;
    const y1 = (ring[i]![1] ?? 0) * ky;
    const x2 = (ring[i + 1]![0] ?? 0) * kx;
    const y2 = (ring[i + 1]![1] ?? 0) * ky;
    s += x1 * y2 - x2 * y1;
  }
  const a = Math.abs(s) / 2;
  if (a < 2) return null;
  return Math.round(a);
}

export function contenanceDepuisProps(
  props: Record<string, unknown> | null | undefined,
): number | null {
  const raw = props?.contenance ?? props?.area ?? props?.superficie;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(String(raw).replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 1 ? Math.round(n) : null;
}

export function emptyParcelleFiche(raw: string): ParcelleFiche {
  const parcelleId = normalizeParcelleId(raw) ?? (raw ?? '').trim().toUpperCase();
  return {
    parcelleId,
    reference: formatParcelleId(parcelleId),
    adresse: null,
    localite: null,
    banId: null,
    adresses: [],
    position: null,
    horsSecteur: false,
    videPublic: true,
    surfaceCadastreM2: null,
    nbAdresses: 0,
    prixM2Secteur: null,
    ventes: [],
    logements: [],
    coproprietes: [],
    prospects: [],
    contacts: [],
    biens: [],
    entreprises: [],
    passages: [],
  };
}
