import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import type { AgencyRow, ProfileRow } from '@/types/database';

export type RequireDirectorResult =
  | { ok: true; user: { id: string; email: string }; profile: ProfileRow; agency: AgencyRow }
  | { ok: false; response: NextResponse };

export async function requireDirector(): Promise<RequireDirectorResult> {
  const { user, profile, agency } = await getServerUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
    };
  }
  if (!profile || !agency) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Profil introuvable' }, { status: 403 }),
    };
  }
  if (profile.role !== 'directeur') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Réservé aux directeurs' }, { status: 403 }),
    };
  }
  return { ok: true, user, profile, agency };
}
