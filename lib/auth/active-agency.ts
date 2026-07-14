import type { ProfileRole } from '@/types/database';

export type ProfileAgencyMembership = {
  agency_id: string;
  role: ProfileRole;
  agency?: import('@/types/database').AgencyRow;
};

/** Vérifie qu'un utilisateur appartient à une agence (garde app + tests RLS). */
export function canAccessAgency(
  memberships: Pick<ProfileAgencyMembership, 'agency_id'>[],
  agencyId: string,
): boolean {
  return memberships.some((m) => m.agency_id === agencyId);
}

/** Résout l'agence active depuis les memberships + active_agency_id. */
export function resolveActiveAgencyId(
  profile: { active_agency_id?: string | null },
  memberships: Pick<ProfileAgencyMembership, 'agency_id'>[],
): string | null {
  if (memberships.length === 0) return null;

  const memberIds = new Set(memberships.map((m) => m.agency_id));
  const candidate = profile.active_agency_id;
  if (candidate && memberIds.has(candidate)) return candidate;

  return memberships[0]!.agency_id;
}

/** Rôle dans l'agence active (source : profile_agencies). */
export function resolveActiveRole(
  memberships: Pick<ProfileAgencyMembership, 'agency_id' | 'role'>[],
  activeAgencyId: string,
): ProfileRole | null {
  const membership = memberships.find((m) => m.agency_id === activeAgencyId);
  return membership?.role ?? null;
}

export function buildAgencyMemberships(
  rows: { agency_id: string; role: ProfileRole }[],
  agencies: import('@/types/database').AgencyRow[],
): ProfileAgencyMembership[] {
  const byId = new Map(agencies.map((a) => [a.id, a]));
  return rows.map((row) => ({
    agency_id: row.agency_id,
    role: row.role,
    agency: byId.get(row.agency_id),
  }));
}
