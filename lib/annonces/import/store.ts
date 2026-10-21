'use client';

import { useSyncExternalStore } from 'react';
import type { CarteImport } from './carte';

/**
 * L'annonce retrouvée par son URL : le panneau l'affiche, la carte y vole et
 * pose son point. Un seul état partagé, sans passer par la page.
 */
let courante: CarteImport | null = null;
const abonnes = new Set<() => void>();

export function definirAnnonceImportee(carte: CarteImport | null): void {
  courante = carte;
  for (const f of abonnes) f();
}

export function annonceImportee(): CarteImport | null {
  return courante;
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useAnnonceImportee(): CarteImport | null {
  return useSyncExternalStore(
    abonner,
    () => courante,
    () => null,
  );
}
