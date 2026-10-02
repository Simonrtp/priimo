import { isKeyInRange, parisYmd, weekRangeKeys, ymdKey } from '@/lib/today/calendar';

/** Bornes incluses, en clés `YYYY-MM-DD` du fuseau Paris. */
export type Intervalle = { debut: string; fin: string };

/** Lundi → dimanche. */
export type Semaine = Intervalle;

export function semaineDe(date: Date): Semaine {
  const { start, end } = weekRangeKeys(date);
  return { debut: start, fin: end };
}

/**
 * Décale une semaine de `delta` semaines. On repart du lundi à midi UTC plutôt
 * que d'ajouter 7 × 86 400 000 ms : au passage à l'heure d'été, une semaine
 * ajoutée en millisecondes décale l'heure murale d'une heure et un lundi à
 * 00 h 30 bascule sur le dimanche précédent.
 */
export function semaineDecalee(semaine: Semaine, delta: number): Semaine {
  const [y, m, d] = semaine.debut.split('-').map(Number);
  const midiUtc = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta * 7, 12, 0, 0);
  return semaineDe(new Date(midiUtc));
}

export function semainePrecedente(semaine: Semaine): Semaine {
  return semaineDecalee(semaine, -1);
}

/**
 * Fenêtre glissante de `nb` semaines finissant sur `semaine` incluse.
 * `fenetreSemaines(s, 12)` couvre s-11 → s.
 */
export function fenetreSemaines(semaine: Semaine, nb: number): Intervalle {
  const premiere = semaineDecalee(semaine, -(Math.max(1, nb) - 1));
  return { debut: premiere.debut, fin: semaine.fin };
}

/** Mois civil parisien contenant `date` — sert à l'objectif mensuel de mandats. */
export function moisDe(date: Date): Intervalle {
  const { y, m } = parisYmd(date);
  const dernierJour = new Date(Date.UTC(y, m, 0, 12, 0, 0)).getUTCDate();
  return {
    debut: ymdKey({ y, m, d: 1, weekday: 0 }),
    fin: ymdKey({ y, m, d: dernierJour, weekday: 0 }),
  };
}

/** `true` si le jour civil tombe dans l'intervalle, bornes incluses. */
export function dansLaSemaine(jour: string, intervalle: Intervalle): boolean {
  return isKeyInRange(jour, intervalle.debut, intervalle.fin);
}

/** Fenêtres du sélecteur Accueil : 7, 30 ou 90 jours, ou une plage choisie. */
export type PeriodePreset = '7j' | '30j' | '90j';
export type Periode = PeriodePreset | 'custom';

export const PRESETS_PERIODE: readonly PeriodePreset[] = ['7j', '30j', '90j'];

export const JOURS_PRESET: Record<PeriodePreset, number> = {
  '7j': 7,
  '30j': 30,
  '90j': 90,
};

export const LIBELLE_PERIODE: Record<PeriodePreset, string> = {
  '7j': '7j',
  '30j': '30j',
  '90j': '90j',
};

export const TITRE_PERIODE: Record<Periode, string> = {
  '7j': 'Ma semaine',
  '30j': 'Mon mois',
  '90j': 'Mes 90 jours',
  custom: 'Ma période',
};

/** Anciennes clés d'URL encore acceptées, ramenées aux fenêtres glissantes. */
export function normaliserPeriode(valeur: string | null | undefined): Periode {
  if (valeur === '30j' || valeur === 'mois') return '30j';
  if (valeur === '90j' || valeur === 'annee') return '90j';
  if (valeur === 'custom' || valeur === 'jour') return 'custom';
  return '7j';
}

export function estPeriodeUrl(valeur: string | null | undefined): boolean {
  return (
    valeur === '7j' ||
    valeur === '30j' ||
    valeur === '90j' ||
    valeur === 'custom' ||
    valeur === 'jour' ||
    valeur === 'semaine' ||
    valeur === 'mois' ||
    valeur === 'annee'
  );
}

/** @deprecated préférer `estPeriodeUrl` + `normaliserPeriode`. */
export function estPeriode(valeur: string | null | undefined): valeur is Periode {
  return valeur === '7j' || valeur === '30j' || valeur === '90j' || valeur === 'custom';
}

function cle(y: number, m: number, d: number): string {
  return ymdKey({ y, m, d, weekday: 0 });
}

/** `nb` jours civils se terminant le jour de `date`, bornes incluses. */
export function intervalleGlissant(nb: number, date: Date): Intervalle {
  const { y, m, d } = parisYmd(date);
  const fin = cle(y, m, d);
  return { debut: clePlusJours(fin, -(Math.max(1, nb) - 1)), fin };
}

function ordonner(a: string, b: string): Intervalle {
  return a <= b ? { debut: a, fin: b } : { debut: b, fin: a };
}

/** L'intervalle affiché pour une période, ancré sur `date` (la fin, pour un preset). */
export function intervalleDe(periode: Periode, date: Date): Intervalle {
  if (periode === 'custom') {
    const { y, m, d } = parisYmd(date);
    const jour = cle(y, m, d);
    return { debut: jour, fin: jour };
  }
  return intervalleGlissant(JOURS_PRESET[periode], date);
}

/** Décale l'intervalle d'un cran de sa propre durée. */
export function intervalleDecale(
  periode: Periode,
  intervalle: Intervalle,
  delta: number,
): Intervalle {
  const largeur = nombreDeJours(intervalle);
  if (periode === 'custom') {
    return {
      debut: clePlusJours(intervalle.debut, delta * largeur),
      fin: clePlusJours(intervalle.fin, delta * largeur),
    };
  }
  return {
    debut: clePlusJours(intervalle.debut, delta * JOURS_PRESET[periode]),
    fin: clePlusJours(intervalle.fin, delta * JOURS_PRESET[periode]),
  };
}

/**
 * Ce que le sélecteur affiche.
 *
 * Le découpage des périodes est un calcul pur : le client sait quel intervalle
 * il vient de demander avant que la réponse du serveur arrive, donc l'en-tête
 * n'a jamais à attendre le réseau.
 */
export type VuePeriode = {
  periode: Periode;
  intervalle: Intervalle;
  /** Un preset qui se termine aujourd'hui — pas une plage choisie au calendrier. */
  estPeriodeCourante: boolean;
  /** Identifie la période à une fenêtre près — sert de clé de cache. */
  cle: string;
};

export function vueSurIntervalle(
  periode: Periode,
  intervalle: Intervalle,
  maintenant: Date = new Date(),
): VuePeriode {
  const courant = intervalleDe(periode === 'custom' ? '7j' : periode, maintenant);
  const estPeriodeCourante =
    periode !== 'custom' &&
    intervalle.debut === courant.debut &&
    intervalle.fin === courant.fin;
  return {
    periode,
    intervalle,
    estPeriodeCourante,
    cle: `${periode}|${intervalle.debut}|${intervalle.fin}`,
  };
}

function jourValide(brut: string | null | undefined): string | null {
  return brut && /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut : null;
}

/** Intervalle d'un preset (fin = ancre) ou d'une plage `debut`→`fin`. */
export function intervalleDepuis(
  periode: Periode,
  ancre: string | null,
  fin: string | null = null,
  maintenant: Date = new Date(),
): Intervalle {
  if (periode === 'custom') {
    const debut = jourValide(ancre);
    const bout = jourValide(fin) ?? debut;
    if (!debut) return intervalleDe('7j', maintenant);
    return ordonner(debut, bout ?? debut);
  }
  const date = jourValide(ancre) ? new Date(`${ancre}T12:00:00Z`) : maintenant;
  return intervalleDe(periode, date);
}

/** La vue d'une période ancrée sur un jour civil — `null` pour celle en cours. */
export function vuePeriode(
  periode: Periode,
  ancre: string | null,
  maintenant: Date = new Date(),
  fin: string | null = null,
): VuePeriode {
  return vueSurIntervalle(periode, intervalleDepuis(periode, ancre, fin, maintenant), maintenant);
}

function jourLisible(cleJour: string): string {
  const [y, m, d] = cleJour.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** « 28 septembre – 4 octobre 2026 », sans répéter le mois quand il est le même. */
export function intervalleLisible(intervalle: Intervalle): string {
  const [ay, am] = intervalle.debut.split('-').map(Number);
  const [by] = intervalle.fin.split('-').map(Number);
  if (intervalle.debut === intervalle.fin) return `${jourLisible(intervalle.debut)} ${ay}`;
  const debut =
    am === Number(intervalle.fin.slice(5, 7)) && ay === by
      ? String(Number(intervalle.debut.slice(8)))
      : jourLisible(intervalle.debut);
  return `${debut} – ${jourLisible(intervalle.fin)} ${by}`;
}

/** Décale une clé `YYYY-MM-DD` de `delta` jours civils. */
export function clePlusJours(cle: string, delta: number): string {
  const [y, m, d] = cle.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta, 12, 0, 0))
    .toISOString()
    .slice(0, 10);
}

/**
 * Sept jours plus tard, même jour de semaine : lundi → lundi, mardi → mardi.
 * Bornes incluses — 8 dates, 7 × 24 h entre les deux.
 */
export function intervalleSeptJours(fin: string): Intervalle {
  return { debut: clePlusJours(fin, -7), fin };
}

/** Nombre de jours civils d'un intervalle, bornes incluses. */
export function nombreDeJours(intervalle: Intervalle): number {
  const [y1, m1, d1] = intervalle.debut.split('-').map(Number);
  const [y2, m2, d2] = intervalle.fin.split('-').map(Number);
  const a = Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1);
  const b = Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Le lundi de la semaine contenant le début de l'intervalle, en Date. */
export function dateDebut(intervalle: Intervalle): Date {
  const [y, m, d] = intervalle.debut.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}
