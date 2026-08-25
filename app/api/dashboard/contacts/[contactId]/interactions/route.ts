import { NextResponse } from 'next/server';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import {
  fetchContactById,
  fetchContactInteractions,
  INTERACTIONS_SELECT_PUBLIC,
  mapDbInteraction,
} from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ContactInteractionKindDb, ContactInteractionRow } from '@/types/database';

export const runtime = 'nodejs';

const KINDS: readonly ContactInteractionKindDb[] = ['note', 'appel', 'visite', 'vocal', 'email'];

export async function GET(_req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const contact = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (
    !contact ||
    !canSeeOwnedRecord(viewer, { assignedTo: contact.assignedTo, createdBy: contact.createdBy })
  ) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  try {
    const interactions = await fetchContactInteractions(supabase, contactId);
    return NextResponse.json({ interactions });
  } catch (err) {
    console.error('[contacts] historique', err);
    return NextResponse.json({ error: 'Historique indisponible' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;

  let body: { body?: unknown; kind?: unknown; assignedTo?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 4000) : '';
  if (!text) return NextResponse.json({ error: 'Le message est vide' }, { status: 400 });

  const kindRaw = typeof body.kind === 'string' ? body.kind : 'note';
  const kind = (KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as ContactInteractionKindDb)
    : 'note';

  const supabase = await createSupabaseServerClient();
  const contact = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (
    !contact ||
    !canSeeOwnedRecord(viewer, { assignedTo: contact.assignedTo, createdBy: contact.createdBy })
  ) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const assigned = parseAssigneeId(body.assignedTo, memberIdSet(members));
  if (assigned.provided && 'invalid' in assigned) {
    return NextResponse.json(
      { error: "Cette personne n'appartient pas à l'agence" },
      { status: 400 },
    );
  }
  const meta =
    assigned.provided && !('invalid' in assigned)
      ? assignmentMeta(assigned.id, profile.id)
      : { assigned_to: null, assigned_by: null, assigned_at: null };

  const { data, error } = await supabase
    .from('contact_interactions')
    .insert({
      agency_id: agency.id,
      contact_id: contactId,
      author_id: profile.id,
      kind,
      body: text,
      ...meta,
    })
    .select(INTERACTIONS_SELECT_PUBLIC)
    .single();

  if (error || !data) {
    console.error('[contacts] ajout échange', error);
    return NextResponse.json({ error: "L'échange n'a pas pu être enregistré" }, { status: 500 });
  }

  return NextResponse.json(
    { interaction: mapDbInteraction(data as unknown as ContactInteractionRow) },
    { status: 201 },
  );
}
