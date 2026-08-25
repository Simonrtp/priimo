'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatIdu, type ParcelleFiche, type ParcelleNoteMarker } from '@/lib/carte/parcelle';

function emptyFiche(idu: string): ParcelleFiche {
  return {
    idu,
    reference: formatIdu(idu),
    adresse: null,
    videPublic: true,
    ventes: [],
    diagnostics: [],
    copropriete: null,
    surCetteParcelle: [],
  };
}

export function useParcelleMap(enabled: boolean) {
  const [eventIdus, setEventIdus] = useState<string[]>([]);
  const [noteMarkers, setNoteMarkers] = useState<ParcelleNoteMarker[]>([]);
  const [selectedIdu, setSelectedIdu] = useState<string | null>(null);
  const [fiche, setFiche] = useState<ParcelleFiche | null>(null);
  const [loading, setLoading] = useState(false);

  const reloadOverlays = useCallback(() => {
    if (!enabled) return;
    void fetch('/api/carte/parcelles')
      .then((res) => res.json())
      .then((data: { eventIdus?: string[]; notes?: ParcelleNoteMarker[] }) => {
        setEventIdus(data.eventIdus ?? []);
        setNoteMarkers(data.notes ?? []);
      })
      .catch(() => {
        setEventIdus([]);
        setNoteMarkers([]);
      });
  }, [enabled]);

  useEffect(() => {
    reloadOverlays();
  }, [reloadOverlays]);

  const openParcelle = useCallback((idu: string) => {
    setSelectedIdu(idu);
    setLoading(true);
    setFiche(null);
    void fetch(`/api/carte/parcelle/${encodeURIComponent(idu)}`)
      .then(async (res) => {
        const data = (await res.json()) as ParcelleFiche & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'parcelle');
        setFiche(data);
      })
      .catch(() => setFiche(emptyFiche(idu)))
      .finally(() => setLoading(false));
  }, []);

  const closeParcelle = useCallback(() => {
    setSelectedIdu(null);
    setFiche(null);
    setLoading(false);
  }, []);

  const refreshAfterNotes = useCallback(() => {
    reloadOverlays();
    if (!selectedIdu) return;
    const idu = selectedIdu;
    void fetch(`/api/carte/parcelle/${encodeURIComponent(idu)}`)
      .then(async (res) => {
        const data = (await res.json()) as ParcelleFiche & { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'parcelle');
        setFiche(data);
      })
      .catch(() => undefined);
  }, [reloadOverlays, selectedIdu]);

  return {
    eventIdus,
    noteMarkers,
    selectedIdu,
    fiche,
    loading,
    openParcelle,
    closeParcelle,
    reloadOverlays,
    refreshAfterNotes,
  };
}
