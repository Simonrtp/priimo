import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type AdminDirectorDto = {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  agencies: { id: string; name: string }[];
};

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();

  const { data: memberships, error: memErr } = await admin
    .from('profile_agencies')
    .select('profile_id, agency_id, role')
    .eq('role', 'directeur');
  if (memErr) {
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const directorIds = [...new Set((memberships ?? []).map((m) => m.profile_id))];
  if (directorIds.length === 0) {
    return NextResponse.json({ directors: [] });
  }

  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', directorIds);
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  const agencyIds = [...new Set((memberships ?? []).map((m) => m.agency_id))];
  const { data: agencies, error: agErr } = await admin
    .from('agencies')
    .select('id, name')
    .in('id', agencyIds);
  if (agErr) {
    return NextResponse.json({ error: agErr.message }, { status: 500 });
  }

  const agencyById = new Map((agencies ?? []).map((a) => [a.id, a]));
  const memsByProfile = new Map<string, typeof memberships>();
  for (const m of memberships ?? []) {
    const list = memsByProfile.get(m.profile_id) ?? [];
    list.push(m);
    memsByProfile.set(m.profile_id, list);
  }

  const { data: usersList, error: usersErr } = await admin.auth.admin.listUsers();
  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }
  const emailById = new Map<string, string>();
  for (const u of usersList.users) {
    if (u.email) emailById.set(u.id, u.email);
  }

  const directors: AdminDirectorDto[] = (profiles ?? []).map((p) => ({
    profileId: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    email: emailById.get(p.id) ?? '',
    agencies: (memsByProfile.get(p.id) ?? [])
      .map((m) => agencyById.get(m.agency_id))
      .filter(Boolean)
      .map((a) => ({ id: a!.id, name: a!.name })),
  }));

  directors.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
  );

  return NextResponse.json({ directors });
}
