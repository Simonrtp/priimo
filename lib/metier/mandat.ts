/** Calculs d'échéances mandat (simple / exclusif). */

export function addMonthsToDate(isoDate: string, months: number): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt;
}

export function mandatExpirationDate(
  mandatSigneLe: string,
  mandatDureeMois: number,
): Date {
  return addMonthsToDate(mandatSigneLe, mandatDureeMois);
}

export function joursJusquA(isoDate: string, now: Date): number {
  const target = new Date(`${isoDate}T12:00:00.000Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

export function joursDepuis(isoDate: string, now: Date): number | null {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Jours restants avant expiration du mandat (négatif = expiré). */
export function joursAvantExpirationMandat(
  mandatSigneLe: string,
  mandatDureeMois: number,
  now: Date,
): number {
  const exp = mandatExpirationDate(mandatSigneLe, mandatDureeMois);
  const expKey = exp.toISOString().slice(0, 10);
  return joursJusquA(expKey, now);
}

/** Imminence 0–100 quand l'expiration est dans ≤ 30 jours. */
export function imminenceExpirationMandat(joursRestants: number): number {
  if (joursRestants > 30) return 0;
  if (joursRestants <= 0) return 100;
  return Math.round(100 * (1 - joursRestants / 30));
}

export function mandatExpireDansFenetre(
  mandatSigneLe: string | null,
  mandatDureeMois: number,
  now: Date,
  fenetreJours = 30,
): boolean {
  if (!mandatSigneLe) return false;
  const jours = joursAvantExpirationMandat(mandatSigneLe, mandatDureeMois, now);
  return jours <= fenetreJours;
}

export function formatDateFr(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}
