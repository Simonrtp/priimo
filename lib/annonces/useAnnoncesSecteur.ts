'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Annonce } from './types';

/**
 * Une seule lecture pour le panneau des couches et les pastilles de la carte :
 * le compteur du panneau et la carte comptent les mêmes annonces. Le pipeline
 * passe le soir ; dix minutes de fraîcheur suffisent largement.
 */
const FRAICHEUR_MS = 10 * 60_000;

let memoire: { annonces: Annonce[]; le: number } | null = null;
let enVol: Promise<Annonce[]> | null = null;
/** Change à chaque ajout d'annonce par URL : les pastilles se relisent. */
let version = 0;
const abonnes = new Set<() => void>();

function charger(): Promise<Annonce[]> {
  if (memoire && Date.now() - memoire.le < FRAICHEUR_MS) return Promise.resolve(memoire.annonces);
  if (!enVol) {
    enVol = fetch('/api/dashboard/annonces')
      .then(async (r) => {
        if (!r.ok) return memoire?.annonces ?? [];
        const json = (await r.json()) as { annonces?: Annonce[] };
        const annonces = json.annonces ?? [];
        memoire = { annonces, le: Date.now() };
        return annonces;
      })
      .catch(() => memoire?.annonces ?? [])
      .finally(() => {
        enVol = null;
      });
  }
  return enVol;
}

/** Une annonce vient d'être ajoutée : relire au lieu d'attendre dix minutes. */
export function rafraichirAnnoncesSecteur(): void {
  memoire = null;
  version += 1;
  for (const f of abonnes) f();
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useAnnoncesSecteur(actif: boolean): { annonces: Annonce[]; pret: boolean } {
  const [annonces, setAnnonces] = useState<Annonce[]>(() => memoire?.annonces ?? []);
  const [pret, setPret] = useState(() => memoire != null);
  const v = useSyncExternalStore(
    abonner,
    () => version,
    () => 0,
  );

  useEffect(() => {
    if (!actif) return;
    let ignore = false;
    void charger().then((a) => {
      if (ignore) return;
      setAnnonces(a);
      setPret(true);
    });
    return () => {
      ignore = true;
    };
  }, [actif, v]);

  return { annonces, pret };
}
