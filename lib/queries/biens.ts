import type { SupabaseClient } from '@supabase/supabase-js';
import type { BienRow, Database, DpeLettreDb, HonorairesAChargeDb } from '@/types/database';
import type { Bien } from '@/types/bien';
import { buildFullName } from '@/lib/queries/contacts';

type Client = SupabaseClient<Database>;

export const BIENS_SELECT_CORE = `
  id, agency_id, created_by, address, city, postal_code, property_type,
  surface_m2, rooms, price, mandat_statut, proprietaire_contact_id, lead_id,
  notes, created_at, updated_at
`;

export const BIENS_SELECT_GEO = `
  ${BIENS_SELECT_CORE},
  ban_id, latitude, longitude, adresse_normalisee, geocode_score, geocode_le
`;

export const BIENS_SELECT_LISTING = `
  listing_title, listing_description, photos, dpe_lettre, dpe_kwh,
  ges_lettre, ges_kg_co2, dpe_vierge, dpe_date, honoraires_montant,
  honoraires_a_charge, honoraires_pourcent, mandat_numero, mandat_date
`;

export const BIENS_SELECT = `
  ${BIENS_SELECT_GEO},
  ${BIENS_SELECT_LISTING}
`;

type BienRowWithOwner = BienRow & {
  proprietaire?: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

export const BIENS_OWNER_JOIN =
  'proprietaire:contacts!biens_proprietaire_contact_id_fkey(first_name, last_name, phone, email)';

export function biensSelectWithOwner(select: string = BIENS_SELECT): string {
  return `${select}, ${BIENS_OWNER_JOIN}`;
}

export function mapDbBienToBien(row: BienRowWithOwner): Bien {
  const owner = row.proprietaire ?? null;
  const ownerName = owner
    ? buildFullName(owner.first_name ?? '', owner.last_name ?? '') || null
    : null;

  return {
    id: row.id,
    agencyId: row.agency_id,
    createdBy: row.created_by,
    address: row.address,
    city: row.city,
    postalCode: row.postal_code,
    propertyType: row.property_type,
    surfaceM2: row.surface_m2,
    rooms: row.rooms,
    price: row.price,
    mandatStatut: row.mandat_statut,
    proprietaireContactId: row.proprietaire_contact_id,
    proprietaireName: ownerName,
    proprietairePhone: owner?.phone?.trim() || null,
    proprietaireEmail: owner?.email?.trim() || null,
    leadId: row.lead_id,
    banId: row.ban_id ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    notes: row.notes,
    listingTitle: row.listing_title ?? null,
    listingDescription: row.listing_description ?? null,
    photos: Array.isArray(row.photos) ? row.photos : [],
    dpeLettre: (row.dpe_lettre as DpeLettreDb | null) ?? null,
    dpeKwh: row.dpe_kwh ?? null,
    gesLettre: (row.ges_lettre as DpeLettreDb | null) ?? null,
    gesKgCo2: row.ges_kg_co2 ?? null,
    dpeVierge: row.dpe_vierge === true,
    dpeDate: row.dpe_date ?? null,
    honorairesMontant: row.honoraires_montant ?? null,
    honorairesACharge: (row.honoraires_a_charge as HonorairesAChargeDb | null) ?? null,
    honorairesPourcent:
      row.honoraires_pourcent === null || row.honoraires_pourcent === undefined
        ? null
        : Number(row.honoraires_pourcent),
    mandatNumero: row.mandat_numero ?? null,
    mandatDate: row.mandat_date ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Voir fetchContactsSafe : tolère l'absence de la table avant migration. */
export async function fetchBiensSafe(supabase: Client): Promise<Bien[]> {
  try {
    return await fetchBiens(supabase);
  } catch (err) {
    console.error('[biens] lecture impossible, écran dégradé', err);
    return [];
  }
}

export async function fetchBiens(supabase: Client): Promise<Bien[]> {
  const full = await supabase
    .from('biens')
    .select(biensSelectWithOwner(BIENS_SELECT))
    .order('created_at', { ascending: false });

  if (!full.error) {
    return ((full.data ?? []) as unknown as BienRowWithOwner[]).map(mapDbBienToBien);
  }

  // Migration d'annonce pas encore appliquée : on garde la géoloc (carte) même sans listing.
  const withGeo = await supabase
    .from('biens')
    .select(biensSelectWithOwner(BIENS_SELECT_GEO))
    .order('created_at', { ascending: false });

  if (!withGeo.error) {
    return ((withGeo.data ?? []) as unknown as BienRowWithOwner[]).map(mapDbBienToBien);
  }

  const fallback = await supabase
    .from('biens')
    .select(biensSelectWithOwner(BIENS_SELECT_CORE))
    .order('created_at', { ascending: false });

  if (fallback.error) throw new Error(full.error.message);
  return ((fallback.data ?? []) as unknown as BienRowWithOwner[]).map(mapDbBienToBien);
}
