'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { Zone } from '@/lib/zones/types';
import type { ApercuSecteur } from '@/lib/zones/accueil';
import {
  COULEUR_FRAICHEUR,
  LIBELLE_FRAICHEUR,
  NIVEAUX_FRAICHEUR,
  type NiveauFraicheur,
} from '@/lib/zones/fraicheur';

const ZonesCarte = dynamic(() => import('@/components/dashboard/zones/ZonesCarte'), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />,
});

function hrefFraicheur(niveau: NiveauFraicheur | 'a-revoir') {
  return `/dashboard/prospection?vue=liste&fraicheur=${niveau}`;
}

/**
 * « Mon secteur » en bas de l'Accueil.
 *
 * Un repère, pas un jugement : le contour, les points colorés selon la
 * fraîcheur, une phrase factuelle. Rien sur la façon de travailler.
 */
export default function MonSecteur({
  apercu,
  centre,
  estDirecteur,
}: {
  apercu: ApercuSecteur;
  centre: { latitude: number | null; longitude: number | null };
  estDirecteur: boolean;
}) {
  const { zones, points, repartition, phrase, zonesDirecteur } = apercu;
  const titre = estDirecteur ? 'Les secteurs de l’agence' : (zones[0]?.nom ?? 'Mon secteur');

  if (zones.length === 0) return null;

  const leads = points.map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    niveau: p.niveau,
  }));

  return (
    <section className="rounded-clay-lg bg-white p-4 shadow-clay">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 font-semibold text-ink" style={{ fontSize: 16 }}>
          <MapPin size={16} className="text-mute" aria-hidden />
          <span className="truncate text-balance">{titre}</span>
        </h2>
        <Link
          href="/dashboard/prospection?vue=carte"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-primary-600 transition-colors duration-fluid-subtle ease-in-out hover:bg-primary-50"
        >
          Carte complète
          <ArrowUpRight size={13} aria-hidden />
        </Link>
      </div>

      <div className={`grid gap-3 ${estDirecteur ? '' : 'lg:grid-cols-[1fr_220px]'}`}>
        <ZonesCarte
          zones={zones}
          zoneActive={null}
          leads={leads}
          centre={centre}
          hauteur={280}
        />

        {estDirecteur ? (
          <ul className="mt-1 flex flex-col gap-1.5">
            {zonesDirecteur.map(({ zone, titulaire, aRevoir }) => (
              <li key={zone.id}>
                <Link
                  href={hrefFraicheur('a-revoir')}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors duration-fluid-subtle hover:bg-black/[0.03]"
                >
                  <span className="min-w-0 truncate text-ink">
                    {zone.nom}
                    <span className="text-mute">
                      {titulaire ? ` · ${titulaire}` : ' · sans titulaire'}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-mute">{aRevoir} à revoir</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col justify-center gap-1">
            {NIVEAUX_FRAICHEUR.map((niveau) => (
              <Link
                key={niveau}
                href={hrefFraicheur(niveau)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors duration-fluid-subtle hover:bg-black/[0.03]"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COULEUR_FRAICHEUR[niveau] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink">{LIBELLE_FRAICHEUR[niveau]}</span>
                <span className="tabular-nums text-mute">{repartition[niveau]}</span>
              </Link>
            ))}
            {phrase ? (
              <p className="mt-2 px-2 text-pretty text-[12.5px] text-mute">{phrase}</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
