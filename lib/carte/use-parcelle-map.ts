'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyParcelleFiche,
  type CadastreImmeublePoint,
  type ParcelleFiche,
  type ParcelleNoteMarker,
} from '@/lib/carte/parcelle';
import type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';
import { serializeDpeAgeBuckets, type DpeAgeBucket } from '@/lib/carte/dpe-age';

const FICHES_EN_MEMOIRE = 40;
const EMPTY_SOURCES: CadastreSourceDates = { diagnosticsAt: null, ventesAt: null };

function memoriser(cache: Map<string, ParcelleFiche>, parcelleId: string, fiche: ParcelleFiche) {
  cache.delete(parcelleId);
  cache.set(parcelleId, fiche);
  if (cache.size > FICHES_EN_MEMOIRE) {
    const plusAncienne = cache.keys().next().value;
    if (plusAncienne !== undefined) cache.delete(plusAncienne);
  }
}

export function useParcelleMap(
  enabled: boolean,
  viewport: { west: number; south: number; east: number; north: number; zoom: number } | null,
  options?: { dpeAges?: readonly DpeAgeBucket[]; includeDpeDetail?: boolean },
) {
  const [immeubles, setImmeubles] = useState<CadastreImmeublePoint[]>([]);
  const [noteMarkers, setNoteMarkers] = useState<ParcelleNoteMarker[]>([]);
  const [sources, setSources] = useState<CadastreSourceDates>(EMPTY_SOURCES);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null);
  const [fiche, setFiche] = useState<ParcelleFiche | null>(null);
  const [loading, setLoading] = useState(false);

  const cache = useRef<Map<string, ParcelleFiche>>(new Map());
  const demande = useRef<string | null>(null);
  const agesProvided = options?.dpeAges != null;
  const agesKey = serializeDpeAgeBuckets(options?.dpeAges ?? []);
  const includeDpe = options?.includeDpeDetail === true;

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
    if (includeDpe) params.set('dpe', '1');
    if (agesProvided) params.set('ages', agesKey);
    const qs = params.toString();
    void fetch(`/api/carte/parcelles${qs ? `?${qs}` : ''}`)
      .then((res) => res.json())
      .then(
        (data: {
          immeubles?: CadastreImmeublePoint[];
          notes?: ParcelleNoteMarker[];
          sources?: CadastreSourceDates;
        }) => {
          setImmeubles(data.immeubles ?? []);
          setNoteMarkers(data.notes ?? []);
          if (data.sources) setSources(data.sources);
        },
      )
      .catch(() => {
        setImmeubles([]);
        setNoteMarkers([]);
      });
  }, [enabled, includeDpe, agesProvided, agesKey, viewport?.west, viewport?.south, viewport?.east, viewport?.north, viewport?.zoom]);

  useEffect(() => {
    const t = window.setTimeout(() => reloadOverlays(), 180);
    return () => window.clearTimeout(t);
  }, [reloadOverlays]);

  const charger = useCallback(async (parcelleId: string) => {
    try {
      const res = await fetch(`/api/carte/parcelle/${encodeURIComponent(parcelleId)}`);
      const data = (await res.json()) as ParcelleFiche & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'parcelle');
      memoriser(cache.current, parcelleId, data);
      if (demande.current !== parcelleId) return;
      setFiche(data);
    } catch {
      if (demande.current !== parcelleId) return;
      setFiche((prev) => prev ?? emptyParcelleFiche(parcelleId));
    } finally {
      if (demande.current === parcelleId) setLoading(false);
    }
  }, []);

  const openParcelle = useCallback(
    (parcelleId: string) => {
      demande.current = parcelleId;
      setSelectedParcelleId(parcelleId);
      const connue = cache.current.get(parcelleId);
      setFiche(connue ?? null);
      setLoading(!connue);
      void charger(parcelleId);
    },
    [charger],
  );

  const closeParcelle = useCallback(() => {
    demande.current = null;
    setSelectedParcelleId(null);
    setFiche(null);
    setLoading(false);
  }, []);

  const refreshAfterNotes = useCallback(() => {
    reloadOverlays();
    if (!selectedParcelleId) return;
    void charger(selectedParcelleId);
  }, [charger, reloadOverlays, selectedParcelleId]);

  return {
    immeubles,
    noteMarkers,
    sources,
    selectedParcelleId,
    fiche,
    loading,
    openParcelle,
    closeParcelle,
    reloadOverlays,
    refreshAfterNotes,
  };
}
