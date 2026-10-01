'use client';

import { useEffect, useMemo, useState } from 'react';
import { bbox, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
import type { Zone } from '@/lib/zones/types';

/**
 * Ce que vaut un secteur, une fois tracé.
 *
 * Les trois nombres viennent du parc open data, pas des adresses livrées :
 * mesurer sa couverture sur ses propres leads reviendrait à se noter sur sa
 * propre copie.
 */

type Stats = {
  immeubles: number;
  rues: number;
  immeublesVus: number;
  couverture: number | null;
  adressesPriimo: number;
  principalesRues: { nom: string; immeubles: number }[];
  tronque: boolean;
};

function nombre(n: number): string {
  return n.toLocaleString('fr-FR');
}

/**
 * Une signature qui bouge quand le périmètre bouge, et pas quand un sommet
 * tremble : quatre décimales valent une dizaine de mètres.
 */
function signatureDuPerimetre(zone: Zone): string {
  const cadre = fusionnerBbox(
    polygonesDeZone(zone)
      .map(bbox)
      .filter((b): b is NonNullable<typeof b> => b !== null),
  );
  const contour = cadre
    ? [cadre.ouest, cadre.sud, cadre.est, cadre.nord].map((n) => n.toFixed(4)).join(',')
    : '';
  return `${zone.regles.map((r) => r.id).join(',')}|${contour}`;
}

export default function StatistiquesSecteur({ zone }: { zone: Zone }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [erreur, setErreur] = useState(false);
  const signature = useMemo(() => signatureDuPerimetre(zone), [zone]);

  useEffect(() => {
    const abandon = new AbortController();
    setErreur(false);
    fetch(`/api/dashboard/zones/${zone.id}/statistiques`, { signal: abandon.signal })
      .then((res) => (res.ok ? (res.json() as Promise<Stats>) : Promise.reject(new Error())))
      .then(setStats)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setErreur(true);
      });
    return () => abandon.abort();
  }, [zone.id, signature]);

  if (erreur && !stats) {
    return <p className="text-[12px] text-mute">Chiffres indisponibles pour le moment.</p>;
  }

  if (!stats) return <SqueletteStats />;

  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <Chiffre terme="Immeubles" valeur={nombre(stats.immeubles)} />
      <Chiffre terme="Rues" valeur={nombre(stats.rues)} />
      <Chiffre terme="Priimo" valeur={nombre(stats.adressesPriimo)} />
    </dl>
  );
}

function Chiffre({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="min-w-0">
      <dd className="font-semibold tabular-nums text-ink" style={{ fontSize: 16 }}>
        {valeur}
      </dd>
      <dt className="truncate text-[11px] text-mute">{terme}</dt>
    </div>
  );
}

function SqueletteStats() {
  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden>
      <div className="h-8 animate-pulse rounded-lg bg-black/[0.05]" />
      <div className="h-8 animate-pulse rounded-lg bg-black/[0.05]" />
      <div className="h-8 animate-pulse rounded-lg bg-black/[0.05]" />
    </div>
  );
}
