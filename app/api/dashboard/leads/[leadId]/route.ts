import { NextResponse } from 'next/server';
import { assignmentMeta, parseAssigneeId } from '@/lib/agency/assignees';
import { canSeeLeadRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LeadMlFeedbackDb, LeadRow, LeadStatusDb } from '@/types/database';

export const runtime = 'nodejs';

const STATUSES: readonly LeadStatusDb[] = [
  'nouveau',
  'contacte',
  'interesse',
  'pas_interesse',
  'mandat_signe',
  'vendeur_ailleurs',
];

export async function PATCH(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
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
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from('leads')
    .select('id, assigned_to, stage_id')
    .eq('id', leadId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  if (!canSeeLeadRecord(viewer, { assignedTo: existing.assigned_to })) {
    return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
  }

  const update: Partial<LeadRow> = {};

  if (raw.status !== undefined) {
    if (typeof raw.status !== 'string' || !(STATUSES as readonly string[]).includes(raw.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }
    update.status = raw.status as LeadStatusDb;
  }
  if (raw.notes !== undefined) {
    update.notes = typeof raw.notes === 'string' ? raw.notes : null;
  }
  if (raw.mlFeedback !== undefined) {
    update.ml_feedback = raw.mlFeedback as LeadMlFeedbackDb | null;
  }
  if (raw.mlFeedbackReason !== undefined) {
    update.ml_feedback_reason = typeof raw.mlFeedbackReason === 'string' ? raw.mlFeedbackReason : null;
  }
  if (raw.mlFeedbackAt !== undefined) {
    update.ml_feedback_at = typeof raw.mlFeedbackAt === 'string' ? raw.mlFeedbackAt : null;
  }

  if (raw.assignedTo !== undefined) {
    const members = await fetchMembersOfMyAgency(agency.id, memberships);
    const assigned = parseAssigneeId(raw.assignedTo, memberIdSet(members));
    if (!assigned.provided || 'invalid' in assigned) {
      return NextResponse.json(
        { error: "Cette personne n'appartient pas à l'agence" },
        { status: 400 },
      );
    }
    Object.assign(update, assignmentMeta(assigned.id, profile.id));
  }

  if (raw.stageId !== undefined) {
    if (raw.stageId === null) {
      update.stage_id = null;
    } else if (typeof raw.stageId !== 'string') {
      return NextResponse.json({ error: 'Étape invalide' }, { status: 400 });
    } else {
      const { data: stage, error: stageError } = await supabase
        .from('lead_stages')
        .select('id, type')
        .eq('id', raw.stageId)
        .eq('agency_id', agency.id)
        .maybeSingle();
      if (stageError || !stage) {
        return NextResponse.json({ error: 'Étape inconnue' }, { status: 400 });
      }
      update.stage_id = stage.id;
      if (stage.type === 'perdu') {
        const alreadyPerdu = existing.stage_id === stage.id;
        if (!alreadyPerdu && (typeof raw.lostReason !== 'string' || raw.lostReason.trim().length === 0)) {
          return NextResponse.json({ error: 'Un motif est obligatoire' }, { status: 400 });
        }
        if (typeof raw.lostReason === 'string' && raw.lostReason.trim().length > 0) {
          update.lost_reason = raw.lostReason.trim();
        }
      } else if (raw.lostReason === null || raw.lostReason === undefined) {
        update.lost_reason = null;
      }
    }
  } else if (raw.lostReason !== undefined) {
    update.lost_reason = typeof raw.lostReason === 'string' ? raw.lostReason.trim() || null : null;
  }

  if (raw.stagePosition !== undefined) {
    if (raw.stagePosition !== null && typeof raw.stagePosition !== 'number') {
      return NextResponse.json({ error: 'Position invalide' }, { status: 400 });
    }
    update.stage_position = raw.stagePosition;
  }

  if (typeof raw.stageChangedAt === 'string') {
    update.stage_changed_at = raw.stageChangedAt;
  }

  if (typeof raw.takenAt === 'string') {
    update.taken_at = raw.takenAt;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  const { error } = await supabase.from('leads').update(update).eq('id', leadId).eq('agency_id', agency.id);
  if (error) {
    console.error('[leads] mise à jour', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
