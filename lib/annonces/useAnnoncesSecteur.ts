'use client';

import { useEffect, useState } from 'react';
import type { Annonce } from './types';

/**
 * Une seule lecture pour le panneau des couches et les pastilles de la carte :
 * le compteur du panneau et la carte comptent les mêmes annonces. Le pipeline
 * passe le soir ; dix minutes de fraîcheur suffisent largement.
 */
const FRAICHEUR_MS = 10 * 60_000;

let memoire: { annonces: Annonce[]; le: number } | null = null;
let enVol: Promise<Annonce[]> | null = null;

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

export function useAnnoncesSecteur(actif: boolean): { annonces: Annonce[]; pret: boolean } {
  const [annonces, setAnnonces] = useState<Annonce[]>(() => memoire?.annonces ?? []);
  const [pret, setPret] = useState(() => memoire != null);

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
  }, [actif]);

  return { annonces, pret };
}
