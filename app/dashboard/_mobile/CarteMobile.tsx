'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Layers, Locate, MapPin, Navigation, Phone, Search, Square, X } from 'lucide-react';
import { createBanGeocodeCache, geocodeAdresse, reverseGeocode } from '@/lib/geo/ban';
import {
  countKindsInViewport,
  entitiesByKind,
  filterMapEntities,
  groupEntitiesByBanId,
  type BuildingMarker,
  type MapPeriod,
  type MapViewport,
} from '@/lib/carte/buildings';
import {
  MAP_LAYER_LABELS,
  MAP_LAYER_ORDER,
  activeKindSet,
  anyCadastreLayer,
  persistMapLayers,
  readStoredMapLayers,
  withCadastreToggled,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import CadastreLayerControls from '@/components/dashboard/carte/CadastreLayerControls';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';
import {
  withoutPositionTotal,
  type MapPoint,
  type MapPointKind,
  type UnplacedRecord,
  type WithoutPositionCount,
} from '@/lib/carte/points';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { requestDevicePosition, watchDevicePosition, type DevicePosition } from '@/lib/voice/gps';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useAssistant } from '@/components/dashboard/assistant/AssistantProvider';
import { AssistantMobileSearchBar } from '@/components/dashboard/assistant/AssistantSearchButton';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import ImmeubleFacade from '@/components/dashboard/carte/ImmeubleFacade';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import MobileMapCanvas, { type MobileMapHandle } from './MobileMapCanvas';
import MobileSheet from './MobileSheet';
import MobileAccountMenu, { AvatarButton } from './MobileAccountMenu';
import ItineraireBanner from '@/components/dashboard/carte/ItineraireBanner';
import { useWalkingRoute } from '@/lib/today/use-walking-route';
import {
  buildingToManualStop,
  latestBatchCandidates,
  searchResultToManualStop,
  suggestedSortiePlan,
} from '@/lib/carte/carte-tournee';
import type { GeoCoord } from '@/lib/carte/coords';
import type { Lead } from '@/types/lead';
import CarteTourneeBriefCard from './CarteTourneeBriefCard';
import CarteTourneeDoneCard from './CarteTourneeDoneCard';
import CarteTourneeStopsSheet from './CarteTourneeStopsSheet';
import {
  MAX_SORTIE_STOPS,
  resolveSortieOrigin,
  type SortieStop,
} from '@/lib/today/sortie';
import { rebuildPlanFromStops } from '@/lib/today/sortie-session';
import { loopWaypoints } from '@/lib/today/route-optimize';
import {
  applyTripOrder,
  fetchOptimizedTrip,
  MAX_TRIP_COORDS,
} from '@/lib/today/optimized-trip';
import {
  fetchWalkingRoute,
  readItineraireStops,
  toItineraireStops,
  writeItineraireStops,
  type ItineraireStop,
} from '@/lib/today/directions';
import { MAPBOX_TOKEN } from '@/lib/map/style';
import {
  persistMapDimension,
  readMapDimension,
  toggleDimension,
  type MapDimension,
} from '@/lib/map/view-mode';
import { FIELD } from '@/lib/today/field';
import { vibrateBrief } from './aujourdhui/tap';

/**
 * `brief` = séquence d'ouverture, `route` = chemin tracé + retouche des
 * adresses, `bilan` = bravo de fin.
 */
type CarteTourPhase = 'off' | 'brief' | 'route' | 'bilan';

type TourTrip = {
  /** Ordre de visite retenu par le routeur. */
  keys: string[];
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
};

const GEO_TABLE: Record<MapPointKind, 'leads' | 'contacts' | 'biens' | 'voice_notes'> = {
  lead: 'leads',
  contact: 'contacts',
  bien: 'biens',
  note: 'voice_notes',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function firstPhone(entities: readonly MapPoint[]): string | null {
  for (const item of entities) {
    if (item.phone) return item.phone;
  }
  return null;
}

export default function CarteMobile({
  points,
  withoutPosition,
  unplaced,
  agencyPostalCodes = [],
  center,
  initialLeads = [],
  profileId = '',
  agencyOrigin = null,
  initialBanId = null,
  fillParent = false,
  hideAccount = false,
  itineraryStops: itineraryStopsProp = null,
  showItineraire = false,
  autoTournee = false,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  agencyPostalCodes: string[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  initialLeads?: Lead[];
  profileId?: string;
  agencyOrigin?: GeoCoord | null;
  initialBanId?: string | null;
  fillParent?: boolean;
  hideAccount?: boolean;
  itineraryStops?: readonly ItineraireStop[] | null;
  showItineraire?: boolean;
  /** Entrée « tournée » depuis l'accueil : la séquence démarre seule. */
  autoTournee?: boolean;
}) {
  const router = useRouter();
  const { openCapture } = useVoiceCapture();
  const { openMobileSearch, mobileSearchOpen, closeMobileSearch } = useAssistant();
  const mapApi = useRef<MobileMapHandle | null>(null);

  const [layers, setLayers] = useState<MapLayerState>(readStoredMapLayers);
  const [dimension, setDimension] = useState<MapDimension>('2d');
  const [selectedBanId, setSelectedBanId] = useState<string | null>(initialBanId);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const geocodeStarted = useRef(false);
  const [storedStops, setStoredStops] = useState<ItineraireStop[] | null>(null);
  const [agentPosition, setAgentPosition] = useState<DevicePosition | null>(null);
  const [tracking, setTracking] = useState(false);

  const [tourPhase, setTourPhase] = useState<CarteTourPhase>('off');
  const [tourStops, setTourStops] = useState<SortieStop[]>([]);
  const [tourOrigin, setTourOrigin] = useState<GeoCoord | null>(agencyOrigin);
  const [trip, setTrip] = useState<TourTrip | null>(null);
  const [tripPending, setTripPending] = useState(false);
  /** Une tournée a cadré la carte : ne pas la redézoomer sur tout le secteur. */
  const [tourFramed, setTourFramed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [bilan, setBilan] = useState<{ stopCount: number; distanceM: number; durationS: number | null } | null>(
    null,
  );
  const autoStarted = useRef(false);

  /** Interaction : les appuis sur la carte retouchent la tournée. */
  const tourActive = tourPhase === 'brief' || tourPhase === 'route';
  /** Affichage : le chemin reste tracé sous le bravo de fin. */
  const tourShown = tourPhase !== 'off';

  const batch = useMemo(
    () => latestBatchCandidates(initialLeads, profileId),
    [initialLeads, profileId],
  );
  const suggestedPlan = useMemo(
    () => suggestedSortiePlan(initialLeads, profileId, tourOrigin ?? agencyOrigin),
    [initialLeads, profileId, tourOrigin, agencyOrigin],
  );

  /** Boucle optimisée localement : disponible tout de suite, sans réseau. */
  const localPlan = useMemo(
    () => rebuildPlanFromStops(tourStops, tourOrigin),
    [tourStops, tourOrigin],
  );

  /** Le routeur Mapbox affine l'ordre et la géométrie ; sinon on garde le local. */
  const tour = useMemo(() => {
    const ordered = localPlan?.ordered ?? [];
    const local = {
      ordered,
      distanceM: localPlan?.distanceM ?? 0,
      durationS: null as number | null,
      geometry: null as GeoJSON.LineString | null,
    };
    if (!trip || trip.keys.length !== ordered.length) return local;
    const byKey = new Map(ordered.map((s) => [s.key, s]));
    const routed: SortieStop[] = [];
    for (const key of trip.keys) {
      const stop = byKey.get(key);
      if (!stop) return local;
      routed.push(stop);
    }
    return {
      ordered: routed,
      distanceM: trip.distanceM,
      durationS: trip.durationS,
      geometry: trip.geometry,
    };
  }, [localPlan, trip]);

  const tourItineraryStops = useMemo(
    () => (tourShown && tour.ordered.length > 0 ? toItineraireStops(tour.ordered) : null),
    [tourShown, tour.ordered],
  );
  const tourKeys = useMemo(() => new Set(tourStops.map((s) => s.key)), [tourStops]);
  const highlightBanIds = useMemo(() => {
    if (!tourShown) return null;
    const ids = new Set<string>();
    for (const stop of tourStops) {
      if (stop.banId) ids.add(stop.banId);
    }
    return ids;
  }, [tourShown, tourStops]);

  useEffect(() => {
    setDimension(readMapDimension());
    setStoredStops(readItineraireStops());
  }, []);

  useEffect(() => {
    if (!tracking && !tourShown) return;
    return watchDevicePosition(setAgentPosition, {
      pauseWhenHidden: true,
      highAccuracy: true,
      minUpdateM: 4,
      maximumAge: 1_500,
    });
  }, [tracking, tourShown]);

  const itineraryStops = tourItineraryStops
    ? tourItineraryStops
    : showItineraire
      ? storedStops ?? itineraryStopsProp
      : null;
  const { route, waypoints } = useWalkingRoute(tourShown ? null : itineraryStops);
  const itineraryGeometry = tourShown ? tour.geometry : route?.geometry ?? null;

  const kinds = useMemo(() => activeKindSet(layers), [layers]);
  const cadastreOn = anyCadastreLayer(layers);
  const parcelle = useParcelleMap(cadastreOn, viewport);
  const { closeParcelle } = parcelle;
  const mapZoom = viewport?.zoom ?? null;
  const filtered = useMemo(
    () =>
      filterMapEntities(points, {
        kinds,
        postalCode: 'tous',
        assignedTo: 'tous',
        period: 'all' as MapPeriod,
        now: Date.now(),
      }),
    [points, kinds],
  );
  const filteredAllKinds = useMemo(
    () =>
      filterMapEntities(points, {
        kinds: new Set(MAP_LAYER_ORDER),
        postalCode: 'tous',
        assignedTo: 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [points],
  );
  const buildings = useMemo(() => groupEntitiesByBanId(filtered), [filtered]);
  const selected = buildings.find((b) => b.banId === selectedBanId) ?? null;
  const counts = useMemo(() => countKindsInViewport(filteredAllKinds, null), [filteredAllKinds]);
  const missingTotal = withoutPositionTotal(withoutPosition);

  useEffect(() => {
    persistMapLayers(layers);
  }, [layers]);

  useEffect(() => {
    if (geocodeStarted.current) return;
    const jobs = unplaced.filter((row) => (row.geocodeQuery ?? '').trim().length >= 3);
    if (jobs.length === 0) return;
    geocodeStarted.current = true;
    const supabase = createSupabaseBrowserClient();
    const cache = createBanGeocodeCache();
    let cancelled = false;
    (async () => {
      let persisted = 0;
      for (const job of jobs) {
        if (cancelled) break;
        const hit = await geocodeAdresse(job.geocodeQuery ?? '', job.postalCode ?? undefined, cache);
        if (!hit) continue;
        const { error } = await supabase
          .from(GEO_TABLE[job.kind])
          .update({
            ban_id: hit.ban_id,
            latitude: hit.lat,
            longitude: hit.lng,
            adresse_normalisee: hit.adresse_normalisee,
            geocode_score: hit.score,
            geocode_le: new Date().toISOString(),
          })
          .eq('id', job.recordId);
        if (!error) persisted += 1;
      }
      if (!cancelled && persisted > 0) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [unplaced, router]);

  /**
   * Chemin réel : d'abord l'Optimization API (vrai TSP piéton, retour au
   * départ), sinon un simple itinéraire sur l'ordre calculé localement.
   */
  useEffect(() => {
    const stops = localPlan?.ordered ?? [];
    if (!tourShown || stops.length === 0 || !MAPBOX_TOKEN) {
      setTrip(null);
      setTripPending(false);
      return;
    }
    const origin = tourOrigin;
    let cancelled = false;
    setTripPending(true);
    void (async () => {
      let next: TourTrip | null = null;
      if (origin && stops.length + 1 <= MAX_TRIP_COORDS) {
        const optimized = await fetchOptimizedTrip([origin, ...stops], MAPBOX_TOKEN);
        const routed = optimized ? applyTripOrder(stops, optimized) : null;
        if (optimized && routed) {
          next = {
            keys: routed.map((s) => s.key),
            geometry: optimized.geometry,
            distanceM: optimized.distanceM,
            durationS: optimized.durationS,
          };
        }
      }
      if (!next) {
        const walk = await fetchWalkingRoute(loopWaypoints(stops, origin), MAPBOX_TOKEN);
        if (walk) {
          next = {
            keys: stops.map((s) => s.key),
            geometry: walk.geometry,
            distanceM: walk.distanceM,
            durationS: walk.durationS,
          };
        }
      }
      if (cancelled) return;
      setTrip(next);
      setTripPending(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourShown, localPlan?.signature, tourOrigin?.latitude, tourOrigin?.longitude]);

  /** L'itinéraire retenu reste lisible depuis l'accueil et le bandeau carte. */
  useEffect(() => {
    if (tourPhase !== 'route' || tour.ordered.length < 2) return;
    writeItineraireStops(toItineraireStops(tour.ordered));
  }, [tourPhase, tour.ordered]);

  /** Amorce : la sortie suggérée du jour, sinon le dernier lot livré. */
  const startTournee = useCallback(() => {
    const seeds: SortieStop[] =
      suggestedPlan && suggestedPlan.ordered.length > 0
        ? suggestedPlan.ordered.map((s) => ({ ...s }))
        : (batch.mine.length > 0 ? batch.mine : batch.all)
            .slice(0, MAX_SORTIE_STOPS)
            .map(({ source: _source, ...stop }) => stop);

    const kept = seeds.slice(0, MAX_SORTIE_STOPS);

    setTourStops(kept);
    setTrip(null);
    setTracking(true);
    setLayersOpen(false);
    setMissingOpen(false);
    setSelectedBanId(null);
    closeParcelle();
    setTourPhase(kept.length > 0 ? 'brief' : 'route');

    const origin = tourOrigin ?? agencyOrigin;
    if (kept.length > 0) {
      setTourFramed(true);
      mapApi.current?.fitStops(origin ? [origin, ...kept] : kept);
    }

    void requestDevicePosition().then((pos) => {
      if (!pos) return;
      setAgentPosition(pos);
      const resolved = resolveSortieOrigin(agencyOrigin, pos);
      setTourOrigin(resolved.origin ?? agencyOrigin);
    });
  }, [suggestedPlan, batch, agencyOrigin, tourOrigin, closeParcelle]);

  useEffect(() => {
    if (!autoTournee || autoStarted.current) return;
    autoStarted.current = true;
    startTournee();
  }, [autoTournee, startTournee]);

  /** La croix ne coupe pas net : on félicite d'abord, puis on rend la carte. */
  const stopTournee = useCallback(() => {
    setPicking(false);
    if (tour.ordered.length > 0) {
      setBilan({
        stopCount: tour.ordered.length,
        distanceM: tour.distanceM,
        durationS: tour.durationS,
      });
      setTourPhase('bilan');
      return;
    }
    setTourPhase('off');
    setTourStops([]);
    setTrip(null);
  }, [tour]);

  const closeBilan = useCallback(() => {
    setBilan(null);
    setTourPhase('off');
    setTourStops([]);
    setTrip(null);
  }, []);

  const addStop = useCallback((stop: SortieStop) => {
    setTourStops((prev) => {
      if (prev.some((s) => s.key === stop.key)) return prev;
      if (prev.length >= MAX_SORTIE_STOPS) return prev;
      return [...prev, stop];
    });
    vibrateBrief();
  }, []);

  const removeStop = useCallback((key: string) => {
    setTourStops((prev) => prev.filter((s) => s.key !== key));
    vibrateBrief();
  }, []);

  const addAddressToTour = useCallback(
    (address: { label: string; latitude: number; longitude: number; id?: string; postcode?: string }) => {
      addStop(
        searchResultToManualStop({
          label: address.label,
          latitude: address.latitude,
          longitude: address.longitude,
          banId: address.id ?? null,
          postalCode: address.postcode ?? null,
        }),
      );
    },
    [addStop],
  );

  /** Point libre : l'adresse BAN la plus proche, sinon les coordonnées brutes. */
  const addPointFromMap = useCallback(
    (coord: GeoCoord) => {
      setPicking(false);
      void reverseGeocode(coord.latitude, coord.longitude).then((hit) => {
        addStop(
          searchResultToManualStop({
            label: hit?.adresse_normalisee ?? 'Point sur la carte',
            latitude: hit?.lat ?? coord.latitude,
            longitude: hit?.lng ?? coord.longitude,
            banId: hit?.ban_id ?? null,
          }),
        );
      });
    },
    [addStop],
  );

  const handleMapSelect = useCallback(
    (building: BuildingMarker) => {
      if (tourActive) {
        const stop = buildingToManualStop(building);
        if (!stop) return;
        if (picking) {
          setPicking(false);
          addStop(stop);
          return;
        }
        if (tourKeys.has(stop.key)) removeStop(stop.key);
        else addStop(stop);
        return;
      }
      closeParcelle();
      setSelectedBanId(building.banId);
      setLayersOpen(false);
      setMissingOpen(false);
    },
    [tourActive, picking, tourKeys, addStop, removeStop, closeParcelle],
  );

  const recenterOnMe = useCallback(() => {
    void requestDevicePosition().then((pos) => {
      if (!pos) return;
      setAgentPosition(pos);
      setTracking(true);
      mapApi.current?.recenter(pos);
    });
  }, []);

  const switchDimension = useCallback(() => {
    setDimension((prev) => {
      const next = toggleDimension(prev);
      persistMapDimension(next);
      return next;
    });
    vibrateBrief();
  }, []);

  const phone = selected ? firstPhone(selected.entities) : null;
  /** Au-dessus du bandeau flottant (carte plein écran derrière les onglets). */
  const floatBottom =
    tourPhase === 'route'
      ? 'calc(86px + var(--field-nav-height))'
      : 'calc(12px + var(--field-nav-height))';

  return (
    <div
      className={
        fillParent
          ? 'relative h-full overflow-hidden overscroll-none bg-soft-cool'
          : 'field-map fixed inset-0 overflow-hidden overscroll-none bg-soft-cool'
      }
    >
      <MobileMapCanvas
        buildings={buildings}
        center={center}
        selectedBanId={selectedBanId}
        mapRef={mapApi}
        onSelect={handleMapSelect}
        onDeselect={() => {
          if (tourActive) return;
          setSelectedBanId(null);
          closeParcelle();
        }}
        onViewport={setViewport}
        onCluster={(children) => mapApi.current?.fitGroup(children)}
        itineraryStops={itineraryStops}
        itineraryGeometry={itineraryGeometry}
        parcellesEnabled={cadastreOn}
        activeParcelleIds={parcelle.immeubles
          .map((row) => row.parcelleId)
          .filter((id): id is string => Boolean(id))}
        parcelleNoteMarkers={parcelle.noteMarkers}
        selectedParcelleId={parcelle.selectedParcelleId}
        cadastreImmeubles={parcelle.immeubles}
        cadastreLayers={{
          cadastreDpe: layers.cadastreDpe,
          cadastreVentes: layers.cadastreVentes,
          cadastreCopro: layers.cadastreCopro,
        }}
        onSelectParcelle={(parcelleId) => {
          if (tourActive) return;
          setSelectedBanId(null);
          setLayersOpen(false);
          setMissingOpen(false);
          parcelle.openParcelle(parcelleId);
        }}
        agentPosition={agentPosition}
        highlightBanIds={highlightBanIds}
        dimension={dimension}
        suppressAutoFit={tourShown || tourFramed}
        onMapPoint={picking ? addPointFromMap : undefined}
      />

      {picking ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-[72] px-4"
          style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#15202F]/90 py-1.5 pl-4 pr-1.5 shadow-lg backdrop-blur-sm">
            <p className="min-w-0 flex-1 text-[13.5px] font-medium text-white">
              Touchez la carte pour ajouter ce point
            </p>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="app-press flex min-h-[38px] flex-shrink-0 items-center rounded-full bg-white/15 px-3 text-[13px] font-semibold text-white"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {tourPhase !== 'brief' && tourPhase !== 'bilan' && !picking ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 px-4"
          style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md">
            {mobileSearchOpen ? (
              <>
                <div className="min-w-0 flex-1">
                  <AssistantMobileSearchBar tone="map" />
                </div>
                <button
                  type="button"
                  onClick={closeMobileSearch}
                  aria-label="Fermer la recherche"
                  className="app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full text-text"
                >
                  <X size={20} strokeWidth={2} aria-hidden />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openMobileSearch}
                  className="app-press flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-1 text-left"
                  aria-label="Rechercher une adresse, un contact"
                >
                  <Search size={18} strokeWidth={2} className="flex-shrink-0 text-text-muted" aria-hidden />
                  <span className="truncate text-[14px] text-text-muted">
                    Rechercher une adresse, un contact
                  </span>
                </button>
                {!hideAccount ? <AvatarButton onClick={() => setAccountOpen(true)} /> : null}
              </>
            )}
          </div>
          {!tourShown && itineraryStops && itineraryStops.length >= 2 ? (
            <div className="pointer-events-auto mt-2">
              <ItineraireBanner stops={itineraryStops} waypoints={waypoints} route={route} />
            </div>
          ) : null}
        </div>
      ) : null}

      {tourPhase !== 'brief' && tourPhase !== 'bilan' ? (
        <>
          {!tourShown ? (
            <button
              type="button"
              onClick={() => startTournee()}
              aria-label="Préparer une tournée"
              className="app-press absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 font-semibold text-white shadow-lg"
              style={{ bottom: floatBottom, backgroundColor: FIELD.orange, fontSize: 14 }}
            >
              <MapPin size={18} strokeWidth={2.2} aria-hidden />
              Tournée
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setLayersOpen(true);
              setSelectedBanId(null);
            }}
            aria-label="Couches"
            className="app-press absolute left-4 z-20 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
            style={{ bottom: floatBottom }}
          >
            <Layers size={20} strokeWidth={2} aria-hidden />
          </button>

          <button
            type="button"
            onClick={switchDimension}
            aria-label={dimension === '3d' ? 'Passer en plan 2D' : 'Passer en relief 3D'}
            aria-pressed={dimension === '3d'}
            className="app-press absolute right-4 z-20 flex size-12 flex-col items-center justify-center gap-0.5 rounded-full bg-surface shadow-md"
            style={{
              bottom: `calc(${floatBottom} + 56px)`,
              color: dimension === '3d' ? FIELD.orange : undefined,
            }}
          >
            {dimension === '3d' ? (
              <Box size={17} strokeWidth={2.2} aria-hidden />
            ) : (
              <Square size={17} strokeWidth={2.2} className="text-text" aria-hidden />
            )}
            <span
              className="text-[10px] font-bold leading-none"
              style={{ color: dimension === '3d' ? FIELD.orange : '#64748B' }}
            >
              {dimension === '3d' ? '3D' : '2D'}
            </span>
          </button>

          <button
            type="button"
            onClick={recenterOnMe}
            aria-label="Recentrer sur ma position"
            className="app-press absolute right-4 z-20 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
            style={{
              bottom: floatBottom,
              boxShadow: tracking ? `0 0 0 2px ${FIELD.ardoise}` : undefined,
            }}
          >
            <Locate size={20} strokeWidth={2} aria-hidden />
          </button>
        </>
      ) : null}

      {tourPhase === 'brief' ? (
        <CarteTourneeBriefCard
          stopCount={tour.ordered.length}
          distanceM={tour.distanceM}
          durationS={tour.durationS}
          onDone={() => setTourPhase('route')}
        />
      ) : null}

      {tourPhase === 'route' ? (
        <CarteTourneeStopsSheet
          stops={tour.ordered}
          distanceM={tour.distanceM}
          durationS={tour.durationS}
          optimizing={tripPending}
          picking={picking}
          postcodeFilter={agencyPostalCodes[0]}
          onRemove={removeStop}
          onAddAddress={addAddressToTour}
          onPickOnMap={() => setPicking(true)}
          onStop={stopTournee}
          onFocusStop={(stop) => mapApi.current?.recenter(stop, 17)}
        />
      ) : null}

      {tourPhase === 'bilan' && bilan ? (
        <CarteTourneeDoneCard
          stopCount={bilan.stopCount}
          distanceM={bilan.distanceM}
          durationS={bilan.durationS}
          onClose={closeBilan}
        />
      ) : null}

      <MobileSheet
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        title="Couches"
        initialSnap={2}
      >
        <ul className="flex flex-col gap-1">
          {MAP_LAYER_ORDER.map((kind) => {
            const active = layers[kind];
            return (
              <li key={kind}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-1">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-black/20"
                    style={{ accentColor: '#E8743C' }}
                    checked={active}
                    onChange={() => setLayers((prev) => ({ ...prev, [kind]: !prev[kind] }))}
                  />
                  <span
                    className={`flex-1 text-[14.5px] font-medium ${active ? 'text-text-strong' : 'text-text-muted'}`}
                  >
                    {MAP_LAYER_LABELS[kind]}
                  </span>
                  <span className="tabular-nums text-[13px] text-text-subtle">{counts[kind]}</span>
                </label>
              </li>
            );
          })}
          <CadastreLayerControls
            layers={layers}
            onToggleCadastre={() =>
              setLayers((prev) => {
                const next = withCadastreToggled(prev);
                persistMapLayers(next);
                return next;
              })
            }
            onToggleOverlay={(id: CadastreLayerId) =>
              setLayers((prev) => {
                const next =
                  id === 'dpe'
                    ? { ...prev, cadastreDpe: !prev.cadastreDpe }
                    : id === 'ventes'
                      ? { ...prev, cadastreVentes: !prev.cadastreVentes }
                      : { ...prev, cadastreCopro: !prev.cadastreCopro };
                persistMapLayers(next);
                return next;
              })
            }
            mapZoom={mapZoom}
            compact
          />
        </ul>

        {missingTotal > 0 ? (
          <button
            type="button"
            onClick={() => {
              setLayersOpen(false);
              setMissingOpen(true);
            }}
            className="app-press mt-4 flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-left"
          >
            <span className="text-[14.5px] font-medium text-text">Fiches sans position</span>
            <span className="tabular-nums text-[13px] text-accent">{missingTotal}</span>
          </button>
        ) : null}
      </MobileSheet>

      <MobileSheet
        open={Boolean(selected) && !tourShown}
        onClose={() => setSelectedBanId(null)}
        title={selected?.title ?? 'Immeuble'}
        initialSnap={1}
        footer={
          selected ? (
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="app-press flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay bg-black/[0.05] text-[13.5px] font-semibold text-text"
              >
                <Navigation size={16} strokeWidth={2} aria-hidden />
                Itinéraire
              </a>
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="app-press flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay bg-black/[0.05] text-[13.5px] font-semibold text-text"
                >
                  <Phone size={16} strokeWidth={2} aria-hidden />
                  Appeler
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => openCapture({ adresse: selected.title })}
                className="app-press flex min-h-[44px] flex-1 items-center justify-center rounded-clay bg-accent text-[13.5px] font-semibold text-white"
              >
                Dicter ici
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <ImmeubleFacade latitude={selected.latitude} longitude={selected.longitude} />
            {entitiesByKind(selected.entities.filter((e) => e.kind !== 'note')).map((group) => (
              <section key={group.kind}>
                <p className="font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                  {group.label}
                  <span className="ml-1.5 tabular-nums">{group.items.length}</span>
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} className="block rounded-xl px-2 py-2 field-fiche-enter">
                        <p className="truncate text-[14px] font-medium text-text-strong">{item.title}</p>
                        {item.subtitle ? (
                          <p className="mt-0.5 truncate text-[12.5px] text-text-muted">{item.subtitle}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11.5px] text-text-subtle">{formatDate(item.occurredAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <section>
              <p className="mb-2 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                Notes terrain
              </p>
              <NotesTerrainList entiteType="immeuble" entiteId={selected.banId} />
            </section>
          </div>
        ) : null}
      </MobileSheet>

      <MobileSheet
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        title="Fiches sans position"
        initialSnap={1}
      >
        <p className="mb-3 text-pretty text-[13px] text-text-muted">
          Corrigez l&apos;adresse pour les placer sur la carte.
        </p>
        <ul className="flex flex-col gap-1">
          {(
            [
              ['lead', 'Prospects', '/dashboard/prospection?filtre=sans-position', withoutPosition.leads],
              ['contact', 'Contacts', '/dashboard/contacts?filtre=sans-position', withoutPosition.contacts],
              ['bien', 'Biens', '/dashboard/biens?filtre=sans-position', withoutPosition.biens],
              ['note', 'Notes terrain', '/dashboard', withoutPosition.notes],
            ] as const
          )
            .filter((row) => row[3] > 0)
            .map(([kind, label, href, count]) => (
              <li key={kind}>
                <Link href={href} className="flex min-h-[44px] items-center justify-between rounded-xl px-1">
                  <span className="text-[14.5px] font-medium text-text-strong">{label}</span>
                  <span className="tabular-nums text-[13px] text-text-subtle">{count}</span>
                </Link>
              </li>
            ))}
        </ul>
        {unplaced.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-1 border-t border-black/[0.06] pt-3">
            {unplaced.slice(0, 12).map((row) => (
              <li key={`${row.kind}:${row.recordId}`}>
                <Link href={row.href} className="block rounded-xl px-1 py-2">
                  <p className="truncate text-[13.5px] font-medium text-text-strong">{row.title}</p>
                  <p className="text-[11.5px] text-text-subtle">{MAP_LAYER_LABELS[row.kind]}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </MobileSheet>

      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
      <ParcelleDrawer
        fiche={parcelle.fiche}
        loading={parcelle.loading}
        onClose={parcelle.closeParcelle}
        onNotesChanged={parcelle.refreshAfterNotes}
      />
    </div>
  );
}
