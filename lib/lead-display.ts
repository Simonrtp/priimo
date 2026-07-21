import type { Lead, LeadSignal, SignalType } from '@/types/lead';
import { SIGNAL_META } from '@/lib/lead-meta';

export const SIGNAL_EMOJI: Record<SignalType, string> = {
  dissolution_sci: '🏢',
  liquidation: '📋',
  cession_parts: '🤝',
  changement_gerant: '👤',
  deces_associe: '💔',
  dpe_recent: '⚡',
  dpe_passoire: '🌡️',
  detention_longue: '🏠',
  plus_value: '💶',
  travaux_recents: '🔨',
  zone_rotation: '📍',
};

const BACKEND_SIGNAL_EMOJI: Record<string, string> = {
  duree_detention: '🏠',
  dpe_classe: '🌡️',
  synergie_pic_passoire: '🔥',
  surface_grande: '📏',
};

export function signalEmoji(type: string, label?: string): string {
  if (label && /combinaison/i.test(label)) return '🔥';
  if (BACKEND_SIGNAL_EMOJI[type]) return BACKEND_SIGNAL_EMOJI[type];
  if (type in SIGNAL_EMOJI) return SIGNAL_EMOJI[type as SignalType];
  return '•';
}

export function getDetentionYears(acquiredYear: number | null): number | null {
  if (acquiredYear == null || acquiredYear <= 0) return null;
  const years = new Date().getFullYear() - acquiredYear;
  if (years < 0) return null;
  return years;
}

export function formatDetentionYearsLabel(years: number): string {
  return years === 1 ? '1 an' : `${years} ans`;
}

export function formatDetentionPrimary(acquiredYear: number | null): string | null {
  const years = getDetentionYears(acquiredYear);
  if (years == null) return null;
  return `Propriétaire depuis ${formatDetentionYearsLabel(years)}`;
}

export function formatDetentionSecondary(acquiredYear: number | null): string | null {
  if (acquiredYear == null) return null;
  return `(acquis en ${acquiredYear})`;
}

export function formatDetentionLong(acquiredYear: number | null): string | null {
  const years = getDetentionYears(acquiredYear);
  if (years == null || acquiredYear == null) return null;
  return `Détention : ${formatDetentionYearsLabel(years)} (acquis en ${acquiredYear})`;
}

function metaForType(type: string) {
  return type in SIGNAL_META ? SIGNAL_META[type as SignalType] : undefined;
}

export function sortSignalsByPts(signals: LeadSignal[]): LeadSignal[] {
  return [...signals].sort((a, b) => resolveSignalPts(b) - resolveSignalPts(a));
}

export function resolveSignalPts(signal: LeadSignal): number {
  if (signal.pts > 0) return signal.pts;
  return metaForType(signal.type)?.pts ?? 0;
}

export function resolveSignalLabel(signal: LeadSignal): string {
  return signal.label || metaForType(signal.type)?.label || 'Signal';
}

export function isPassoireSignal(signal: LeadSignal): boolean {
  return (
    signal.type === 'dpe_passoire' ||
    signal.type === 'dpe_classe' ||
    /passoire/i.test(signal.label)
  );
}

export function isDpeRecentSignal(signal: LeadSignal): boolean {
  return signal.type === 'dpe_recent' || /dpe.*récent/i.test(signal.label);
}

export function isActiveLeadStatus(status: Lead['status']): boolean {
  return status !== 'pas_interesse' && status !== 'vendeur_ailleurs';
}

/**
 * Formate l'étage à partir du champ texte `etage` ("RDC", "1", "2"…).
 * - "RDC"/"0" -> "Rez-de-chaussée" ; "1" -> "1er étage" ; N>=2 -> "Ne étage".
 * - Une maison n'affiche jamais d'étage (peu pertinent).
 * - Valeur absente ou non exploitable -> null (rien affiché).
 */
export function formatEtage(
  etage: string | null | undefined,
  propertyType: string | null | undefined,
): string | null {
  if (!etage) return null;
  if (propertyType === 'Maison') return null;
  const raw = etage.trim();
  if (!raw) return null;
  if (/^rdc$/i.test(raw)) return 'Rez-de-chaussée';
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  if (n <= 0) return 'Rez-de-chaussée';
  if (n === 1) return '1er étage';
  return `${n}e étage`;
}
