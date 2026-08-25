import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';
import { countLatestBatchLeads } from '@/lib/lead-delivery';

/** Chiffres de fond affichés quand la pile du jour est vide. */
export interface TodayPortfolioSnapshot {
  contactCount: number;
  bienCount: number;
  acquereurCount: number;
  leadsNonTraites: number;
  newBatchCount: number;
}

export function buildTodayPortfolioSnapshot(
  leads: readonly Lead[],
  contacts: readonly Contact[],
  bienCount: number,
): TodayPortfolioSnapshot {
  return {
    contactCount: contacts.length,
    bienCount,
    acquereurCount: contacts.filter((c) => c.type === 'acquereur').length,
    leadsNonTraites: leads.filter((l) => l.status === 'nouveau').length,
    newBatchCount: countLatestBatchLeads([...leads]),
  };
}
