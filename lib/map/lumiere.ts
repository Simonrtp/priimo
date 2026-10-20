'use client';

import { useSyncExternalStore } from 'react';

/** Les lumières du fond Standard. */
export const LUMIERES = ['dawn', 'day', 'dusk', 'night'] as const;
export type Lumiere = (typeof LUMIERES)[number];
/** « auto » suit le soleil au-dessus de la carte. */
export type ChoixLumiere = 'auto' | Lumiere;

export const LIBELLES_LUMIERE: Record<ChoixLumiere, string> = {
  auto: 'Auto',
  dawn: 'Aube',
  day: 'Jour',
  dusk: 'Crépuscule',
  night: 'Nuit',
};

const RAD = Math.PI / 180;

/**
 * Hauteur du soleil (degrés) et matin ou soir, au lieu et à l'heure donnés.
 * Formules simplifiées de l'almanach (précision d'un quart de degré) : bien
 * assez pour choisir entre aube, jour, crépuscule et nuit.
 */
export function positionSoleil(date: Date, latitude: number, longitude: number): { hauteur: number; matin: boolean } {
  const d = date.getTime() / 86_400_000 - 10_957.5; // jours depuis J2000
  const g = ((357.529 + 0.98560028 * d) % 360) * RAD;
  const q = (280.459 + 0.98564736 * d) % 360;
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ascension = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / RAD;
  const declinaison = Math.asin(Math.sin(e) * Math.sin(l));
  const tsm = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24; // temps sidéral moyen (h)
  let angleHoraire = (tsm * 15 + longitude - ascension) % 360;
  if (angleHoraire > 180) angleHoraire -= 360;
  if (angleHoraire <= -180) angleHoraire += 360;
  const lat = latitude * RAD;
  const hauteur =
    Math.asin(Math.sin(lat) * Math.sin(declinaison) + Math.cos(lat) * Math.cos(declinaison) * Math.cos(angleHoraire * RAD)) / RAD;
  return { hauteur, matin: angleHoraire < 0 };
}

/** Au-dessus : plein jour. En dessous du crépuscule civil (−6°) : nuit. */
const HAUTEUR_JOUR = 8;
const HAUTEUR_NUIT = -6;

export function lumiereDuSoleil(date: Date, latitude: number, longitude: number): Lumiere {
  const { hauteur, matin } = positionSoleil(date, latitude, longitude);
  if (hauteur >= HAUTEUR_JOUR) return 'day';
  if (hauteur <= HAUTEUR_NUIT) return 'night';
  return matin ? 'dawn' : 'dusk';
}

export function resoudreLumiere(choix: ChoixLumiere, date: Date, latitude: number, longitude: number): Lumiere {
  return choix === 'auto' ? lumiereDuSoleil(date, latitude, longitude) : choix;
}

/* -------------------------------------------------------------------------- */
/*            Le choix de l'agent : partagé par toutes les cartes             */
/* -------------------------------------------------------------------------- */

const CLE = 'priimo:lumiere';
let choix: ChoixLumiere | null = null;
const abonnes = new Set<() => void>();

function lire(): ChoixLumiere {
  if (choix) return choix;
  let lu: string | null = null;
  try {
    lu = window.localStorage.getItem(CLE);
  } catch {
    /* stockage bloqué : réglage par défaut */
  }
  choix = lu === 'auto' || (LUMIERES as readonly string[]).includes(lu ?? '') ? (lu as ChoixLumiere) : 'auto';
  return choix;
}

export function definirLumiere(valeur: ChoixLumiere): void {
  choix = valeur;
  try {
    window.localStorage.setItem(CLE, valeur);
  } catch {
    /* stockage bloqué : le choix vaut pour la session */
  }
  for (const f of abonnes) f();
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useChoixLumiere(): ChoixLumiere {
  return useSyncExternalStore(abonner, lire, () => 'auto');
}
