'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ApercuSecteur } from '@/lib/zones/accueil';
import {
  COULEUR_FRAICHEUR,
  LIBELLE_FRAICHEUR,
  NIVEAUX_FRAICHEUR,
  type NiveauFraicheur,
} from '@/lib/zones/fraicheur';
const ZonesCarte = dynamic(() => import('@/components/dashboard/zones/ZonesCarte'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[280px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />
  ),
});

function hrefFraicheur(niveau: NiveauFraicheur | 'a-revoir') {
  return `/dashboard/prospection?vue=liste&fraicheur=${niveau}`;
}

/**
 * « Mon secteur » sur l'Accueil.
 *
 * Un repère, pas un jugement : le contour, les points colorés selon la
 * fraîcheur, les compteurs cliquables et une phrase factuelle. Aucun conseil
 * sur la façon de travailler, aucun taux de couverture présenté comme une note.
 */
export default function MonSecteur({
  apercu,
  centre,
  estDirecteur,
  onAtelier,
}: {
  apercu: ApercuSecteur;
  centre: { latitude: number | null; longitude: number | null };
  estDirecteur: boolean;
  /** Rouvre l'atelier de découpage sans quitter l'Accueil. */
  onAtelier: () => void;
}) {
  const { zones, points, repartition, phrase, zonesDirecteur } = apercu;
  const titre = estDirecteur ? 'Les secteurs de l’agence' : 'Couverture de mon secteur';
  // Le nom de la zone descend en sous-titre : il situe, il ne dit pas ce que
  // la carte montre.
  const nomZone = estDirecteur ? null : (zones[0]?.nom ?? null);

  if (zones.length === 0) return null;

  const leads = points.map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    niveau: p.niveau,
  }));

  return (
    <section className="flex h-full flex-col rounded-clay-lg bg-white p-4 shadow-clay">
      <div className="mb-3 flex items-center justify-between gap-3">
        {/* Pas de pictogramme de carte ici : la vraie carte est juste en
            dessous, le répéter en icône n'apprendrait rien. */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="min-w-0">
            <h2 className="truncate text-balance font-semibold text-ink" style={{ fontSize: 16 }}>
              {titre}
            </h2>
            {nomZone ? (
              <span className="block truncate text-[12px] text-mute">{nomZone}</span>
            ) : null}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onAtelier}
            className="inline-flex min-h-[32px] shrink-0 items-center rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-primary-600 transition-colors duration-fluid-subtle ease-in-out hover:bg-primary-50"
          >
            {estDirecteur ? 'Modifier le découpage' : 'Modifier mon secteur'}
          </button>
          <Link
            href="/dashboard/prospection?vue=carte"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-primary-600 transition-colors duration-fluid-subtle ease-in-out hover:bg-primary-50"
          >
            Voir la carte complète
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_270px] lg:items-stretch">
        <div className="relative h-full min-h-[280px] min-w-0 overflow-hidden rounded-clay-lg">
          <ZonesCarte
            zones={zones}
            zoneActive={null}
            leads={leads}
            centre={centre}
          />
        </div>

        <div className="flex min-w-0 flex-col">
          {estDirecteur ? (
            <ul className="flex flex-col">
              {zonesDirecteur.map(({ zone, titulaire, aRevoir }) => (
                <li key={zone.id}>
                  <Link
                    href={hrefFraicheur('a-revoir')}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.03]"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-ink">{zone.nom}</span>
                      <span className="text-mute">
                        {titulaire ? ` · ${titulaire}` : ' · sans titulaire'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-mute">
                      {aRevoir} à revoir
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col">
              {NIVEAUX_FRAICHEUR.map((niveau) => (
                <li key={niveau}>
                  <Link
                    href={hrefFraicheur(niveau)}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.03]"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: COULEUR_FRAICHEUR[niveau] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {LIBELLE_FRAICHEUR[niveau]}
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">
                      {repartition[niveau]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {phrase ? (
            <p className="mt-auto rounded-clay bg-bg-subtle px-3 py-2.5 text-pretty text-[12.5px] text-mute">
              {phrase}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
