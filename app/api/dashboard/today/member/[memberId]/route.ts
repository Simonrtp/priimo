import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import {
  visibleBiensFor,
  visibleLeadsFor,
  visibleVoiceNotesFor,
} from '@/lib/agency/scope-records';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchLeads } from '@/lib/queries/leads';
import { fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { isSignedMandat } from '@/lib/today/portfolio';
import { isHomeNoteWorthy } from '@/lib/notes/inbox';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ memberId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (profile.role !== 'directeur') {
    return NextResponse.json({ error: 'Réservé au directeur' }, { status: 403 });
  }

  const { memberId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const member = members.find((m) => m.id === memberId);
  if (!member) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  const [leads, biens, notes] = await Promise.all([
    fetchLeads(supabase),
    fetchBiensSafe(supabase),
    fetchVoiceNotesSafe(supabase),
  ]);

  const visibleLeads = visibleLeadsFor(viewer, leads)
    .filter((l) => l.assignedTo === memberId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const visibleBiens = visibleBiensFor(viewer, biens)
    .filter((b) => b.createdBy === memberId && isSignedMandat(b.mandatStatut))
    .slice(0, 12);
  const memberNotes = visibleVoiceNotesFor(viewer, notes).filter((n) => n.createdBy === memberId);
  const visibleNotes = memberNotes.filter((n) => isHomeNoteWorthy(n.transcript)).slice(0, 8);

  let lastActivityAt: string | null = null;
  function consider(iso: string | null | undefined) {
    if (!iso) return;
    if (!lastActivityAt || iso > lastActivityAt) lastActivityAt = iso;
  }
  for (const n of memberNotes) consider(n.createdAt);
  for (const l of visibleLeadsFor(viewer, leads).filter((x) => x.assignedTo === memberId)) {
    consider(l.updatedAt);
  }
  for (const b of visibleBiensFor(viewer, biens).filter((x) => x.createdBy === memberId)) {
    consider(b.updatedAt);
  }

  return NextResponse.json({
    brief: {
      memberId: member.id,
      fullName: member.fullName,
      lastActivityAt,
      leads: visibleLeads.map((l) => ({ id: l.id, address: l.address, score: l.score })),
      mandats: visibleBiens.map((b) => ({
        id: b.id,
        address: b.address,
        mandatStatut: b.mandatStatut,
      })),
      notes: visibleNotes.map((n) => ({
        id: n.id,
        excerpt: (n.transcript ?? '').trim().slice(0, 180),
        createdAt: n.createdAt,
      })),
    },
  });
}
