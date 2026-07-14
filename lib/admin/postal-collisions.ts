import type { AgencyRow } from '@/types/database';

export type PostalCollision = {
  code: string;
  agencyId: string;
  agencyName: string;
};

/** Codes postaux déjà attribués à une autre agence. */
export function findPostalCollisions(
  requestedCodes: string[],
  agencies: Pick<AgencyRow, 'id' | 'name' | 'codes_postaux'>[],
  excludeAgencyId?: string,
): PostalCollision[] {
  const normalized = [...new Set(requestedCodes.map((c) => c.trim()).filter(Boolean))];
  const collisions: PostalCollision[] = [];

  for (const code of normalized) {
    for (const agency of agencies) {
      if (excludeAgencyId && agency.id === excludeAgencyId) continue;
      const codes = agency.codes_postaux ?? [];
      if (codes.includes(code)) {
        collisions.push({ code, agencyId: agency.id, agencyName: agency.name });
      }
    }
  }

  return collisions;
}
