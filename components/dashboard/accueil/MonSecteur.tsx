'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, MapPin } from 'lucide-react';
import type { Zone } from '@/lib/zones/types';
import type { LeadPoint } from '@/components/dashboard/zones/ZonesCarte';

const ZonesCarte = dynamic(() => import('@/components/dashboard/zones/ZonesCarte'), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-clay-lg bg-black/[0.04]" aria-hidden />,
});

/**
 * « Mon secteur » en bas de l'Accueil.
 *
 * Ce n'est pas un outil de travail, c'est un repère : on regarde son
 * territoire, on voit ce qui reste à faire, et on clique pour ouvrir la vraie
 * carte. D'où la hauteur contenue et l'absence de contrôles.
 */
export default function MonSecteur({
  zones,
  leads,
  centre,
  titulaires,
  estDirecteur,
  aTravailler,
  dejaPrises,
}: {
  zones: Zone[];
  leads: LeadPoint[];
  centre: { latitude: number | null; longitude: number | null };
  /** profileId → nom complet, pour nommer le titulaire au survol. */
  titulaires: Record<string, string>;
  estDirecteur: boolean;
  aTravailler: number;
  dejaPrises: number;
}) {
  const [survol, setSurvol] = useState<string | null>(null);

  const titre = useMemo(() => {
    if (estDirecteur) return 'Les secteurs de l’agence';
    return zones[0]?.nom ?? 'Mon secteur';
  }, [estDirecteur, zones]);

  const zoneSurvolee = survol ? zones.find((z) => z.id === survol) : null;

  if (zones.length === 0) return null;

  return (
    <section className="rounded-clay-lg bg-white p-4 shadow-clay">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 16 }}>
            <MapPin size={16} className="text-mute" aria-hidden />
            <span className="truncate">{titre}</span>
          </h2>
          <p className="mt-0.5 text-[12.5px] text-mute">
            {aTravailler} adresses à travailler · {dejaPrises} déjà prises
          </p>
        </div>
        <Link
          href="/dashboard/prospection?vue=carte"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-primary-600 transition-colors duration-fluid-subtle ease-in-out hover:bg-primary-50"
        >
          Carte complète
          <ArrowUpRight size={13} aria-hidden />
        </Link>
      </div>

      <ZonesCarte
        zones={zones}
        zoneActive={null}
        leads={leads}
        centre={centre}
        hauteur={280}
        onSurvolZone={estDirecteur ? setSurvol : undefined}
      />

      {zoneSurvolee ? (
        <p className="mt-2 text-[12px] text-mute">
          {zoneSurvolee.nom} ·{' '}
          {zoneSurvolee.assignedTo
            ? (titulaires[zoneSurvolee.assignedTo] ?? 'titulaire inconnu')
            : 'sans titulaire'}
        </p>
      ) : null}
    </section>
  );
}
