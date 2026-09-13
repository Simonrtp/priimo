'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl';
import { FRANCE_MAP_VIEW, MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import { OPACITE_REMPLISSAGE_ZONE } from '@/lib/zones/palette';
import { bbox, chevauchements, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
import { COULEUR_FRAICHEUR, type NiveauFraicheur } from '@/lib/zones/fraicheur';
import { polygoneDepuisTrace, type PointTrace } from '@/lib/zones/trace';
import {
  deplacerSommet,
  insererSommet,
  milieuxSegments,
  retirerSommet,
  sommetsManipulables,
  type Sommet,
} from '@/lib/zones/contour';
import type { Zone } from '@/lib/zones/types';

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

export type ModeCarte = 'inactif' | 'polygone' | 'ajuster';

const ORANGE_LEAD = '#E8743C';

/** Un geste de la souris ou du doigt sur la carte, quelle que soit sa source. */
type GesteCarte = {
  point: { x: number; y: number };
  lngLat: { lng: number; lat: number };
};

/** En dessous, c'est du tremblement de main, pas une inflexion du contour. */
const PAS_MINIMUM_PX = 3;

/**
 * Lissage du geste, plus lâche que le pas de capture : un contour se retouche
 * ensuite poignée par poignée, et trois cents poignées ne se retouchent pas.
 */
const LISSAGE_PX = 9;

/** Au-delà, les milieux de segment encombrent le contour plus qu'ils n'aident. */
const MILIEUX_JUSQUA = 120;

/**
 * Tolérance de simplification, exprimée en degrés à l'échelle affichée : le
 * même geste doit donner le même contour qu'on soit zoomé sur un pâté de
 * maisons ou sur une ville entière.
 */
function toleranceDegres(ref: MapRef | null, pixels: number): number {
  const map = ref?.getMap();
  const bornes = map?.getBounds();
  const largeur = map?.getCanvas().clientWidth ?? 0;
  if (!bornes || largeur <= 0) return 0.00001 * pixels;
  return (Math.abs(bornes.getEast() - bornes.getWest()) / largeur) * pixels;
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
  /** Hauteur fixe. Sans valeur, la carte remplit le parent. */
  hauteur?: number;
  /** Contour proposé mais pas encore enregistré. */
  apercu?: GeoJSON.Polygon | null;
  /** Voie surlignée après le choix dans l'autocomplétion BAN. */
  voieSurlignee?: { latitude: number; longitude: number } | null;
  modeDessin?: ModeCarte;
  onPolygoneDessine?: (polygone: GeoJSON.Polygon) => void;
  onPolygoneModifie?: (regleId: string, polygone: GeoJSON.Polygon) => void;
  onSurvolZone?: (zoneId: string | null) => void;
  /** Lecture seule : un clic dans un contour choisit ce secteur. */
  onChoisirZone?: (zoneId: string) => void;
};

/** Retouche en cours de geste, pas encore envoyée au serveur. */
type Brouillon = { regleId: string; polygone: GeoJSON.Polygon };

function polygoneDeRegle(coordinates: unknown): GeoJSON.Polygon {
  return { type: 'Polygon', coordinates: coordinates as number[][][] };
}

/** Contours d'une zone, avec la retouche en cours substituée à l'enregistré. */
function collectionDeZone(zone: Zone, brouillon: Brouillon | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const regle of zone.regles) {
    if (regle.type !== 'polygone' || !regle.inclusion) continue;
    features.push({
      type: 'Feature',
      properties: { zoneId: zone.id, nom: zone.nom },
      geometry:
        brouillon?.regleId === regle.id
          ? brouillon.polygone
          : polygoneDeRegle(regle.valeur.coordinates),
    });
  }
  return { type: 'FeatureCollection', features };
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
  onChoisirZone,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const boiteRef = useRef<HTMLDivElement | null>(null);
  const [pret, setPret] = useState(false);

  /**
   * Tracé à main levée. mapbox-gl-draw ne sait poser des sommets qu'au clic,
   * un par un : quand on essaie de suivre une rue d'un geste, la carte se
   * contente de coulisser. On récolte donc le geste nous-mêmes.
   */
  const dessinActif = modeDessin === 'polygone' && Boolean(onPolygoneDessine);
  const ajustActif = modeDessin === 'ajuster' && Boolean(onPolygoneModifie) && zoneActive !== null;
  const traceRef = useRef<PointTrace[]>([]);
  const dernierPixelRef = useRef<{ x: number; y: number } | null>(null);
  const enTraceRef = useRef(false);
  const [trace, setTrace] = useState<PointTrace[]>([]);

  /**
   * Retouche élastique. L'éditeur de mapbox-gl-draw déplace le secteur entier
   * dès qu'on glisse à l'intérieur du contour : un geste de trop et le quartier
   * part à deux rues de là. On tient donc les poignées nous-mêmes.
   */
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  /** Index du sommet né sous le doigt quand on tire un milieu de segment. */
  const sommetNeRef = useRef<number | null>(null);

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
    const polygone = polygoneDepuisTrace(points, toleranceDegres(mapRef.current, LISSAGE_PX));
    if (polygone) onPolygoneDessine?.(polygone);
  }, [onPolygoneDessine]);

  const commiter = useCallback(() => {
    sommetNeRef.current = null;
    if (!brouillon) return;
    onPolygoneModifie?.(brouillon.regleId, brouillon.polygone);
    setBrouillon(null);
  }, [brouillon, onPolygoneModifie]);

  const actives = useMemo(() => zones.filter((z) => z.actif), [zones]);
  const idsHachures = useMemo(() => {
    const ids = new Set<string>();
    for (const c of chevauchements(actives)) {
      ids.add(c.zoneA.id);
      ids.add(c.zoneB.id);
    }
    return ids;
  }, [actives]);

  /** Contours retouchables du secteur en cours, avec leurs poignées. */
  const contoursAjustables = useMemo(() => {
    if (!ajustActif || !zoneActive) return [];
    return zoneActive.regles.flatMap((regle) => {
      if (regle.type !== 'polygone' || !regle.inclusion) return [];
      const polygone =
        brouillon?.regleId === regle.id
          ? brouillon.polygone
          : polygoneDeRegle(regle.valeur.coordinates);
      return polygone.coordinates.map((anneau, indexAnneau) => ({
        cle: `${regle.id}-${indexAnneau}`,
        regleId: regle.id,
        polygone,
        indexAnneau,
        sommets: sommetsManipulables(anneau),
        milieux: milieuxSegments(anneau),
      }));
    });
  }, [ajustActif, zoneActive, brouillon]);

  const tropDeSommetsPourLesMilieux =
    contoursAjustables.reduce((n, c) => n + c.sommets.length, 0) > MILIEUX_JUSQUA;

  /**
   * Cadre de départ : l'emprise de tous les secteurs. Sans secteur, l'adresse
   * de l'agence ; sans adresse, la France — on n'affiche jamais une carte grise
   * sans repère.
   */
  const cadre = useMemo(() => {
    const cibles = onChoisirZone && zoneActive ? [zoneActive] : actives;
    const boites = cibles
      .flatMap((z) => polygonesDeZone(z).map(bbox))
      .filter((b): b is NonNullable<typeof b> => b !== null);
    return fusionnerBbox(boites);
  }, [actives, zoneActive, onChoisirZone]);

  /**
   * On recadre à l'arrivée et quand la liste des secteurs change, jamais quand
   * un contour bouge : recadrer après chaque poignée relâchée déplacerait la
   * carte sous la main de celui qui retouche.
   */
  const listeSecteurs = actives.map((z) => z.id).join(',');
  const cadreRef = useRef(cadre);
  cadreRef.current = cadre;
  useEffect(() => {
    const map = mapRef.current;
    const c = cadreRef.current;
    if (!pret || !map || !c) return;
    map.fitBounds(
      [
        [c.ouest, c.sud],
        [c.est, c.nord],
      ],
      { padding: 48, maxZoom: 15, duration: zoneActive ? 400 : 0 },
    );
  }, [pret, listeSecteurs, zoneActive?.id]);

  // Un parent en flex change de taille après le premier rendu : sans ça,
  // Mapbox garde le canvas de 280 px dans une carte déjà plus haute.
  useEffect(() => {
    const el = boiteRef.current;
    if (!pret || !el) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.getMap().resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pret]);

  if (!MAPBOX_TOKEN) return <MapTokenMissing />;

  const depart =
    centre.latitude != null && centre.longitude != null
      ? { longitude: centre.longitude, latitude: centre.latitude, zoom: 12 }
      : FRANCE_MAP_VIEW;

  return (
    <div
      ref={boiteRef}
      className={`priimo-map relative overflow-hidden rounded-clay-lg ${
        dessinActif ? 'touch-none' : ''
      } ${hauteur == null ? 'h-full min-h-[280px]' : ''}`}
      style={hauteur != null ? { height: hauteur } : undefined}
      // Relâcher au-dessus d'un point de lead ne passe pas par la carte : sans
      // ça, le geste resterait ouvert et le contour serait perdu.
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
        cursor={dessinActif ? 'crosshair' : onChoisirZone ? 'pointer' : undefined}
        onMouseDown={debuterTrace}
        onMouseUp={terminerTrace}
        onTouchStart={debuterTrace}
        onTouchMove={prolongerTrace}
        onTouchEnd={terminerTrace}
        onClick={(e) => {
          if (dessinActif || ajustActif || !onChoisirZone) return;
          const zoneId = e.features?.[0]?.properties?.zoneId;
          if (typeof zoneId === 'string') onChoisirZone(zoneId);
        }}
        onLoad={(e) => {
          const map = e.target;
          if (!map.hasImage('hachure-chevauchement')) {
            const canvas = canvasHachure();
            const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
            if (pixels) map.addImage('hachure-chevauchement', pixels, { pixelRatio: 2 });
          }
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
        {actives.map((zone) => {
          const courante = zone.id === zoneActive?.id;
          return (
            <Source
              key={zone.id}
              id={`zone-${zone.id}`}
              type="geojson"
              data={collectionDeZone(zone, courante ? brouillon : null)}
            >
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
              {pret && idsHachures.has(zone.id) ? (
                <Layer
                  id={`zone-hatch-${zone.id}`}
                  type="fill"
                  paint={{ 'fill-pattern': 'hachure-chevauchement', 'fill-opacity': 0.55 }}
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

        {contoursAjustables.map((contour) => (
          <PoigneesContour
            key={contour.cle}
            couleur={zoneActive?.couleur ?? '#4C7A9E'}
            sommets={contour.sommets}
            milieux={contour.milieux}
            avecMilieux={!tropDeSommetsPourLesMilieux}
            onDeplacerSommet={(index, vers) =>
              setBrouillon({
                regleId: contour.regleId,
                polygone: deplacerSommet(contour.polygone, contour.indexAnneau, index, vers),
              })
            }
            onTirerMilieu={(apres, vers) => {
              // Le premier mouvement fait naître le sommet, les suivants le tirent.
              if (sommetNeRef.current === null) {
                sommetNeRef.current = apres + 1;
                setBrouillon({
                  regleId: contour.regleId,
                  polygone: insererSommet(contour.polygone, contour.indexAnneau, apres, vers),
                });
                return;
              }
              setBrouillon({
                regleId: contour.regleId,
                polygone: deplacerSommet(
                  contour.polygone,
                  contour.indexAnneau,
                  sommetNeRef.current,
                  vers,
                ),
              });
            }}
            onRetirerSommet={(index) => {
              const reduit = retirerSommet(contour.polygone, contour.indexAnneau, index);
              if (reduit) onPolygoneModifie?.(contour.regleId, reduit);
            }}
            onFinGeste={commiter}
          />
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

/**
 * Les poignées d'un anneau : un rond plein par sommet, un rond creux au milieu
 * de chaque segment. Tirer un rond creux fait naître un sommet — c'est ce geste
 * qui donne au contour son élasticité.
 *
 * La poignée en cours de geste suit le curseur et rien d'autre. Sans ça elle se
 * ferait rappeler à sa position calculée à chaque image, et le trait tremblerait.
 */
function PoigneesContour({
  couleur,
  sommets,
  milieux,
  avecMilieux,
  onDeplacerSommet,
  onTirerMilieu,
  onRetirerSommet,
  onFinGeste,
}: {
  couleur: string;
  sommets: readonly Sommet[];
  milieux: readonly { apres: number; point: Sommet }[];
  avecMilieux: boolean;
  onDeplacerSommet: (index: number, vers: Sommet) => void;
  onTirerMilieu: (apres: number, vers: Sommet) => void;
  onRetirerSommet: (index: number) => void;
  onFinGeste: () => void;
}) {
  const [tiree, setTiree] = useState<{ cle: string; point: Sommet } | null>(null);

  const position = (cle: string, defaut: Sommet): Sommet =>
    tiree?.cle === cle ? tiree.point : defaut;

  const relacher = () => {
    setTiree(null);
    onFinGeste();
  };

  return (
    <>
      {sommets.map((sommet, index) => {
        const cle = `s-${index}`;
        const [lng, lat] = position(cle, sommet);
        return (
          <Marker
            key={cle}
            longitude={lng}
            latitude={lat}
            draggable
            onDrag={(e) => {
              const point: Sommet = [e.lngLat.lng, e.lngLat.lat];
              setTiree({ cle, point });
              onDeplacerSommet(index, point);
            }}
            onDragEnd={relacher}
          >
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Sommet ${index + 1}, double-cliquez pour le retirer`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onRetirerSommet(index);
              }}
              className="block cursor-grab rounded-full border-2 bg-white shadow-clay-sm active:cursor-grabbing"
              style={{ width: 13, height: 13, borderColor: couleur }}
            />
          </Marker>
        );
      })}

      {avecMilieux
        ? milieux.map((milieu) => {
            const cle = `m-${milieu.apres}`;
            const [lng, lat] = position(cle, milieu.point);
            return (
              <Marker
                key={cle}
                longitude={lng}
                latitude={lat}
                draggable
                onDrag={(e) => {
                  const point: Sommet = [e.lngLat.lng, e.lngLat.lat];
                  setTiree({ cle, point });
                  onTirerMilieu(milieu.apres, point);
                }}
                onDragEnd={relacher}
              >
                <span
                  aria-hidden
                  className="block cursor-grab rounded-full border border-white/80 active:cursor-grabbing"
                  style={{ width: 9, height: 9, backgroundColor: couleur, opacity: 0.55 }}
                />
              </Marker>
            );
          })
        : null}
    </>
  );
}
