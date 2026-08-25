import { canAccessAgency } from '@/lib/auth/active-agency';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ProfileRole } from '@/types/database';

export class AgencyScopeError extends Error {
  constructor() {
    super('Agence hors périmètre');
    this.name = 'AgencyScopeError';
  }
}

/**
 * Filet applicatif : l'admin client contourne le RLS, donc chaque lecture
 * « membres d'une agence » doit d'abord prouver que le visiteur en est membre.
 */
export function assertAgencyScope(
  memberships: readonly { agency_id: string }[],
  agencyId: string,
): void {
  if (!agencyId || !canAccessAgency(memberships, agencyId)) {
    throw new AgencyScopeError();
  }
}

export type AgencyMember = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: ProfileRole;
  email: string;
  contactCount: number;
  leadCount: number;
};

export type FetchAgencyMembersOptions = {
  includeEmail?: boolean;
  includeStats?: boolean;
};

export function buildFullName(firstName: string, lastName: string): string {
  return [firstName, lastName].map((s) => s.trim()).filter(Boolean).join(' ') || 'Sans nom';
}

export function memberNamesById(members: readonly AgencyMember[]): Map<string, string> {
  return new Map(members.map((m) => [m.id, m.fullName]));
}

export function memberIdSet(members: readonly { id: string }[]): Set<string> {
  return new Set(members.map((m) => m.id));
}

export function sortAgencyMembers(members: AgencyMember[]): AgencyMember[] {
  return [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'directeur' ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, 'fr');
  });
}

export function tallyByOwner(rows: readonly { ownerId: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.ownerId) continue;
    counts.set(row.ownerId, (counts.get(row.ownerId) ?? 0) + 1);
  }
  return counts;
}

async function emailsForProfiles(
  ids: string[],
): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient();
  const emailById = new Map<string, string>();
  const results = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user?.email) return [id, ''] as const;
      return [id, data.user.email] as const;
    }),
  );
  for (const [id, email] of results) emailById.set(id, email);
  return emailById;
}

/**
 * Collègues de *mon* agence. Toujours appeler avec l'agence active du
 * visiteur (getServerUser), jamais un identifiant fourni par le client.
 *
 * Sert à la page « Mon équipe » et, plus tard, au champ « Assigner à ».
 */
export async function fetchMembersOfMyAgency(
  agencyId: string,
  memberships: readonly { agency_id: string }[],
  options: FetchAgencyMembersOptions = {},
): Promise<AgencyMember[]> {
  assertAgencyScope(memberships, agencyId);

  const admin = createSupabaseAdminClient();
  const { data: links, error: linksErr } = await admin
    .from('profile_agencies')
    .select('profile_id, role')
    .eq('agency_id', agencyId);
  if (linksErr) throw new Error(linksErr.message);

  const rows = links ?? [];
  const profileIds = rows.map((l) => l.profile_id);
  if (profileIds.length === 0) return [];

  const roleById = new Map(rows.map((l) => [l.profile_id, l.role as ProfileRole]));

  const { data: profiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', profileIds);
  if (profilesErr) throw new Error(profilesErr.message);

  const emailById = options.includeEmail ? await emailsForProfiles(profileIds) : new Map<string, string>();

  let contactCounts = new Map<string, number>();
  let leadCounts = new Map<string, number>();
  if (options.includeStats) {
    const [contactsRes, leadsRes] = await Promise.all([
      admin.from('contacts').select('assigned_to, created_by').eq('agency_id', agencyId),
      admin.from('leads').select('assigned_to').eq('agency_id', agencyId),
    ]);
    const contactRows = contactsRes.error
      ? ((
          await admin.from('contacts').select('created_by').eq('agency_id', agencyId)
        ).data ?? [])
      : (contactsRes.data ?? []);
    contactCounts = tallyByOwner(
      contactRows.map((r) => {
        const assigned = 'assigned_to' in r && typeof r.assigned_to === 'string' ? r.assigned_to : null;
        const created = typeof r.created_by === 'string' ? r.created_by : null;
        return { ownerId: assigned ?? created };
      }),
    );
    if (!leadsRes.error) {
      leadCounts = tallyByOwner(
        (leadsRes.data ?? []).map((r) => ({ ownerId: r.assigned_to })),
      );
    }
  }

  const members: AgencyMember[] = (profiles ?? []).map((p) => {
    const firstName = (p.first_name ?? '').trim();
    const lastName = (p.last_name ?? '').trim();
    return {
      id: p.id,
      firstName,
      lastName,
      fullName: buildFullName(firstName, lastName),
      role: roleById.get(p.id) ?? 'collaborateur',
      email: emailById.get(p.id) ?? '',
      contactCount: contactCounts.get(p.id) ?? 0,
      leadCount: leadCounts.get(p.id) ?? 0,
    };
  });

  return sortAgencyMembers(members);
}
