'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyParcelleFiche, type CadastreImmeublePoint, type ParcelleFiche, type ParcelleNoteMarker } from '@/lib/carte/parcelle';

/**
 * Combien de fiches on garde sous la main pendant une session de carte.
 * Un agent fait des allers-retours entre quelques parcelles voisines : les
 * relire au serveur à chaque clic rallume un squelette pour rien.
 */
const FICHES_EN_MEMOIRE = 40;

function memoriser(cache: Map<string, ParcelleFiche>, parcelleId: string, fiche: ParcelleFiche) {
  // Réinsérer remet la fiche en queue : la plus ancienne consultée sort en tête.
  cache.delete(parcelleId);
  cache.set(parcelleId, fiche);
  if (cache.size > FICHES_EN_MEMOIRE) {
    const plusAncienne = cache.keys().next().value;
    if (plusAncienne !== undefined) cache.delete(plusAncienne);
  }
}

export function useParcelleMap(enabled: boolean, viewport: { west: number; south: number; east: number; north: number; zoom: number } | null) {
  const [immeubles, setImmeubles] = useState<CadastreImmeublePoint[]>([]);
  const [noteMarkers, setNoteMarkers] = useState<ParcelleNoteMarker[]>([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null);
  const [fiche, setFiche] = useState<ParcelleFiche | null>(null);
  const [loading, setLoading] = useState(false);

  const cache = useRef<Map<string, ParcelleFiche>>(new Map());
  /** La parcelle réellement à l'écran : une réponse doublée par un clic plus récent est jetée. */
  const demande = useRef<string | null>(null);

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

  /** Lit la fiche au serveur et la met à l'écran si elle est toujours celle demandée. */
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
      // Une revalidation ratée ne doit pas vider un panneau déjà rempli.
      setFiche((prev) => prev ?? emptyParcelleFiche(parcelleId));
    } finally {
      if (demande.current === parcelleId) setLoading(false);
    }
  }, []);

  const openParcelle = useCallback(
    (parcelleId: string) => {
      demande.current = parcelleId;
      setSelectedParcelleId(parcelleId);

      // Déjà lue pendant cette session : elle revient à l'écran immédiatement
      // et se revalide derrière. Le squelette est réservé à une vraie première
      // ouverture.
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
    selectedParcelleId,
    fiche,
    loading,
    openParcelle,
    closeParcelle,
    reloadOverlays,
    refreshAfterNotes,
  };
}
