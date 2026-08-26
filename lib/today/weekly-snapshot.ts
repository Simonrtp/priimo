import { startOfWeekYmd, ymdKey } from '@/lib/today/calendar';
import type { PortfolioPreviousWeek } from '@/lib/today/portfolio';

export type WeeklyPortfolioSnapshot = {
  weekStart: string;
  mandatsActifs: number;
  leadsNonPris: number;
  rdvSansSuite: number;
  mandats60j: number;
};

export function mondayOf(date = new Date()): string {
  return ymdKey(startOfWeekYmd(date));
}

export function previousMonday(date = new Date()): string {
  const start = startOfWeekYmd(date);
  const utc = Date.UTC(start.y, start.m - 1, start.d - 7, 12, 0, 0);
  const d = new Date(utc);
  return ymdKey({
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    weekday: d.getUTCDay(),
  });
}

export function toPreviousWeek(
  snap: WeeklyPortfolioSnapshot | null,
): PortfolioPreviousWeek | null {
  if (!snap) return null;
  return {
    mandatsActifs: snap.mandatsActifs,
    leadsNonPris: snap.leadsNonPris,
    rdvSansSuite: snap.rdvSansSuite,
    mandats60j: snap.mandats60j,
  };
}
