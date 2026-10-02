/**
 * Création d'un contact — saisie manuelle, ou dictée validée par l'agent.
 *
 * Partagée par la route `/api/dashboard/contacts` et la validation d'une
 * dictée : un contact né d'une note suit exactement les mêmes règles
 * (doublons, géocodage, attribution) qu'un contact saisi à la main.
 */

import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import { viewerFromProfile, type RecordViewer } from '@/lib/agency/visibility';
import { parseContactInput } from '@/lib/contact-input';
import { findDuplicates } from '@/lib/contacts/duplicates';
import { contactGeocodeQuery, resolveGeoColumns } from '@/lib/geo/fields';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import {
  buildFullName,
  fetchContactById,
  fetchContactsDuplicateLite,
  insertContactRow,
  mapDbContactToContact,
} from '@/lib/queries/contacts';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { reconcileOrphanNotes } from '@/lib/notes/run-reconcile';
import type { Contact } from '@/types/contact';
import type { ContactRow, ContactSourceDb, Database } from '@/types/database';

export const SOURCES_CONTACT: readonly ContactSourceDb[] = [
  'manuel',
  'vocal',
  'prospection',
  'portail',
  'site_agence',
  'seloger',
  'bienici',
  'logicimmo',
  'leboncoin',
  'autre_portail',
  'qr_terrain',
];

export type ContexteCreation = {
  supabase: SupabaseClient<Database>;
  profile: RecordViewer & { id: string };
  agencyId: string;
  memberships: readonly { agency_id: string }[];
  /** Liste des contacts pour les doublons, déjà lue : évite de la relire par contact. */
  existants?: Awaited<ReturnType<typeof fetchContactsDuplicateLite>>;
};

export type ResultatCreation =
  | { ok: true; status: 200 | 201; contact: Contact; reused: boolean }
  | {
      ok: false;
      status: 400 | 409 | 500;
      error: string;
      field?: string | null;
      matches?: { contact: Contact; strength: string; reason: string }[];
    };

export async function creerContact(ctx: ContexteCreation, body: unknown): Promise<ResultatCreation> {
  const { supabase, profile, agencyId } = ctx;
  const parsed = parseContactInput(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error, field: parsed.field ?? null };
  const f = parsed.fields;

  const raw = (body ?? {}) as Record<string, unknown>;
  const sourceRaw = typeof raw.source === 'string' ? raw.source : 'manuel';
  const source = (SOURCES_CONTACT as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as ContactSourceDb)
    : 'manuel';
  const voiceNoteId = typeof raw.voiceNoteId === 'string' ? raw.voiceNoteId : null;

  // Pas de lecture des membres si l’assignation est soi-même ou absente.
  const assignedRaw = raw.assignedTo;
  const needsMemberLookup =
    typeof assignedRaw === 'string' && assignedRaw.length > 0 && assignedRaw !== profile.id;

  const query = contactGeocodeQuery(f.address, f.secteur, f.postalCodes);

  const [members, geo, existing] = await Promise.all([
    needsMemberLookup ? fetchMembersOfMyAgency(agencyId, ctx.memberships) : Promise.resolve([]),
    query ? resolveGeoColumns(raw, query.adresse, query.codePostal) : Promise.resolve(null),
    ctx.existants ? Promise.resolve(ctx.existants) : fetchContactsDuplicateLite(supabase),
  ]);

  let assigneeId: string | null = profile.id;
  if (assignedRaw === null || assignedRaw === '') {
    assigneeId = null;
  } else if (typeof assignedRaw === 'string' && assignedRaw === profile.id) {
    assigneeId = profile.id;
  } else if (needsMemberLookup) {
    const assigned = parseAssigneeId(assignedRaw, memberIdSet(members));
    if (assigned.provided && 'invalid' in assigned) {
      return { ok: false, status: 400, error: "Cette personne n'appartient pas à l'agence" };
    }
    assigneeId = assigned.provided && !('invalid' in assigned) ? assigned.id : profile.id;
  }

  const meta = assignmentMeta(assigneeId, profile.id);

  const forceCreate = raw.forceCreate === true;
  const visible = visibleContactsFor(viewerFromProfile(profile), existing);
  const hits = findDuplicates(
    {
      id: '__new__',
      firstName: f.firstName,
      lastName: f.lastName,
      fullName: buildFullName(f.firstName, f.lastName),
      phone: f.phone,
      email: f.email,
    },
    visible,
  );
  const strong = hits.filter((h) => h.strength === 'strong');
  if (strong.length > 0 && !forceCreate) {
    // Depuis une dictée : rattacher au contact existant plutôt que bloquer l’agent.
    if (voiceNoteId) {
      const existingContact = strong[0]!.other;
      try {
        await supabase
          .from('voice_notes')
          .update({ contact_id: existingContact.id, status: 'valide', ...meta })
          .eq('id', voiceNoteId)
          .eq('agency_id', agencyId);
        const admin = createSupabaseAdminClient();
        await admin.from('note_liens').upsert(
          {
            note_id: voiceNoteId,
            agency_id: agencyId,
            entite_type: 'contact',
            entite_id: existingContact.id,
            confiance: 'certain',
            cree_par: 'agent',
          },
          { onConflict: 'note_id,entite_type,entite_id' },
        );
      } catch (err) {
        console.error('[contacts] rattachement dictée (doublon)', err);
      }
      return { ok: true, status: 200, contact: existingContact, reused: true };
    }

    return {
      ok: false,
      status: 409,
      error: 'Un contact similaire existe déjà',
      matches: strong.map((h) => ({ contact: h.other, strength: h.strength, reason: h.reason })),
    };
  }

  const { data: inserted, error } = await insertContactRow(supabase, {
    agency_id: agencyId,
    created_by: profile.id,
    first_name: f.firstName || null,
    last_name: f.lastName || null,
    contact_type: f.type,
    autres_types: f.autresTypes,
    phone: f.phone,
    numero_communique_par_la_personne: f.numeroCommuniqueParLaPersonne,
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
    source,
    ...meta,
    ...(geo ?? {}),
  });

  if (error || !inserted) {
    console.error('[contacts] création', error);
    return { ok: false, status: 500, error: "Le contact n'a pas pu être créé" };
  }

  let contact = mapDbContactToContact(inserted as unknown as ContactRow);

  const toMark = forceCreate ? hits : hits.filter((h) => h.strength === 'weak');
  if (toMark.length > 0) {
    const partner = toMark[0]!.other;
    const { error: markNew } = await supabase
      .from('contacts')
      .update({ doublon_de: partner.id })
      .eq('id', contact.id)
      .eq('agency_id', agencyId);
    if (markNew) {
      console.error('[contacts] marquage doublon', markNew);
    } else if (!partner.doublonDe) {
      const { error: markOld } = await supabase
        .from('contacts')
        .update({ doublon_de: contact.id })
        .eq('id', partner.id)
        .eq('agency_id', agencyId);
      if (markOld) console.error('[contacts] marquage doublon existant', markOld);
    }
    const refreshed = await fetchContactById(supabase, contact.id);
    if (refreshed) contact = refreshed;
  }

  if (voiceNoteId) {
    try {
      const { error: linkError } = await supabase
        .from('voice_notes')
        .update({ contact_id: contact.id, status: 'valide', ...meta })
        .eq('id', voiceNoteId)
        .eq('agency_id', agencyId);

      if (linkError) {
        console.error('[contacts] rattachement de la dictée', linkError);
      } else {
        const admin = createSupabaseAdminClient();
        const { error: lienErr } = await admin.from('note_liens').upsert(
          {
            note_id: voiceNoteId,
            agency_id: agencyId,
            entite_type: 'contact',
            entite_id: contact.id,
            confiance: 'certain',
            cree_par: 'agent',
          },
          { onConflict: 'note_id,entite_type,entite_id' },
        );
        if (lienErr) console.error('[contacts] note_liens', lienErr);
        if (f.summary) {
          const { error: interErr } = await supabase.from('contact_interactions').insert({
            agency_id: agencyId,
            contact_id: contact.id,
            author_id: profile.id,
            kind: 'vocal',
            body: f.summary,
            voice_note_id: voiceNoteId,
            ...meta,
          });
          if (interErr) console.error('[contacts] interaction vocale', interErr);
        }
      }
    } catch (err) {
      // La fiche contact est créée : un échec de lien ne doit pas faire échouer la réponse.
      console.error('[contacts] rattachement dictée', err);
    }
  }

  // Hors chemin critique : ne bloque pas la réponse.
  const reconcileNeedles = [contact.fullName, contact.firstName, contact.lastName, contact.phone, contact.address];
  const contactId = contact.id;
  try {
    after(() => {
      try {
        const admin = createSupabaseAdminClient();
        void reconcileOrphanNotes(admin, agencyId, {
          entiteType: 'contact',
          entiteId: contactId,
          needles: reconcileNeedles,
        }).catch((err) => console.error('[contacts] réconciliation', err));
      } catch (err) {
        console.error('[contacts] réconciliation', err);
      }
    });
  } catch (err) {
    console.error('[contacts] after()', err);
  }

  return { ok: true, status: 201, contact, reused: false };
}
