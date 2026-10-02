'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ApercuSecteur, RepartitionFraicheur } from '@/lib/zones/accueil';
import {
  COULEUR_FRAICHEUR,
  LIBELLE_FRAICHEUR,
  NIVEAUX_FRAICHEUR,
} from '@/lib/zones/fraicheur';

const ZonesCarte = dynamic(() => import('@/components/dashboard/zones/ZonesCarte'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[420px] animate-pulse rounded-clay-lg bg-black/[0.04] sm:min-h-[520px]" aria-hidden />
  ),
});

function hrefCarte(zoneId: string | null) {
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
 * Repère sur l'Accueil : la carte d'abord, le détail en dessous, un seul
 * « Modifier ». Un clic sur un secteur ouvre la carte complète.
 * Mapbox ne charge qu'à l'approche du viewport (évite le jank au chargement).
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
  onAtelier: () => void;
}) {
  const router = useRouter();
  const { zones, points, cycleSemaines, zonesDirecteur } = apercu;
  const zoneSeule = zones.length === 1 ? zones[0] : null;
  const [carteVisible, setCarteVisible] = useState(false);
  const [cadre, setCadre] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cadre || carteVisible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setCarteVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCarteVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    );
    io.observe(cadre);
    return () => io.disconnect();
  }, [cadre, carteVisible]);

  const repartition = useMemo(() => compter(points), [points]);
  const aRevoir = repartition.revoir + repartition.jamais;
  const phrase = phraseFactuelle(aRevoir, cycleSemaines);

  const titre = estDirecteur ? 'Les secteurs de l’agence' : 'Mon secteur';

  if (zones.length === 0) return null;

  const leads = points.map((p) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    niveau: p.niveau,
  }));

  const ouvrirCarte = (zoneId: string) => {
    router.push(hrefCarte(zoneId));
  };

  return (
    <section className="flex flex-col rounded-clay-lg bg-white p-4 shadow-clay">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-balance font-semibold text-ink" style={{ fontSize: 16 }}>
          {titre}
        </h2>
        <button
          type="button"
          onClick={onAtelier}
          className="inline-flex shrink-0 items-center rounded-clay bg-[#1a2a56] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#152348] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a2a56]"
        >
          Modifier
        </button>
      </div>

      <div
        ref={setCadre}
        className="relative h-[420px] min-h-[420px] overflow-hidden rounded-clay-lg sm:h-[520px] sm:min-h-[520px]"
      >
        {carteVisible ? (
          <ZonesCarte
            zones={zones}
            zoneActive={estDirecteur ? null : zoneSeule}
            leads={leads}
            centre={centre}
            onChoisirZone={ouvrirCarte}
          />
        ) : (
          <div className="h-full min-h-[420px] animate-pulse rounded-clay-lg bg-black/[0.04] sm:min-h-[520px]" aria-hidden />
        )}
      </div>

      {estDirecteur ? (
        <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
          {zonesDirecteur.map(({ zone, titulaire, aRevoir: n }) => (
            <li key={zone.id}>
              <Link
                href={hrefCarte(zone.id)}
                className="flex w-full items-baseline justify-between gap-3 py-2 text-[13px] text-ink hover:text-primary-600"
              >
                <span className="min-w-0 flex-1 truncate">
                  {zone.nom}
                  <span className="text-mute">
                    {titulaire ? ` · ${titulaire}` : ' · sans titulaire'}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-mute">
                  {n} à revoir
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {NIVEAUX_FRAICHEUR.map((niveau) => (
            <li key={niveau} className="flex items-center gap-2 text-[13px]">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COULEUR_FRAICHEUR[niveau] }}
              />
              <span className="text-ink">{LIBELLE_FRAICHEUR[niveau]}</span>
              <span className="font-semibold tabular-nums text-ink">
                {repartition[niveau]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {phrase ? (
        <p className="mt-2 text-pretty text-[12.5px] text-mute">{phrase}</p>
      ) : null}
    </section>
  );
}
