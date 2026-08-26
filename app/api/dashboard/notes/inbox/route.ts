import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleVoiceNotesFor } from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import {
  filterInboxNotes,
  type NotesInboxPeriod,
  type NotesInboxRattachement,
  type NotesInboxScope,
  type NotesInboxStatut,
} from '@/lib/notes/inbox';

export const runtime = 'nodejs';

function asStatut(raw: string | null): NotesInboxStatut {
  if (raw === 'brute' || raw === 'revue') return raw;
  return 'tous';
}

function asScope(raw: string | null): NotesInboxScope {
  return raw === 'agence' ? 'agence' : 'moi';
}

function asPeriod(raw: string | null): NotesInboxPeriod {
  if (raw === '7j' || raw === '30j') return raw;
  return 'tous';
}

function asRattachement(raw: string | null): NotesInboxRattachement {
  if (raw === 'rattachees' || raw === 'orphelines') return raw;
  return 'tous';
}

export async function GET(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const url = new URL(req.url);
  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const [all, members] = await Promise.all([
    fetchVoiceNotesSafe(supabase),
    fetchMembersOfMyAgency(agency.id, memberships),
  ]);
  const visible = visibleVoiceNotesFor(viewer, all);
  const names = new Map(members.map((m) => [m.id, m.fullName]));

  const filtered = filterInboxNotes(visible, {
    viewerId: profile.id,
    statut: asStatut(url.searchParams.get('statut')),
    scope: asScope(url.searchParams.get('scope')),
    period: asPeriod(url.searchParams.get('period')),
    rattachement: asRattachement(url.searchParams.get('rattachement')),
    q: url.searchParams.get('q') ?? '',
    auteurId: url.searchParams.get('membre')?.trim() || null,
  });

  return NextResponse.json({
    notes: filtered.map((n) => ({
      ...n,
      authorName: n.createdBy ? names.get(n.createdBy) ?? null : null,
    })),
  });
}
