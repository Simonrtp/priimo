import type { AgencyRow } from '@/types/database';

/** Libellé court pour la sidebar (max 3 codes postaux visibles). */
export function formatZoneSidebarLabel(agency: AgencyRow): string | null {
  const codes = agency.codes_postaux;
  if (!codes || codes.length === 0) return null;

  const sorted = [...codes].sort();
  if (sorted.length <= 3) return `Secteur : ${sorted.join(', ')}`;
  return `Secteur : ${sorted.slice(0, 3).join(', ')} +${sorted.length - 3}`;
}
