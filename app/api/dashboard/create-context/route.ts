import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor } from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchContactsSafe } from '@/lib/queries/contacts';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Membres et vendeurs pour le menu Nouveau, depuis n'importe quel écran. */
export async function GET() {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const [members, contacts] = await Promise.all([
    fetchMembersOfMyAgency(agency.id, memberships),
    fetchContactsSafe(supabase),
  ]);
  const visible = visibleContactsFor(viewerFromProfile(profile), contacts);

  return NextResponse.json({
    members: members.map((m) => ({ id: m.id, fullName: m.fullName })),
    vendeurs: visible.filter((c) => c.type === 'vendeur'),
  });
}
