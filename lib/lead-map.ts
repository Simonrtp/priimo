import type { Lead } from '@/types/lead';
import { formatLeadAddressQuery } from '@/lib/utils';

export interface LeadMapPoint {
  leadId: string;
  latitude: number;
  longitude: number;
  address: string;
  score: number;
}

export function leadToAddressQuery(lead: Pick<Lead, 'address' | 'postalCode' | 'city'>): string {
  return formatLeadAddressQuery(lead);
}

export function scoreMarkerColor(score: number): string {
  if (score >= 80) return '#E85D2C';
  if (score >= 60) return '#F4A462';
  if (score >= 40) return '#F59E0B';
  return '#94A3B8';
}
