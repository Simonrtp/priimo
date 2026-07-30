import type { Lead } from '@/types/lead';

export type ProspectsSortMode = 'score' | 'dpe_recent' | 'joignables';

export const PROSPECTS_SORT_LABELS: Record<ProspectsSortMode, string> = {
  score: 'Score',
  dpe_recent: 'DPE le plus récent',
  joignables: "Joignables d'abord",
};

export type DpeFreshnessTier = 'hot' | 'recent';

/** Jours écoulés depuis la date DPE (date du jour locale, minuit). */
export function daysSinceDpe(dpeDate: string | null, refDate: Date = new Date()): number | null {
  if (!dpeDate) return null;
  const dpe = new Date(dpeDate);
  if (Number.isNaN(dpe.getTime())) return null;
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const dpeDay = new Date(dpe.getFullYear(), dpe.getMonth(), dpe.getDate());
  const diffMs = today.getTime() - dpeDay.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function dpeFreshnessTier(days: number | null): DpeFreshnessTier | null {
  if (days === null || days < 0) return null;
  if (days < 30) return 'hot';
  if (days < 60) return 'recent';
  return null;
}

export function getDpeFreshnessTier(lead: Pick<Lead, 'dpeDate'>): DpeFreshnessTier | null {
  return dpeFreshnessTier(daysSinceDpe(lead.dpeDate));
}

export function isDpeUnder30Days(lead: Pick<Lead, 'dpeDate'>): boolean {
  const days = daysSinceDpe(lead.dpeDate);
  return days !== null && days < 30;
}

export function getLeadSourceLabels(lead: Pick<Lead, 'ownerType' | 'dpeDate'>): string[] {
  const labels: string[] = [lead.ownerType === 'entreprise' ? 'BODACC' : 'DVF'];
  if (lead.dpeDate) labels.push('DPE');
  return labels;
}

export function sortProspects(leads: Lead[], mode: ProspectsSortMode): Lead[] {
  const copy = [...leads];
  if (mode === 'dpe_recent') {
    return copy.sort((a, b) => {
      const aTime = a.dpeDate ? new Date(a.dpeDate).getTime() : Number.NEGATIVE_INFINITY;
      const bTime = b.dpeDate ? new Date(b.dpeDate).getTime() : Number.NEGATIVE_INFINITY;
      if (bTime !== aTime) return bTime - aTime;
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  if (mode === 'joignables') {
    const rank = (c: Lead['contactabilite']): number => {
      switch (c) {
        case 'direct':
          return 0;
        case 'nominatif':
          return 1;
        case 'immeuble':
          return 2;
        case 'aucun':
          return 3;
        default:
          return 4;
      }
    };
    return copy.sort((a, b) => {
      const ra = rank(a.contactabilite);
      const rb = rank(b.contactabilite);
      if (ra !== rb) return ra - rb;
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  return copy.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
