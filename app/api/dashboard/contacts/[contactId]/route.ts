import { NextResponse } from 'next/server';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { parseContactInput } from '@/lib/contact-input';
import { contactGeocodeQuery, EMPTY_BAN_GEO, parseClientGeo, resolveGeoColumns } from '@/lib/geo/fields';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import { CONTACTS_SELECT, fetchContactById, mapDbContactToContact } from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ContactRow } from '@/types/database';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;
  if (!contactId) return NextResponse.json({ error: 'Contact inconnu' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const existing = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (
    !existing ||
    !canSeeOwnedRecord(viewer, { assignedTo: existing.assignedTo, createdBy: existing.createdBy })
  ) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const hasCoreFields = 'firstName' in raw || 'lastName' in raw || 'type' in raw;
  const relanceProvided = Object.prototype.hasOwnProperty.call(raw, 'recontacterLe');
  const parsed = hasCoreFields ? parseContactInput(body) : null;
  if (parsed && !parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const membersNeeded =
    typeof raw.assignedTo === 'string' &&
    raw.assignedTo.length > 0 &&
    raw.assignedTo !== profile.id;
  const members = membersNeeded
    ? await fetchMembersOfMyAgency(agency.id, memberships)
    : [];
  const assigned = parseAssigneeId(
    raw.assignedTo,
    membersNeeded ? memberIdSet(members) : new Set([profile.id]),
  );
  if (assigned.provided && 'invalid' in assigned) {
    return NextResponse.json(
      { error: "Cette personne n'appartient pas à l'agence" },
      { status: 400 },
    );
  }

  if (!parsed && !(assigned.provided && !('invalid' in assigned)) && !relanceProvided) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const update: Partial<ContactRow> = {};
  if (parsed?.ok) {
    const f = parsed.fields;
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
    Object.assign(update, {
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
      ...(geo ?? {}),
    });
  }
  if (relanceProvided && !parsed) {
    if (raw.recontacterLe === null || raw.recontacterLe === '') {
      update.recontacter_le = null;
    } else if (
      typeof raw.recontacterLe === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(raw.recontacterLe.trim())
    ) {
      update.recontacter_le = raw.recontacterLe.trim();
    } else {
      return NextResponse.json({ error: "La date de relance n'est pas valide" }, { status: 400 });
    }
  }
  if (assigned.provided && !('invalid' in assigned)) {
    Object.assign(update, assignmentMeta(assigned.id, profile.id));
  }

  const { data, error } = await supabase
    .from('contacts')
    .update(update)
    .eq('id', contactId)
    .eq('agency_id', agency.id)
    .select(CONTACTS_SELECT)
    .single();

  if (error || !data) {
    console.error('[contacts] mise à jour', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ contact: mapDbContactToContact(data as unknown as ContactRow) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId } = await ctx.params;
  if (!contactId) return NextResponse.json({ error: 'Contact inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const existing = await fetchContactById(supabase, contactId);
  const viewer = viewerFromProfile(profile);
  if (
    !existing ||
    !canSeeOwnedRecord(viewer, { assignedTo: existing.assignedTo, createdBy: existing.createdBy })
  ) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[contacts] suppression', error);
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
