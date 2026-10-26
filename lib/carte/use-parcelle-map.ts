'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyParcelleFiche,
  type CadastreImmeublePoint,
  type ParcelleFiche,
  type ParcelleLogement,
  type ParcelleNoteMarker,
  type ParcellePickExtra,
} from '@/lib/carte/parcelle';
import type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';
import { serializeDpeAgeBuckets, type DpeAgeBucket } from '@/lib/carte/dpe-age';

const FICHES_EN_MEMOIRE = 40;
const OVERLAY_CACHE = 24;
const EMPTY_SOURCES: CadastreSourceDates = { diagnosticsAt: null, ventesAt: null };

type Viewport = { west: number; south: number; east: number; north: number; zoom: number };

type OverlayPayload = {
  immeubles: CadastreImmeublePoint[];
  notes: ParcelleNoteMarker[];
  sources: CadastreSourceDates;
};

function memoriser(cache: Map<string, ParcelleFiche>, parcelleId: string, fiche: ParcelleFiche) {
  cache.delete(parcelleId);
  cache.set(parcelleId, fiche);
  if (cache.size > FICHES_EN_MEMOIRE) {
    const plusAncienne = cache.keys().next().value;
    if (plusAncienne !== undefined) cache.delete(plusAncienne);
  }
}

/** Emprise mise en cache, toujours élargie : aucun point visible ne doit sortir par arrondi. */
export function quantizeViewport(v: Viewport): Viewport {
  const step = v.zoom >= 16 ? 0.002 : v.zoom >= 14 ? 0.003 : v.zoom >= 12 ? 0.006 : 0.01;
  return {
    west: Math.floor(v.west / step) * step,
    south: Math.floor(v.south / step) * step,
    east: Math.ceil(v.east / step) * step,
    north: Math.ceil(v.north / step) * step,
    zoom: Math.round(v.zoom),
  };
}

export function mergeOverlayPayload(base: OverlayPayload, incoming: OverlayPayload): OverlayPayload {
  const immeubles = new Map(base.immeubles.map((row) => [row.banId, row]));
  for (const row of incoming.immeubles) immeubles.set(row.banId, row);
  const notes = new Map(base.notes.map((row) => [row.parcelleId, row]));
  for (const row of incoming.notes) notes.set(row.parcelleId, row);
  return {
    immeubles: [...immeubles.values()],
    notes: [...notes.values()],
    sources: incoming.sources,
  };
}

function overlayCacheKey(
  viewport: Viewport | null,
  includeDpe: boolean,
  agesKey: string,
  includeVentes = false,
): string {
  const ventes = includeVentes ? 1 : 0;
  if (!viewport) return `none|${includeDpe ? 1 : 0}|${agesKey}|${ventes}`;
  const v = quantizeViewport(viewport);
  return `${v.west},${v.south},${v.east},${v.north},${v.zoom}|${includeDpe ? 1 : 0}|${agesKey}|${ventes}`;
}

function appliquerSurface(fiche: ParcelleFiche, surface: number | null): ParcelleFiche {
  if (surface == null) return fiche;
  return { ...fiche, surfaceCadastreM2: surface };
}

export function avecDpeClique(fiche: ParcelleFiche, dpe: ParcelleLogement | null): ParcelleFiche {
  if (!dpe?.date || !dpe.etiquette) return fiche;
  const logements = fiche.logements.filter(
    (row) => !(row.banId === dpe.banId && row.date === dpe.date && row.etiquette === dpe.etiquette),
  );
  return { ...fiche, logements: [dpe, ...logements] };
}

function appliquerSelection(
  fiche: ParcelleFiche,
  surface: number | null,
  dpe: ParcelleLogement | null,
): ParcelleFiche {
  return avecDpeClique(appliquerSurface(fiche, surface), dpe);
}

export function useParcelleMap(
  enabled: boolean,
  viewport: Viewport | null,
  options?: { dpeAges?: readonly DpeAgeBucket[]; includeDpeDetail?: boolean; includeVentes?: boolean },
) {
  const [immeubles, setImmeubles] = useState<CadastreImmeublePoint[]>([]);
  const [noteMarkers, setNoteMarkers] = useState<ParcelleNoteMarker[]>([]);
  const [sources, setSources] = useState<CadastreSourceDates>(EMPTY_SOURCES);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | null>(null);
  const [fiche, setFiche] = useState<ParcelleFiche | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const cache = useRef<Map<string, ParcelleFiche>>(new Map());
  const inflight = useRef<Map<string, Promise<ParcelleFiche>>>(new Map());
  const overlayCache = useRef<Map<string, OverlayPayload>>(new Map());
  const accumulatedOverlays = useRef<OverlayPayload>({
    immeubles: [],
    notes: [],
    sources: EMPTY_SOURCES,
  });
  const overlayDatasetKeyRef = useRef('');
  const demande = useRef<string | null>(null);
  const seq = useRef(0);
  const surfaceCliquee = useRef<number | null>(null);
  const dpeClique = useRef<ParcelleLogement | null>(null);
  const agesProvided = options?.dpeAges != null;
  const agesKey = serializeDpeAgeBuckets(options?.dpeAges ?? []);
  const includeDpe = options?.includeDpeDetail === true;
  const includeVentes = options?.includeVentes === true;
  const overlayDatasetKey = `${includeDpe ? 1 : 0}|${agesProvided ? agesKey : ''}|${includeVentes ? 1 : 0}`;

  const viewportKey = useMemo(
    () => overlayCacheKey(viewport, includeDpe, agesProvided ? agesKey : '', includeVentes),
    [viewport, includeDpe, agesProvided, agesKey, includeVentes],
  );

  useEffect(() => {
    if (overlayDatasetKeyRef.current === overlayDatasetKey) return;
    overlayDatasetKeyRef.current = overlayDatasetKey;
    overlayCache.current.clear();
    accumulatedOverlays.current = { immeubles: [], notes: [], sources: EMPTY_SOURCES };
    setImmeubles([]);
    setNoteMarkers([]);
    setSources(EMPTY_SOURCES);
  }, [overlayDatasetKey]);

  useEffect(() => {
    if (!enabled) {
      accumulatedOverlays.current = { immeubles: [], notes: [], sources: EMPTY_SOURCES };
      setImmeubles([]);
      setNoteMarkers([]);
      setSources(EMPTY_SOURCES);
      return;
    }

    const known = overlayCache.current.get(viewportKey);
    if (known) {
      const merged = mergeOverlayPayload(accumulatedOverlays.current, known);
      accumulatedOverlays.current = merged;
      setImmeubles(merged.immeubles);
      setNoteMarkers(merged.notes);
      setSources(merged.sources);
      // Cache hit : pas de refetch immédiat — le pan/zoom reste fluide.
      return;
    }

    const ac = new AbortController();
    const ticket = ++seq.current;
    // Laisser le geste de zoom se terminer avant de charger les pastilles.
    const debounceMs = 280;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (viewport) {
        const v = quantizeViewport(viewport);
        params.set('west', String(v.west));
        params.set('south', String(v.south));
        params.set('east', String(v.east));
        params.set('north', String(v.north));
        params.set('zoom', String(v.zoom));
      }
      if (includeDpe) params.set('dpe', '1');
      if (agesProvided) params.set('ages', agesKey);
      if (includeVentes) params.set('ventes', '1');
      const qs = params.toString();

      void fetch(`/api/carte/parcelles${qs ? `?${qs}` : ''}`, { signal: ac.signal })
        .then((res) => res.json())
        .then(
          (data: {
            immeubles?: CadastreImmeublePoint[];
            notes?: ParcelleNoteMarker[];
            sources?: CadastreSourceDates;
          }) => {
            if (ticket !== seq.current) return;
            const incoming: OverlayPayload = {
              immeubles: data.immeubles ?? [],
              notes: data.notes ?? [],
              sources: data.sources ?? EMPTY_SOURCES,
            };
            const payload = mergeOverlayPayload(accumulatedOverlays.current, incoming);
            accumulatedOverlays.current = payload;
            overlayCache.current.delete(viewportKey);
            overlayCache.current.set(viewportKey, incoming);
            if (overlayCache.current.size > OVERLAY_CACHE) {
              const oldest = overlayCache.current.keys().next().value;
              if (oldest !== undefined) overlayCache.current.delete(oldest);
            }
            setImmeubles(payload.immeubles);
            setNoteMarkers(payload.notes);
            setSources(payload.sources);
          },
        )
        .catch((err: unknown) => {
          if (ticket !== seq.current) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // Garde les pastilles déjà affichées plutôt que de vider la carte.
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [enabled, viewportKey, viewport, includeDpe, includeVentes, agesProvided, agesKey, reloadToken]);

  const fetchFiche = useCallback((parcelleId: string, opts?: { bypassCache?: boolean }): Promise<ParcelleFiche> => {
    if (!opts?.bypassCache) {
      const known = cache.current.get(parcelleId);
      if (known) return Promise.resolve(known);
    }

    const pending = inflight.current.get(parcelleId);
    if (pending) return pending;

    const request = (async () => {
      const res = await fetch(`/api/carte/parcelle/${encodeURIComponent(parcelleId)}`);
      const data = (await res.json()) as ParcelleFiche & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'parcelle');
      const next = {
        ...data,
        surfaceCadastreM2: data.surfaceCadastreM2 ?? surfaceCliquee.current,
      };
      memoriser(cache.current, parcelleId, next);
      return next;
    })().finally(() => {
      inflight.current.delete(parcelleId);
    });

    inflight.current.set(parcelleId, request);
    return request;
  }, []);

  const appliquerSiOuverte = useCallback((parcelleId: string, next: ParcelleFiche) => {
    if (demande.current !== parcelleId) return;
    setFiche(appliquerSelection(next, surfaceCliquee.current, dpeClique.current));
    setLoading(false);
  }, []);

  const charger = useCallback(
    async (parcelleId: string, opts?: { bypassCache?: boolean }) => {
      try {
        const next = await fetchFiche(parcelleId, opts);
        appliquerSiOuverte(parcelleId, next);
      } catch {
        if (demande.current !== parcelleId) return;
        setFiche((prev) => prev ?? emptyParcelleFiche(parcelleId));
        setLoading(false);
      }
    },
    [appliquerSiOuverte, fetchFiche],
  );

  const prefetchParcelle = useCallback(
    (parcelleId: string) => {
      if (!parcelleId) return;
      if (cache.current.has(parcelleId) || inflight.current.has(parcelleId)) return;
      void fetchFiche(parcelleId).catch(() => {
        // préchauffage silencieux
      });
    },
    [fetchFiche],
  );

  const openParcelle = useCallback(
    (parcelleId: string, extra?: ParcellePickExtra) => {
      demande.current = parcelleId;
      surfaceCliquee.current = extra?.surfaceM2 ?? null;
      dpeClique.current = extra?.dpe ?? null;
      setSelectedParcelleId(parcelleId);
      const connue = cache.current.get(parcelleId);
      const surface = extra?.surfaceM2 ?? connue?.surfaceCadastreM2 ?? null;
      setFiche(
        connue
          ? appliquerSelection(connue, surface, dpeClique.current)
          : appliquerSelection(
              { ...emptyParcelleFiche(parcelleId), surfaceCadastreM2: surface },
              surface,
              dpeClique.current,
            ),
      );
      setLoading(!connue);
      // Cache = affichage immédiat. Revalidation sans bypass : évite un 2ᵉ fetch
      // juste après le prefetch au survol.
      void charger(parcelleId);
    },
    [charger],
  );

  const closeParcelle = useCallback(() => {
    demande.current = null;
    surfaceCliquee.current = null;
    dpeClique.current = null;
    setSelectedParcelleId(null);
    setFiche(null);
    setLoading(false);
  }, []);

  const reloadOverlays = useCallback(() => {
    overlayCache.current.clear();
    setReloadToken((n) => n + 1);
  }, []);

  const refreshAfterNotes = useCallback(() => {
    reloadOverlays();
    if (!selectedParcelleId) return;
    cache.current.delete(selectedParcelleId);
    inflight.current.delete(selectedParcelleId);
    setLoading(true);
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
    prefetchParcelle,
    closeParcelle,
    reloadOverlays,
    refreshAfterNotes,
  };
}
