'use client';

import { useCallback, useEffect, useState } from 'react';

export type ImmeubleSuiviCarte = {
  parcelleId: string;
  banId: string | null;
  libelle: string | null;
};

/** Immeubles que l’agent a choisi de suivre — pour les peindre sur la carte. */
export function useImmeublesSuivisCarte() {
  const [suivis, setSuivis] = useState<ImmeubleSuiviCarte[]>([]);
  const [disponible, setDisponible] = useState(false);

  const recharger = useCallback(() => {
    const ac = new AbortController();
    void fetch('/api/dashboard/immeubles-suivis', { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          disponible?: boolean;
          suivis?: ImmeubleSuiviCarte[];
        };
        setDisponible(Boolean(data.disponible));
        setSuivis(Array.isArray(data.suivis) ? data.suivis : []);
      })
      .catch(() => {
        /* abandon */
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const stop = recharger();
    return stop;
  }, [recharger]);

  return { suivis, disponible, recharger };
}
