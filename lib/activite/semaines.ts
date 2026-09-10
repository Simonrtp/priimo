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

/** Granularité du sélecteur de l'écran Accueil. */
export type Periode = 'jour' | 'semaine' | 'mois' | 'annee';

export const LIBELLE_PERIODE: Record<Periode, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Année',
};

export function estPeriode(valeur: string | null | undefined): valeur is Periode {
  return valeur === 'jour' || valeur === 'semaine' || valeur === 'mois' || valeur === 'annee';
}

function cle(y: number, m: number, d: number): string {
  return ymdKey({ y, m, d, weekday: 0 });
}

/** L'intervalle civil parisien correspondant à la période contenant `date`. */
export function intervalleDe(periode: Periode, date: Date): Intervalle {
  const { y, m, d } = parisYmd(date);
  if (periode === 'jour') return { debut: cle(y, m, d), fin: cle(y, m, d) };
  if (periode === 'semaine') return semaineDe(date);
  if (periode === 'mois') return moisDe(date);
  return { debut: cle(y, 1, 1), fin: cle(y, 12, 31) };
}

/** Décale l'intervalle d'un cran de sa propre granularité. */
export function intervalleDecale(
  periode: Periode,
  intervalle: Intervalle,
  delta: number,
): Intervalle {
  const [y, m, d] = intervalle.debut.split('-').map(Number);
  const an = y ?? 1970;
  const mois = m ?? 1;
  const jour = d ?? 1;

  if (periode === 'jour') {
    return intervalleDe('jour', new Date(Date.UTC(an, mois - 1, jour + delta, 12)));
  }
  if (periode === 'semaine') return semaineDecalee(intervalle, delta);
  if (periode === 'mois') {
    return intervalleDe('mois', new Date(Date.UTC(an, mois - 1 + delta, 15, 12)));
  }
  return intervalleDe('annee', new Date(Date.UTC(an + delta, 6, 1, 12)));
}

/**
 * Ce que le sélecteur de granularité affiche.
 *
 * Le découpage des périodes est un calcul pur : le client sait quel intervalle
 * il vient de demander avant que la réponse du serveur arrive, donc l'en-tête
 * et le bouton « suivant » n'ont jamais à attendre le réseau.
 */
export type VuePeriode = {
  periode: Periode;
  intervalle: Intervalle;
  /** Décide du bouton « suivant » : on ne consulte pas l'avenir. */
  estPeriodeCourante: boolean;
  /** Identifie la période à une granularité près — sert de clé de cache. */
  cle: string;
};

export function vueSurIntervalle(
  periode: Periode,
  intervalle: Intervalle,
  maintenant: Date = new Date(),
): VuePeriode {
  return {
    periode,
    intervalle,
    estPeriodeCourante: intervalle.debut === intervalleDe(periode, maintenant).debut,
    cle: `${periode}|${intervalle.debut}`,
  };
}

/** La vue d'une période ancrée sur un jour civil — `null` pour celle en cours. */
export function vuePeriode(
  periode: Periode,
  ancre: string | null,
  maintenant: Date = new Date(),
): VuePeriode {
  const date = ancre ? new Date(`${ancre}T12:00:00Z`) : maintenant;
  return vueSurIntervalle(periode, intervalleDe(periode, date), maintenant);
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
