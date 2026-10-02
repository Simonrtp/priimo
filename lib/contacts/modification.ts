/**
 * Modifier une fiche contact existante — depuis la fiche elle-même ou depuis
 * la revue d'une note. Les deux chemins écrivent les mêmes colonnes, avec le
 * même géocodage : une fiche corrigée en rangeant une dictée est une fiche
 * corrigée, pas un cas à part.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactInputFields } from '@/lib/contact-input';
import { contactGeocodeQuery, EMPTY_BAN_GEO, parseClientGeo, resolveGeoColumns } from '@/lib/geo/fields';
import { fetchContactById, mapDbContactToContact, updateContactRow } from '@/lib/queries/contacts';
import { normalizeEmail, normalizePhone } from '@/lib/import/normalize';
import type { Contact, ContactType } from '@/types/contact';
import { repartirRoles, rolesDuContact } from '@/types/contact';
import type { ContactRow, Database } from '@/types/database';

type Client = SupabaseClient<Database>;

/**
 * Les colonnes d'une fiche à partir de champs validés. L'adresse n'est
 * regéocodée que si elle a changé ou si l'écran fournit un point choisi.
 */
export async function colonnesDepuisChamps(
  f: ContactInputFields,
  raw: Record<string, unknown>,
  existing: Pick<Contact, 'address' | 'banId' | 'latitude' | 'longitude'>,
): Promise<Partial<ContactRow>> {
  const query = contactGeocodeQuery(f.address, f.secteur, f.postalCodes);
  const addressUnchanged =
    (f.address ?? null) === (existing.address ?? null) &&
    existing.banId != null &&
    existing.latitude != null &&
    existing.longitude != null;
  const geo = !query
    ? { ...EMPTY_BAN_GEO }
    : addressUnchanged && !parseClientGeo(raw)
      ? {
          ban_id: existing.banId,
          latitude: existing.latitude,
          longitude: existing.longitude,
          adresse_normalisee: existing.address,
          geocode_score: null,
          geocode_le: null,
        }
      : await resolveGeoColumns(raw, query.adresse, query.codePostal);
  return {
    first_name: f.firstName || null,
    last_name: f.lastName || null,
    contact_type: f.type,
    // Un écran qui n'envoie pas les rôles secondaires ne doit pas les effacer.
    ...('autresTypes' in raw ? { autres_types: f.autresTypes } : {}),
    phone: f.phone,
    email: f.email,
    secteur: f.secteur,
    address: f.address,
    postal_codes: f.postalCodes,
    budget_min: f.budgetMin,
    budget_max: f.budgetMax,
    surface_min: f.surfaceMin,
    surface_max: f.surfaceMax,
    rooms_min: f.roomsMin,
    summary: f.summary,
    recontacter_le: f.recontacterLe,
    ...(geo ?? {}),
  };
}

/** Ce qu'une note apporte à une fiche existante sans que l'agent l'ait ouverte. */
export type AjoutsNote = {
  roles: ContactType[];
  phone: string | null;
  email: string | null;
  address: string | null;
  banId: string | null;
};

/**
 * Complète une fiche avec ce que la note a appris, sans rien écraser : un rôle
 * s'ajoute aux autres, un téléphone, un e-mail ou une adresse ne remplissent
 * qu'un champ vide. Ce qui est déjà dans la fiche a été saisi par quelqu'un.
 */
export async function completerContact(
  supabase: Client,
  ids: { contactId: string; agencyId: string },
  ajouts: AjoutsNote,
): Promise<Contact | null> {
  const existing = await fetchContactById(supabase, ids.contactId);
  if (!existing) return null;

  const update: Partial<ContactRow> = {};
  const avant = rolesDuContact(existing);
  const apres = repartirRoles([...avant, ...ajouts.roles]);
  if (rolesDuContact(apres).join() !== avant.join()) {
    update.contact_type = apres.type;
    update.autres_types = apres.autresTypes;
  }
  if (!existing.phone && ajouts.phone && normalizePhone(ajouts.phone)) update.phone = ajouts.phone;
  if (!existing.email && ajouts.email && normalizeEmail(ajouts.email)) update.email = ajouts.email.trim();
  if (!existing.address && ajouts.address) {
    update.address = ajouts.address;
    Object.assign(update, await resolveGeoColumns({}, ajouts.address));
    if (ajouts.banId && !update.ban_id) update.ban_id = ajouts.banId;
  }
  if (Object.keys(update).length === 0) return existing;

  const { data, error } = await updateContactRow(supabase, ids, update);
  if (error || !data) throw new Error(error?.message ?? 'Fiche non mise à jour');
  return mapDbContactToContact(data as unknown as ContactRow);
}
