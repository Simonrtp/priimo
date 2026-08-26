/**
 * Validation des champs d'un bien.
 *
 * Partagé par la création et la modification : les deux routes doivent appliquer
 * exactement les mêmes règles, sinon un bien valide à la création devient
 * refusable à la première correction.
 */

import type { DpeLettre, HonorairesACharge, MandatStatut } from '@/types/bien';
import {
  DPE_LETTRE_ORDER,
  HONORAIRES_A_CHARGE_ORDER,
  MANDAT_STATUT_ORDER,
} from '@/types/bien';

export interface BienInputFields {
  address: string;
  city: string | null;
  postalCode: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  rooms: number | null;
  price: number | null;
  mandatStatut: MandatStatut;
  proprietaireContactId: string | null;
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
  estCopropriete: boolean;
  nombreLots: number | null;
  chargesAnnuelles: number | null;
  procedureEnCours: boolean | null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function num(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n);
}

function decimal(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100) / 100;
}

function isoDate(v: unknown): string | null {
  const s = str(v, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : s;
}

function dpeLettre(v: unknown): DpeLettre | null {
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  return (DPE_LETTRE_ORDER as readonly string[]).includes(s) ? (s as DpeLettre) : null;
}

/** Photos destinées à un flux : uniquement des URL http(s), 20 maximum. */
export function normalizePhotoUrls(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\s+/) : [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item).trim();
    if (!/^https?:\/\/\S{3,2000}$/i.test(s)) continue;
    if (!out.includes(s)) out.push(s.slice(0, 2000));
    if (out.length >= 20) break;
  }
  return out;
}

export type ParsedBienInput = { ok: true; fields: BienInputFields } | { ok: false; error: string };

export function parseBienInput(raw: unknown): ParsedBienInput {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Requête invalide' };
  }
  const b = raw as Record<string, unknown>;

  const address = str(b.address, 240);
  if (!address) return { ok: false, error: "L'adresse est obligatoire" };

  const statutRaw = typeof b.mandatStatut === 'string' ? b.mandatStatut : 'estimation';
  const mandatStatut = (MANDAT_STATUT_ORDER as readonly string[]).includes(statutRaw)
    ? (statutRaw as MandatStatut)
    : 'estimation';

  const postalCodeRaw = str(b.postalCode, 10);
  const postalCode = postalCodeRaw && /^\d{5}$/.test(postalCodeRaw) ? postalCodeRaw : null;

  const surfaceM2 = num(b.surfaceM2, 100_000);

  const chargeRaw = typeof b.honorairesACharge === 'string' ? b.honorairesACharge : '';
  const honorairesACharge = (HONORAIRES_A_CHARGE_ORDER as readonly string[]).includes(chargeRaw)
    ? (chargeRaw as HonorairesACharge)
    : null;

  return {
    ok: true,
    fields: {
      address,
      city: str(b.city, 120),
      postalCode,
      propertyType: str(b.propertyType, 60),
      surfaceM2: surfaceM2 === 0 ? null : surfaceM2,
      rooms: num(b.rooms, 50),
      price: num(b.price, 100_000_000),
      mandatStatut,
      proprietaireContactId: str(b.proprietaireContactId, 40),
      notes: str(b.notes, 4000),
      listingTitle: str(b.listingTitle, 180),
      listingDescription: str(b.listingDescription, 8000),
      photos: normalizePhotoUrls(b.photos),
      dpeLettre: dpeLettre(b.dpeLettre),
      dpeKwh: num(b.dpeKwh, 9999),
      gesLettre: dpeLettre(b.gesLettre),
      gesKgCo2: num(b.gesKgCo2, 9999),
      dpeVierge: b.dpeVierge === true || b.dpeVierge === 'true',
      dpeDate: isoDate(b.dpeDate),
      honorairesMontant: num(b.honorairesMontant, 10_000_000),
      honorairesACharge,
      honorairesPourcent: decimal(b.honorairesPourcent, 100),
      mandatNumero: str(b.mandatNumero, 80),
      mandatDate: isoDate(b.mandatDate),
      estCopropriete: b.estCopropriete === true || b.estCopropriete === 'true',
      nombreLots: num(b.nombreLots, 10_000),
      chargesAnnuelles: num(b.chargesAnnuelles, 10_000_000),
      procedureEnCours:
        b.procedureEnCours === true || b.procedureEnCours === 'true'
          ? true
          : b.procedureEnCours === false || b.procedureEnCours === 'false'
            ? false
            : null,
    },
  };
}

/** Colonnes snake_case à écrire en base, hors agence et auteur. */
export function bienFieldsToRow(f: BienInputFields) {
  return {
    address: f.address,
    city: f.city,
    postal_code: f.postalCode,
    property_type: f.propertyType,
    surface_m2: f.surfaceM2,
    rooms: f.rooms,
    price: f.price,
    mandat_statut: f.mandatStatut,
    proprietaire_contact_id: f.proprietaireContactId,
    notes: f.notes,
    listing_title: f.listingTitle,
    listing_description: f.listingDescription,
    photos: f.photos,
    dpe_lettre: f.dpeLettre,
    dpe_kwh: f.dpeKwh,
    ges_lettre: f.gesLettre,
    ges_kg_co2: f.gesKgCo2,
    dpe_vierge: f.dpeVierge,
    dpe_date: f.dpeDate,
    honoraires_montant: f.honorairesMontant,
    honoraires_a_charge: f.honorairesACharge,
    honoraires_pourcent: f.honorairesPourcent,
    mandat_numero: f.mandatNumero,
    mandat_date: f.mandatDate,
    est_copropriete: f.estCopropriete,
    nombre_lots: f.estCopropriete ? f.nombreLots : null,
    charges_annuelles: f.estCopropriete ? f.chargesAnnuelles : null,
    procedure_en_cours: f.estCopropriete ? f.procedureEnCours : null,
  };
}
