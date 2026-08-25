'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Navigation } from 'lucide-react';
import type { Lead } from '@/types/lead';
import type { GeoCoord } from '@/lib/carte/coords';
import { FIELD, formatDistance } from '@/lib/today/field';
import {
  buildSortie,
  type SortiePlan,
  type SortieProgress,
  type SortieStop,
} from '@/lib/today/sortie';
import {
  CARTE_ITINERAIRE_HREF,
  toItineraireStops,
  writeItineraireStops,
} from '@/lib/today/directions';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

const SortieMap = dynamic(() => import('./SortieMap'), { ssr: false });

export default function SortiePanel({
  leads,
  profileId,
  sectorCenter,
  progress,
  onStart,
}: {
  leads: readonly Lead[];
  profileId: string;
  sectorCenter: GeoCoord | null;
  progress: SortieProgress;
  onStart: (plan: SortiePlan) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const router = useRouter();

  const plan = useMemo(() => buildSortie(leads, profileId, null), [leads, profileId]);
  const doneCount = useMemo(() => {
    if (!plan || progress.signature !== plan.signature) return 0;
    return progress.done.length;
  }, [plan, progress]);

  const geolocatedLeads = useMemo(
    () => leads.filter((l) => l.latitude != null && l.longitude != null),
    [leads],
  );

  const mapStops: SortieStop[] = useMemo(() => {
    if (plan) return plan.ordered;
    return geolocatedLeads.slice(0, 20).map((l) => ({
      key: l.id,
      leadId: l.id,
      address: l.address,
      latitude: l.latitude!,
      longitude: l.longitude!,
      score: l.score,
      surfaceM2: l.surfaceM2,
      etage: l.etage,
      mainSignalLabel: l.mainSignalLabel,
      notes: l.notes,
      banId: l.banId,
      postalCode: l.postalCode,
    }));
  }, [plan, geolocatedLeads]);

  const n = plan?.ordered.length ?? 0;

  function openItineraire() {
    const stops = plan ? plan.ordered : mapStops;
    if (stops.length < 2) return;
    writeItineraireStops(toItineraireStops(stops));
    router.push(CARTE_ITINERAIRE_HREF);
  }

  return (
    <aside
      className="flex flex-col overflow-hidden rounded-[20px] border border-black/[0.06] bg-surface shadow-clay-sm"
      style={{ minHeight: 420, maxHeight: 420 }}
    >
      <div className="flex-shrink-0 border-b border-black/[0.06] px-4 py-3">
        <h2 className="text-balance font-semibold text-text-strong" style={{ fontSize: 16 }}>
          {plan
            ? `Sortie du jour · ${n} adresse${n > 1 ? 's' : ''}`
            : 'Sortie du jour'}
        </h2>
        {plan ? (
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            {formatDistance(plan.distanceM)} à pied estimés
          </p>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1" style={{ height: 220 }}>
        <SortieMap
          stops={mapStops}
          sectorCenter={sectorCenter}
          hoveredIndex={hoveredIndex}
          onHoverIndex={setHoveredIndex}
          onOpenItineraire={openItineraire}
          className="h-full"
        />
        {mapStops.length >= 2 ? (
          <button
            type="button"
            onClick={openItineraire}
            className="absolute bottom-2 left-1/2 z-10 flex min-h-[36px] -translate-x-1/2 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-white shadow-md"
          >
            <Navigation size={14} strokeWidth={2.2} aria-hidden />
            Voir l&apos;itinéraire
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
        {plan ? (
          <>
            <ol className="min-h-0 flex-1 overflow-y-auto">
              {plan.ordered.map((stop, i) => (
                <li key={stop.key}>
                  <button
                    type="button"
                    className="flex w-full min-h-[36px] items-baseline gap-2 truncate rounded-lg px-1 py-1.5 text-left text-[13px] transition-colors"
                    style={{
                      backgroundColor: hoveredIndex === i ? FIELD.creme : undefined,
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <span className="tabular-nums font-semibold text-text-muted">{i + 1}.</span>
                    <span className="truncate text-text">{stop.address}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06]" aria-hidden>
              <div
                className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                style={{
                  width: `${n === 0 ? 0 : Math.round((doneCount / n) * 100)}%`,
                  backgroundColor: FIELD.orange,
                }}
              />
            </div>
            <p className="mt-1 tabular-nums text-[11.5px] text-text-muted">
              {doneCount}/{n}
            </p>
            <WorkspaceButton type="button" className="mt-2 w-full" onClick={() => onStart(plan)}>
              Démarrer la sortie
            </WorkspaceButton>
          </>
        ) : (
          <div className="flex flex-1 flex-col justify-center py-2 text-center">
            <p className="text-pretty text-[14px] text-text-muted">
              Aucune adresse à travailler aujourd&apos;hui
            </p>
            <Link
              href="/dashboard/prospection"
              className="mt-3 text-[13.5px] font-semibold text-text-strong underline decoration-black/25 underline-offset-2"
            >
              Voir la prospection
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
