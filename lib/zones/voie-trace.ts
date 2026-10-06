/**
 * Ce qu'une règle de voie retient, dessiné sur la carte : les numéros
 * concernés, et un trait par côté de rue (pairs d'un côté, impairs de
 * l'autre). Même logique que `correspondVoie` dans l'appartenance : ce qui
 * s'affiche est ce qui compte.
 */
import type { PariteVoie } from './types';

export type NumeroSitue = {
  numero: number;
  suffixe?: string | null;
  longitude: number;
  latitude: number;
  parcelles?: readonly string[];
};

export type FiltreVoie = {
  parite: PariteVoie;
  numero_min: number | null;
  numero_max: number | null;
};

export function numerosDeLaRegle<T extends NumeroSitue>(numeros: readonly T[], filtre: FiltreVoie): T[] {
  return numeros.filter((n) => {
    if (filtre.parite === 'paires' && n.numero % 2 !== 0) return false;
    if (filtre.parite === 'impaires' && n.numero % 2 === 0) return false;
    if (filtre.numero_min !== null && n.numero < filtre.numero_min) return false;
    if (filtre.numero_max !== null && n.numero > filtre.numero_max) return false;
    return true;
  });
}

function ordre(a: NumeroSitue, b: NumeroSitue): number {
  if (a.numero !== b.numero) return a.numero - b.numero;
  return (a.suffixe ?? '').localeCompare(b.suffixe ?? '', 'fr');
}

/** Un trait par côté de rue, dans l'ordre des numéros. Un côté d'un seul numéro n'a pas de trait. */
export function cotesDeLaVoie(numeros: readonly NumeroSitue[]): [number, number][][] {
  const cotes: [number, number][][] = [];
  for (const reste of [0, 1]) {
    const cote = numeros
      .filter((n) => n.numero % 2 === reste)
      .sort(ordre)
      .map((n) => [n.longitude, n.latitude] as [number, number]);
    if (cote.length >= 2) cotes.push(cote);
  }
  return cotes;
}

/** Résumé court d'une règle : « Rue Oberkampf · pairs · 2 à 40 ». */
export function resumerVoie(v: FiltreVoie & { nom_voie: string }): string {
  const cote = v.parite === 'paires' ? ' · pairs' : v.parite === 'impaires' ? ' · impairs' : '';
  const plage =
    v.numero_min !== null && v.numero_max !== null
      ? ` · ${v.numero_min} à ${v.numero_max}`
      : v.numero_min !== null
        ? ` · dès le ${v.numero_min}`
        : v.numero_max !== null
          ? ` · jusqu’au ${v.numero_max}`
          : '';
  return `${v.nom_voie}${cote}${plage}`;
}
