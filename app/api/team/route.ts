import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { AgencyScopeError, fetchMembersOfMyAgency } from '@/lib/queries/agency-members';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const isDirector = profile.role === 'directeur';

  try {
    const members = await fetchMembersOfMyAgency(agency.id, memberships, {
      includeEmail: isDirector,
      includeStats: isDirector,
    });
    return NextResponse.json({ members });
  } catch (err) {
    if (err instanceof AgencyScopeError) {
      return NextResponse.json({ error: 'Agence hors périmètre' }, { status: 403 });
    }
    console.error('[team] lecture', err);
    return NextResponse.json({ error: "Impossible de charger l'équipe" }, { status: 500 });
  }
}
