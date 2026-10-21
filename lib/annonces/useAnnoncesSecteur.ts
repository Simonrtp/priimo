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

/* -------------------------------------------------------------------------- */
/*          Annonces ajoutées par l'agence : toujours sur la carte            */
/* -------------------------------------------------------------------------- */

let ajoutees: { annonces: Annonce[]; le: number; version: number } | null = null;
let ajouteesEnVol: Promise<Annonce[]> | null = null;
/** Une réponse partie avant un retrait ne doit pas reposer le point. */
let ajouteesEpoch = 0;

function chargerAjoutees(): Promise<Annonce[]> {
  if (ajoutees && ajoutees.version === version && Date.now() - ajoutees.le < FRAICHEUR_MS) {
    return Promise.resolve(ajoutees.annonces);
  }
  if (!ajouteesEnVol) {
    const pour = version;
    const epoch = ajouteesEpoch;
    ajouteesEnVol = fetch('/api/dashboard/annonces/ajoutees', { cache: 'no-store' })
      .then(async (r) => {
        if (epoch !== ajouteesEpoch) return ajoutees?.annonces ?? [];
        if (!r.ok) return ajoutees?.annonces ?? [];
        const json = (await r.json()) as { annonces?: Annonce[] };
        const liste = json.annonces ?? [];
        ajoutees = { annonces: liste, le: Date.now(), version: pour };
        return liste;
      })
      .catch(() => ajoutees?.annonces ?? [])
      .finally(() => {
        ajouteesEnVol = null;
      });
  }
  return ajouteesEnVol;
}

/** Le point vient d'être retiré : la carte se met à jour sans attendre le réseau. */
export function oublierAnnonceAjoutee(id: string): void {
  ajouteesEpoch += 1;
  version += 1;
  ajoutees = {
    annonces: (ajoutees?.annonces ?? []).filter((a) => a.id !== id),
    le: Date.now(),
    version,
  };
  for (const f of abonnes) f();
}

/** Le retrait a échoué : relire ce que l'agence a vraiment sur la carte. */
export function relireAnnoncesAjoutees(): void {
  ajoutees = null;
  version += 1;
  for (const f of abonnes) f();
}

/**
 * Les annonces que l'agence a ajoutées par leur URL, quels que soient la couche
 * Annonces, le secteur choisi ou le code postal : elles restent sur la carte,
 * au bureau comme sur le téléphone, tournée comprise. Relues après chaque ajout.
 */
export function useAnnoncesAjoutees(): Annonce[] {
  const [liste, setListe] = useState<Annonce[]>(() => ajoutees?.annonces ?? []);
  const v = useSyncExternalStore(
    abonner,
    () => version,
    () => 0,
  );
  useEffect(() => {
    let ignore = false;
    void chargerAjoutees().then((a) => {
      if (!ignore) setListe(a);
    });
    return () => {
      ignore = true;
    };
  }, [v]);
  return liste;
}
