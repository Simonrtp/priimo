'use client';

import { useCallback, useEffect, useState } from 'react';
import { emptyParcelleFiche, type CadastreImmeublePoint, type ParcelleFiche, type ParcelleNoteMarker } from '@/lib/carte/parcelle';

export function useParcelleMap(enabled: boolean, viewport: { west: number; south: number; east: number; north: number; zoom: number } | null) {
  const [immeubles, setImmeubles] = useState<CadastreImmeublePoint[]>([]);
  const [noteMarkers, setNoteMarkers] = useState<ParcelleNoteMarker[]>([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null);
  const [fiche, setFiche] = useState<ParcelleFiche | null>(null);
  const [loading, setLoading] = useState(false);

  const reloadOverlays = useCallback(() => {
    if (!enabled) {
      setImmeubles([]);
      setNoteMarkers([]);
      return;
    }
    const params = new URLSearchParams();
    if (viewport) {
      params.set('west', String(viewport.west));
      params.set('south', String(viewport.south));
      params.set('east', String(viewport.east));
      params.set('north', String(viewport.north));
      params.set('zoom', String(viewport.zoom));
    }
    const qs = params.toString();
    void fetch(`/api/carte/parcelles${qs ? `?${qs}` : ''}`)
      .then((res) => res.json())
      .then((data: { immeubles?: CadastreImmeublePoint[]; notes?: ParcelleNoteMarker[] }) => {
        setImmeubles(data.immeubles ?? []);
        setNoteMarkers(data.notes ?? []);
      })
      .catch(() => {
        setImmeubles([]);
        setNoteMarkers([]);
      });
  }, [enabled, viewport?.west, viewport?.south, viewport?.east, viewport?.north, viewport?.zoom]);

  useEffect(() => {
    const t = window.setTimeout(() => reloadOverlays(), 180);
    return () => window.clearTimeout(t);
  }, [reloadOverlays]);

  const openParcelle = useCallback((parcelleId: string) => {
    setSelectedParcelleId(parcelleId);
    setLoading(true);
    setFiche(null);
    void fetch(`/api/carte/parcelle/${encodeURIComponent(parcelleId)}`)
      .then(async (res) => {
        const data = (await res.json()) as ParcelleFiche & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'parcelle');
        setFiche(data);
      })
      .catch(() => setFiche(emptyParcelleFiche(parcelleId)))
      .finally(() => setLoading(false));
  }, []);

  const closeParcelle = useCallback(() => {
    setSelectedParcelleId(null);
    setFiche(null);
    setLoading(false);
  }, []);

  const refreshAfterNotes = useCallback(() => {
    reloadOverlays();
    if (!selectedParcelleId) return;
    const parcelleId = selectedParcelleId;
    void fetch(`/api/carte/parcelle/${encodeURIComponent(parcelleId)}`)
      .then(async (res) => {
        const data = (await res.json()) as ParcelleFiche & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'parcelle');
        setFiche(data);
      })
      .catch(() => undefined);
  }, [reloadOverlays, selectedParcelleId]);

  return {
    immeubles,
    noteMarkers,
    selectedParcelleId,
    fiche,
    loading,
    openParcelle,
    closeParcelle,
    reloadOverlays,
    refreshAfterNotes,
  };
}
