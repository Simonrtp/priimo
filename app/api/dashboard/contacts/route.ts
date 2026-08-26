import { NextResponse } from 'next/server';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { parseContactInput } from '@/lib/contact-input';
import { findDuplicates } from '@/lib/contacts/duplicates';
import { contactGeocodeQuery, geocodeToColumns } from '@/lib/geo/fields';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import {
  buildFullName,
  CONTACTS_SELECT,
  fetchContactById,
  fetchContactsSafe,
  mapDbContactToContact,
} from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ContactRow, ContactSourceDb } from '@/types/database';
import { reconcileOrphanNotes } from '@/lib/notes/run-reconcile';

export const runtime = 'nodejs';

const SOURCES: readonly ContactSourceDb[] = [
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
];

/** Création d'un contact : saisie manuelle ou dictée validée par l'agent. */
export async function POST(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const parsed = parseContactInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const f = parsed.fields;

  const raw = body as Record<string, unknown>;
  const sourceRaw = typeof raw.source === 'string' ? raw.source : 'manuel';
  const source = (SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as ContactSourceDb)
    : 'manuel';
  const voiceNoteId = typeof raw.voiceNoteId === 'string' ? raw.voiceNoteId : null;

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const assigned = parseAssigneeId(raw.assignedTo, memberIdSet(members));
  if (assigned.provided && 'invalid' in assigned) {
    return NextResponse.json(
      { error: "Cette personne n'appartient pas à l'agence" },
      { status: 400 },
    );
  }

  const assigneeId =
    assigned.provided && !('invalid' in assigned) ? assigned.id : profile.id;
  const meta = assignmentMeta(assigneeId, profile.id);

  const query = contactGeocodeQuery(f.address, f.secteur, f.postalCodes);
  const geo = query
    ? await geocodeToColumns(query.adresse, query.codePostal)
    : null;

  const supabase = await createSupabaseServerClient();
  const forceCreate = raw.forceCreate === true;
  const existing = visibleContactsFor(viewerFromProfile(profile), await fetchContactsSafe(supabase));
  const hits = findDuplicates(
    {
      id: '__new__',
      firstName: f.firstName,
      lastName: f.lastName,
      fullName: buildFullName(f.firstName, f.lastName),
      phone: f.phone,
      email: f.email,
    },
    existing,
  );
  const strong = hits.filter((h) => h.strength === 'strong');
  if (strong.length > 0 && !forceCreate) {
    return NextResponse.json(
      {
        error: 'Un contact similaire existe déjà',
        matches: strong.map((h) => ({
          contact: h.other,
          strength: h.strength,
          reason: h.reason,
        })),
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      agency_id: agency.id,
      created_by: profile.id,
      first_name: f.firstName || null,
      last_name: f.lastName || null,
      contact_type: f.type,
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
      source,
      ...meta,
      ...(geo ?? {}),
    })
    .select(CONTACTS_SELECT)
    .single();

  if (error || !data) {
    console.error('[contacts] création', error);
    return NextResponse.json({ error: "Le contact n'a pas pu être créé" }, { status: 500 });
  }

  let contact = mapDbContactToContact(data as unknown as ContactRow);

  const toMark = forceCreate ? hits : hits.filter((h) => h.strength === 'weak');
  if (toMark.length > 0) {
    const partner = toMark[0]!.other;
    const { error: markNew } = await supabase
      .from('contacts')
      .update({ doublon_de: partner.id })
      .eq('id', contact.id)
      .eq('agency_id', agency.id);
    if (markNew) {
      console.error('[contacts] marquage doublon', markNew);
    } else if (!partner.doublonDe) {
      const { error: markOld } = await supabase
        .from('contacts')
        .update({ doublon_de: contact.id })
        .eq('id', partner.id)
        .eq('agency_id', agency.id);
      if (markOld) console.error('[contacts] marquage doublon existant', markOld);
    }
    const refreshed = await fetchContactById(supabase, contact.id);
    if (refreshed) contact = refreshed;
  }

  if (voiceNoteId) {
    const { error: linkError } = await supabase
      .from('voice_notes')
      .update({
        contact_id: contact.id,
        status: 'valide',
        ...meta,
      })
      .eq('id', voiceNoteId)
      .eq('agency_id', agency.id);

    if (linkError) {
      console.error('[contacts] rattachement de la dictée', linkError);
    } else {
      const admin = createSupabaseAdminClient();
      await admin.from('note_liens').upsert(
        {
          note_id: voiceNoteId,
          agency_id: agency.id,
          entite_type: 'contact',
          entite_id: contact.id,
          confiance: 'certain',
          cree_par: 'agent',
        },
        { onConflict: 'note_id,entite_type,entite_id' },
      );
      if (f.summary) {
        await supabase.from('contact_interactions').insert({
          agency_id: agency.id,
          contact_id: contact.id,
          author_id: profile.id,
          kind: 'vocal',
          body: f.summary,
          voice_note_id: voiceNoteId,
          ...meta,
        });
      }
    }
  }

  try {
    const admin = createSupabaseAdminClient();
    await reconcileOrphanNotes(admin, agency.id, {
      entiteType: 'contact',
      entiteId: contact.id,
      needles: [contact.fullName, contact.firstName, contact.lastName, contact.phone, contact.address],
    });
  } catch (err) {
    console.error('[contacts] réconciliation', err);
  }

  return NextResponse.json({ contact }, { status: 201 });
}
