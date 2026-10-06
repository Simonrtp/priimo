'use client';

import { useEffect, useMemo, useState } from 'react';
import type { NumeroVoie } from '@/lib/geo/ban-voie';
import { normaliserVoie } from './adresse';

type VoieDemandee = { nom_voie: string; code_postal: string };

export function cleVoie(v: VoieDemandee): string {
  return `${normaliserVoie(v.nom_voie)}|${v.code_postal}`;
}

/** Une rue n'est demandée qu'une fois par session, quel que soit l'écran. */
const demandes = new Map<string, Promise<NumeroVoie[]>>();

function charger(v: VoieDemandee): Promise<NumeroVoie[]> {
  const cle = cleVoie(v);
  const connue = demandes.get(cle);
  if (connue) return connue;
  const params = new URLSearchParams({ nom: v.nom_voie, cp: v.code_postal });
  const demande = fetch(`/api/dashboard/zones/voies/numeros?${params.toString()}`)
    .then((res) => (res.ok ? (res.json() as Promise<{ numeros?: NumeroVoie[] }>) : { numeros: [] }))
    .then((data) => data.numeros ?? [])
    .catch(() => {
      // Réseau coupé : on pourra redemander plus tard.
      demandes.delete(cle);
      return [] as NumeroVoie[];
    });
  demandes.set(cle, demande);
  return demande;
}

/** Les numéros situés de chaque rue citée par une règle, par clé de voie. */
export function useNumerosVoies(voies: readonly VoieDemandee[]): ReadonlyMap<string, NumeroVoie[]> {
  const [charges, setCharges] = useState<ReadonlyMap<string, NumeroVoie[]>>(() => new Map());
  const uniques = useMemo(() => {
    const parCle = new Map<string, VoieDemandee>();
    for (const v of voies) {
      if (v.nom_voie.trim() && /^\d{5}$/.test(v.code_postal)) parCle.set(cleVoie(v), v);
    }
    return parCle;
  }, [voies]);
  const signature = [...uniques.keys()].sort().join('§');

  useEffect(() => {
    let vivant = true;
    for (const [cle, voie] of uniques) {
      void charger(voie).then((numeros) => {
        if (!vivant) return;
        setCharges((prev) => (prev.get(cle) === numeros ? prev : new Map(prev).set(cle, numeros)));
      });
    }
    return () => {
      vivant = false;
    };
    // La signature suffit : `uniques` change d'identité à chaque rendu du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return charges;
}
