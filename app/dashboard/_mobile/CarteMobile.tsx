'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCibleCarte } from '@/lib/carte/cible';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Layers, Locate, MapPin, Navigation, Phone, Square } from 'lucide-react';
import { toast } from 'sonner';
import Switch from '@/components/ui/Switch';
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
  anyCadastreOverlay,
  persistMapLayers,
  readStoredMapLayers,
  showParcellesPlan,
  withCadastreLayerToggled,
  withCadastreMenuToggled,
  withDpeAgeSpan,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import CadastreLayerControls from '@/components/dashboard/carte/CadastreLayerControls';
import EmpriseCapsules from '@/components/dashboard/carte/EmpriseCapsules';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';
import { useImmeublesSuivisCarte } from '@/lib/carte/immeubles-suivis';
import { cadastreDansEmprise, empriseDepuisZoneId, type MapEmprise } from '@/lib/carte/emprise';
import { zoneProspectionParDefaut } from '@/lib/zones/jour';
import {
  type MapPoint,
  type MapPointKind,
  type UnplacedRecord,
  type WithoutPositionCount,
} from '@/lib/carte/points';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  readDevicePosition,
  requestDevicePosition,
  watchDevicePosition,
  type DevicePosition,
} from '@/lib/voice/gps';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import NotePlusSurPlace from '@/components/dashboard/notes/NotePlusSurPlace';
import ImmeubleFacade from '@/components/dashboard/carte/ImmeubleFacade';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import MobileMapCanvas, { type MobileMapHandle } from './MobileMapCanvas';
import MobileSheet from './MobileSheet';
import MobileAccountMenu from './MobileAccountMenu';
import MobileSearchCapsule from './MobileSearchCapsule';
import ItineraireBanner from '@/components/dashboard/carte/ItineraireBanner';
import type { SelectedAddress } from '@/components/AddressAutocomplete';
import { useWalkingRoute } from '@/lib/today/use-walking-route';
import { buildingToManualStop, searchResultToManualStop } from '@/lib/carte/carte-tournee';
import type { GeoCoord } from '@/lib/carte/coords';
import { haversineM } from '@/lib/geo/distance';
import { newOfflineId, postJsonOrQueue } from '@/lib/offline/queue';
import CarteTourneeBriefCard from './CarteTourneeBriefCard';
import CarteTourneeDoneCard from './CarteTourneeDoneCard';
import CarteTourneeSetupSheet from './CarteTourneeSetupSheet';
import CarteTourneeStopsSheet from './CarteTourneeStopsSheet';
import type { SortieStop } from '@/lib/today/sortie';
import { rebuildPlanFromStops, todaySortieDay } from '@/lib/today/sortie-session';
import {
  DUREE_TOURNEE_DEFAUT,
  DUREES_TOURNEE,
  MAX_ARRETS_TOURNEE,
  libelleDuree,
  type TourneeReponse,
} from '@/lib/tournee/reglages';
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
import { bboxDeZone, bboxVersBounds } from '@/lib/zones/geometrie';
import { pointDansZone } from '@/lib/zones/leads';
import type { Zone } from '@/lib/zones/types';

/**
 * `preparation` = adresse de passage et temps, `brief` = séquence d'ouverture,
 * `route` = chemin tracé + retouche des adresses, `bilan` = bravo de fin.
 */
type CarteTourPhase = 'off' | 'preparation' | 'brief' | 'route' | 'bilan';

const DUREE_STORAGE_KEY = 'priimo-tournee-duree';
/** Assez près pour dire qu'on est passé devant la porte, pas assez pour la frôler en voiture. */
const PASSAGE_RAYON_M = 25;
const PASSAGE_PRECISION_M = 35;
const PASSAGE_VITESSE_MAX_MS = 2.5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lireDureeTournee(): number {
  try {
    const brut = Number(window.localStorage.getItem(DUREE_STORAGE_KEY));
    return (DUREES_TOURNEE as readonly number[]).includes(brut) ? brut : DUREE_TOURNEE_DEFAUT;
  } catch {
    return DUREE_TOURNEE_DEFAUT;
  }
}

function messageTourneeVide(reponse: TourneeReponse): string {
  const ou = reponse.secteur ? `dans ${reponse.secteur}` : 'dans votre secteur';
  if (reponse.adressesAFaire === 0 && reponse.dejaFaites > 0) {
    return `Toutes les adresses à DPE récent ${ou} ont déjà été prospectées. Revenez quand de nouveaux DPE tombent.`;
  }
  if (reponse.adressesAFaire === 0) return `Aucun DPE récent ${ou} pour le moment.`;
  return 'Aucune adresse ne tient dans ce temps. Essayez une durée plus longue.';
}

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
  withoutPosition: _withoutPosition,
  unplaced,
  agencyPostalCodes = [],
  center,
  isDirector,
  profileId = '',
  agencyOrigin = null,
  initialBanId = null,
  fillParent = false,
  hideAccount = false,
  itineraryStops: itineraryStopsProp = null,
  showItineraire = false,
  autoTournee = false,
  zones = [],
  initialZoneId = null,
  viewSwitcher = null,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  agencyPostalCodes: string[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  profileId?: string;
  agencyOrigin?: GeoCoord | null;
  initialBanId?: string | null;
  fillParent?: boolean;
  hideAccount?: boolean;
  itineraryStops?: readonly ItineraireStop[] | null;
  showItineraire?: boolean;
  /** Entrée « tournée » depuis l'accueil : la préparation s'ouvre seule. */
  autoTournee?: boolean;
  zones?: readonly Zone[];
  initialZoneId?: string | null;
  viewSwitcher?: ReactNode;
}) {
  const router = useRouter();
  const { openCapture } = useVoiceCapture();
  const mapApi = useRef<MobileMapHandle | null>(null);

  const [layers, setLayers] = useState<MapLayerState>(readStoredMapLayers);
  const [zoneId, setZoneId] = useState(
    initialZoneId && zones.some((z) => z.id === initialZoneId) ? initialZoneId : 'aucun',
  );
  const [dimension, setDimension] = useState<MapDimension>(readMapDimension);
  const [selectedBanId, setSelectedBanId] = useState<string | null>(initialBanId);
  const cible = useCibleCarte();
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const geocodeStarted = useRef(false);
  const [storedStops, setStoredStops] = useState<ItineraireStop[] | null>(null);
  const [agentPosition, setAgentPosition] = useState<DevicePosition | null>(null);

  const [tourPhase, setTourPhase] = useState<CarteTourPhase>('off');
  const [tourStops, setTourStops] = useState<SortieStop[]>([]);
  const [tourOrigin, setTourOrigin] = useState<GeoCoord | null>(agencyOrigin);
  const [trip, setTrip] = useState<TourTrip | null>(null);
  const [tripPending, setTripPending] = useState(false);
  /** Une tournée a cadré la carte : ne pas la redézoomer sur tout le secteur. */
  const [tourFramed, setTourFramed] = useState(false);
  const [picking, setPicking] = useState(false);
  /** Le point touché sur la carte devient l'adresse de passage, ou un arrêt de plus. */
  const [pickTarget, setPickTarget] = useState<'ancre' | 'arret'>('arret');
  const [bilan, setBilan] = useState<{ stopCount: number; distanceM: number; durationS: number | null } | null>(
    null,
  );
  const autoStarted = useRef(false);

  const [ancreTournee, setAncreTournee] = useState<SelectedAddress | null>(null);
  const [dureeTournee, setDureeTournee] = useState<number>(lireDureeTournee);
  const [generation, setGeneration] = useState(false);
  const [messageTournee, setMessageTournee] = useState<string | null>(null);
  const [contexteTournee, setContexteTournee] = useState<string | null>(null);
  /** Portes devant lesquelles le GPS a vu passer l'agent pendant la tournée. */
  const [faits, setFaits] = useState<readonly string[]>([]);
  const positionPreparation = useRef<Promise<DevicePosition | null> | null>(null);
  const faitsRef = useRef<ReadonlySet<string>>(new Set());
  const arretsRef = useRef<readonly SortieStop[]>([]);

  /** Interaction : les appuis sur la carte retouchent la tournée. */
  const tourActive = tourPhase === 'brief' || tourPhase === 'route';
  /** Affichage : le chemin reste tracé sous le bravo de fin. */
  const tourShown = tourActive || tourPhase === 'bilan';

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
  const faitsSet = useMemo(() => new Set(faits), [faits]);
  const arretsFaits = useMemo(
    () => tour.ordered.filter((s) => faitsSet.has(s.key)).map((s) => s.leadId),
    [tour.ordered, faitsSet],
  );
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
    arretsRef.current = tourActive ? tour.ordered : [];
  }, [tourActive, tour.ordered]);

  /** Une porte longée à pied devient un passage : la prochaine tournée ne la reproposera pas. */
  const noterPassage = useCallback(
    (pos: DevicePosition) => {
      if (pos.accuracyM === null || pos.accuracyM > PASSAGE_PRECISION_M) return;
      if (pos.speedMs !== null && pos.speedMs > PASSAGE_VITESSE_MAX_MS) return;
      const longees = arretsRef.current.filter(
        (s) => !faitsRef.current.has(s.key) && haversineM(pos, s) <= PASSAGE_RAYON_M,
      );
      if (longees.length === 0) return;
      faitsRef.current = new Set([...faitsRef.current, ...longees.map((s) => s.key)]);
      setFaits([...faitsRef.current]);
      vibrateBrief();
      // Le journal de sortie est réservé aux collaborateurs.
      if (isDirector) return;
      for (const stop of longees) {
        void postJsonOrQueue('/api/dashboard/sortie/events', {
          kind: 'passer',
          leadId: UUID.test(stop.leadId) ? stop.leadId : null,
          stopKey: stop.key,
          banId: stop.banId,
          payload: { source: 'carte' },
          clientId: newOfflineId(),
          day: todaySortieDay(),
        });
      }
    },
    [isDirector],
  );

  // GPS parent seulement en tournée (progressPoint). Hors tournée, le point
  // bleu vit dans LiveAgentLocationMarker pour ne pas re-render toute la carte.
  useEffect(() => {
    if (!tourShown) {
      setAgentPosition(null);
      return;
    }
    return watchDevicePosition(
      (pos) => {
        setAgentPosition(pos);
        noterPassage(pos);
      },
      {
        pauseWhenHidden: true,
        highAccuracy: true,
        minUpdateM: 10,
        maximumAge: 2_000,
      },
    );
  }, [tourShown, noterPassage]);

  const itineraryStops = tourItineraryStops
    ? tourItineraryStops
    : showItineraire
      ? storedStops ?? itineraryStopsProp
      : null;
  const { route, waypoints } = useWalkingRoute(tourShown ? null : itineraryStops);
  const itineraryGeometry = tourShown ? tour.geometry : route?.geometry ?? null;

  const kinds = useMemo(() => activeKindSet(layers), [layers]);
  const overlaysCadastre = anyCadastreOverlay(layers);
  const planParcelles = showParcellesPlan(layers);
  const parcelle = useParcelleMap(overlaysCadastre, viewport, {
    dpeAges: layers.cadastreDpeAges,
    includeDpeDetail: layers.cadastreDpe,
  });
  const { suivis: immeublesSuivis, recharger: rechargerSuivis } = useImmeublesSuivisCarte();
  const suiviParcelleIds = useMemo(
    () => immeublesSuivis.map((s) => s.parcelleId),
    [immeublesSuivis],
  );
  const { closeParcelle } = parcelle;
  const mapZoom = viewport?.zoom ?? null;
  const monSecteurId = useMemo(
    () => (profileId ? zoneProspectionParDefaut(zones, profileId) : null),
    [profileId, zones],
  );
  const emprise = empriseDepuisZoneId(zoneId);
  const zoneChoisie = zones.find((z) => z.id === zoneId) ?? null;
  const pointsDuSecteur = useMemo(
    () => (zoneChoisie ? points.filter((p) => pointDansZone(p, zoneChoisie)) : points),
    [points, zoneChoisie],
  );
  const focusBounds = useMemo(() => {
    if (!zoneChoisie) return null;
    const boite = bboxDeZone(zoneChoisie);
    return boite ? bboxVersBounds(boite) : null;
  }, [zoneChoisie]);
  const filtered = useMemo(
    () =>
      filterMapEntities(pointsDuSecteur, {
        kinds,
        assignedTo: 'tous',
        period: 'all' as MapPeriod,
        now: Date.now(),
      }),
    [pointsDuSecteur, kinds],
  );
  const filteredAllKinds = useMemo(
    () =>
      filterMapEntities(pointsDuSecteur, {
        kinds: new Set(MAP_LAYER_ORDER),
        assignedTo: 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [pointsDuSecteur],
  );
  const buildings = useMemo(() => groupEntitiesByBanId(filtered), [filtered]);
  const selected = buildings.find((b) => b.banId === selectedBanId) ?? null;
  const counts = useMemo(() => countKindsInViewport(filteredAllKinds, null), [filteredAllKinds]);

  function choisirEmprise(next: MapEmprise) {
    if (next === 'code_postal') {
      setZoneId('aucun');
      return;
    }
    if (monSecteurId) setZoneId(monSecteurId);
  }

  const cadastreImmeubles = useMemo(
    () => parcelle.immeubles.filter((row) => cadastreDansEmprise(row, zoneChoisie)),
    [parcelle.immeubles, zoneChoisie],
  );
  const activeParcelleIds = useMemo(
    () => cadastreImmeubles.map((row) => row.parcelleId).filter((id): id is string => Boolean(id)),
    [cadastreImmeubles],
  );
  const parcelleNoteMarkers = useMemo(
    () => parcelle.noteMarkers.filter((row) => cadastreDansEmprise(row, zoneChoisie)),
    [parcelle.noteMarkers, zoneChoisie],
  );

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

  /** Le secteur que le serveur retiendra : celui affiché s'il est à l'agent, sinon le sien. */
  const secteurTournee = useMemo(() => {
    if (zoneChoisie && (isDirector || zoneChoisie.assignedTo === profileId)) return zoneChoisie;
    return zones.find((z) => z.id === monSecteurId) ?? null;
  }, [zoneChoisie, zones, monSecteurId, isDirector, profileId]);

  /** Le GPS se cherche pendant que l'agent choisit son adresse et son temps. */
  const ouvrirPreparation = useCallback(() => {
    setLayersOpen(false);
    setSelectedBanId(null);
    closeParcelle();
    setMessageTournee(null);
    setTourPhase('preparation');
    positionPreparation.current = readDevicePosition();
  }, [closeParcelle]);

  useEffect(() => {
    if (!autoTournee || autoStarted.current) return;
    autoStarted.current = true;
    ouvrirPreparation();
  }, [autoTournee, ouvrirPreparation]);

  const fermerPreparation = useCallback(() => {
    setPicking(false);
    setAncreTournee(null);
    setMessageTournee(null);
    setTourPhase('off');
  }, []);

  const choisirDuree = useCallback((minutes: number) => {
    setDureeTournee(minutes);
    setMessageTournee(null);
    try {
      window.localStorage.setItem(DUREE_STORAGE_KEY, String(minutes));
    } catch {
      /* mode privé */
    }
  }, []);

  const genererTournee = useCallback(async () => {
    if (generation) return;
    setGeneration(true);
    setMessageTournee(null);
    const position = await Promise.race([
      positionPreparation.current ?? readDevicePosition(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
    ]);

    let reponse: TourneeReponse | null = null;
    try {
      const res = await fetch('/api/dashboard/tournee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dureeMinutes: dureeTournee,
          zoneId: zoneChoisie?.id ?? null,
          ancre: ancreTournee
            ? {
                label: ancreTournee.label,
                latitude: ancreTournee.latitude,
                longitude: ancreTournee.longitude,
                banId: ancreTournee.id ?? null,
                codePostal: ancreTournee.postcode || null,
              }
            : null,
          position: position ? { latitude: position.latitude, longitude: position.longitude } : null,
        }),
      });
      if (res.ok) {
        reponse = (await res.json()) as TourneeReponse;
      } else {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessageTournee(corps?.error ?? 'La tournée n’a pas pu être préparée. Réessayez.');
      }
    } catch {
      setMessageTournee('Pas de réseau : la tournée n’a pas pu être préparée.');
    }
    setGeneration(false);
    if (!reponse) return;
    if (reponse.arrets.length === 0) {
      setMessageTournee(messageTourneeVide(reponse));
      return;
    }

    const minutes = Math.max(5, Math.round(reponse.minutes / 5) * 5);
    const parmi =
      reponse.adressesAFaire > reponse.arrets.length
        ? ` · retenues parmi ${reponse.adressesAFaire} adresses à DPE récent`
        : '';
    faitsRef.current = new Set();
    setFaits([]);
    setTourStops(reponse.arrets);
    setTourOrigin(reponse.depart);
    setTrip(null);
    setContexteTournee(`Environ ${libelleDuree(minutes)}, portes comprises${parmi}`);
    setTourPhase('brief');
    setTourFramed(true);
    mapApi.current?.fitStops(reponse.depart ? [reponse.depart, ...reponse.arrets] : reponse.arrets);
  }, [generation, dureeTournee, zoneChoisie, ancreTournee]);

  const finirTournee = useCallback(() => {
    setTourPhase('off');
    setTourStops([]);
    setTrip(null);
    setAncreTournee(null);
    setContexteTournee(null);
    faitsRef.current = new Set();
    setFaits([]);
  }, []);

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
    finirTournee();
  }, [tour, finirTournee]);

  const closeBilan = useCallback(() => {
    setBilan(null);
    finirTournee();
  }, [finirTournee]);

  const addStop = useCallback((stop: SortieStop) => {
    setTourStops((prev) => {
      if (prev.some((s) => s.key === stop.key)) return prev;
      if (prev.length >= MAX_ARRETS_TOURNEE) return prev;
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
        const label = hit?.adresse_normalisee ?? 'Point sur la carte';
        const latitude = hit?.lat ?? coord.latitude;
        const longitude = hit?.lng ?? coord.longitude;
        if (pickTarget === 'ancre') {
          setAncreTournee({
            label,
            latitude,
            longitude,
            city: '',
            postcode: /\b\d{5}\b/.exec(label)?.[0] ?? '',
            id: hit?.ban_id,
          });
          return;
        }
        addStop(searchResultToManualStop({ label, latitude, longitude, banId: hit?.ban_id ?? null }));
      });
    },
    [addStop, pickTarget],
  );

  const handleMapSelect = useCallback(
    (building: BuildingMarker) => {
      if (tourPhase === 'preparation') {
        setPicking(false);
        setAncreTournee({
          label: building.title,
          latitude: building.latitude,
          longitude: building.longitude,
          city: '',
          postcode: building.postalCode ?? '',
          // `bien:…` et `gps:…` placent une fiche sans adresse BAN : pas un identifiant d'immeuble.
          id: building.banId.includes(':') ? undefined : building.banId,
        });
        setMessageTournee(null);
        vibrateBrief();
        return;
      }
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
    },
    [tourPhase, tourActive, picking, tourKeys, addStop, removeStop, closeParcelle],
  );

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

  const recenterGps = useCallback(() => {
    void requestDevicePosition().then((pos) => {
      if (!pos) {
        toast.error('Position indisponible. Active le GPS.');
        return;
      }
      mapApi.current?.recenter(pos, 16);
    });
  }, []);

  return (
    <div
      className={
        fillParent
          ? 'field-map relative h-full min-h-0 overflow-hidden overscroll-none bg-soft-cool'
          : 'field-map fixed inset-0 overflow-hidden overscroll-none bg-soft-cool'
      }
    >
      <MobileMapCanvas
        buildings={buildings}
        center={center}
        cible={cible}
        focusBounds={focusBounds}
        zones={zoneId === 'aucun' ? [] : zones}
        highlightedZoneId={zoneChoisie?.id ?? null}
        clipZone={zoneChoisie}
        dimension={dimension}
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
        // Une parcelle ouverte (par la recherche, plan éteint) reste détourée.
        parcellesEnabled={!tourShown && (planParcelles || Boolean(parcelle.selectedParcelleId))}
        activeParcelleIds={activeParcelleIds}
        suiviParcelleIds={suiviParcelleIds}
        parcelleNoteMarkers={parcelleNoteMarkers}
        selectedParcelleId={parcelle.selectedParcelleId}
        cadastreImmeubles={cadastreImmeubles}
        cadastreLayers={{
          cadastreDpe: layers.cadastreDpe,
          cadastreVentes: layers.cadastreVentes,
          cadastreCopro: layers.cadastreCopro,
          cadastreDpeAges: layers.cadastreDpeAges,
        }}
        onSelectParcelle={(parcelleId, extra) => {
          if (tourActive || tourPhase === 'preparation') return;
          setSelectedBanId(null);
          setLayersOpen(false);
          parcelle.openParcelle(parcelleId, extra);
        }}
        onPrefetchParcelle={parcelle.prefetchParcelle}
        agentPosition={agentPosition}
        completedLeadIds={arretsFaits}
        highlightBanIds={highlightBanIds}
        // Une adresse cherchée garde la main : la carte ne repart pas sur tout le secteur.
        suppressAutoFit={tourShown || tourFramed || Boolean(cible)}
        navigation={tourShown}
        onMapPoint={picking ? addPointFromMap : undefined}
      />

      {picking ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-[72] px-4"
          style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#1A2A56] py-1.5 pl-4 pr-1.5 shadow-lg">
            <p className="min-w-0 flex-1 text-[13.5px] font-medium text-white">
              {pickTarget === 'ancre'
                ? 'Touchez la carte à l’endroit où passer'
                : 'Touchez la carte pour ajouter ce point'}
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

      {(tourPhase === 'off' || tourPhase === 'route') && !picking ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 px-4"
          style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="pointer-events-auto">
            <MobileSearchCapsule
              translucent
              hideAccount={hideAccount}
              onAccount={() => setAccountOpen(true)}
              accountOpen={accountOpen}
            />
          </div>
          {viewSwitcher ? (
            <div className="pointer-events-auto mt-2 flex justify-end">{viewSwitcher}</div>
          ) : null}
          {!tourShown && itineraryStops && itineraryStops.length >= 2 ? (
            <div className="pointer-events-auto mt-2">
              <ItineraireBanner stops={itineraryStops} waypoints={waypoints} route={route} />
            </div>
          ) : null}
        </div>
      ) : null}

      {tourPhase === 'off' || tourPhase === 'route' ? (
        <>
          {!tourShown ? (
            <button
              type="button"
              onClick={ouvrirPreparation}
              aria-label="Préparer une tournée"
              className="app-press absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 font-semibold text-white shadow-[0_10px_24px_-8px_rgba(79,70,229,0.6)] ring-2 ring-white"
              style={{ bottom: floatBottom, fontSize: 14 }}
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
            className="app-press absolute left-4 z-20 flex size-12 items-center justify-center rounded-full bg-[#1A2A56] text-white shadow-[0_10px_24px_-8px_rgba(26,42,86,0.55)] ring-2 ring-white"
            style={{ bottom: floatBottom }}
          >
            <Layers size={20} strokeWidth={2.2} aria-hidden />
          </button>

          <div
            className="absolute right-4 z-20 flex flex-col-reverse items-center gap-2"
            style={{ bottom: floatBottom }}
          >
            {!tourShown ? (
              <button
                type="button"
                onClick={switchDimension}
                aria-label={dimension === '3d' ? 'Passer en plan 2D' : 'Passer en relief 3D'}
                aria-pressed={dimension === '3d'}
                className="app-press flex size-12 flex-col items-center justify-center gap-0.5 rounded-full bg-surface shadow-md"
                style={{ color: dimension === '3d' ? FIELD.orange : undefined }}
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
            ) : null}
            <button
              type="button"
              onClick={recenterGps}
              aria-label="Recentrer sur ma position"
              className="app-press flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
            >
              <Locate size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </>
      ) : null}

      {tourPhase === 'preparation' && !picking ? (
        <CarteTourneeSetupSheet
          secteurNom={secteurTournee?.nom ?? null}
          ancre={ancreTournee}
          onAncre={(adresse) => {
            setAncreTournee(adresse);
            setMessageTournee(null);
          }}
          duree={dureeTournee}
          onDuree={choisirDuree}
          postcodeFilter={agencyPostalCodes[0]}
          generating={generation}
          message={messageTournee}
          onPickOnMap={() => {
            setPickTarget('ancre');
            setPicking(true);
          }}
          onGenerate={() => void genererTournee()}
          onClose={fermerPreparation}
        />
      ) : null}

      {tourPhase === 'brief' ? (
        <CarteTourneeBriefCard
          stopCount={tour.ordered.length}
          distanceM={tour.distanceM}
          durationS={tour.durationS}
          contexte={contexteTournee}
          onDone={() => setTourPhase('route')}
        />
      ) : null}

      {tourPhase === 'route' ? (
        <CarteTourneeStopsSheet
          stops={tour.ordered}
          faits={faitsSet}
          maxStops={MAX_ARRETS_TOURNEE}
          distanceM={tour.distanceM}
          durationS={tour.durationS}
          optimizing={tripPending}
          picking={picking}
          postcodeFilter={agencyPostalCodes[0]}
          onRemove={removeStop}
          onAddAddress={addAddressToTour}
          onPickOnMap={() => {
            setPickTarget('arret');
            setPicking(true);
          }}
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
        <EmpriseCapsules
          value={emprise}
          onChange={choisirEmprise}
          hasSecteur={Boolean(monSecteurId)}
        />
        <ul className="flex flex-col gap-1">
          {MAP_LAYER_ORDER.map((kind) => {
            const active = layers[kind];
            return (
              <li key={kind}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setLayers((prev) => ({ ...prev, [kind]: !prev[kind] }))}
                  className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
                >
                  <Switch checked={active} />
                  <span
                    className={`flex-1 text-[14.5px] font-medium ${active ? 'text-text-strong' : 'text-text-muted'}`}
                  >
                    {MAP_LAYER_LABELS[kind]}
                  </span>
                  <span className="tabular-nums text-[13px] text-text-subtle">{counts[kind]}</span>
                </button>
              </li>
            );
          })}
          <CadastreLayerControls
            layers={layers}
            onToggleLayer={(id: CadastreLayerId) =>
              setLayers((prev) => {
                const next = withCadastreLayerToggled(prev, id);
                persistMapLayers(next);
                return next;
              })
            }
            onChangeDpeAge={(from, to) =>
              setLayers((prev) => {
                const next = withDpeAgeSpan(prev, from, to);
                persistMapLayers(next);
                return next;
              })
            }
            onToggleMenu={() =>
              setLayers((prev) => {
                const next = withCadastreMenuToggled(prev);
                persistMapLayers(next);
                return next;
              })
            }
            mapZoom={mapZoom}
            compact
          />
        </ul>
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
              <NotePlusSurPlace adresse={selected.title} banId={selected.banId} />
              <NotesTerrainList entiteType="immeuble" entiteId={selected.banId} />
            </section>
          </div>
        ) : null}
      </MobileSheet>

      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
      <ParcelleDrawer
        fiche={parcelle.fiche}
        loading={parcelle.loading}
        onClose={parcelle.closeParcelle}
        onNotesChanged={parcelle.refreshAfterNotes}
        onSuiviChanged={rechargerSuivis}
      />
    </div>
  );
}
