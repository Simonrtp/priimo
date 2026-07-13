import type { AgencyRow, ProfileRole, ProfileRow } from '@/types/database';

export type ProfileAgencyMembership = {
  agency_id: string;
  role: ProfileRole;
  agency?: AgencyRow;
};

/** Résout l'agence active (client / middleware sans SQL helper). */
export function resolveActiveAgencyId(
  profile: Pick<ProfileRow, 'agency_id' | 'active_agency_id'>,
  memberships: Pick<ProfileAgencyMembership, 'agency_id'>[],
): string {
  const memberIds = new Set(memberships.map((m) => m.agency_id));
  const candidate = profile.active_agency_id ?? profile.agency_id;
  if (memberIds.has(candidate)) return candidate;
  return profile.agency_id;
}

/** Rôle dans l'agence active. */
export function resolveActiveRole(
  profile: Pick<ProfileRow, 'agency_id' | 'role'>,
  memberships: Pick<ProfileAgencyMembership, 'agency_id' | 'role'>[],
  activeAgencyId: string,
): ProfileRole {
  const membership = memberships.find((m) => m.agency_id === activeAgencyId);
  return membership?.role ?? profile.role;
}

export function buildAgencyMemberships(
  rows: { agency_id: string; role: ProfileRole }[],
  agencies: AgencyRow[],
): ProfileAgencyMembership[] {
  const byId = new Map(agencies.map((a) => [a.id, a]));
  return rows.map((row) => ({
    agency_id: row.agency_id,
    role: row.role,
    agency: byId.get(row.agency_id),
  }));
}
