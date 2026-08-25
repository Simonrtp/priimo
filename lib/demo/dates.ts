const PARIS = 'Europe/Paris';
const DAY_MS = 86_400_000;

function parisParts(d: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

/** Date ISO (YYYY-MM-DD) à partir de now + offset jours. */
export function isoDateDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Timestamp ISO avec offset jours et heures. */
export function isoDaysHours(now: Date, days: number, hours = 0): string {
  return new Date(now.getTime() + days * DAY_MS + hours * 3_600_000).toISOString();
}

/** Date de signature mandat pour expiration dans N jours (durée en mois). */
export function mandatSignePourExpirationDans(now: Date, joursRestants: number, dureeMois = 3): string {
  const exp = new Date(now.getTime() + joursRestants * DAY_MS);
  const signe = new Date(exp);
  signe.setUTCMonth(signe.getUTCMonth() - dureeMois);
  return signe.toISOString().slice(0, 10);
}

/** Aujourd'hui à 14h30 Paris (RDV cet après-midi). */
export function cetApresMidiParis(now: Date): { debut: string; fin: string } {
  const base = isoDateDays(now, 0);
  return {
    debut: new Date(`${base}T14:30:00+02:00`).toISOString(),
    fin: new Date(`${base}T15:30:00+02:00`).toISOString(),
  };
}

/** Densité croissante vers le présent (0–1). */
export function recentBiasWeight(fraction: number): number {
  const t = Math.max(0, Math.min(1, fraction));
  return Math.max(0.05, t * t);
}

/** Jours dans le passé sur 24 mois, avec creux août et fin décembre. */
export function daysAgoGlissant(now: Date, fraction: number): number {
  const maxDays = 730;
  let daysAgo = Math.floor((1 - recentBiasWeight(fraction)) * maxDays);
  const d = new Date(now.getTime() - daysAgo * DAY_MS);
  const { m, d: day } = parisParts(d);
  if (m === 8) daysAgo = Math.min(maxDays, daysAgo + 12);
  if (m === 12 && day >= 20) daysAgo = Math.min(maxDays, daysAgo + 8);
  return daysAgo;
}

/** Date ISO à partir d'une date de base + offset jours. */
export function isoDateFromBase(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}
/** Prix au m² autour de 9 000–10 500 € avec dispersion. */
export function priceFromSurfaceM2(surfaceM2: number, seed: number): number {
  const base = 9000 + (seed % 16) * 100;
  const jitter = ((seed * 17) % 7) * 50 - 150;
  return Math.round(surfaceM2 * (base + jitter));
}
