'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ApercuSecteur, RepartitionFraicheur } from '@/lib/zones/accueil';
import {
  COULEUR_FRAICHEUR,
  LIBELLE_FRAICHEUR,
  NIVEAUX_FRAICHEUR,
  type NiveauFraicheur,
} from '@/lib/zones/fraicheur';
import Select from '@/components/ui/Select';
const ZonesCarte = dynamic(() => import('@/components/dashboard/zones/ZonesCarte'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[280px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />
  ),
});

function hrefFraicheur(niveau: NiveauFraicheur | 'a-revoir') {
  return `/dashboard/prospection?vue=liste&fraicheur=${niveau}`;
}

function hrefCarteComplete(zoneId: string | null) {
  const base = '/dashboard/prospection?vue=carte';
  return zoneId ? `${base}&zone=${encodeURIComponent(zoneId)}` : base;
}

const REPARTITION_VIDE: RepartitionFraicheur = {
  semaine: 0,
  cycle: 0,
  revoir: 0,
  jamais: 0,
};

function compter(points: ApercuSecteur['points']): RepartitionFraicheur {
  const out: RepartitionFraicheur = { ...REPARTITION_VIDE };
  for (const p of points) out[p.niveau] += 1;
  return out;
}

function phraseFactuelle(aRevoir: number, cycleSemaines: number | null): string | null {
  if (aRevoir <= 0) return null;
  const n = aRevoir === 1 ? '1 adresse n’a' : `${aRevoir} adresses n’ont`;
  if (cycleSemaines === null) {
    return `${n} pas été passée${aRevoir > 1 ? 's' : ''} depuis trop longtemps.`;
  }
  return `${n} pas été passée${aRevoir > 1 ? 's' : ''} depuis plus de ${cycleSemaines} semaine${cycleSemaines > 1 ? 's' : ''}.`;
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
  const { zones, points, cycleSemaines, zonesDirecteur } = apercu;
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? null);
  const zoneChoisie = zones.find((z) => z.id === zoneId) ?? zones[0] ?? null;

  const pointsFiltres = useMemo(
    () => (zoneChoisie ? points.filter((p) => p.zoneId === zoneChoisie.id) : points),
    [points, zoneChoisie],
  );
  const repartition = useMemo(() => compter(pointsFiltres), [pointsFiltres]);
  const aRevoir = repartition.revoir + repartition.jamais;
  const phrase = phraseFactuelle(aRevoir, cycleSemaines);

  const titre = estDirecteur ? 'Les secteurs de l’agence' : 'Couverture de mon secteur';

  if (zones.length === 0) return null;

  const leads = pointsFiltres.map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    niveau: p.niveau,
  }));

  return (
    <section className="flex h-full flex-col rounded-clay-lg bg-white p-4 shadow-clay">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="min-w-0">
            <h2 className="truncate text-balance font-semibold text-ink" style={{ fontSize: 16 }}>
              {titre}
            </h2>
            {zones.length > 1 ? (
              <label className="mt-1 block min-w-0 max-w-[16rem]">
                <span className="sr-only">Secteur affiché</span>
                <Select
                  aria-label="Choisir un secteur"
                  value={zoneChoisie?.id ?? ''}
                  onChange={setZoneId}
                  options={zones.map((z) => ({ value: z.id, label: z.nom }))}
                  triggerClassName="flex w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-black/[0.08] bg-white py-1 pl-2 pr-1.5 text-left text-[12px] font-medium text-mute outline-none hover:border-black/[0.14] focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 [&>svg]:size-3.5"
                />
              </label>
            ) : zoneChoisie ? (
              <span className="block truncate text-[12px] text-mute">{zoneChoisie.nom}</span>
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
            href={hrefCarteComplete(zoneChoisie?.id ?? null)}
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
            zoneActive={zoneChoisie}
            leads={leads}
            centre={centre}
            onChoisirZone={setZoneId}
          />
        </div>

        <div className="flex min-w-0 flex-col">
          {estDirecteur ? (
            <ul className="flex flex-col">
              {zonesDirecteur.map(({ zone, titulaire, aRevoir: n }) => {
                const actif = zone.id === zoneChoisie?.id;
                return (
                  <li key={zone.id}>
                    <button
                      type="button"
                      onClick={() => setZoneId(zone.id)}
                      aria-pressed={actif}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-[13px] transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.03] ${
                        actif ? 'bg-black/[0.04]' : ''
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-ink">{zone.nom}</span>
                        <span className="text-mute">
                          {titulaire ? ` · ${titulaire}` : ' · sans titulaire'}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] tabular-nums text-mute">
                        {n} à revoir
                      </span>
                    </button>
                  </li>
                );
              })}
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
