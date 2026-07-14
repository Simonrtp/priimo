/** True when the agency has no configured address or prospection sector yet. */
export function agencyNeedsOnboarding(agency: {
  address?: string | null;
  codes_postaux?: string[] | null;
} | null): boolean {
  if (!agency) return false;

  const address = agency.address?.trim();
  const codes = agency.codes_postaux;
  if (address && address.length >= 5 && codes && codes.length > 0) {
    return false;
  }

  return true;
}
