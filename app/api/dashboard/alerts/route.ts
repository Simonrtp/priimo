import { NextResponse } from 'next/server';
import { isAgencyAlertKind } from '@/lib/agency/alerts';
import { canSeeLeadRecord, canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchContactById } from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  if (!isAgencyAlertKind(raw.kind)) {
    return NextResponse.json({ error: 'Type de signalement inconnu' }, { status: 400 });
  }

  const contactId = typeof raw.contactId === 'string' ? raw.contactId : null;
  const leadId = typeof raw.leadId === 'string' ? raw.leadId : null;
  if (!contactId && !leadId) {
    return NextResponse.json({ error: 'Indiquez un contact ou un prospect' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  if (contactId) {
    const contact = await fetchContactById(supabase, contactId);
    if (
      !contact ||
      !canSeeOwnedRecord(viewer, { assignedTo: contact.assignedTo, createdBy: contact.createdBy })
    ) {
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
    }
  }

  if (leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, assigned_to')
      .eq('id', leadId)
      .eq('agency_id', agency.id)
      .maybeSingle();
    if (!lead || !canSeeLeadRecord(viewer, { assignedTo: lead.assigned_to })) {
      return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
    }
  }

  const { error } = await supabase.from('agency_alerts').insert({
    agency_id: agency.id,
    created_by: profile.id,
    kind: raw.kind,
    contact_id: contactId,
    lead_id: leadId,
  });

  if (error) {
    console.error('[alerts] création', error);
    return NextResponse.json({ error: "Le signalement n'a pas pu être envoyé" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
