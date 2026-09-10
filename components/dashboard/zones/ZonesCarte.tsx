'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl';
import type MapboxDraw from '@mapbox/mapbox-gl-draw';
import { FRANCE_MAP_VIEW, MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import { OPACITE_REMPLISSAGE_ZONE } from '@/lib/zones/palette';
import { bbox, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
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

export type LeadPoint = { id: string; latitude: number; longitude: number; pris: boolean };

const ORANGE_LEAD = '#E8743C';

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

  const actives = useMemo(() => zones.filter((z) => z.actif), [zones]);

  /**
   * Cadre de départ : l'emprise de tous les secteurs. Sans secteur, l'adresse
   * de l'agence ; sans adresse, la France — on n'affiche jamais une carte
   * grise sans repère.
   */
  const cadre = useMemo(() => {
    const boites = actives.flatMap((z) => polygonesDeZone(z).map(bbox)).filter((b): b is NonNullable<typeof b> => b !== null);
    return fusionnerBbox(boites);
  }, [actives]);

  const onDessine = useCallback(
    (e: DrawEvent) => {
      const feature = e.features[0];
      if (!feature || feature.geometry.type !== 'Polygon') return;
      onPolygoneDessine?.(feature.geometry);
      // Le contour part vers le panneau : on rend la carte propre, la couche
      // du secteur prendra le relais dès l'enregistrement.
      drawRef.current?.deleteAll();
    },
    [onPolygoneDessine],
  );

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
    if (!zoneActive) return;
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
  }, [zoneActive, pret]);

  useEffect(() => {
    const draw = drawRef.current as unknown as { changeMode: (mode: string) => void } | null;
    if (!draw || !pret) return;
    draw.changeMode(modeDessin === 'polygone' ? 'draw_polygon' : 'simple_select');
  }, [modeDessin, pret]);

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
    <div className="relative overflow-hidden rounded-clay-lg" style={{ height: hauteur }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        initialViewState={depart}
        onLoad={() => setPret(true)}
        interactiveLayerIds={actives.map((z) => `zone-fill-${z.id}`)}
        onMouseMove={(e) => {
          const zoneId = e.features?.[0]?.properties?.zoneId;
          onSurvolZone?.(typeof zoneId === 'string' ? zoneId : null);
        }}
        onMouseOut={() => onSurvolZone?.(null)}
        style={{ width: '100%', height: '100%' }}
      >
        {onPolygoneDessine || onPolygoneModifie ? (
          <DrawControl
            couleur={zoneActive?.couleur ?? '#4C7A9E'}
            onCreate={onDessine}
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
          if (courante && (onPolygoneDessine || onPolygoneModifie)) return null;
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
            </Source>
          );
        })}

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
                backgroundColor: ORANGE_LEAD,
                opacity: lead.pris ? 0.35 : 1,
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
