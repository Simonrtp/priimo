'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { CLE_ADRESSES_VUES, nouveautesDepuis } from '@/lib/entree/entree';
import { FIELD } from '@/lib/today/field';

const abonnerRien = () => () => undefined;

function adressesVues(): string[] | null {
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE_ADRESSES_VUES) ?? 'null') as unknown;
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * « 3 nouvelles depuis ma dernière visite » : les adresses livrées que l'agent
 * n'avait pas encore vues ici. Rien la toute première fois, rien côté serveur ;
 * les adresses affichées deviennent les « vues » de la prochaine visite.
 */
export default function NouveautesDepuisVisite({ ids }: { ids: readonly string[] }) {
  const estClient = useSyncExternalStore(abonnerRien, () => true, () => false);
  const cle = ids.join('|');
  // Compté une fois par liste : la mémoire mise à jour juste après ne l'efface pas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nouvelles = useMemo(() => (estClient ? nouveautesDepuis(adressesVues(), ids) : 0), [estClient, cle]);

  useEffect(() => {
    if (!estClient || ids.length === 0) return;
    try {
      const deja = adressesVues() ?? [];
      window.localStorage.setItem(CLE_ADRESSES_VUES, JSON.stringify([...new Set([...ids, ...deja])].slice(0, 400)));
    } catch {
      // Stockage indisponible : la pastille ne s'affichera simplement pas.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estClient, cle]);

  if (nouvelles === 0) return null;
  return (
    <p className="pastille-nouveautes mt-1.5 inline-flex items-center gap-1.5 self-start text-[12px] font-semibold" style={{ color: FIELD.orange }}>
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" style={{ backgroundColor: FIELD.orange, animationIterationCount: 2 }} />
        <span className="relative inline-flex size-2 rounded-full" style={{ backgroundColor: FIELD.orange }} />
      </span>
      {nouvelles > 1 ? `${nouvelles} nouvelles depuis ma dernière visite` : '1 nouvelle depuis ma dernière visite'}
    </p>
  );
}
