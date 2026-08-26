import { NextResponse } from 'next/server';
import { assignmentMeta } from '@/lib/agency/assignees';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  applyMergeChoices,
  emptyLinkCounts,
  MERGE_LINK_TARGETS,
  parseMergeChoices,
  transferredCounts,
  type MergeLinkCounts,
} from '@/lib/contacts/merge';
import {
  contactPatchToRow,
  fetchContactById,
} from '@/lib/queries/contacts';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function countEq(admin: Admin, table: string, column: string, id: string): Promise<number> {
  const { count, error } = await admin
    .from(table as 'contact_interactions')
    .select('id', { count: 'exact', head: true })
    .eq(column as 'contact_id', id);
  if (error) return 0;
  return count ?? 0;
}

async function countNotes(admin: Admin, contactId: string): Promise<number> {
  const { count, error } = await admin
    .from('note_liens')
    .select('id', { count: 'exact', head: true })
    .eq('entite_type', 'contact')
    .eq('entite_id', contactId);
  if (error) return 0;
  return count ?? 0;
}

async function countAll(admin: Admin, contactId: string): Promise<MergeLinkCounts> {
  const out = emptyLinkCounts();
  for (const t of MERGE_LINK_TARGETS) {
    out[t.key] = await countEq(admin, t.table, t.column, contactId);
  }
  out.notes = await countNotes(admin, contactId);
  return out;
}

async function reassignEq(admin: Admin, table: string, column: string, fromId: string, toId: string) {
  const { error } = await admin
    .from(table as 'contact_interactions')
    .update({ [column]: toId } as never)
    .eq(column as 'contact_id', fromId);
  if (error) console.error(`[contacts/merge] ${table}`, error);
}

export async function POST(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { contactId: keepId } = await ctx.params;
  if (!keepId) return NextResponse.json({ error: 'Contact inconnu' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const absorbId = typeof raw.absorbId === 'string' ? raw.absorbId : '';
  const choices = parseMergeChoices(raw.fields);
  if (!absorbId || absorbId === keepId || !choices) {
    return NextResponse.json({ error: 'Fusion invalide' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const [keep, absorb] = await Promise.all([
    fetchContactById(supabase, keepId),
    fetchContactById(supabase, absorbId),
  ]);
  const viewer = viewerFromProfile(profile);
  if (
    !keep ||
    !absorb ||
    keep.agencyId !== agency.id ||
    absorb.agencyId !== agency.id ||
    !canSeeOwnedRecord(viewer, { assignedTo: keep.assignedTo, createdBy: keep.createdBy }) ||
    !canSeeOwnedRecord(viewer, { assignedTo: absorb.assignedTo, createdBy: absorb.createdBy })
  ) {
    return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const beforeKeep = await countAll(admin, keepId);
  const beforeAbsorb = await countAll(admin, absorbId);

  for (const t of MERGE_LINK_TARGETS) {
    await reassignEq(admin, t.table, t.column, absorbId, keepId);
  }

  const { data: absorbLiens } = await admin
    .from('note_liens')
    .select('id, note_id')
    .eq('entite_type', 'contact')
    .eq('entite_id', absorbId);
  for (const lien of absorbLiens ?? []) {
    const { error } = await admin
      .from('note_liens')
      .update({ entite_id: keepId })
      .eq('id', (lien as { id: string }).id);
    if (error) {
      await admin.from('note_liens').delete().eq('id', (lien as { id: string }).id);
    }
  }

  const patch = applyMergeChoices(keep, absorb, choices);
  const row = contactPatchToRow(patch);
  if (patch.assignedTo !== undefined) {
    Object.assign(row, assignmentMeta(patch.assignedTo, profile.id));
  }
  const nextLeadId = keep.leadId || absorb.leadId;
  Object.assign(row, {
    lead_id: nextLeadId,
    doublon_de: keep.doublonDe === absorbId ? null : keep.doublonDe,
  });

  const { error: patchError } = await admin
    .from('contacts')
    .update(row)
    .eq('id', keepId)
    .eq('agency_id', agency.id);
  if (patchError) {
    console.error('[contacts/merge] patch', patchError);
    return NextResponse.json({ error: 'Le report des champs a échoué' }, { status: 500 });
  }

  await admin
    .from('contacts')
    .update({ doublon_de: keepId })
    .eq('doublon_de', absorbId)
    .eq('agency_id', agency.id);

  const afterTransferKeep = await countAll(admin, keepId);
  const afterTransferAbsorb = await countAll(admin, absorbId);

  const { error: deleteError } = await admin
    .from('contacts')
    .delete()
    .eq('id', absorbId)
    .eq('agency_id', agency.id);

  if (deleteError) {
    console.error('[contacts/merge] delete', deleteError);
    return NextResponse.json(
      {
        error: 'Le report est fait, mais la fiche absorbée n’a pas pu être supprimée',
        counts: {
          before: { keep: beforeKeep, absorb: beforeAbsorb },
          after: { keep: afterTransferKeep, absorb: afterTransferAbsorb },
          transferred: transferredCounts(beforeKeep, beforeAbsorb),
        },
      },
      { status: 500 },
    );
  }

  const refreshed = await fetchContactById(supabase, keepId);
  const afterKeep = await countAll(admin, keepId);

  return NextResponse.json({
    contact: refreshed ?? keep,
    absorbedId: absorbId,
    counts: {
      before: { keep: beforeKeep, absorb: beforeAbsorb },
      after: { keep: afterKeep },
      transferred: transferredCounts(beforeKeep, beforeAbsorb),
    },
  });
}
