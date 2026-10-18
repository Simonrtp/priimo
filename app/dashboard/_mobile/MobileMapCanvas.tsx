'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/dashboard/carte/carte.css';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import Map, { Marker, type MapRef } from 'react-map-gl';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE, FRANCE_MAP_VIEW } from '@/lib/map/style';
import { applyTourneeMapStyle, restoreTourneeMapStyle } from '@/lib/map/tournee-style';
import { MAP_MAX_PITCH, tiltFromMap } from '@/lib/map/camera';
import { cameraFor, type MapDimension } from '@/lib/map/view-mode';
import { useCanvasAJour } from '@/lib/map/canvas-a-jour';
import { computeLngLatBounds, type LngLatBoundsTuple } from '@/lib/carte/bounds';
import PinIcone from '@/components/dashboard/carte/PinIcone';
import { LEAD_FIELD_COLOR } from '@/lib/carte/colors';
import type { BuildingMarker, MapViewport } from '@/lib/carte/buildings';
import { isUsableCoord, toGeoCoord } from '@/lib/carte/coords';
import { clusterBuildings } from '@/lib/carte/cluster';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import ItineraireLayer from '@/components/dashboard/carte/ItineraireLayer';
import Buildings3DLayer from '@/components/dashboard/carte/Buildings3DLayer';
import { AnnoncesMarqueurs } from '@/components/dashboard/annonces/AnnoncesCoucheCarte';
import type { Annonce } from '@/lib/annonces/types';
import ParcellesLayer, {
  CADASTRE_COPRO_LAYER_ID,
  CADASTRE_DPE_LAYER_ID,
  CADASTRE_VENTES_LAYER_ID,
  CADASTRE_VENTES_PARCELLE_LABEL_LAYER_ID,
  CADASTRE_VENTES_POINT_LAYER_ID,
  PARCELLES_FILL_LAYER_ID,
} from '@/components/dashboard/carte/ParcellesLayer';
import AgentLocationMarker from '@/components/dashboard/field/AgentLocationMarker';
import LiveAgentLocationMarker from '@/components/dashboard/field/LiveAgentLocationMarker';
import AgencyLocationMarker from '@/components/dashboard/field/AgencyLocationMarker';
import type { ItineraireStop } from '@/lib/today/directions';
import type { CadastreImmeublePoint, ParcelleNoteMarker, ParcellePickExtra } from '@/lib/carte/parcelle';
import { DEFAULT_MAP_LAYERS, type MapLayerState } from '@/lib/carte/layers';
import type { DevicePosition } from '@/lib/voice/gps';
import ZonesOverlay from '@/components/dashboard/carte/ZonesOverlay';
import SecteurMasqueLayer from '@/components/dashboard/carte/SecteurMasqueLayer';
import CibleRecherche from '@/components/dashboard/carte/CibleRecherche';
import VolCarte from '@/components/dashboard/carte/VolCarte';
import type { CibleCarte } from '@/lib/carte/cible';
import type { Zone } from '@/lib/zones/types';

const VIEWPORT_SETTLE_MS = 320;
const MARKERS_GARDES_PENDANT_GESTE = 120;

export type MobileMapHandle = {
  recenter: (coord: { latitude: number; longitude: number }, zoom?: number) => void;
  fitGroup: (buildings: readonly BuildingMarker[]) => void;
  fitStops: (stops: readonly { latitude: number; longitude: number }[]) => void;
  /** Revient au cap et à l'inclinaison du mode 2D / 3D. */
  remettreVue: () => void;
};

export type VueCarte = { bearing: number; pitch: number };

function vueDepart(
  bounds: LngLatBoundsTuple | null,
  secours: { longitude: number; latitude: number } | null,
  camera: { pitch: number; bearing: number },
) {
  // Un cadrage « bounds » seul est lu comme zoom 0 au centre du globe
  // tant que le style n'est pas prêt. On donne toujours un centre local.
  if (bounds) {
    const [[west, south], [east, north]] = bounds;
    return {
      longitude: (west + east) / 2,
      latitude: (south + north) / 2,
      zoom: 14,
      pitch: camera.pitch,
      bearing: camera.bearing,
      bounds,
      fitBoundsOptions: {
        padding: 60,
        maxZoom: 15,
      },
    };
  }
  if (secours) {
    return {
      longitude: secours.longitude,
      latitude: secours.latitude,
      zoom: 15,
      ...camera,
    };
  }
  return { ...FRANCE_MAP_VIEW, ...camera };
}

function boundsToViewport(map: MapRef): MapViewport | null {
  const b = map.getBounds();
  if (!b) return null;
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
    zoom: map.getZoom(),
  };
}

function fieldColor(building: BuildingMarker): string {
  if (building.appearance.kind === 'lead') return LEAD_FIELD_COLOR;
  return building.appearance.color;
}

export default function MobileMapCanvas({
  buildings,
  center,
  selectedBanId,
  mapRef: mapRefOut,
  onSelect,
  onDeselect,
  onViewport,
  onCluster,
  itineraryStops = null,
  itineraryGeometry = null,
  parcellesEnabled = false,
  activeParcelleIds = [],
  suiviParcelleIds = [],
  parcelleNoteMarkers = [],
  selectedParcelleId = null,
  cadastreImmeubles = [],
  cadastreLayers = {
    cadastreDpe: DEFAULT_MAP_LAYERS.cadastreDpe,
    cadastreVentes: DEFAULT_MAP_LAYERS.cadastreVentes,
    cadastreCopro: DEFAULT_MAP_LAYERS.cadastreCopro,
    cadastreDpeAges: DEFAULT_MAP_LAYERS.cadastreDpeAges,
  },
  onSelectParcelle,
  onPrefetchParcelle,
  agentPosition = null,
  highlightBanIds = null,
  suppressAutoFit = false,
  onMapPoint,
  onStopTap,
  onUserInteract,
  navigation = false,
  currentLeadId = null,
  completedLeadIds,
  focusBounds = null,
  zones = [],
  highlightedZoneId = null,
  clipZone = null,
  dimension = '2d',
  cible = null,
  focus = null,
  onVue,
  annoncesCouche = null,
}: {
  buildings: readonly BuildingMarker[];
  center: { latitude: number | null; longitude: number | null };
  selectedBanId: string | null;
  mapRef?: MutableRefObject<MobileMapHandle | null>;
  onSelect: (building: BuildingMarker) => void;
  onDeselect: () => void;
  onViewport: (viewport: MapViewport) => void;
  onCluster: (children: BuildingMarker[]) => void;
  itineraryStops?: readonly ItineraireStop[] | null;
  itineraryGeometry?: GeoJSON.LineString | null;
  parcellesEnabled?: boolean;
  activeParcelleIds?: readonly string[];
  suiviParcelleIds?: readonly string[];
  parcelleNoteMarkers?: readonly ParcelleNoteMarker[];
  selectedParcelleId?: string | null;
  cadastreImmeubles?: readonly CadastreImmeublePoint[];
  cadastreLayers?: Pick<MapLayerState, 'cadastreDpe' | 'cadastreVentes' | 'cadastreCopro' | 'cadastreDpeAges'>;
  onSelectParcelle?: (parcelleId: string, extra?: ParcellePickExtra) => void;
  onPrefetchParcelle?: (parcelleId: string) => void;
  agentPosition?: DevicePosition | null;
  highlightBanIds?: ReadonlySet<string> | null;
  suppressAutoFit?: boolean;
  /** Mode « choisir un point » : tout appui sur la carte renvoie ses coordonnées. */
  onMapPoint?: (coord: { latitude: number; longitude: number }) => void;
  /** Tournée : un numéro d'arrêt touché ouvre sa fiche au lieu de l'immeuble. */
  onStopTap?: (stop: ItineraireStop) => void;
  onUserInteract?: () => void;
  /** Tournée en cours : plus de cadastre, plus d'immeubles, carte atténuée. */
  navigation?: boolean;
  currentLeadId?: string | null;
  completedLeadIds?: readonly string[];
  focusBounds?: LngLatBoundsTuple | null;
  zones?: readonly Zone[];
  highlightedZoneId?: string | null;
  clipZone?: Zone | null;
  /** L'adresse demandée dans la barre de recherche. */
  cible?: CibleCarte | null;
  /** Lieu d'une note : la carte s'y pose. */
  focus?: { cle: string; latitude: number; longitude: number } | null;
  /** Plan à plat ou relief des immeubles. */
  dimension?: MapDimension;
  /** Cap et inclinaison après chaque geste. */
  onVue?: (vue: VueCarte) => void;
  annoncesCouche?: {
    layers: MapLayerState;
    /** Toutes les zones de l'agence : « Mon secteur » ne dépend pas de l'emprise affichée. */
    zones: readonly Zone[];
    directeur: boolean;
    profileId: string;
    onChoisir: (annonce: Annonce, soeurs: Annonce[]) => void;
  } | null;
}) {
  const mapRef = useRef<MapRef | null>(null);
  const fallback = toGeoCoord(center.latitude, center.longitude);
  const [zoom, setZoom] = useState(13);
  const [styleReady, setStyleReady] = useState(false);
  const [vuePosee, setVuePosee] = useState(false);
  const [mapGesturing, setMapGesturing] = useState(false);
  const gestureTimer = useRef<number | null>(null);
  const viewportTimer = useRef<number | null>(null);
  const revelerTimer = useRef<number | null>(null);
  const camera = cameraFor(dimension);
  const relief = !navigation && dimension === '3d';
  useCanvasAJour(mapRef, styleReady);

  const idsSignature = useMemo(
    () => buildings.map((b) => b.banId).sort().join(','),
    [buildings],
  );

  const initialBounds = useMemo(() => computeLngLatBounds(buildings), []); // eslint-disable-line react-hooks/exhaustive-deps

  const clustered = useMemo(() => clusterBuildings(buildings, zoom), [buildings, zoom]);

  useEffect(() => {
    if (!styleReady) return;
    const raw = mapRef.current?.getMap();
    if (!raw) return;
    let annule = false;
    const appliquer = () => {
      if (annule) return;
      if (navigation) applyTourneeMapStyle(raw);
      else restoreTourneeMapStyle(raw);
    };
    appliquer();
    try {
      raw.once('idle', appliquer);
    } catch {
      /* carte déjà détruite */
    }
    return () => {
      annule = true;
      try {
        raw.off('idle', appliquer);
      } catch {
        /* */
      }
    };
  }, [navigation, styleReady]);

  useEffect(
    () => () => {
      if (gestureTimer.current != null) window.clearTimeout(gestureTimer.current);
      if (viewportTimer.current != null) window.clearTimeout(viewportTimer.current);
      if (revelerTimer.current != null) window.clearTimeout(revelerTimer.current);
    },
    [],
  );

  const itineraryBounds = useMemo(() => {
    if (itineraryGeometry?.coordinates?.length) {
      return computeLngLatBounds(
        itineraryGeometry.coordinates.map((c) => ({ longitude: c[0] ?? 0, latitude: c[1] ?? 0 })),
      );
    }
    if (itineraryStops && itineraryStops.length > 0) return computeLngLatBounds(itineraryStops);
    return null;
  }, [itineraryGeometry, itineraryStops]);

  const fitBoundsTo = useCallback(
    (bounds: ReturnType<typeof computeLngLatBounds>, animate: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      try {
      const duration = animate ? 400 : 0;
      const tilt = navigation ? tiltFromMap(map) : camera;
      if (!bounds) {
        if (fallback) {
          map.easeTo({
            center: [fallback.longitude, fallback.latitude],
            zoom: 16,
            duration,
            ...tilt,
          });
        }
        return;
      }
      const [[west, south], [east, north]] = bounds;
      if (Math.max(east - west, north - south) > 2) {
        if (fallback) {
          map.easeTo({
            center: [fallback.longitude, fallback.latitude],
            zoom: 16,
            duration,
            ...tilt,
          });
        }
        return;
      }
      if (west === east && south === north) {
        map.easeTo({
          center: [west, south],
          zoom: 16,
          duration,
          ...tilt,
        });
        return;
      }
      map.fitBounds(bounds, {
        padding: { top: 80, bottom: 160, left: 40, right: 40 },
        maxZoom: 17,
        duration,
        ...tilt,
      });
      } catch {
        /* style pas encore prêt : le cadrage attendra le prochain geste */
      }
    },
    [fallback, camera, navigation],
  );

  const fitToPoints = useCallback(
    (animate: boolean, group?: readonly BuildingMarker[]) => {
      const source = group && group.length > 0 ? group : buildings;
      fitBoundsTo(
        !group && itineraryBounds
          ? itineraryBounds
          : !group && focusBounds
            ? focusBounds
            : computeLngLatBounds(source),
        animate,
      );
    },
    [buildings, itineraryBounds, focusBounds, fitBoundsTo],
  );

  const focusSignature = focusBounds
    ? `${focusBounds[0][0]},${focusBounds[0][1]},${focusBounds[1][0]},${focusBounds[1][1]}`
    : '';

  const cadrageInitial = useRef(true);
  useEffect(() => {
    if (suppressAutoFit) return;
    const animer = !cadrageInitial.current;
    cadrageInitial.current = false;
    fitToPoints(animer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSignature, itineraryBounds, suppressAutoFit, focusSignature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.getMap().touchZoomRotate.enableRotation();
      if (navigation) return;
      map.easeTo({ pitch: camera.pitch, bearing: camera.bearing, duration: 450, essential: true });
    } catch {
      /* style pas encore prêt */
    }
  }, [camera.pitch, camera.bearing, navigation, styleReady]);

  useEffect(() => {
    if (!mapRefOut) return;
    mapRefOut.current = {
      recenter: (coord, zoomLevel) => {
        const map = mapRef.current;
        map?.easeTo({
          center: [coord.longitude, coord.latitude],
          zoom: zoomLevel ?? 16,
          duration: 400,
          ...(map ? (navigation ? tiltFromMap(map) : camera) : {}),
        });
      },
      fitGroup: (group) => fitToPoints(true, group),
      fitStops: (stops) => fitBoundsTo(computeLngLatBounds(stops), true),
      remettreVue: () => {
        mapRef.current?.easeTo({ pitch: camera.pitch, bearing: camera.bearing, duration: 450, essential: true });
      },
    };
    return () => {
      mapRefOut.current = null;
    };
  }, [mapRefOut, fitToPoints, fitBoundsTo, camera, navigation]);

  const showCrmPins =
    !navigation &&
    !cadastreLayers.cadastreDpe &&
    !cadastreLayers.cadastreVentes &&
    !cadastreLayers.cadastreCopro;

  if (!MAPBOX_TOKEN) {
    return <MapTokenMissing />;
  }

  return (
    <div
      data-carte-vue={vuePosee ? 'prete' : 'attente'}
      className="priimo-map relative z-0 h-full min-h-0 w-full overflow-hidden bg-[#c8c0b4]"
      onContextMenu={(event) => event.preventDefault()}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        projection={{ name: 'mercator' }}
        initialViewState={vueDepart(initialBounds, fallback, camera)}
        attributionControl={false}
        minPitch={0}
        maxPitch={MAP_MAX_PITCH}
        dragRotate
        pitchWithRotate
        touchPitch
        touchZoomRotate
        interactiveLayerIds={[
          ...(!navigation && parcellesEnabled ? [PARCELLES_FILL_LAYER_ID] : []),
          ...(!navigation && cadastreLayers.cadastreDpe ? [CADASTRE_DPE_LAYER_ID] : []),
          ...(!navigation && cadastreLayers.cadastreVentes
            ? [
                CADASTRE_VENTES_POINT_LAYER_ID,
                CADASTRE_VENTES_LAYER_ID,
                CADASTRE_VENTES_PARCELLE_LABEL_LAYER_ID,
              ]
            : []),
          ...(!navigation && cadastreLayers.cadastreCopro ? [CADASTRE_COPRO_LAYER_ID] : []),
        ]}
        onMoveStart={() => {
          onUserInteract?.();
          if (gestureTimer.current != null) {
            window.clearTimeout(gestureTimer.current);
            gestureTimer.current = null;
          }
          if (viewportTimer.current != null) {
            window.clearTimeout(viewportTimer.current);
            viewportTimer.current = null;
          }
          setMapGesturing(true);
        }}
        onLoad={() => {
          const map = mapRef.current;
          const raw = map?.getMap();
          if (raw) {
            try {
              raw.setProjection('mercator');
            } catch {
              /* carte déjà détruite */
            }
          }
          const next = map ? boundsToViewport(map) : null;
          if (next) onViewport(next);
          if (map) {
            setZoom(map.getZoom());
            if (navigation) applyTourneeMapStyle(map.getMap());
          }
          setStyleReady(true);
          if (!cible && !focus) fitToPoints(false);
          const montrer = () => {
            const vue = mapRef.current;
            if (vue && vue.getZoom() < 6 && fallback) {
              try {
                vue.easeTo({
                  center: [fallback.longitude, fallback.latitude],
                  zoom: 15,
                  duration: 0,
                });
              } catch {
                /* le cadrage de secours attendra le prochain geste */
              }
            }
            setVuePosee(true);
          };
          if (raw) {
            try {
              raw.once('render', montrer);
            } catch {
              montrer();
            }
          } else {
            montrer();
          }
          if (revelerTimer.current != null) window.clearTimeout(revelerTimer.current);
          revelerTimer.current = window.setTimeout(montrer, 250);
        }}
        onMoveEnd={(event) => {
          const b = event.target.getBounds();
          if (b) {
            const next = {
              west: b.getWest(),
              south: b.getSouth(),
              east: b.getEast(),
              north: b.getNorth(),
              zoom: event.target.getZoom(),
            };
            if (viewportTimer.current != null) window.clearTimeout(viewportTimer.current);
            viewportTimer.current = window.setTimeout(() => {
              viewportTimer.current = null;
              onViewport(next);
            }, VIEWPORT_SETTLE_MS);
          }
          setZoom(event.target.getZoom());
          onVue?.({ bearing: event.target.getBearing(), pitch: event.target.getPitch() });
          if (gestureTimer.current != null) window.clearTimeout(gestureTimer.current);
          gestureTimer.current = window.setTimeout(() => {
            gestureTimer.current = null;
            setMapGesturing(false);
          }, 120);
        }}
        onClick={(event) => {
          try {
            if (onMapPoint) {
              onMapPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
              return;
            }
            if (parcellesEnabled && event.target.getLayer(PARCELLES_FILL_LAYER_ID)) {
              const hits = event.target.queryRenderedFeatures(event.point, {
                layers: [PARCELLES_FILL_LAYER_ID],
              });
              if (hits.length > 0) return;
            }
          } catch {
            /* couche ou style pas encore là */
          }
          onDeselect();
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Buildings3DLayer
          mapRef={mapRef}
          enabled={relief}
          ready={styleReady}
        />
        <ParcellesLayer
          mapRef={mapRef}
          enabled={!navigation && parcellesEnabled}
          activeParcelleIds={activeParcelleIds}
          suiviParcelleIds={suiviParcelleIds}
          noteMarkers={parcelleNoteMarkers}
          selectedParcelleId={selectedParcelleId}
          immeubles={cadastreImmeubles}
          layers={cadastreLayers}
          clipZone={clipZone}
          onPick={(parcelleId, extra) => onSelectParcelle?.(parcelleId, extra)}
          onPrefetch={onPrefetchParcelle}
        />
        {annoncesCouche && !navigation ? (
          <AnnoncesMarqueurs
            layers={annoncesCouche.layers}
            zones={annoncesCouche.zones}
            directeur={annoncesCouche.directeur}
            profileId={annoncesCouche.profileId}
            onChoisir={annoncesCouche.onChoisir}
          />
        ) : null}
        {cible && !navigation ? (
          <CibleRecherche
            cible={cible}
            buildings={buildings}
            onSelect={onSelect}
            onSelectParcelle={onSelectParcelle}
          />
        ) : focus && !navigation ? (
          <VolCarte latitude={focus.latitude} longitude={focus.longitude} cle={focus.cle} />
        ) : null}
        {navigation ? null : (
          <>
            <SecteurMasqueLayer zone={clipZone} />
            <ZonesOverlay zones={zones} highlightedZoneId={highlightedZoneId} />
          </>
        )}
        {itineraryStops && (itineraryStops.length >= 2 || (itineraryStops.length > 0 && itineraryGeometry)) ? (
          <ItineraireLayer
            geometry={itineraryGeometry}
            stops={itineraryStops}
            currentLeadId={currentLeadId}
            completedLeadIds={completedLeadIds}
            progressPoint={agentPosition}
            onStop={(stop) => {
              if (onStopTap) {
                onStopTap(stop);
                return;
              }
              const building = buildings.find((b) => b.banId && b.banId === stop.banId);
              if (building) onSelect(building);
            }}
          />
        ) : null}
        {showCrmPins &&
        (!mapGesturing || clustered.length <= MARKERS_GARDES_PENDANT_GESTE)
          ? clustered.map((item) => {
          if (item.kind === 'cluster') {
            if (!isUsableCoord(item.latitude, item.longitude)) return null;
            return (
              <Marker
                key={item.id}
                longitude={item.longitude}
                latitude={item.latitude}
                anchor="center"
                onClick={(event) => {
                  event.originalEvent.stopPropagation();
                  onCluster(item.children);
                }}
              >
                <button
                  type="button"
                  aria-label={`${item.count} adresses`}
                  className="priimo-pin-field priimo-pin-field--cluster"
                >
                  {item.count}
                </button>
              </Marker>
            );
          }

          const building = item.building;
          if (!isUsableCoord(building.latitude, building.longitude)) return null;
          const emphasized = building.banId === selectedBanId;
          const tourSelected = highlightBanIds?.has(building.banId) ?? false;
          const color = fieldColor(building);
          const label =
            building.count > 1 ? `${building.count} fiches à cette adresse` : building.appearance.title;

          return (
            <Marker
              key={building.banId}
              longitude={building.longitude}
              latitude={building.latitude}
              anchor="center"
              style={{ zIndex: emphasized ? 20 : 4 }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                onSelect(building);
              }}
            >
              <span className="priimo-pin-wrap">
                <button
                  type="button"
                  aria-label={label}
                  className="priimo-pin-field priimo-pin-field--icon"
                  style={{
                    background: color,
                    boxShadow:
                      emphasized || tourSelected
                        ? '0 0 0 3px rgba(232, 116, 60, 0.45)'
                        : undefined,
                    outline: tourSelected ? '2px solid #fff' : undefined,
                  }}
                >
                  <PinIcone kind={building.appearance.kind} />
                </button>
                {building.count > 1 ? (
                  <span className="priimo-pin-count" aria-hidden>
                    {building.count}
                  </span>
                ) : null}
              </span>
            </Marker>
          );
        })
          : null}
        {!navigation && fallback ? (
          <Marker
            longitude={fallback.longitude}
            latitude={fallback.latitude}
            anchor="center"
            style={{ zIndex: 36 }}
          >
            <AgencyLocationMarker />
          </Marker>
        ) : null}
        {navigation && agentPosition && isUsableCoord(agentPosition.latitude, agentPosition.longitude) ? (
          <Marker
            longitude={agentPosition.longitude}
            latitude={agentPosition.latitude}
            anchor="center"
            style={{ zIndex: 40 }}
          >
            <AgentLocationMarker position={agentPosition} />
          </Marker>
        ) : null}
        {!navigation ? <LiveAgentLocationMarker highAccuracy minUpdateM={10} /> : null}
      </Map>
    </div>
  );
}
