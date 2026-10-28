'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Les parcelles de tous les secteurs de l'agence, une lecture partagée par
 * la carte et l'atelier. Relue après chaque modification de secteur.
 */

export type ParcelleSecteur = GeoJSON.Feature<
  GeoJSON.Polygon,
  { parcelleId: string; zoneId: string; assignedTo: string | null; couleur: string; initiales: string }
>;

export type CarteSecteurs = {
  features: ParcelleSecteur[];
  secteurs: {
    zoneId: string;
    nom?: string;
    assignedTo: string | null;
    /** Prénom du titulaire. */
    agent?: string | null;
    couleur: string;
    initiales: string;
    parcelles: number;
  }[];
};

const VIDE: CarteSecteurs = { features: [], secteurs: [] };
const FRAICHEUR_MS = 5 * 60_000;

let memoire: { carte: CarteSecteurs; le: number } | null = null;
let enVol: Promise<CarteSecteurs> | null = null;
let version = 0;
const abonnes = new Set<() => void>();

function charger(): Promise<CarteSecteurs> {
  if (memoire && Date.now() - memoire.le < FRAICHEUR_MS) return Promise.resolve(memoire.carte);
  if (!enVol) {
    enVol = fetch('/api/dashboard/zones/carte', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) return memoire?.carte ?? VIDE;
        const json = (await r.json()) as Partial<CarteSecteurs>;
        const carte = { features: json.features ?? [], secteurs: json.secteurs ?? [] };
        memoire = { carte, le: Date.now() };
        return carte;
      })
      .catch(() => memoire?.carte ?? VIDE)
      .finally(() => {
        enVol = null;
      });
  }
  return enVol;
}

/** Un secteur vient de changer : la carte se relit. */
export function rafraichirCarteSecteurs(): void {
  memoire = null;
  version += 1;
  for (const f of abonnes) f();
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export function useCarteSecteurs(actif = true): CarteSecteurs {
  const [carte, setCarte] = useState<CarteSecteurs>(() => memoire?.carte ?? VIDE);
  const v = useSyncExternalStore(
    abonner,
    () => version,
    () => 0,
  );
  useEffect(() => {
    if (!actif) return;
    let ignore = false;
    void charger().then((c) => {
      if (!ignore) setCarte(c);
    });
    return () => {
      ignore = true;
    };
  }, [actif, v]);
  return carte;
}
