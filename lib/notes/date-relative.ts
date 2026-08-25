/**
 * Résolution de dates relatives en français à partir de la date de la note.
 * Complète l'extraction LLM pour les formulations courantes.
 */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoDateTime(d: Date): string {
  return d.toISOString();
}

/** Prochaine occurrence d'un jour de semaine (0=dim … 6=sam). */
export function prochainJourSemaine(from: Date, weekday: number): Date {
  const base = startOfDay(from);
  const current = base.getDay();
  let delta = weekday - current;
  if (delta <= 0) delta += 7;
  const out = new Date(base);
  out.setDate(out.getDate() + delta);
  return out;
}

export function jourSemaineFromText(text: string): number | null {
  const lower = text.toLocaleLowerCase('fr');
  for (let i = 0; i < JOURS.length; i++) {
    if (lower.includes(JOURS[i]!)) return i;
  }
  return null;
}

/** « dans N jours / semaines » */
export function resolveDans(text: string, ref: Date): Date | null {
  const lower = text.toLocaleLowerCase('fr');
  const jours = lower.match(/dans\s+(\d+)\s+jours?/);
  if (jours) {
    const out = startOfDay(ref);
    out.setDate(out.getDate() + Number(jours[1]));
    return out;
  }
  const sem = lower.match(/dans\s+(?:deux|2|\d+)\s+semaines?/);
  if (sem) {
    const n = lower.includes('deux') ? 2 : Number(sem[0].match(/\d+/)?.[0] ?? 2);
    const out = startOfDay(ref);
    out.setDate(out.getDate() + n * 7);
    return out;
  }
  if (lower.includes('demain')) {
    const out = startOfDay(ref);
    out.setDate(out.getDate() + 1);
    return out;
  }
  if (lower.includes('après-demain')) {
    const out = startOfDay(ref);
    out.setDate(out.getDate() + 2);
    return out;
  }
  const wd = jourSemaineFromText(lower);
  if (wd !== null) return prochainJourSemaine(ref, wd);
  return null;
}

/** Heure explicite « 14h » ou « 14h30 » */
export function parseHeure(text: string): { h: number; m: number } | null {
  const m = text.match(/(\d{1,2})\s*h\s*(\d{2})?/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

export type PlageHoraire = { debut: string; fin: string };

/** Créneau RDV : heure précise ou plage matin/après-midi. */
export function resolveRendezVous(
  text: string,
  ref: Date,
): PlageHoraire | null {
  const lower = text.toLocaleLowerCase('fr');
  const day = resolveDans(lower, ref) ?? prochainJourSemaine(ref, ref.getDay() === 0 ? 1 : ref.getDay());
  const heure = parseHeure(lower);

  if (heure) {
    const debut = new Date(day);
    debut.setHours(heure.h, heure.m, 0, 0);
    const fin = new Date(debut);
    fin.setHours(debut.getHours() + 1);
    return { debut: toIsoDateTime(debut), fin: toIsoDateTime(fin) };
  }

  if (lower.includes('matin')) {
    const debut = new Date(day);
    debut.setHours(9, 0, 0, 0);
    const fin = new Date(day);
    fin.setHours(12, 0, 0, 0);
    return { debut: toIsoDateTime(debut), fin: toIsoDateTime(fin) };
  }
  if (lower.includes('après-midi') || lower.includes('apres-midi')) {
    const debut = new Date(day);
    debut.setHours(14, 0, 0, 0);
    const fin = new Date(day);
    fin.setHours(18, 0, 0, 0);
    return { debut: toIsoDateTime(debut), fin: toIsoDateTime(fin) };
  }

  const wd = jourSemaineFromText(lower);
  if (wd !== null) {
    const d = prochainJourSemaine(ref, wd);
    const debut = new Date(d);
    debut.setHours(10, 0, 0, 0);
    const fin = new Date(d);
    fin.setHours(11, 0, 0, 0);
    return { debut: toIsoDateTime(debut), fin: toIsoDateTime(fin) };
  }
  return null;
}

/** Date absolue pour une promesse (engagement daté). */
export function resolvePromesseEcheance(text: string, ref: Date): string | null {
  const resolved = resolveDans(text, ref);
  return resolved ? toIsoDate(resolved) : null;
}

export function parseIsoDateOnly(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function parseIsoDateTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
