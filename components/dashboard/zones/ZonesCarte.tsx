'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
import { FRANCE_MAP_VIEW, MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import { OPACITE_REMPLISSAGE_ZONE } from '@/lib/zones/palette';
import { bbox, chevauchements, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
import { COULEUR_FRAICHEUR, type NiveauFraicheur } from '@/lib/zones/fraicheur';
import { polygoneDepuisTrace, type PointTrace } from '@/lib/zones/trace';
import type { Zone } from '@/lib/zones/types';
import DrawControl, { type DrawEvent } from './DrawControl';

/**
 * La carte des secteurs.
 *
 * Toutes les zones sont visibles en même temps, chacune dans sa couleur, en
 * remplissage translucide : c'est le seul moyen de voir les trous et les
 * chevauchements. Celle qu'on travaille est plus contrastée que les autres,
 * pour qu'on sache toujours sur quoi on dessine.
 */

export type LeadPoint = {
  id: string;
  latitude: number;
  longitude: number;
  pris?: boolean;
  niveau?: NiveauFraicheur;
};

const ORANGE_LEAD = '#E8743C';

/** Un geste de la souris ou du doigt sur la carte, quelle que soit sa source. */
type GesteCarte = {
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
};

/** En dessous, c'est du tremblement de main, pas une inflexion du contour. */
const PAS_MINIMUM_PX = 3;

/**
 * Tolérance de simplification, exprimée en degrés à l'échelle affichée : le
 * même geste doit donner le même contour qu'on soit zoomé sur un pâté de
 * maisons ou sur une ville entière.
 */
function toleranceDegres(ref: MapRef | null): number {
  const map = ref?.getMap();
  const bornes = map?.getBounds();
  const largeur = map?.getCanvas().clientWidth ?? 0;
  if (!bornes || largeur <= 0) return 0.00003;
  return (Math.abs(bornes.getEast() - bornes.getWest()) / largeur) * PAS_MINIMUM_PX;
}

function canvasHachure(): HTMLCanvasElement {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.strokeStyle = 'rgba(40, 36, 32, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-2, size / 2);
  ctx.lineTo(size / 2, -2);
  ctx.moveTo(0, size + 2);
  ctx.lineTo(size + 2, 0);
  ctx.moveTo(size / 2, size + 2);
  ctx.lineTo(size + 2, size / 2);
  ctx.stroke();
  return canvas;
}

type Props = {
  zones: readonly Zone[];
  /** Secteur en cours d'édition. Null = lecture seule. */
  zoneActive: Zone | null;
  leads?: readonly LeadPoint[];
  centre: { latitude: number | null; longitude: number | null };
  hauteur: number;
  /** Contour proposé mais pas encore enregistré. */
  apercu?: GeoJSON.Polygon | null;
  /** Voie surlignée après le choix dans l'autocomplétion BAN. */
  voieSurlignee?: { latitude: number; longitude: number } | null;
  modeDessin?: 'inactif' | 'polygone';
  onPolygoneDessine?: (polygone: GeoJSON.Polygon) => void;
  onPolygoneModifie?: (regleId: string, polygone: GeoJSON.Polygon) => void;
  onSurvolZone?: (zoneId: string | null) => void;
};

function collectionDeZone(zone: Zone): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: polygonesDeZone(zone).map((p) => ({
      type: 'Feature',
      properties: { zoneId: zone.id, nom: zone.nom },
      geometry: { type: 'Polygon', coordinates: p.coordinates as unknown as number[][][] },
    })),
  };
}

export default function ZonesCarte({
  zones,
  zoneActive,
  leads = [],
  centre,
  hauteur,
  apercu = null,
  voieSurlignee = null,
  modeDessin = 'inactif',
  onPolygoneDessine,
  onPolygoneModifie,
  onSurvolZone,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [pret, setPret] = useState(false);
  const [hachurePret, setHachurePret] = useState(false);

  /**
   * Tracé à main levée. mapbox-gl-draw ne sait poser des sommets qu'au clic,
   * un par un : quand on essaie de suivre une rue d'un geste, la carte se
   * contente de coulisser. On récolte donc le geste nous-mêmes, et on ne
   * laisse à l'éditeur que ce qu'il fait bien — reprendre un sommet.
   */
  const dessinActif = modeDessin === 'polygone' && Boolean(onPolygoneDessine);
  const traceRef = useRef<PointTrace[]>([]);
  const dernierPixelRef = useRef<{ x: number; y: number } | null>(null);
  const enTraceRef = useRef(false);
  const [trace, setTrace] = useState<PointTrace[]>([]);

  const debuterTrace = useCallback(
    (e: GesteCarte) => {
      if (!dessinActif) return;
      enTraceRef.current = true;
      traceRef.current = [[e.lngLat.lng, e.lngLat.lat]];
      dernierPixelRef.current = { x: e.point.x, y: e.point.y };
      setTrace(traceRef.current.slice());
    },
    [dessinActif],
  );

  const prolongerTrace = useCallback((e: GesteCarte) => {
    if (!enTraceRef.current) return;
    const dernier = dernierPixelRef.current;
    if (dernier && Math.hypot(e.point.x - dernier.x, e.point.y - dernier.y) < PAS_MINIMUM_PX) {
      return;
    }
    dernierPixelRef.current = { x: e.point.x, y: e.point.y };
    traceRef.current = [...traceRef.current, [e.lngLat.lng, e.lngLat.lat]];
    setTrace(traceRef.current);
  }, []);

  const terminerTrace = useCallback(() => {
    if (!enTraceRef.current) return;
    enTraceRef.current = false;
    const points = traceRef.current;
    traceRef.current = [];
    dernierPixelRef.current = null;
    setTrace([]);
    const polygone = polygoneDepuisTrace(points, toleranceDegres(mapRef.current));
    if (polygone) onPolygoneDessine?.(polygone);
  }, [onPolygoneDessine]);

  const actives = useMemo(() => zones.filter((z) => z.actif), [zones]);
  const idsHachures = useMemo(() => {
    const ids = new Set<string>();
    for (const c of chevauchements(actives)) {
      ids.add(c.zoneA.id);
      ids.add(c.zoneB.id);
    }
    return ids;
  }, [actives]);

  /**
   * Cadre de départ : l'emprise de tous les secteurs. Sans secteur, l'adresse
   * de l'agence ; sans adresse, la France — on n'affiche jamais une carte
   * grise sans repère.
   */
  const cadre = useMemo(() => {
    const boites = actives.flatMap((z) => polygonesDeZone(z).map(bbox)).filter((b): b is NonNullable<typeof b> => b !== null);
    return fusionnerBbox(boites);
  }, [actives]);

  const onModifie = useCallback(
    (e: DrawEvent) => {
      const feature = e.features[0];
      if (!feature || feature.geometry.type !== 'Polygon') return;
      const regleId = typeof feature.id === 'string' ? feature.id : null;
      if (regleId) onPolygoneModifie?.(regleId, feature.geometry);
    },
    [onPolygoneModifie],
  );

  /**
   * Les contours du secteur en cours passent dans l'éditeur, avec l'id de leur
   * règle comme identité : déplacer un sommet met à jour cette règle-là, pas
   * une copie.
   */
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw || !pret) return;
    draw.deleteAll();
    // Pendant le tracé, l'éditeur est vidé : sinon le premier appui attrape un
    // sommet existant au lieu de commencer un contour. Le secteur reste visible,
    // rendu par sa propre couche.
    if (!zoneActive || dessinActif) return;
    for (const regle of zoneActive.regles) {
      if (regle.type !== 'polygone' || !regle.inclusion) continue;
      draw.add({
        id: regle.id,
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: regle.valeur.coordinates as unknown as number[][][],
        },
      });
    }
  }, [zoneActive, pret, dessinActif]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cadre) return;
    map.fitBounds(
      [
        [cadre.ouest, cadre.sud],
        [cadre.est, cadre.nord],
      ],
      { padding: 48, maxZoom: 15, duration: 0 },
    );
  }, [cadre]);

  if (!MAPBOX_TOKEN) return <MapTokenMissing />;

  const depart =
    centre.latitude != null && centre.longitude != null
      ? { longitude: centre.longitude, latitude: centre.latitude, zoom: 12 }
      : FRANCE_MAP_VIEW;

  return (
    <div
      className={`priimo-map relative overflow-hidden rounded-clay-lg ${
        dessinActif ? 'touch-none' : ''
      }`}
      style={{ height: hauteur }}
      // Relâcher au-dessus d'un point de lead ne passe pas par la carte :
      // sans ça, le geste resterait ouvert et le contour serait perdu.
      onPointerUp={terminerTrace}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        initialViewState={depart}
        attributionControl={false}
        // Le geste appartient au tracé : la carte ne coulisse plus sous la main.
        dragPan={!dessinActif}
        doubleClickZoom={!dessinActif}
        cursor={dessinActif ? 'crosshair' : undefined}
        onMouseDown={debuterTrace}
        onMouseUp={terminerTrace}
        onTouchStart={debuterTrace}
        onTouchMove={prolongerTrace}
        onTouchEnd={terminerTrace}
        onLoad={(e) => {
          const map = e.target;
          if (!map.hasImage('hachure-chevauchement')) {
            const canvas = canvasHachure();
            const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
            if (pixels) map.addImage('hachure-chevauchement', pixels, { pixelRatio: 2 });
          }
          setHachurePret(true);
          setPret(true);
        }}
        interactiveLayerIds={actives.map((z) => `zone-fill-${z.id}`)}
        onMouseMove={(e) => {
          if (enTraceRef.current) {
            prolongerTrace(e);
            return;
          }
          const zoneId = e.features?.[0]?.properties?.zoneId;
          onSurvolZone?.(typeof zoneId === 'string' ? zoneId : null);
        }}
        onMouseOut={() => onSurvolZone?.(null)}
        style={{ width: '100%', height: '100%' }}
      >
        {onPolygoneModifie ? (
          <DrawControl
            couleur={zoneActive?.couleur ?? '#4C7A9E'}
            onUpdate={onModifie}
            onReady={(draw) => {
              drawRef.current = draw;
            }}
          />
        ) : null}

        {actives.map((zone) => {
          const courante = zone.id === zoneActive?.id;
          // Le secteur en cours est déjà dans l'éditeur : le redessiner ici
          // superposerait deux contours et fausserait la lecture des teintes.
          if (courante && Boolean(onPolygoneModifie) && !dessinActif) return null;
          return (
            <Source key={zone.id} id={`zone-${zone.id}`} type="geojson" data={collectionDeZone(zone)}>
              <Layer
                id={`zone-fill-${zone.id}`}
                type="fill"
                paint={{
                  'fill-color': zone.couleur,
                  'fill-opacity': courante ? OPACITE_REMPLISSAGE_ZONE * 2 : OPACITE_REMPLISSAGE_ZONE,
                }}
              />
              <Layer
                id={`zone-line-${zone.id}`}
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': zone.couleur,
                  'line-width': courante ? 2.5 : 1.5,
                  'line-opacity': courante ? 1 : 0.7,
                }}
              />
              {hachurePret && idsHachures.has(zone.id) ? (
                <Layer
                  id={`zone-hatch-${zone.id}`}
                  type="fill"
                  paint={{
                    'fill-pattern': 'hachure-chevauchement',
                    'fill-opacity': 0.55,
                  }}
                />
              ) : null}
            </Source>
          );
        })}

        {trace.length >= 2 ? (
          <Source
            id="zone-trace"
            type="geojson"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: trace.map((p) => [p[0], p[1]]) },
            }}
          >
            <Layer
              id="zone-trace-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': zoneActive?.couleur ?? '#4C7A9E', 'line-width': 3 }}
            />
          </Source>
        ) : null}

        {apercu ? (
          <Source id="zone-apercu" type="geojson" data={{ type: 'Feature', properties: {}, geometry: apercu }}>
            <Layer
              id="zone-apercu-fill"
              type="fill"
              paint={{ 'fill-color': zoneActive?.couleur ?? '#4C7A9E', 'fill-opacity': 0.18 }}
            />
            <Layer
              id="zone-apercu-line"
              type="line"
              paint={{
                'line-color': zoneActive?.couleur ?? '#4C7A9E',
                'line-width': 2,
                'line-dasharray': [2, 1.5],
              }}
            />
          </Source>
        ) : null}

        {leads.map((lead) => (
          <Marker key={lead.id} longitude={lead.longitude} latitude={lead.latitude}>
            <span
              aria-hidden
              className="block rounded-full ring-2 ring-white"
              style={{
                width: 9,
                height: 9,
                backgroundColor: lead.niveau ? COULEUR_FRAICHEUR[lead.niveau] : ORANGE_LEAD,
                opacity: lead.pris && !lead.niveau ? 0.35 : 1,
              }}
            />
          </Marker>
        ))}

        {voieSurlignee ? (
          <Marker longitude={voieSurlignee.longitude} latitude={voieSurlignee.latitude}>
            <span
              aria-hidden
              className="block animate-pulse rounded-full ring-2 ring-white"
              style={{ width: 14, height: 14, backgroundColor: zoneActive?.couleur ?? '#4C7A9E' }}
            />
          </Marker>
        ) : null}
      </Map>
    </div>
  );
}
