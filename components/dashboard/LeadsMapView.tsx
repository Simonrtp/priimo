'use client';

import { useEffect, useState } from 'react';
import type { Lead } from '@/types/lead';
import { useLeadMapPoints } from '@/hooks/useLeadMapPoints';
import LeadsMapCanvas from './LeadsMapCanvas';

interface AgencyZone {
  latitude: number;
  longitude: number;
  radiusKm: number | null;
}

interface LeadsMapViewProps {
  leads: Lead[];
  selectedLeadId: string | null;
  onLeadSelect: (id: string) => void;
  agencyZone?: AgencyZone | null;
}

export default function LeadsMapView({
  leads,
  selectedLeadId,
  onLeadSelect,
  agencyZone,
}: LeadsMapViewProps) {
  const { points, loading, failedCount, mappedCount } = useLeadMapPoints(leads, true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (active) setMapReady(true);
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      setMapReady(false);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/8 shadow-soft">
      {loading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/75 backdrop-blur-[2px]">
          <p className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-ink shadow-soft">
            Placement des prospects sur la carte…
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] bg-white px-4 py-2.5">
        <p className="text-sm font-medium text-ink">
          <span className="tabular font-semibold">{mappedCount}</span> sur{' '}
          <span className="tabular">{leads.length}</span> sur la carte
        </p>
        {failedCount > 0 && (
          <p className="text-xs text-mute">
            {failedCount} adresse{failedCount > 1 ? 's' : ''} non localisée{failedCount > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {mapReady ? (
        <LeadsMapCanvas
          points={points}
          selectedLeadId={selectedLeadId}
          onLeadSelect={onLeadSelect}
          agencyZone={agencyZone}
        />
      ) : (
        <div className="bg-[#F4F4F2]" style={{ height: 480, minHeight: 360 }} aria-hidden />
      )}
    </div>
  );
}
