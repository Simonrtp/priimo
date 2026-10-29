'use client';

import { useEffect, useState } from 'react';
import type { FlashItem } from './flash';

/** Le relevé DPE est quotidien, le balayage des annonces nocturne : dix minutes suffisent. */
const FRAICHEUR_MS = 10 * 60_000;

const memoire = new Map<string, { items: FlashItem[]; le: number }>();
const enVol = new Map<string, Promise<FlashItem[]>>();

function charger(requete: string): Promise<FlashItem[]> {
  const connu = memoire.get(requete);
  if (connu && Date.now() - connu.le < FRAICHEUR_MS) return Promise.resolve(connu.items);
  let promesse = enVol.get(requete);
  if (!promesse) {
    promesse = fetch(`/api/dashboard/flash?${requete}`)
      .then(async (r) => {
        if (!r.ok) return connu?.items ?? [];
        const json = (await r.json()) as { items?: FlashItem[] };
        const items = json.items ?? [];
        memoire.set(requete, { items, le: Date.now() });
        return items;
      })
      .catch(() => connu?.items ?? [])
      .finally(() => {
        enVol.delete(requete);
      });
    enVol.set(requete, promesse);
  }
  return promesse;
}

/**
 * Les nouvelles du périmètre affiché. `requete` : `zones=…` ou `cp=1`.
 * Changer de périmètre garde les nouvelles affichées jusqu'à l'arrivée des suivantes.
 */
export function useFlashCarte(requete: string): { items: FlashItem[]; pret: boolean } {
  const [etat, setEtat] = useState<{ items: FlashItem[]; pret: boolean }>(() => {
    const connu = memoire.get(requete);
    return { items: connu?.items ?? [], pret: connu != null };
  });

  useEffect(() => {
    let ignore = false;
    void charger(requete).then((items) => {
      if (!ignore) setEtat({ items, pret: true });
    });
    return () => {
      ignore = true;
    };
  }, [requete]);

  return etat;
}
