import { FIELD } from '@/lib/today/field';

/** États d’un compteur Accueil. Une seule règle, pas une couleur figée. */
export type CounterTone = 'sain' | 'info' | 'surveiller' | 'probleme';

export const PRISE_RATE_SAIN = 0.7;
export const PRISE_RATE_SURVEILLER = 0.5;

export function toneColor(tone: CounterTone, value: number): string {
  if (value === 0 || tone === 'info') return '#94A3B8';
  switch (tone) {
    case 'sain':
      return FIELD.vert;
    case 'surveiller':
      return FIELD.ardoise;
    case 'probleme':
      return FIELD.rouge;
  }
}

/**
 * Taux de prise = leads déjà au kanban / leads livrés.
 * Rouge sous 50 %, ardoise sous 70 %, vert au-dessus.
 */
export function leadsNonPrisTone(nonPris: number, delivered: number): CounterTone {
  if (delivered <= 0) return 'info';
  const prise = (delivered - nonPris) / delivered;
  if (prise >= PRISE_RATE_SAIN) return 'sain';
  if (prise >= PRISE_RATE_SURVEILLER) return 'surveiller';
  return 'probleme';
}

/** Zéro = information. Un stock positif de mandats est sain. */
export function mandatsActifsTone(value: number): CounterTone {
  return value === 0 ? 'info' : 'sain';
}

/** Un rendez-vous sans suite est à surveiller. Zéro reste une information. */
export function rdvSansSuiteTone(value: number): CounterTone {
  return value === 0 ? 'info' : 'surveiller';
}

/** Un mandat qui pourrit est un problème. Zéro reste une information. */
export function mandats60jTone(value: number): CounterTone {
  return value === 0 ? 'info' : 'probleme';
}

export function formatWeekDelta(current: number, previous: number | null): string | null {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return 'comme la semaine dernière';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta} vs semaine dernière`;
}
