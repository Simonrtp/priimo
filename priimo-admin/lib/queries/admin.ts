import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AgencyRow, InvitationRow, LeadRow, ProfileRow } from '@/lib/types/database';
import { getInvitationStatus } from '@/lib/utils/format';

/**
 * Lève une erreur explicite si la requête Supabase échoue.
 * Évite le piège « compteur à 0 » : une erreur (schéma, RLS, réseau) ne doit
 * JAMAIS être avalée silencieusement et affichée comme une absence de données.
 */
function unwrap<T>(
  res: { data: T | null; error: { message: string; code?: string } | null },
  ctx: string,
): T {
  if (res.error) {
    throw new Error(`[Supabase:${ctx}] ${res.error.message}${res.error.code ? ` (${res.error.code})` : ''}`);
  }
  return (res.data ?? ([] as unknown)) as T;
}

function unwrapCount(
  res: { count: number | null; error: { message: string; code?: string } | null },
  ctx: string,
): number {
  if (res.error) {
    throw new Error(`[Supabase:${ctx}] ${res.error.message}${res.error.code ? ` (${res.error.code})` : ''}`);
  }
  return res.count ?? 0;
}

export type DashboardStats = {
  agenciesCount: number;
  profilesCount: number;
  leadsCount: number;
  leadsByStatus: Record<string, number>;
  avgScore: number | null;
  leadsByOwnerType: Record<string, number>;
  invitationsPending: number;
  invitationsExpired: number;
  invitationsUsed: number;
  mlFeedbackRate: number;
  mlFeedbackBreakdown: Record<string, number>;
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const admin = createSupabaseAdminClient();

  const [agenciesRes, profilesRes, leadsRes, invitationsRes] = await Promise.all([
    admin.from('agencies').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('leads').select('status, score, owner_type, ml_feedback'),
    admin.from('invitations').select('used_at, expires_at'),
  ]);

  const agenciesCount = unwrapCount(agenciesRes, 'agencies.count');
  const profilesCount = unwrapCount(profilesRes, 'profiles.count');
  const leadRows = unwrap(leadsRes, 'leads.stats') as Pick<
    LeadRow,
    'status' | 'score' | 'owner_type' | 'ml_feedback'
  >[];
  const invRows = unwrap(invitationsRes, 'invitations.stats') as Pick<
    InvitationRow,
    'used_at' | 'expires_at'
  >[];

  const leadsByStatus: Record<string, number> = {};
  const leadsByOwnerType: Record<string, number> = {};
  const mlFeedbackBreakdown: Record<string, number> = {
    mandat_signe: 0,
    vendeur_perdu: 0,
    pas_vendeur: 0,
    injoignable: 0,
    aucun: 0,
  };

  let scoreSum = 0;
  let scoreCount = 0;
  let withFeedback = 0;

  for (const lead of leadRows) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;
    leadsByOwnerType[lead.owner_type] = (leadsByOwnerType[lead.owner_type] ?? 0) + 1;
    if (typeof lead.score === 'number') {
      scoreSum += lead.score;
      scoreCount += 1;
    }
    if (lead.ml_feedback) {
      withFeedback += 1;
      mlFeedbackBreakdown[lead.ml_feedback] = (mlFeedbackBreakdown[lead.ml_feedback] ?? 0) + 1;
    } else {
      mlFeedbackBreakdown.aucun += 1;
    }
  }

  let invitationsPending = 0;
  let invitationsExpired = 0;
  let invitationsUsed = 0;

  for (const inv of invRows) {
    const status = getInvitationStatus(inv);
    if (status === 'used') invitationsUsed += 1;
    else if (status === 'expired') invitationsExpired += 1;
    else invitationsPending += 1;
  }

  const leadsCount = leadRows.length;
  const mlFeedbackRate = leadsCount > 0 ? (withFeedback / leadsCount) * 100 : 0;

  return {
    agenciesCount,
    profilesCount,
    leadsCount,
    leadsByStatus,
    avgScore: scoreCount > 0 ? scoreSum / scoreCount : null,
    leadsByOwnerType,
    invitationsPending,
    invitationsExpired,
    invitationsUsed,
    mlFeedbackRate,
    mlFeedbackBreakdown,
  };
}

/** Leads insérés par jour sur les `days` derniers jours (séries complètes, 0 inclus). */
export type LeadsPerDayPoint = { date: string; label: string; count: number };

export async function fetchLeadsPerDay(days = 30): Promise<LeadsPerDayPoint[]> {
  const admin = createSupabaseAdminClient();

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = unwrap(
    await admin
      .from('leads')
      .select('created_at')
      .gte('created_at', since.toISOString()),
    'leads.perDay',
  ) as Pick<LeadRow, 'created_at'>[];

  // Bucket par jour (clé YYYY-MM-DD locale)
  const counts = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: LeadsPerDayPoint[] = [];
  const cursor = new Date(since);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
  for (let i = 0; i < days; i += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
      cursor.getDate(),
    ).padStart(2, '0')}`;
    out.push({ date: key, label: fmt.format(cursor), count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export type AgencyWithCounts = AgencyRow & {
  leadsCount: number;
  membersCount: number;
  statusLabel: string;
};

export async function fetchAgenciesWithCounts(): Promise<AgencyWithCounts[]> {
  const admin = createSupabaseAdminClient();
  const [agenciesRes, profilesRes, leadsRes] = await Promise.all([
    admin.from('agencies').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('agency_id'),
    admin.from('leads').select('agency_id'),
  ]);

  const agencies = unwrap(agenciesRes, 'agencies.list') as AgencyRow[];
  const profiles = unwrap(profilesRes, 'profiles.agencyId') as Pick<ProfileRow, 'agency_id'>[];
  const leads = unwrap(leadsRes, 'leads.agencyId') as Pick<LeadRow, 'agency_id'>[];

  const memberCounts = new Map<string, number>();
  for (const p of profiles) {
    memberCounts.set(p.agency_id, (memberCounts.get(p.agency_id) ?? 0) + 1);
  }

  // COUNT explicite des leads groupé par agency_id (pas de jointure silencieuse).
  const leadCounts = new Map<string, number>();
  for (const l of leads) {
    leadCounts.set(l.agency_id, (leadCounts.get(l.agency_id) ?? 0) + 1);
  }

  return agencies.map((agency) => {
    const membersCount = memberCounts.get(agency.id) ?? 0;
    const leadsCount = leadCounts.get(agency.id) ?? 0;
    const hasZone = Boolean(agency.zone_center_address || agency.zone_postal_codes?.length);
    const statusLabel = membersCount === 0 ? 'Sans membres' : hasZone ? 'Active' : 'Zone à configurer';

    return {
      ...agency,
      membersCount,
      leadsCount,
      statusLabel,
    };
  });
}

/** Les `limit` agences les plus récemment créées, avec leur nombre de leads. */
export async function fetchRecentAgencies(limit = 5): Promise<AgencyWithCounts[]> {
  const all = await fetchAgenciesWithCounts();
  return all.slice(0, limit);
}

export async function fetchAgencyDetail(id: string) {
  const admin = createSupabaseAdminClient();
  const [agencyRes, profilesRes, invitationsRes, leadsRes] = await Promise.all([
    admin.from('agencies').select('*').eq('id', id).maybeSingle(),
    admin.from('profiles').select('*').eq('agency_id', id).order('created_at'),
    admin.from('invitations').select('*').eq('agency_id', id).order('created_at', { ascending: false }),
    admin.from('leads').select('*').eq('agency_id', id).order('score', { ascending: false }),
  ]);

  if (agencyRes.error) throw new Error(`[Supabase:agency.detail] ${agencyRes.error.message}`);

  return {
    agency: agencyRes.data as AgencyRow | null,
    profiles: unwrap(profilesRes, 'agency.profiles') as ProfileRow[],
    invitations: unwrap(invitationsRes, 'agency.invitations') as InvitationRow[],
    leads: unwrap(leadsRes, 'agency.leads') as LeadRow[],
  };
}

export type LeadWithAgency = LeadRow & { agency_name: string };

export type LeadFilters = {
  agencyId?: string;
  status?: string;
  ownerType?: string;
  minScore?: number;
};

export async function fetchAllLeads(filters: LeadFilters = {}): Promise<LeadWithAgency[]> {
  const admin = createSupabaseAdminClient();
  const [agenciesRes, leadsRes] = await Promise.all([
    admin.from('agencies').select('id, name'),
    admin.from('leads').select('*').order('score', { ascending: false }),
  ]);

  const agencies = unwrap(agenciesRes, 'leads.agencyNames') as Pick<AgencyRow, 'id' | 'name'>[];
  const leads = unwrap(leadsRes, 'leads.all') as LeadRow[];

  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));

  let rows = leads.map((lead) => ({
    ...lead,
    agency_name: agencyMap.get(lead.agency_id) ?? '—',
  }));

  if (filters.agencyId) {
    rows = rows.filter((l) => l.agency_id === filters.agencyId);
  }
  if (filters.status) {
    rows = rows.filter((l) => l.status === filters.status);
  }
  if (filters.ownerType) {
    rows = rows.filter((l) => l.owner_type === filters.ownerType);
  }
  if (filters.minScore != null && !Number.isNaN(filters.minScore)) {
    rows = rows.filter((l) => l.score >= filters.minScore!);
  }

  return rows;
}

export async function fetchAgencyOptions(): Promise<{ id: string; name: string }[]> {
  const admin = createSupabaseAdminClient();
  const data = unwrap(
    await admin.from('agencies').select('id, name').order('name'),
    'agencies.options',
  ) as { id: string; name: string }[];
  return data;
}

export type ProfileWithEmail = ProfileRow & {
  email: string;
  agency_name: string;
};

export async function fetchAllProfiles(): Promise<ProfileWithEmail[]> {
  const admin = createSupabaseAdminClient();
  const [profilesRes, agenciesRes] = await Promise.all([
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
    admin.from('agencies').select('id, name'),
  ]);

  const profiles = unwrap(profilesRes, 'profiles.list') as ProfileRow[];
  const agencies = unwrap(agenciesRes, 'profiles.agencyNames') as Pick<AgencyRow, 'id' | 'name'>[];

  const agencyMap = new Map(agencies.map((a) => [a.id, a.name]));
  const emailMap = new Map<string, string>();

  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data: authData, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`[Supabase:auth.listUsers] ${error.message}`);
    for (const user of authData.users) {
      if (user.email) emailMap.set(user.id, user.email);
    }
    if (authData.users.length < perPage) break;
    page += 1;
  }

  return profiles.map((profile) => ({
    ...profile,
    email: emailMap.get(profile.id) ?? '—',
    agency_name: agencyMap.get(profile.agency_id) ?? '—',
  }));
}

export async function fetchAllInvitations(): Promise<
  (InvitationRow & { status: ReturnType<typeof getInvitationStatus> })[]
> {
  const admin = createSupabaseAdminClient();
  const data = unwrap(
    await admin.from('invitations').select('*').order('created_at', { ascending: false }),
    'invitations.list',
  ) as InvitationRow[];

  return data.map((row) => ({
    ...row,
    status: getInvitationStatus(row),
  }));
}

/** Ping léger pour l'indicateur de connexion (ne lève jamais). */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('agencies').select('*', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
