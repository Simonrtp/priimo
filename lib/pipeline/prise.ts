import { parisYmd } from '@/lib/today/calendar';

export type PriseStatLead = {
  deliveredAt: string;
  stageId: string | null;
};

export type PriseStats = {
  delivered: number;
  pris: number;
  pct: number;
};

/** Leads livrés ce mois (Europe/Paris) et part déjà prise. */
export function priseStats(leads: readonly PriseStatLead[], now = new Date()): PriseStats {
  const { y, m } = parisYmd(now);
  const monthPrefix = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  const deliveredThisMonth = leads.filter((lead) => lead.deliveredAt.slice(0, 7) === monthPrefix);
  const pris = deliveredThisMonth.filter((lead) => lead.stageId != null).length;
  const delivered = deliveredThisMonth.length;
  return {
    delivered,
    pris,
    pct: delivered === 0 ? 0 : Math.round((pris / delivered) * 100),
  };
}

export function formatPriseLine(stats: PriseStats): string {
  const leadWord = stats.delivered === 1 ? 'lead livré' : 'leads livrés';
  const prisWord = stats.pris === 1 ? 'pris' : 'pris';
  if (stats.delivered === 0) return `0 ${leadWord} ce mois · 0 ${prisWord}`;
  return `${stats.delivered} ${leadWord} ce mois · ${stats.pris} ${prisWord} (${stats.pct} %)`;
}
