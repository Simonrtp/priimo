/**
 * Résolution de dates relatives en français à partir de la date de la note.
 * Complète l'extraction LLM pour les formulations courantes.
 *
 * Tout se compte à l'heure de Paris. Le serveur tourne en UTC : un « 15h »
 * lu en heure locale du serveur s'affichait 17h chez l'agent.
 */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

export const FUSEAU_AGENCE = 'Europe/Paris';

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU_AGENCE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

type HeureMurale = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function heureMuraleParis(at: Date): HeureMurale {
  const parts = PARTS_FORMAT.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Décalage de Paris sur UTC, en minutes, à un instant donné (60 ou 120). */
function decalageParisMinutes(at: Date): number {
  const m = heureMuraleParis(at);
  const commeUtc = Date.UTC(m.y, m.mo - 1, m.d, m.h, m.mi, m.s);
  return Math.round((commeUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** Heure affichée à Paris → instant réel. Gère les changements d'heure. */
export function heureParisVersUtc(y: number, mo: number, d: number, h = 0, mi = 0): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const premier = decalageParisMinutes(new Date(naive));
  let ts = naive - premier * 60_000;
  const second = decalageParisMinutes(new Date(ts));
  if (second !== premier) ts = naive - second * 60_000;
  return new Date(ts);
}

/** Jour calendaire à Paris, « AAAA-MM-JJ ». */
export function dateParisIso(at: Date): string {
  const m = heureMuraleParis(at);
  return `${m.y}-${String(m.mo).padStart(2, '0')}-${String(m.d).padStart(2, '0')}`;
}

/**
 * Jour calendaire de Paris porté par midi UTC : les calculs de jours se font
 * ensuite en UTC sans jamais basculer sur la veille ou le lendemain.
 */
function startOfDay(d: Date): Date {
  const m = heureMuraleParis(d);
  return new Date(Date.UTC(m.y, m.mo - 1, m.d, 12, 0, 0, 0));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function aHeureParis(jour: Date, h: number, mi: number): Date {
  return heureParisVersUtc(jour.getUTCFullYear(), jour.getUTCMonth() + 1, jour.getUTCDate(), h, mi);
}

function ajouterJours(jour: Date, n: number): Date {
  const out = new Date(jour);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** Prochaine occurrence d'un jour de semaine (0=dim … 6=sam). */
export function prochainJourSemaine(from: Date, weekday: number): Date {
  const base = startOfDay(from);
  let delta = weekday - base.getUTCDay();
  if (delta <= 0) delta += 7;
  return ajouterJours(base, delta);
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
  if (jours) return ajouterJours(startOfDay(ref), Number(jours[1]));
  const sem = lower.match(/dans\s+(?:deux|2|\d+)\s+semaines?/);
  if (sem) {
    const n = lower.includes('deux') ? 2 : Number(sem[0].match(/\d+/)?.[0] ?? 2);
    return ajouterJours(startOfDay(ref), n * 7);
  }
  // « après-demain » contient « demain » : il passe en premier.
  if (lower.includes('après-demain') || lower.includes('apres-demain')) {
    return ajouterJours(startOfDay(ref), 2);
  }
  if (lower.includes('demain')) return ajouterJours(startOfDay(ref), 1);
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

function plage(jour: Date, h1: number, m1: number, h2: number, m2: number): PlageHoraire {
  return { debut: aHeureParis(jour, h1, m1).toISOString(), fin: aHeureParis(jour, h2, m2).toISOString() };
}

/** Créneau RDV : heure précise ou plage matin/après-midi, à l'heure de Paris. */
export function resolveRendezVous(
  text: string,
  ref: Date,
): PlageHoraire | null {
  const lower = text.toLocaleLowerCase('fr');
  const day = resolveDans(lower, ref) ?? prochainJourSemaine(ref, startOfDay(ref).getUTCDay() === 0 ? 1 : startOfDay(ref).getUTCDay());
  const heure = parseHeure(lower);

  if (heure) return plage(day, heure.h, heure.m, Math.min(23, heure.h + 1), heure.m);
  if (lower.includes('matin')) return plage(day, 9, 0, 12, 0);
  if (lower.includes('après-midi') || lower.includes('apres-midi')) return plage(day, 14, 0, 18, 0);

  const wd = jourSemaineFromText(lower);
  if (wd !== null) return plage(prochainJourSemaine(ref, wd), 10, 0, 11, 0);
  return null;
}

/**
 * « jeudi 14h », « demain matin », « dans deux jours », « ce soir » → jour et
 * heure, calculés ici plutôt que par le modèle : les modèles comptent mal les
 * jours de la semaine (« jeudi » dicté un mercredi devenait vendredi).
 * Rend null quand l'expression ne se résout pas — la date du modèle reste.
 */
export function resoudreQuand(
  quand: string | null | undefined,
  ref: Date,
): { date: string; heure: string | null } | null {
  const q = (quand ?? '').toLocaleLowerCase('fr').trim();
  if (!q) return null;
  // Une date écrite en toutes lettres (« le 15 octobre ») : le modèle la lit bien.
  if (/\b\d{1,2}\s*(?:er)?\s+(?:janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)/.test(q)) {
    return null;
  }
  let jour: Date | null = null;
  if (/aujourd|ce soir|ce matin|cet après-midi|cet apres-midi|tout à l'heure|tout a l'heure|tantôt/.test(q)) {
    jour = startOfDay(ref);
  } else if (/semaine prochaine/.test(q) && jourSemaineFromText(q) === null) {
    jour = prochainJourSemaine(ref, 1);
  } else {
    jour = resolveDans(q, ref);
  }
  if (!jour) return null;
  const h = parseHeure(q);
  return {
    date: toIsoDate(jour),
    heure: h ? `${String(h.h).padStart(2, '0')}:${String(h.m).padStart(2, '0')}` : null,
  };
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

/**
 * Le modèle rend « 2026-10-02T15:00 », sans fuseau : c'est l'heure dite par
 * l'agent, donc l'heure de Paris. Une date avec fuseau explicite est lue telle quelle.
 */
export function parseIsoDateTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  const murale = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/);
  if (murale) {
    const [, y, mo, d, h, mi] = murale;
    const at = heureParisVersUtc(Number(y), Number(mo), Number(d), Number(h ?? 0), Number(mi ?? 0));
    return Number.isNaN(at.getTime()) ? null : at.toISOString();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
