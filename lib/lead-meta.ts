import {
  Building2,
  Check,
  CircleSlash,
  FileText,
  Flame,
  Hammer,
  Handshake,
  HeartCrack,
  Pause,
  Repeat,
  ScrollText,
  TrendingUp,
  UserMinus,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Lead, LeadStatus, MlFeedback, SignalType } from '@/types/lead';

export const SIGNAL_META: Record<SignalType, { label: string; pts: number; Icon: LucideIcon; color: string }> = {
  dissolution_sci: { label: 'Dissolution SCI en cours', pts: 35, Icon: Building2, color: '#B91C1C' },
  liquidation: { label: 'Liquidation (amiable ou judiciaire)', pts: 35, Icon: ScrollText, color: '#B91C1C' },
  cession_parts: { label: 'Cession de parts sociales', pts: 30, Icon: Handshake, color: '#B45309' },
  changement_gerant: { label: 'Changement de gérant', pts: 25, Icon: UserMinus, color: '#B45309' },
  deces_associe: { label: "Décès d'associé", pts: 28, Icon: HeartCrack, color: '#7F1D1D' },
  dpe_recent: { label: 'DPE refait récemment', pts: 20, Icon: FileText, color: '#1F2937' },
  dpe_passoire: { label: 'DPE passoire (F ou G)', pts: 22, Icon: FileText, color: '#B91C1C' },
  detention_longue: { label: 'Détention longue durée', pts: 15, Icon: Pause, color: '#4B5563' },
  plus_value: { label: 'Plus-value estimée élevée', pts: 20, Icon: TrendingUp, color: '#047857' },
  travaux_recents: { label: 'Travaux récents (permis SITADEL)', pts: 18, Icon: Hammer, color: '#1F2937' },
  zone_rotation: { label: 'Zone à forte rotation', pts: 12, Icon: Repeat, color: '#3D5A80' },
};

export const STATUS_META: Record<LeadStatus, { label: string; chipClass: string; dotColor: string }> = {
  nouveau: {
    label: 'Nouveau',
    chipClass: 'bg-blue/10 text-blue-dark',
    dotColor: '#3D5A80',
  },
  contacte: {
    label: 'Contacté',
    chipClass: 'bg-accent/10 text-accent-dark',
    dotColor: '#E8743C',
  },
  interesse: {
    label: 'Intéressé',
    chipClass: 'bg-emerald-500/10 text-emerald-700',
    dotColor: '#059669',
  },
  pas_interesse: {
    label: 'Pas intéressé',
    chipClass: 'bg-black/[0.07] text-mute',
    dotColor: '#9CA3AF',
  },
  mandat_signe: {
    label: 'Mandat signé',
    chipClass: 'bg-emerald-500/20 text-emerald-800',
    dotColor: '#047857',
  },
  vendeur_ailleurs: {
    label: 'Vendeur ailleurs',
    chipClass: 'bg-violet-500/10 text-violet-800',
    dotColor: '#7C3AED',
  },
};

export const STATUS_ORDER: LeadStatus[] = [
  'nouveau',
  'contacte',
  'interesse',
  'mandat_signe',
  'pas_interesse',
  'vendeur_ailleurs',
];

export const ML_FEEDBACK_OPTIONS: {
  value: NonNullable<MlFeedback>;
  label: string;
  Icon: LucideIcon;
  color: string;
}[] = [
  { value: 'mandat_signe', label: 'Mandat signé', Icon: Check, color: '#047857' },
  { value: 'vendeur_ailleurs', label: 'Vendu ailleurs', Icon: Flame, color: '#3D5A80' },
  { value: 'pas_vendeur', label: 'Pas vendeur', Icon: X, color: '#B91C1C' },
  { value: 'pas_contacte', label: 'Pas contacté', Icon: CircleSlash, color: '#6B7280' },
];

export function statusLabel(status: LeadStatus): string {
  return STATUS_META[status].label;
}

const KNOWN_SIGNAL_TYPES = new Set<string>(Object.keys(SIGNAL_META));

export function isKnownSignalType(type: string): type is SignalType {
  return KNOWN_SIGNAL_TYPES.has(type);
}

export function getMainSignalLabel(lead: Pick<Lead, 'signals' | 'mainSignalLabel'>): string {
  if (lead.mainSignalLabel?.trim()) return lead.mainSignalLabel.trim();
  if (lead.signals.length === 0) return 'Signal détecté';
  const top = [...lead.signals].sort((a, b) => b.pts - a.pts)[0];
  if (!top) return 'Signal détecté';
  return top.label || (isKnownSignalType(top.type) ? SIGNAL_META[top.type].label : 'Signal détecté');
}

export function uniqueSignalTypes(leads: Lead[]): SignalType[] {
  const set = new Set<SignalType>();
  for (const lead of leads) {
    for (const s of lead.signals) {
      if (isKnownSignalType(s.type)) set.add(s.type);
    }
  }
  return Array.from(set);
}
