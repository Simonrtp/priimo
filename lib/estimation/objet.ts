import type { AgencyEstimationRow } from '@/types/database';
import {
  isEtat,
  isMotif,
  type EstimationEtat,
  type EstimationMotif,
  type EstimationOccupation,
} from '@/lib/estimation/cycle';
import { estNote, type CritereSource, type GrilleSaisie } from '@/lib/estimation/grille';

export type EstimationBien = {
  sousType: string | null;
  anneeConstruction: number | null;
  chambres: number | null;
  carrez: boolean | null;
  surfaceTerrain: number | null;
  niveaux: number | null;
  etagesImmeuble: number | null;
  dernierEtage: boolean | null;
  qualiteEmplacement: string | null;
  ascenseur: boolean | null;
  balconTerrasse: boolean | null;
  chargesAnnuelles: number | null;
  chargesCopro: number | null;
  taxeFonciere: number | null;
  dpeVersion: string | null;
  ges: string | null;
  consoKwh: number | null;
  facadeCouverture: boolean;
};

export type EstimationAnnexe = {
  id: string;
  libelle: string;
  surfaceM2: number | null;
  valorisationEur: number | null;
};

export type EstimationPhoto = {
  url: string;
  kind: 'photo' | 'plan';
};

export const BIEN_VIDE: EstimationBien = {
  sousType: null,
  anneeConstruction: null,
  chambres: null,
  carrez: null,
  surfaceTerrain: null,
  niveaux: null,
  etagesImmeuble: null,
  dernierEtage: null,
  qualiteEmplacement: null,
  ascenseur: null,
  balconTerrasse: null,
  chargesAnnuelles: null,
  chargesCopro: null,
  taxeFonciere: null,
  dpeVersion: null,
  ges: null,
  consoKwh: null,
  facadeCouverture: false,
};

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function asText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function asNum(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asBool(raw: unknown): boolean | null {
  if (raw === true || raw === false) return raw;
  return null;
}

export function parseBien(raw: unknown): EstimationBien {
  const o = asObject(raw);
  return {
    sousType: asText(o.sousType),
    anneeConstruction: asNum(o.anneeConstruction),
    chambres: asNum(o.chambres),
    carrez: asBool(o.carrez),
    surfaceTerrain: asNum(o.surfaceTerrain),
    niveaux: asNum(o.niveaux),
    etagesImmeuble: asNum(o.etagesImmeuble),
    dernierEtage: asBool(o.dernierEtage),
    qualiteEmplacement: asText(o.qualiteEmplacement),
    ascenseur: asBool(o.ascenseur),
    balconTerrasse: asBool(o.balconTerrasse),
    chargesAnnuelles: asNum(o.chargesAnnuelles),
    chargesCopro: asNum(o.chargesCopro),
    taxeFonciere: asNum(o.taxeFonciere),
    dpeVersion: asText(o.dpeVersion),
    ges: asText(o.ges),
    consoKwh: asNum(o.consoKwh),
    facadeCouverture: o.facadeCouverture === true,
  };
}

export function parseGrille(raw: unknown): GrilleSaisie {
  const o = asObject(raw);
  const out: GrilleSaisie = {};
  for (const [id, val] of Object.entries(o)) {
    const row = asObject(val);
    const source: CritereSource = row.source === 'donnees' ? 'donnees' : 'agent';
    out[id] = { valeur: estNote(row.valeur) ? row.valeur : null, source };
  }
  return out;
}

export function parseAnnexes(raw: unknown): EstimationAnnexe[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = asObject(item);
      const id = asText(o.id);
      const libelle = asText(o.libelle);
      if (!id || !libelle) return null;
      return {
        id,
        libelle,
        surfaceM2: asNum(o.surfaceM2),
        valorisationEur: asNum(o.valorisationEur),
      };
    })
    .filter((a): a is EstimationAnnexe => a != null);
}

export function parsePhotos(raw: unknown): EstimationPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const o = asObject(item);
      const url = asText(o.url);
      if (!url) return null;
      return { url, kind: o.kind === 'plan' ? 'plan' : 'photo' } as const;
    })
    .filter((p): p is EstimationPhoto => p != null);
}

export function parseListe(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
}

export type EstimationObjet = {
  id: string;
  agencyId: string;
  createdBy: string | null;
  referentId: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  banId: string | null;
  parcelleId: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: 'appartement' | 'maison' | null;
  surfaceM2: number | null;
  rooms: number | null;
  floor: string | null;
  dpeClass: string | null;
  motif: EstimationMotif;
  etat: EstimationEtat;
  dateValeur: string | null;
  occupation: EstimationOccupation;
  loyerAnnuel: number | null;
  honorairesPct: number;
  commentairesConfidentiels: string | null;
  commentairesPublics: string | null;
  bien: EstimationBien;
  grille: GrilleSaisie;
  annexes: EstimationAnnexe[];
  pointsForts: string[];
  pointsFaibles: string[];
  photos: EstimationPhoto[];
  available: boolean;
  priceValue: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  pricePerM2: number | null;
  reliability: number;
  reliabilityLabel: string | null;
  comparables: unknown;
  context: Record<string, unknown>;
  leadId: string | null;
  contactId: string | null;
  bienId: string | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
  shareRevokedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

export function mapEstimation(row: AgencyEstimationRow): EstimationObjet {
  const ctx =
    row.context && typeof row.context === 'object' && !Array.isArray(row.context)
      ? (row.context as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    agencyId: row.agency_id,
    createdBy: row.created_by,
    referentId: row.referent_id,
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    banId: row.ban_id,
    parcelleId: row.parcelle_id,
    latitude: row.latitude,
    longitude: row.longitude,
    propertyType:
      row.property_type === 'maison' || row.property_type === 'appartement'
        ? row.property_type
        : null,
    surfaceM2: row.surface_m2,
    rooms: row.rooms,
    floor: row.floor,
    dpeClass: row.dpe_class,
    motif: isMotif(row.motif) ? row.motif : 'projet_vente',
    etat: isEtat(row.etat) ? row.etat : 'brouillon',
    dateValeur: row.date_valeur,
    occupation: row.occupation === 'occupe' ? 'occupe' : 'libre',
    loyerAnnuel: row.loyer_annuel,
    honorairesPct: Number(row.honoraires_pct) || 5,
    commentairesConfidentiels: row.commentaires_confidentiels,
    commentairesPublics: row.commentaires_publics,
    bien: parseBien(row.bien),
    grille: parseGrille(row.grille),
    annexes: parseAnnexes(row.annexes),
    pointsForts: parseListe(row.points_forts),
    pointsFaibles: parseListe(row.points_faibles),
    photos: parsePhotos(row.photos),
    available: row.available,
    priceValue: row.price_value,
    priceLow: row.price_low,
    priceHigh: row.price_high,
    pricePerM2: row.price_per_m2,
    reliability: row.reliability,
    reliabilityLabel: row.reliability_label,
    comparables: row.comparables,
    context: ctx,
    leadId: row.lead_id,
    contactId: row.contact_id,
    bienId: row.bien_id,
    shareToken: row.share_token,
    shareExpiresAt: row.share_expires_at,
    shareRevokedAt: row.share_revoked_at,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const ESTIMATION_SELECT =
  'id, agency_id, created_by, referent_id, address, postal_code, city, ban_id, parcelle_id, latitude, longitude, property_type, surface_m2, rooms, floor, condition_rating, dpe_class, motif, etat, date_valeur, occupation, loyer_annuel, honoraires_pct, commentaires_confidentiels, commentaires_publics, bien, grille, annexes, points_forts, points_faibles, photos, available, price_value, price_low, price_high, price_per_m2, reliability, reliability_label, steps, comparables, context, lead_id, contact_id, bien_id, share_token, share_expires_at, share_revoked_at, view_count, last_viewed_at, created_at, updated_at';

export const ESTIMATION_LIST_SELECT =
  'id, address, postal_code, city, motif, etat, referent_id, created_by, price_value, price_low, price_high, available, occupation, created_at, updated_at, lead_id, contact_id';
