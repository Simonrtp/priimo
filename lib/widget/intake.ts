/**
 * Ce qui arrive dans Priimo quand une estimation aboutit sur le site d'une agence.
 *
 * Un contact vendeur, source « estimation site agence », rattaché à la demande
 * et à sa preuve de consentement. La détection de doublon existante s'applique :
 * sur une correspondance forte on rattache la demande à la fiche déjà connue
 * plutôt que d'en créer une jumelle — un formulaire public ne peut pas
 * demander à l'agent d'arbitrer sur le moment.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactInsert, Database } from '@/types/database';
import { findDuplicates, type DuplicateFields } from '@/lib/contacts/duplicates';
import { chooseAssignee, type AssignableMember } from '@/lib/widget/assignment';

type Db = SupabaseClient<Database>;

export type IntakePerson = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
};

export type IntakeProperty = {
  address: string;
  postalCode: string;
  city: string | null;
  banId: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string;
  surfaceM2: number;
  rooms: number;
  saleTimeline: string | null;
};

export type IntakeOutcome = {
  contactId: string | null;
  assignedTo: string | null;
  /** Vrai si la personne était déjà connue de l'agence. */
  reused: boolean;
};

function fullName(first: string, last: string): string {
  return [first, last].map((s) => s.trim()).filter(Boolean).join(' ') || 'Sans nom';
}

async function fetchMembers(admin: Db, agencyId: string): Promise<AssignableMember[]> {
  const { data } = await admin
    .from('profile_agencies')
    .select('profile_id, role, profiles(first_name, last_name)')
    .eq('agency_id', agencyId);

  return (data ?? []).map((row) => {
    const profile = row.profiles as { first_name?: string; last_name?: string } | null;
    return {
      id: row.profile_id as string,
      fullName: fullName(profile?.first_name ?? '', profile?.last_name ?? ''),
      role: (row.role as 'directeur' | 'collaborateur') ?? 'collaborateur',
    };
  });
}

/** Charge du jour : demandes du site déjà attribuées à chaque membre. */
async function fetchCharge(admin: Db, agencyId: string): Promise<Map<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data } = await admin
    .from('estimation_requests')
    .select('assigned_to')
    .eq('agency_id', agencyId)
    .gte('created_at', since.toISOString())
    .not('assigned_to', 'is', null);

  const charge = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.assigned_to as string | null;
    if (!id) continue;
    charge.set(id, (charge.get(id) ?? 0) + 1);
  }
  return charge;
}

export async function intakeEstimationLead(
  admin: Db,
  agencyId: string,
  person: IntakePerson,
  property: IntakeProperty,
  summary: string,
): Promise<IntakeOutcome> {
  const members = await fetchMembers(admin, agencyId);
  const assignedTo = chooseAssignee(members, await fetchCharge(admin, agencyId));

  const { data: existingRows } = await admin
    .from('contacts')
    .select('id, first_name, last_name, phone, email, doublon_de')
    .eq('agency_id', agencyId)
    .limit(2000);

  const existing: (DuplicateFields & { doublonDe: string | null })[] = (existingRows ?? []).map(
    (row) => ({
      id: row.id as string,
      firstName: (row.first_name as string | null) ?? '',
      lastName: (row.last_name as string | null) ?? '',
      fullName: fullName((row.first_name as string | null) ?? '', (row.last_name as string | null) ?? ''),
      phone: (row.phone as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      doublonDe: (row.doublon_de as string | null) ?? null,
    }),
  );

  const hits = findDuplicates(
    {
      id: '__widget__',
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: fullName(person.firstName, person.lastName),
      phone: person.phone,
      email: person.email,
    },
    existing,
  );

  const strong = hits.find((h) => h.strength === 'strong');
  const now = new Date().toISOString();

  if (strong) {
    // Déjà connue : on enrichit la fiche sans écraser ce que l'agent a saisi.
    const patch: Partial<ContactInsert> = { last_interaction_at: now };
    if (!strong.other.phone) patch.phone = person.phone;
    if (!strong.other.email) patch.email = person.email;
    await admin.from('contacts').update(patch).eq('id', strong.other.id).eq('agency_id', agencyId);
    return { contactId: strong.other.id, assignedTo, reused: true };
  }

  const { data: created, error } = await admin
    .from('contacts')
    .insert({
      agency_id: agencyId,
      first_name: person.firstName || null,
      last_name: person.lastName || null,
      contact_type: 'vendeur',
      phone: person.phone,
      email: person.email,
      address: property.address,
      secteur: property.city,
      postal_codes: property.postalCode ? [property.postalCode] : [],
      summary,
      source: 'site_agence',
      collecte_provenance: 'Widget d’estimation du site de l’agence',
      collecte_at: now,
      collecte_base_legale: 'Consentement explicite au rappel téléphonique',
      ban_id: property.banId,
      latitude: property.latitude,
      longitude: property.longitude,
      last_interaction_at: null,
      assigned_to: assignedTo,
      assigned_at: assignedTo ? now : null,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[widget] création du contact', error);
    return { contactId: null, assignedTo, reused: false };
  }

  // Correspondance faible : on ne fusionne pas, on signale à l'agent.
  const weak = hits.find((h) => h.strength === 'weak');
  if (weak) {
    await admin
      .from('contacts')
      .update({ doublon_de: weak.other.id })
      .eq('id', created.id)
      .eq('agency_id', agencyId);
    if (!weak.other.doublonDe) {
      await admin
        .from('contacts')
        .update({ doublon_de: created.id })
        .eq('id', weak.other.id)
        .eq('agency_id', agencyId);
    }
  }

  return { contactId: created.id as string, assignedTo, reused: false };
}
