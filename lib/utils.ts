export function splitStreetAndCity(address: string): { streetLine: string; cityZipLine: string } {
  const idx = address.lastIndexOf(',');
  if (idx === -1) return { streetLine: address.trim(), cityZipLine: '' };
  const streetLine = address.slice(0, idx).trim();
  const tail = address.slice(idx + 1).trim();
  const m = tail.match(/^(\d{5})\s+(.+)$/);
  const cityZipLine = m ? `${m[2]} · ${m[1]}` : tail;
  return { streetLine, cityZipLine };
}

export function scoreTierLabel(score: number): string {
  if (score >= 80) return 'Très chaud';
  if (score >= 60) return 'Chaud';
  return 'Tiède';
}

export function scoreTierAccentColor(score: number): string {
  if (score >= 80) return '#C2410C';
  if (score >= 60) return '#B45309';
  return '#64748B';
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

export function getScoreColor(score: number): { bg: string; text: string; dot: string } {
  if (score >= 80) return { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' };
  if (score >= 50) return { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' };
  return { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' };
}
