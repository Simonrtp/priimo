import type { Lead } from '@/types/lead';

/** Découpe « rue, code postal ville » pour l’en-tête drawer. */
export function splitStreetAndCity(address: string): { streetLine: string; cityZipLine: string } {
  const idx = address.lastIndexOf(',');
  if (idx === -1) return { streetLine: address.trim(), cityZipLine: '' };
  const streetLine = address.slice(0, idx).trim();
  const tail = address.slice(idx + 1).trim();
  const m = tail.match(/^(\d{5})\s+(.+)$/);
  const cityZipLine = m ? `${m[2]} · ${m[1]}` : tail;
  return { streetLine, cityZipLine };
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price);
}

export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function getYearsBetween(dateString: string, now = new Date()): number {
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export function getMonthsBetween(dateString: string, now = new Date()): number {
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 30.44));
}

export function getScoreColor(score: number): { bg: string; text: string; dot: string } {
  if (score >= 80) return { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' };
  if (score >= 50) return { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' };
  return { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' };
}

export function getStatusColor(status: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    nouveau: { bg: '#DBEAFE', text: '#1E40AF' },
    contacté: { bg: '#FEF3C7', text: '#92400E' },
    intéressé: { bg: '#D1FAE5', text: '#065F46' },
    pas_intéressé: { bg: '#F3F4F6', text: '#4B5563' },
    rdv_pris: { bg: '#EDE9FE', text: '#5B21B6' },
  };
  return colors[status] || colors.nouveau;
}

export function getMainSignalLabel(lead: Pick<Lead, 'signalType' | 'signals'>): string {
  if (lead.signalType.includes('liquidation_pro')) return 'Liquidation pro détectée';
  if (lead.signalType.includes('dissolution_sci')) return 'Dissolution SCI détectée';
  if (lead.signalType.includes('cession_entreprise')) return "Cession d'entreprise détectée";
  if (lead.signalType.includes('dpe_recent')) {
    const months = Math.round(lead.signals.days_since_dpe / 30);
    return `DPE refait il y a ${months} mois`;
  }
  if (lead.signalType.includes('detention_longue')) {
    return `Détenu depuis ${lead.signals.years_owned} ans`;
  }
  if (lead.signalType.includes('plus_value')) {
    return `Plus-value estimée +${lead.signals.estimated_gain_pct}%`;
  }
  if (lead.signalType.includes('zone_rotation')) return 'Zone à forte rotation';
  return 'Signal détecté';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    nouveau: 'Nouveau',
    contacté: 'Contacté',
    intéressé: 'Intéressé',
    pas_intéressé: 'Pas intéressé',
    rdv_pris: 'RDV pris',
  };
  return labels[status] || status;
}

/** Pastille signal drawer : intensité selon les points. */
export function signalTierEmoji(pts: number): string {
  if (pts >= 35) return '🔴';
  if (pts >= 25) return '🟠';
  if (pts >= 15) return '🟡';
  return '🟢';
}
