/** Ajustement agent sur le prix moteur, −10 % à +10 %, pas de 0,1. */

export function bornerMajoration(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.round(Math.min(10, Math.max(-10, pct)) * 10) / 10;
}

export function prixAvecMajoration(moteur: number, pct: number): number {
  return Math.round(moteur * (1 + bornerMajoration(pct) / 100));
}

/** null = le prix saisi n’est plus un ajustement −10 % / +10 %. */
export function majorationDepuisPrix(moteur: number, prix: number): number | null {
  if (!(moteur > 0) || !(prix > 0)) return null;
  const pct = (prix / moteur - 1) * 100;
  if (pct < -10.05 || pct > 10.05) return null;
  return bornerMajoration(pct);
}

export function libelleMajoration(pct: number): string {
  const n = bornerMajoration(pct);
  const abs = Math.abs(n).toLocaleString('fr-FR', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
  if (n > 0) return `+${abs} %`;
  if (n < 0) return `−${abs} %`;
  return '0 %';
}
