import { scoreColor } from '@/lib/score-color';
import type { ContactType } from '@/types/contact';

export const MAP_KIND_LABELS = {
  lead: 'Prospects',
  contact: 'Contacts',
  bien: 'Biens',
  note: 'Notes terrain',
} as const;

export const NOTE_MARKER_COLOR = '#64748B';

/** Pastille unique des prospects sur le terrain — le score ne colore plus. */
export const LEAD_FIELD_COLOR = '#E8743C';

export const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  vendeur: '#C25E2C',
  acquereur: '#3D5A80',
  locataire: '#0F766E',
  gardien: '#4C5D73',
  commercant: '#5A6F7A',
  autre: '#64748B',
};

export const BIEN_MARKER_COLOR = '#1E3148';

export function leadMarkerColor(score: number): string {
  return scoreColor(score);
}

function hexLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return 0;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Texte lisible sur la pastille colorée du marqueur. */
export function markerBadgeColor(backgroundHex: string): string {
  return hexLuminance(backgroundHex) < 150 ? '#FFFFFF' : '#15110F';
}
