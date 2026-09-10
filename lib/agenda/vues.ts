/**
 * Vues de l'agenda : jour, semaine, mois.
 *
 * Tout se calcule sur des clés « YYYY-MM-DD » et à midi UTC, pour ne jamais
 * dépendre du fuseau de la machine ni tomber sur une bascule d'heure d'été.
 *
 * Une vue « jour » ne déclenche pas d'appel réseau à elle seule : elle se lit
 * dans la semaine déjà chargée. D'où deux plages seulement, semaine et mois.
 */

import { minuitParisIso } from './semaine';

export type VueAgenda = 'jour' | 'semaine' | 'mois';

export const VUES: readonly VueAgenda[] = ['jour', 'semaine', 'mois'];

export const LIBELLE_VUE: Record<VueAgenda, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function partsDe(cle: string): { y: number; m: number; d: number } {
  const [y, m, d] = cle.split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

function midiUtc(cle: string): Date {
  const { y, m, d } = partsDe(cle);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function cleDe(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function decalerJours(cle: string, delta: number): string {
  const date = midiUtc(cle);
  date.setUTCDate(date.getUTCDate() + delta);
  return cleDe(date);
}

/** Lundi de la semaine contenant `cle`. */
export function lundiDe(cle: string): string {
  const jour = midiUtc(cle).getUTCDay();
  return decalerJours(cle, -(jour === 0 ? 6 : jour - 1));
}

export function premierDuMois(cle: string): string {
  const { y, m } = partsDe(cle);
  return `${y}-${pad(m)}-01`;
}

export function dernierDuMois(cle: string): string {
  const { y, m } = partsDe(cle);
  return cleDe(new Date(Date.UTC(y, m, 0, 12)));
}

/**
 * Clé de cache et de requête. Le jour se sert dans la semaine : deux plages
 * seulement à charger, donc moins d'aller-retours réseau.
 */
export function cleAgenda(vue: VueAgenda, ancre: string): string {
  if (vue === 'mois') return `mois:${premierDuMois(ancre).slice(0, 7)}`;
  return `semaine:${lundiDe(ancre)}`;
}

/** Plage à demander à Google pour une clé. Le mois couvre des semaines entières. */
export function bornesDeCle(cle: string): { timeMin: string; timeMax: string } {
  const [genre, valeur = ''] = cle.split(':');
  if (genre === 'mois') {
    const premier = `${valeur}-01`;
    const debut = lundiDe(premier);
    const fin = decalerJours(lundiDe(dernierDuMois(premier)), 7);
    return { timeMin: minuitParisIso(debut), timeMax: minuitParisIso(fin) };
  }
  return {
    timeMin: minuitParisIso(valeur),
    timeMax: minuitParisIso(decalerJours(valeur, 7)),
  };
}

/** Clé valide ? Garde-fou avant de fabriquer une plage depuis une URL. */
export function cleValide(cle: string): boolean {
  return /^semaine:\d{4}-\d{2}-\d{2}$/.test(cle) || /^mois:\d{4}-\d{2}$/.test(cle);
}

export function ancreDecalee(vue: VueAgenda, ancre: string, delta: number): string {
  if (vue === 'jour') return decalerJours(ancre, delta);
  if (vue === 'semaine') return decalerJours(lundiDe(ancre), delta * 7);
  const { y, m } = partsDe(ancre);
  return cleDe(new Date(Date.UTC(y, m - 1 + delta, 1, 12)));
}

function capitale(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1);
}

function enFrancais(cle: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(midiUtc(cle));
}

/** « Mer. 9 sept. », « 7 – 13 sept. », « Septembre 2026 ». */
export function libelleVue(vue: VueAgenda, ancre: string): string {
  if (vue === 'jour') {
    return capitale(enFrancais(ancre, { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  if (vue === 'mois') {
    return capitale(enFrancais(premierDuMois(ancre), { month: 'long', year: 'numeric' }));
  }
  const lundi = lundiDe(ancre);
  const dimanche = decalerJours(lundi, 6);
  const memeMois = lundi.slice(0, 7) === dimanche.slice(0, 7);
  const debut = memeMois
    ? String(Number(lundi.slice(8)))
    : enFrancais(lundi, { day: 'numeric', month: 'short' });
  return `${debut} – ${enFrancais(dimanche, { day: 'numeric', month: 'short' })}`;
}

export type CaseMois = {
  cle: string;
  numero: number;
  horsMois: boolean;
  aujourdhui: boolean;
};

/** Grille du mois en semaines entières (lundi → dimanche). */
export function grilleMois(ancre: string, aujourdhui: string): CaseMois[][] {
  const premier = premierDuMois(ancre);
  const mois = premier.slice(0, 7);
  const dernierLundi = lundiDe(dernierDuMois(premier));
  const semaines: CaseMois[][] = [];

  for (let lundi = lundiDe(premier); lundi <= dernierLundi; lundi = decalerJours(lundi, 7)) {
    const semaine: CaseMois[] = [];
    for (let i = 0; i < 7; i += 1) {
      const cle = decalerJours(lundi, i);
      semaine.push({
        cle,
        numero: Number(cle.slice(8)),
        horsMois: cle.slice(0, 7) !== mois,
        aujourdhui: cle === aujourdhui,
      });
    }
    semaines.push(semaine);
  }
  return semaines;
}
