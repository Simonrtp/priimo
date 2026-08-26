import { NextResponse } from 'next/server';
import { assignmentMeta } from '@/lib/agency/assignees';
import { canSeeLeadRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { findDuplicates } from '@/lib/contacts/duplicates';
import { parseContactsImmeuble } from '@/lib/lead-contacts';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import {
  CONTACTS_SELECT,
  fetchContactsSafe,
  mapDbContactToContact,
} from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ContactRow } from '@/types/database';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { leadId } = await ctx.params;
  if (!leadId) return NextResponse.json({ error: 'Prospect inconnu' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const companyName = typeof raw.companyName === 'string' ? raw.companyName.trim() : '';
  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  const categorie = typeof raw.categorie === 'string' ? raw.categorie.trim() : '';
  const nafLibelle = typeof raw.nafLibelle === 'string' ? raw.nafLibelle.trim() : '';
  if (!companyName || !phone) {
    return NextResponse.json({ error: 'Nom et téléphone obligatoires' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: lead, error: loadError } = await supabase
    .from('leads')
    .select('id, assigned_to, address, ban_id, latitude, longitude, contacts_immeuble')
    .eq('id', leadId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (loadError || !lead) {
    return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  if (!canSeeLeadRecord(viewer, { assignedTo: lead.assigned_to })) {
    return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
  }

  const immeuble = parseContactsImmeuble(lead.contacts_immeuble);
  const match = immeuble.find((c) => c.companyName === companyName && c.phone === phone);
  if (!match) {
    return NextResponse.json({ error: 'Ce commerçant n’est pas rattaché à cet immeuble' }, { status: 400 });
  }

  const existing = visibleContactsFor(viewer, await fetchContactsSafe(supabase));
  const hits = findDuplicates(
    {
      id: '__new__',
      firstName: '',
      lastName: companyName,
      fullName: companyName,
      phone,
      email: null,
    },
    existing,
  );
  const strong = hits.find((h) => h.strength === 'strong');
  if (strong) {
    return NextResponse.json({ contact: strong.other, already: true });
  }

  const summaryBits = [categorie || match.categorie, nafLibelle || match.nafLibelle].filter(Boolean);
  const meta = assignmentMeta(lead.assigned_to ?? profile.id, profile.id);

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      agency_id: agency.id,
      created_by: profile.id,
      first_name: null,
      last_name: companyName,
      contact_type: 'commercant',
      phone,
      address: lead.address,
      ban_id: lead.ban_id,
      latitude: lead.latitude,
      longitude: lead.longitude,
      lead_id: leadId,
      source: 'prospection',
      summary: summaryBits.length ? summaryBits.join(' · ') : null,
      ...meta,
    })
    .select(CONTACTS_SELECT)
    .single();

  if (error || !data) {
    console.error('[leads] promote-contact', error);
    return NextResponse.json({ error: 'Le contact n’a pas pu être créé' }, { status: 500 });
  }

  let contact = mapDbContactToContact(data as unknown as ContactRow);
  const weak = hits.find((h) => h.strength === 'weak');
  if (weak) {
    await supabase.from('contacts').update({ doublon_de: weak.other.id }).eq('id', contact.id);
    if (!weak.other.doublonDe) {
      await supabase.from('contacts').update({ doublon_de: contact.id }).eq('id', weak.other.id);
    }
    contact = { ...contact, doublonDe: weak.other.id };
  }

  return NextResponse.json({ contact, already: false }, { status: 201 });
}
