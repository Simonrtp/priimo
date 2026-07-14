import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ProfileRole } from '@/types/database';

export interface TeamMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: ProfileRole;
}

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: links, error: linksErr } = await admin
    .from('profile_agencies')
    .select('profile_id, role')
    .eq('agency_id', agency.id);
  if (linksErr) {
    return NextResponse.json({ error: linksErr.message }, { status: 500 });
  }

  const profileIds = (links ?? []).map((l) => l.profile_id);
  if (profileIds.length === 0) {
    return NextResponse.json({ members: [] });
  }

  const roleByProfileId = new Map((links ?? []).map((l) => [l.profile_id, l.role as ProfileRole]));

  const { data: profiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', profileIds);
  if (profilesErr) {
    return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  }

  const { data: usersList, error: usersErr } = await admin.auth.admin.listUsers();
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }
  const emailById = new Map<string, string>();
  for (const u of usersList.users) {
    if (u.email) emailById.set(u.id, u.email);
  }

  const members: TeamMemberDto[] = (profiles ?? [])
    .map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      role: roleByProfileId.get(p.id) ?? 'collaborateur',
      email: emailById.get(p.id) ?? '',
    }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'directeur' ? -1 : 1;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

  return NextResponse.json({ members });
}
