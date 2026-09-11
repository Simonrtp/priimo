'use client';

import { useEffect, useMemo, useState } from 'react';
import { FIELD } from '@/lib/today/field';
import { bbox, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
import type { Zone } from '@/lib/zones/types';

/**
 * Ce que vaut un secteur, une fois tracé.
 *
 * Les trois nombres viennent du parc open data, pas des adresses livrées :
 * mesurer sa couverture sur ses propres leads reviendrait à se noter sur sa
 * propre copie. Un immeuble compte comme vu quand une note terrain, une
 * rencontre ou un changement d'étape l'a signalé — jamais sur déclaration.
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

const RAYON = 30;
const EPAISSEUR = 8;
const PERIMETRE = 2 * Math.PI * RAYON;

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
    // On garde les chiffres précédents à l'écran pendant le recalcul : les
    // faire disparaître à chaque poignée relâchée donnerait un panneau qui
    // clignote.
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
    return (
      <p className="rounded-clay bg-bg-subtle px-3 py-2.5 text-[12px] text-mute">
        Chiffres du secteur indisponibles pour le moment.
      </p>
    );
  }

  if (!stats) return <SqueletteStats />;

  const couverture = stats.couverture;
  const arc = couverture === null ? 0 : (couverture / 100) * PERIMETRE;

  return (
    <section className="flex flex-col gap-3 rounded-clay bg-bg-subtle px-3.5 py-3.5">
      <div className="flex items-center gap-3.5">
        <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
          <svg width={76} height={76} viewBox="0 0 76 76" aria-hidden>
            <circle
              cx={38}
              cy={38}
              r={RAYON}
              fill="none"
              stroke={FIELD.ardoisePastel}
              strokeWidth={EPAISSEUR}
            />
            {couverture !== null ? (
              <circle
                cx={38}
                cy={38}
                r={RAYON}
                fill="none"
                stroke={FIELD.vert}
                strokeWidth={EPAISSEUR}
                strokeLinecap="round"
                strokeDasharray={`${arc} ${PERIMETRE - arc}`}
                transform="rotate(-90 38 38)"
                className="transition-[stroke-dasharray] duration-fluid-subtle ease-in-out"
              />
            ) : null}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-semibold tabular-nums text-ink" style={{ fontSize: 17 }}>
              {couverture === null ? '—' : `${couverture}%`}
            </span>
          </span>
        </div>

        <dl className="min-w-0 flex-1 text-[12.5px]">
          <Ligne terme="Immeubles" valeur={nombre(stats.immeubles)} />
          <Ligne terme="Rues" valeur={nombre(stats.rues)} />
          <Ligne terme="Adresses Priimo" valeur={nombre(stats.adressesPriimo)} />
        </dl>
      </div>

      <p className="text-pretty text-[11.5px] leading-snug text-mute">
        {couverture === null
          ? 'Aucun immeuble référencé dans ce périmètre : la couverture reste incalculable.'
          : `${nombre(stats.immeublesVus)} immeuble${stats.immeublesVus > 1 ? 's' : ''} où Priimo a observé un passage sur les trois derniers mois.`}
        {stats.tronque ? ' Secteur très large : les chiffres sont un plancher.' : ''}
      </p>

      {stats.principalesRues.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-2.5">
          {stats.principalesRues.map((rue) => (
            <span
              key={rue.nom}
              className="inline-flex max-w-full items-center gap-1.5 rounded-clay bg-white px-2 py-1 text-[11.5px] text-ink shadow-clay-sm"
            >
              <span className="truncate">{rue.nom}</span>
              <span className="shrink-0 tabular-nums text-mute">{nombre(rue.immeubles)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Ligne({ terme, valeur }: { terme: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-black/[0.05] py-[3px] last:border-0">
      <dt className="truncate text-mute">{terme}</dt>
      <dd className="shrink-0 font-semibold tabular-nums text-ink">{valeur}</dd>
    </div>
  );
}

function SqueletteStats() {
  return (
    <div className="flex items-center gap-3.5 rounded-clay bg-bg-subtle px-3.5 py-3.5" aria-hidden>
      <div className="size-[76px] shrink-0 animate-pulse rounded-full bg-black/[0.05]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="h-3 w-full animate-pulse rounded bg-black/[0.05]" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-black/[0.05]" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-black/[0.05]" />
      </div>
    </div>
  );
}
