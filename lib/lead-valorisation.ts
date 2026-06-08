import { formatPrice } from '@/lib/utils';

export type ValorisationLeadFields = {
  acquiredYear: number | null;
  acquiredPrice: number | null;
  acquiredPriceReliable: boolean | null;
  estimatedValue: number | null;
  estimationLow: number | null;
  estimationHigh: number | null;
  estimationConfidence: string | null;
  estimationBasis: string | null;
  plusValuePct: number | null;
};

/** Même règle que la liste (LeadCard) : prix fiable si reliable !== false et montant > 0. */
export function hasReliableAcquiredPrice(
  lead: Pick<ValorisationLeadFields, 'acquiredPrice' | 'acquiredPriceReliable'>,
): boolean {
  return lead.acquiredPrice != null && lead.acquiredPrice > 0 && lead.acquiredPriceReliable !== false;
}

/** Affichage strict volet : reliable === true uniquement (spec produit). */
export function hasDisplayableAcquiredPrice(
  lead: Pick<ValorisationLeadFields, 'acquiredPrice' | 'acquiredPriceReliable'>,
): boolean {
  return lead.acquiredPrice != null && lead.acquiredPrice > 0 && lead.acquiredPriceReliable === true;
}

export function formatAcquiredPriceLine(
  lead: Pick<ValorisationLeadFields, 'acquiredYear' | 'acquiredPrice' | 'acquiredPriceReliable'>,
  options?: { strictReliable?: boolean },
): string {
  const ok = options?.strictReliable ? hasDisplayableAcquiredPrice(lead) : hasReliableAcquiredPrice(lead);
  if (!ok || lead.acquiredPrice == null) return 'Prix d\u2019achat indisponible';
  const price = `${formatPrice(lead.acquiredPrice)} \u20ac`;
  if (lead.acquiredYear != null) return `Achet\u00e9 en ${lead.acquiredYear} \u2014 ${price}`;
  return `Achet\u00e9 \u2014 ${price}`;
}

export function hasEstimation(
  lead: Pick<ValorisationLeadFields, 'estimatedValue'>,
): boolean {
  return lead.estimatedValue != null && lead.estimatedValue > 0;
}

export function formatEstimationRange(
  lead: Pick<ValorisationLeadFields, 'estimatedValue' | 'estimationLow' | 'estimationHigh'>,
): string | null {
  if (!hasEstimation(lead)) return null;
  const low = lead.estimationLow ?? lead.estimatedValue!;
  const high = lead.estimationHigh ?? lead.estimatedValue!;
  return `${formatPrice(low)} \u2013 ${formatPrice(high)} \u20ac`;
}

export function formatPlusValuePct(pct: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(pct);
  return `${formatted} % depuis l\u2019achat`;
}

export function formatEstimationConfidence(confidence: string | null): string | null {
  if (!confidence?.trim()) return null;
  const c = confidence.trim().toLowerCase();
  if (c === 'élevée' || c === 'elevee') return 'Confiance élevée';
  if (c === 'moyenne') return 'Confiance moyenne';
  if (c === 'faible') return 'Confiance faible';
  return `Confiance ${confidence.trim().toLowerCase()}`;
}
