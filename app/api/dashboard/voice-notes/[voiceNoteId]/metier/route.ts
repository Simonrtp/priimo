import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { parseAssigneeId } from '@/lib/agency/assignees';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';

export const runtime = 'nodejs';

/** Crée promesse / RDV / visite validés depuis une dictée. */
export async function POST(req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: note } = await admin
    .from('voice_notes')
    .select('id, agency_id, created_by')
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!note || note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const memberIds = memberIdSet(members);
  const contactId = typeof body.contactId === 'string' ? body.contactId : null;
  const bienId = typeof body.bienId === 'string' ? body.bienId : null;

  const created: string[] = [];

  const promesse = body.promesse as Record<string, unknown> | undefined;
  if (promesse?.accepted === true && typeof promesse.intitule === 'string' && typeof promesse.echeance === 'string') {
    const assigned = parseAssigneeId(promesse.assignedTo, memberIds);
    const profileId =
      assigned.provided && !('invalid' in assigned) && assigned.id ? assigned.id : profile.id;
    const { data, error } = await admin
      .from('promesses')
      .insert({
        agency_id: agency.id,
        profile_id: profileId,
        contact_id: contactId,
        note_id: voiceNoteId,
        intitule: promesse.intitule.slice(0, 200),
        echeance: promesse.echeance.slice(0, 10),
        statut: 'a_faire',
        cree_par: 'dictee',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[metier] promesse', error);
      return NextResponse.json({ error: 'Promesse non enregistrée' }, { status: 500 });
    }
    created.push(`promesse:${data.id}`);
  }

  const rdv = body.rendezVous as Record<string, unknown> | undefined;
  if (rdv?.accepted === true && typeof rdv.debut === 'string' && typeof rdv.fin === 'string') {
    const { data, error } = await admin
      .from('rendez_vous')
      .insert({
        agency_id: agency.id,
        profile_id: profile.id,
        contact_id: contactId,
        bien_id: bienId,
        debut: rdv.debut,
        fin: rdv.fin,
        type: typeof rdv.type === 'string' ? rdv.type : 'autre',
        lieu: typeof rdv.lieu === 'string' ? rdv.lieu.slice(0, 200) : null,
        cree_par: 'dictee',
      })
      .select('id')
      .single();
    if (error) {
      console.error('[metier] rdv', error);
      return NextResponse.json({ error: 'Rendez-vous non enregistré' }, { status: 500 });
    }
    created.push(`rdv:${data.id}`);
  }

  const visite = body.visite as Record<string, unknown> | undefined;
  if (visite?.accepted === true && typeof visite.dateVisite === 'string' && bienId) {
    const { data, error } = await admin
      .from('visites')
      .insert({
        agency_id: agency.id,
        bien_id: bienId,
        contact_id: contactId,
        profile_id: profile.id,
        date_visite: visite.dateVisite,
        retour: typeof visite.retour === 'string' ? visite.retour.slice(0, 2000) : null,
        interet: typeof visite.interet === 'string' ? visite.interet : null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[metier] visite', error);
      return NextResponse.json({ error: 'Visite non enregistrée' }, { status: 500 });
    }
    created.push(`visite:${data.id}`);
  }

  return NextResponse.json({ ok: true, created });
}
