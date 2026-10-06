'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl';
import {
  FRANCE_MAP_VIEW,
  IGN_PCI_MINZOOM,
  IGN_PCI_SOURCE_ID,
  IGN_PCI_SOURCE_LAYER,
  IGN_PCI_VECTOR_SOURCE,
  MAPBOX_TOKEN,
  PRIIMO_MAP_STYLE,
} from '@/lib/map/style';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import { useCanvasAJour } from '@/lib/map/canvas-a-jour';
import { OPACITE_REMPLISSAGE_ZONE } from '@/lib/zones/palette';
import { bbox, chevauchements, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
import { COULEUR_FRAICHEUR, type NiveauFraicheur } from '@/lib/zones/fraicheur';
import { polygoneDepuisTrace, type PointTrace } from '@/lib/zones/trace';
import { pointDansPolygone } from '@/lib/zones/appartenance';
import { polygoneForme, type FormePredeterminee, type PointEcran } from '@/lib/zones/formes';
import {
  accrocherAuBord,
  anneauxDepuisGeometrie,
  centroideAnneau,
  contourDepuisParcelles,
  enveloppeFidele,
} from '@/lib/zones/parcelles-contour';
import type { ExpressionSpecification, Map as MapboxMap } from 'mapbox-gl';
import {
  deplacerSommet,
  insererSommet,
  milieuxSegments,
  retirerSommet,
  sommetsManipulables,
  type Sommet,
} from '@/lib/zones/contour';
import type { ValeurVoie, Zone } from '@/lib/zones/types';
import { cotesDeLaVoie, numerosDeLaRegle } from '@/lib/zones/voie-trace';
import { cleVoie, useNumerosVoies } from '@/lib/zones/use-numeros-voies';
import { Check, RotateCcw } from 'lucide-react';

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

export type ModeCarte = 'inactif' | 'polygone' | 'ajuster' | 'carre' | 'rond' | 'triangle';

const FORMES: readonly FormePredeterminee[] = ['carre', 'rond', 'triangle'];

function estForme(mode: ModeCarte): mode is FormePredeterminee {
  return FORMES.includes(mode as FormePredeterminee);
}

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

const ZONE_PCI_FILL = 'zone-parcelles-fill';
/** En deçà, on ne lit pas les rues : le tracé rapproche la vue jusque-là. */
const ZOOM_LECTURE_RUES = 13;
/** Rouge des exclusions, le même que les erreurs de formulaire. */
const ROUGE_EXCLUSION = '#B42318';
const ZONE_PCI_LINE = 'zone-parcelles-line';
/** Distance à laquelle le trait se colle à un bord de parcelle. */
const SNAP_PX = 18;

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

function ramasserParcelles(
  map: MapboxMap,
  box: [[number, number], [number, number]],
  dest: globalThis.Map<string, [number, number][]>,
) {
  if (!map.getLayer(ZONE_PCI_FILL)) return;
  const feats = map.queryRenderedFeatures(box, { layers: [ZONE_PCI_FILL] });
  for (const f of feats) {
    const idu = typeof f.properties?.idu === 'string' ? f.properties.idu : null;
    const id = idu ?? (f.id != null ? String(f.id) : '');
    if (!id || dest.has(id)) continue;
    const anneau = anneauxDepuisGeometrie(f.geometry as GeoJSON.Geometry)[0];
    if (anneau) dest.set(id, anneau);
  }
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
  /** Règle de rue en cours de saisie : dessinée en pointillés avant l'ajout. */
  voieApercu?: { valeur: ValeurVoie; inclusion: boolean } | null;
  /**
   * Repère figé (Accueil) : ni glisser, ni zoomer. La carte cadre tous les
   * secteurs et s'y tient ; un clic sur un secteur reste possible.
   */
  figee?: boolean;
  modeDessin?: ModeCarte;
  onPolygoneDessine?: (polygone: GeoJSON.Polygon) => void;
  onPolygoneModifie?: (regleId: string, polygone: GeoJSON.Polygon) => void;
  onSurvolZone?: (zoneId: string | null) => void;
  /** Lecture seule : un clic dans un contour choisit ce secteur. */
  onChoisirZone?: (zoneId: string) => void;
  /** Téléphone : poignées à la taille du doigt. */
  tactile?: boolean;
};

/** Retouche en cours de geste, pas encore envoyée au serveur. */
type Brouillon = { regleId: string; polygone: GeoJSON.Polygon };

function polygoneDeRegle(coordinates: unknown): GeoJSON.Polygon {
  return { type: 'Polygon', coordinates: coordinates as number[][][] };
}

/** Le geste en cours : le trait, et la surface qu'il referme déjà. */
function collectionDuTrace(trace: readonly PointTrace[]): GeoJSON.FeatureCollection {
  const ligne = trace.map((p) => [p[0], p[1]]);
  const features: GeoJSON.Feature[] = [
    { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ligne } },
  ];
  if (ligne.length >= 3) {
    features.unshift({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[...ligne, ligne[0]!]] },
    });
  }
  return { type: 'FeatureCollection', features };
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
  voieApercu = null,
  figee = false,
  modeDessin = 'inactif',
  onPolygoneDessine,
  onPolygoneModifie,
  onSurvolZone,
  onChoisirZone,
  tactile = false,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const boiteRef = useRef<HTMLDivElement | null>(null);
  const [pret, setPret] = useState(false);

  /**
   * Tracé à main levée. mapbox-gl-draw ne sait poser des sommets qu'au clic,
   * un par un : quand on essaie de suivre une rue d'un geste, la carte se
   * contente de coulisser. On récolte donc le geste nous-mêmes.
   */
  const formeActive = estForme(modeDessin) && Boolean(onPolygoneDessine);
  const dessinActif =
    (modeDessin === 'polygone' && Boolean(onPolygoneDessine)) || formeActive;
  const ajustActif = modeDessin === 'ajuster' && Boolean(onPolygoneModifie) && zoneActive !== null;
  const traceRef = useRef<PointTrace[]>([]);
  const dernierPixelRef = useRef<{ x: number; y: number } | null>(null);
  const enTraceRef = useRef(false);
  const parcellesRef = useRef(new globalThis.Map<string, [number, number][]>());
  const formeRef = useRef<{ origine: PointEcran; actuel: PointEcran } | null>(null);
  const [trace, setTrace] = useState<PointTrace[]>([]);
  const [formeApercu, setFormeApercu] = useState<GeoJSON.Polygon | null>(null);
  /**
   * Le contour tout juste tracé, montré avant d'être gardé : un geste raté se
   * refait d'un nouveau geste, au lieu de s'enregistrer d'office.
   */
  const [propose, setPropose] = useState<GeoJSON.Polygon | null>(null);
  const proposeRef = useRef(propose);
  useEffect(() => {
    proposeRef.current = propose;
  }, [propose]);
  // Changer de mode jette la proposition en attente.
  const [modeVu, setModeVu] = useState(modeDessin);
  if (modeVu !== modeDessin) {
    setModeVu(modeDessin);
    setPropose(null);
  }

  /**
   * Retouche élastique. L'éditeur de mapbox-gl-draw déplace le secteur entier
   * dès qu'on glisse à l'intérieur du contour : un geste de trop et le quartier
   * part à deux rues de là. On tient donc les poignées nous-mêmes.
   */
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  /** Index du sommet né sous le doigt quand on tire un milieu de segment. */
  const sommetNeRef = useRef<number | null>(null);

  const collerPoint = useCallback((e: GesteCarte): PointTrace => {
    const map = mapRef.current?.getMap();
    const libre: PointTrace = [e.lngLat.lng, e.lngLat.lat];
    if (!map?.getLayer(ZONE_PCI_FILL)) return libre;
    const proche = new globalThis.Map<string, [number, number][]>();
    ramasserParcelles(
      map,
      [
        [e.point.x - SNAP_PX, e.point.y - SNAP_PX],
        [e.point.x + SNAP_PX, e.point.y + SNAP_PX],
      ],
      proche,
    );
    for (const [id, anneau] of proche) parcellesRef.current.set(id, anneau);
    const colle = accrocherAuBord(libre, [...proche.values()], toleranceDegres(mapRef.current, SNAP_PX));
    return colle ?? libre;
  }, []);

  const debuterTrace = useCallback(
    (e: GesteCarte) => {
      if (!dessinActif || formeActive) return;
      enTraceRef.current = true;
      parcellesRef.current = new globalThis.Map();
      setPropose(null);
      if (tactile) navigator.vibrate?.(8);
      const point = collerPoint(e);
      traceRef.current = [point];
      dernierPixelRef.current = { x: e.point.x, y: e.point.y };
      setTrace(traceRef.current.slice());
    },
    [collerPoint, dessinActif, formeActive],
  );

  const prolongerTrace = useCallback(
    (e: GesteCarte) => {
      if (!enTraceRef.current) return;
      const dernier = dernierPixelRef.current;
      if (dernier && Math.hypot(e.point.x - dernier.x, e.point.y - dernier.y) < PAS_MINIMUM_PX) {
        return;
      }
      dernierPixelRef.current = { x: e.point.x, y: e.point.y };
      const point = collerPoint(e);
      traceRef.current = [...traceRef.current, point];
      setTrace(traceRef.current);
    },
    [collerPoint],
  );

  const terminerTrace = useCallback(() => {
    if (!enTraceRef.current) return;
    enTraceRef.current = false;
    const points = traceRef.current;
    traceRef.current = [];
    dernierPixelRef.current = null;
    setTrace([]);
    const map = mapRef.current?.getMap();
    const libre = polygoneDepuisTrace(points, toleranceDegres(mapRef.current, LISSAGE_PX));
    if (libre && map?.getLayer(ZONE_PCI_FILL)) {
      const canvas = map.getCanvas();
      const visibles = new globalThis.Map<string, [number, number][]>();
      ramasserParcelles(
        map,
        [
          [0, 0],
          [canvas.clientWidth, canvas.clientHeight],
        ],
        visibles,
      );
      const valeur = { type: 'Polygon' as const, coordinates: libre.coordinates as [number, number][][] };
      for (const [id, anneau] of visibles) {
        const c = centroideAnneau(anneau);
        if (c && pointDansPolygone({ latitude: c[1], longitude: c[0] }, valeur)) {
          parcellesRef.current.set(id, anneau);
        }
      }
    }
    const enveloppe = contourDepuisParcelles([...parcellesRef.current.values()]);
    parcellesRef.current = new globalThis.Map();
    // Le geste, déjà collé aux bords de parcelles point par point, fait foi ;
    // l'enveloppe des parcelles ne le remplace que si elle en garde la surface.
    const polygone = libre
      ? enveloppe && enveloppeFidele(enveloppe, libre)
        ? enveloppe
        : libre
      : enveloppe;
    if (polygone) setPropose(polygone);
  }, []);

  const debuterForme = useCallback(
    (e: GesteCarte) => {
      if (!formeActive) return;
      formeRef.current = { origine: e.point, actuel: e.point };
      setFormeApercu(null);
      setPropose(null);
    },
    [formeActive],
  );

  const etirerForme = useCallback(
    (e: GesteCarte) => {
      if (!formeRef.current || !formeActive) return;
      formeRef.current = { ...formeRef.current, actuel: e.point };
      const map = mapRef.current?.getMap();
      if (!map) return;
      setFormeApercu(
        polygoneForme(modeDessin as FormePredeterminee, formeRef.current.origine, e.point, (p) => {
          const ll = map.unproject([p.x, p.y]);
          return [ll.lng, ll.lat];
        }),
      );
    },
    [formeActive, modeDessin],
  );

  const terminerForme = useCallback(() => {
    if (!formeRef.current || !formeActive) return;
    const geste = formeRef.current;
    formeRef.current = null;
    setFormeApercu(null);
    const map = mapRef.current?.getMap();
    if (!map) return;
    const polygone = polygoneForme(modeDessin as FormePredeterminee, geste.origine, geste.actuel, (p) => {
      const ll = map.unproject([p.x, p.y]);
      return [ll.lng, ll.lat];
    });
    if (polygone) setPropose(polygone);
  }, [formeActive, modeDessin]);

  const relacherGeste = useCallback(() => {
    if (formeRef.current) terminerForme();
    else terminerTrace();
  }, [terminerForme, terminerTrace]);

  /**
   * Un deuxième doigt, c'est un zoom, pas un tracé : on abandonne le geste en
   * cours et on laisse la carte zoomer, sans quitter le mode dessin.
   */
  const abandonnerGeste = useCallback(() => {
    enTraceRef.current = false;
    traceRef.current = [];
    dernierPixelRef.current = null;
    parcellesRef.current = new globalThis.Map();
    setTrace([]);
    formeRef.current = null;
    setFormeApercu(null);
  }, []);

  /**
   * On ne force plus le zoom des parcelles : à ce niveau, un secteur de
   * quelques rues ne tenait plus à l'écran, et la carte ne bouge pas pendant
   * le tracé. On rapproche seulement une vue trop lointaine pour lire les rues.
   * Au zoom des parcelles, le contour s'y colle ; plus loin, il est lissé.
   */
  useEffect(() => {
    if (!dessinActif || !pret) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (map.getZoom() < ZOOM_LECTURE_RUES) {
      map.easeTo({ zoom: ZOOM_LECTURE_RUES + 0.5, duration: 380 });
    }
  }, [dessinActif, pret]);

  // Échap : abandonne le geste en cours, puis la proposition.
  useEffect(() => {
    if (!dessinActif) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (enTraceRef.current || formeRef.current) {
        e.stopPropagation();
        abandonnerGeste();
        return;
      }
      if (proposeRef.current) {
        e.stopPropagation();
        setPropose(null);
      }
    };
    window.addEventListener('keydown', surTouche, true);
    return () => window.removeEventListener('keydown', surTouche, true);
  }, [dessinActif, abandonnerGeste]);

  const garderContour = useCallback(() => {
    if (!propose) return;
    onPolygoneDessine?.(propose);
    setPropose(null);
  }, [onPolygoneDessine, propose]);

  const commiter = useCallback(() => {
    sommetNeRef.current = null;
    if (!brouillon) return;
    onPolygoneModifie?.(brouillon.regleId, brouillon.polygone);
    setBrouillon(null);
  }, [brouillon, onPolygoneModifie]);

  const actives = useMemo(() => zones.filter((z) => z.actif), [zones]);
  const couleurTrace = zoneActive?.couleur ?? '#4C7A9E';

  /**
   * Un point par secteur pour son nom. Un libellé posé sur le polygone se
   * répétait à chaque tuile que le contour traverse.
   */
  const nomsDesZones = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: actives.flatMap((zone) => {
        const anneau = polygonesDeZone(zone)[0]?.coordinates[0];
        const centre = anneau ? centroideAnneau(anneau as [number, number][]) : null;
        if (!centre) return [];
        return [
          {
            type: 'Feature' as const,
            properties: { nom: zone.nom },
            geometry: { type: 'Point' as const, coordinates: [centre[0], centre[1]] },
          },
        ];
      }),
    }),
    [actives],
  );

  /**
   * Les règles de rue, dessinées : un trait par côté retenu, un point par
   * numéro, et les parcelles de ces numéros au zoom du cadastre. Une
   * exclusion est en pointillés rouges ; la règle en cours de saisie, en
   * pointillés de la couleur du secteur.
   */
  const reglesVoie = useMemo(
    () =>
      actives.flatMap((zone) =>
        zone.regles.flatMap((regle) =>
          regle.type === 'voie' ? [{ zone, valeur: regle.valeur, inclusion: regle.inclusion }] : [],
        ),
      ),
    [actives],
  );
  const voiesDemandees = useMemo(
    () => [...reglesVoie.map((r) => r.valeur), ...(voieApercu ? [voieApercu.valeur] : [])],
    [reglesVoie, voieApercu],
  );
  const numerosParVoie = useNumerosVoies(voiesDemandees);
  const dessinVoies = useMemo(() => {
    const features: GeoJSON.Feature[] = [];
    const parcelles = new globalThis.Map<string, string>();
    const ajouter = (valeur: ValeurVoie, couleur: string, style: 'plein' | 'tirets') => {
      const retenus = numerosDeLaRegle(numerosParVoie.get(cleVoie(valeur)) ?? [], valeur);
      for (const cote of cotesDeLaVoie(retenus)) {
        features.push({
          type: 'Feature',
          properties: { couleur, style },
          geometry: { type: 'LineString', coordinates: cote },
        });
      }
      for (const n of retenus) {
        features.push({
          type: 'Feature',
          properties: { couleur, style },
          geometry: { type: 'Point', coordinates: [n.longitude, n.latitude] },
        });
        for (const id of n.parcelles) parcelles.set(id, couleur);
      }
    };
    for (const r of reglesVoie) {
      ajouter(r.valeur, r.inclusion ? r.zone.couleur : ROUGE_EXCLUSION, r.inclusion ? 'plein' : 'tirets');
    }
    if (voieApercu) {
      ajouter(voieApercu.valeur, voieApercu.inclusion ? couleurTrace : ROUGE_EXCLUSION, 'tirets');
    }
    const parCouleur = new globalThis.Map<string, string[]>();
    for (const [id, couleur] of parcelles) parCouleur.set(couleur, [...(parCouleur.get(couleur) ?? []), id]);
    const couleurParcelle: unknown[] = ['match', ['get', 'idu']];
    for (const [couleur, ids] of parCouleur) couleurParcelle.push(ids, couleur);
    couleurParcelle.push('rgba(0, 0, 0, 0)');
    return {
      collection: { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection,
      parcelleIds: [...parcelles.keys()],
      couleurParcelle: couleurParcelle as ExpressionSpecification,
    };
  }, [reglesVoie, voieApercu, numerosParVoie, couleurTrace]);

  // Une rue choisie dans la saisie : la carte va la montrer.
  const apercuCle = voieApercu ? cleVoie(voieApercu.valeur) : null;
  const apercuNumeros = apercuCle ? numerosParVoie.get(apercuCle) : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!pret || !map || !apercuNumeros || apercuNumeros.length === 0) return;
    const lons = apercuNumeros.map((n) => n.longitude);
    const lats = apercuNumeros.map((n) => n.latitude);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 56, maxZoom: 17, duration: 500 },
    );
  }, [pret, apercuCle, apercuNumeros]);
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
    const cibles = !figee && onChoisirZone && zoneActive ? [zoneActive] : actives;
    const boites = cibles
      .flatMap((z) => polygonesDeZone(z).map(bbox))
      .filter((b): b is NonNullable<typeof b> => b !== null);
    return fusionnerBbox(boites);
  }, [actives, zoneActive, onChoisirZone, figee]);

  /**
   * On recadre à l'arrivée et quand la liste des secteurs change, jamais quand
   * un contour bouge : recadrer après chaque poignée relâchée déplacerait la
   * carte sous la main de celui qui retouche.
   */
  const listeSecteurs = actives.map((z) => z.id).join(',');
  const cadreRef = useRef(cadre);
  cadreRef.current = cadre;
  const cadrer = useCallback((duree: number) => {
    const map = mapRef.current;
    const c = cadreRef.current;
    if (!map || !c) return;
    map.fitBounds(
      [
        [c.ouest, c.sud],
        [c.est, c.nord],
      ],
      { padding: 40, maxZoom: 15, duration: duree },
    );
  }, []);
  useEffect(() => {
    if (!pret) return;
    cadrer(zoneActive && !figee ? 400 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recadrer seulement quand la liste ou le secteur choisi change
  }, [pret, listeSecteurs, zoneActive?.id]);

  // Un parent en flex change de taille après le premier rendu : sans ça,
  // Mapbox garde le canvas de 280 px dans une carte déjà plus haute.
  useCanvasAJour(mapRef, pret);

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
      onPointerUp={relacherGeste}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={PRIIMO_MAP_STYLE}
        initialViewState={depart}
        attributionControl={false}
        // Le geste appartient au tracé : la carte ne coulisse plus sous la main.
        // Figée (Accueil), elle ne bouge jamais ; le clic sur un secteur reste.
        dragPan={!dessinActif && !figee}
        doubleClickZoom={!dessinActif && !figee}
        scrollZoom={!figee}
        touchZoomRotate={!figee}
        dragRotate={false}
        touchPitch={false}
        keyboard={!figee}
        boxZoom={!figee}
        onResize={() => {
          if (figee) cadrer(0);
        }}
        cursor={dessinActif ? 'crosshair' : onChoisirZone ? 'pointer' : undefined}
        onMouseDown={(e) => {
          if (formeActive) debuterForme(e);
          else debuterTrace(e);
        }}
        onMouseUp={relacherGeste}
        onTouchStart={(e) => {
          if (e.originalEvent.touches.length > 1) {
            abandonnerGeste();
            return;
          }
          if (formeActive) debuterForme(e);
          else debuterTrace(e);
        }}
        onTouchMove={(e) => {
          if (e.originalEvent.touches.length > 1) return;
          if (formeRef.current) etirerForme(e);
          else prolongerTrace(e);
        }}
        onTouchEnd={relacherGeste}
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
          if (formeRef.current) {
            etirerForme(e);
            return;
          }
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

        {/* Le nom sur la carte, un seul par secteur : on voit qui tient quoi. */}
        {dessinActif || ajustActif ? null : (
          <Source id="zones-noms" type="geojson" data={nomsDesZones}>
            <Layer
              id="zones-noms-texte"
              type="symbol"
              layout={{
                'text-field': ['get', 'nom'],
                'text-size': 12,
                'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                'text-max-width': 9,
              }}
              paint={{
                'text-color': '#1a2a56',
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.6,
              }}
            />
          </Source>
        )}

        {dessinVoies.collection.features.length > 0 ? (
          <Source id="zone-voies" type="geojson" data={dessinVoies.collection}>
            <Layer
              id="zone-voies-fond"
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 }}
            />
            <Layer
              id="zone-voies-ligne"
              type="line"
              filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'style'], 'plein']]}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': ['get', 'couleur'], 'line-width': 4 }}
            />
            <Layer
              id="zone-voies-tirets"
              type="line"
              filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'style'], 'tirets']]}
              layout={{ 'line-join': 'round' }}
              paint={{ 'line-color': ['get', 'couleur'], 'line-width': 4, 'line-dasharray': [1.4, 1.1] }}
            />
            <Layer
              id="zone-voies-numeros"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.8, 16, 3.5, 18, 5],
                'circle-color': ['get', 'couleur'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.2,
              }}
            />
          </Source>
        ) : null}

        {propose ? (
          <Source id="zone-propose" type="geojson" data={{ type: 'Feature', properties: {}, geometry: propose }}>
            <Layer
              id="zone-propose-fill"
              type="fill"
              paint={{ 'fill-color': couleurTrace, 'fill-opacity': 0.24 }}
            />
            <Layer
              id="zone-propose-line"
              type="line"
              layout={{ 'line-join': 'round' }}
              paint={{ 'line-color': couleurTrace, 'line-width': 3, 'line-dasharray': [2, 1.2] }}
            />
          </Source>
        ) : null}

        {/* Le geste en cours, déjà refermé : on voit la surface qu'on entoure. */}
        {trace.length >= 2 ? (
          <Source id="zone-trace" type="geojson" data={collectionDuTrace(trace)}>
            <Layer
              id="zone-trace-fill"
              type="fill"
              filter={['==', ['geometry-type'], 'Polygon']}
              paint={{ 'fill-color': couleurTrace, 'fill-opacity': 0.14 }}
            />
            <Layer
              id="zone-trace-fond"
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 }}
            />
            <Layer
              id="zone-trace-line"
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': couleurTrace, 'line-width': 3.5 }}
            />
          </Source>
        ) : null}
        {trace.length >= 2 ? (
          <Marker longitude={trace[0]![0]} latitude={trace[0]![1]}>
            <span
              aria-hidden
              className="block rounded-full border-[2.5px] bg-white shadow-clay-sm"
              style={{ width: 12, height: 12, borderColor: couleurTrace }}
            />
          </Marker>
        ) : null}

        <Source id={IGN_PCI_SOURCE_ID} {...IGN_PCI_VECTOR_SOURCE}>
          <Layer
            id={ZONE_PCI_FILL}
            type="fill"
            source-layer={IGN_PCI_SOURCE_LAYER}
            minzoom={IGN_PCI_MINZOOM}
            paint={{
              'fill-color': 'rgba(26, 42, 86, 0.05)',
              'fill-opacity': dessinActif || ajustActif ? 1 : 0,
            }}
          />
          <Layer
            id={ZONE_PCI_LINE}
            type="line"
            source-layer={IGN_PCI_SOURCE_LAYER}
            minzoom={IGN_PCI_MINZOOM}
            paint={{
              'line-color': 'rgba(26, 42, 86, 0.42)',
              'line-width': 0.8,
              'line-opacity': dessinActif || ajustActif ? 1 : 0.35,
            }}
          />
          {dessinVoies.parcelleIds.length > 0 ? (
            <Layer
              id="zone-voies-parcelles"
              type="fill"
              source-layer={IGN_PCI_SOURCE_LAYER}
              minzoom={IGN_PCI_MINZOOM}
              filter={['in', ['get', 'idu'], ['literal', dessinVoies.parcelleIds]]}
              paint={{ 'fill-color': dessinVoies.couleurParcelle, 'fill-opacity': 0.3 }}
            />
          ) : null}
        </Source>

        {formeApercu ? (
          <Source id="zone-forme" type="geojson" data={{ type: 'Feature', properties: {}, geometry: formeApercu }}>
            <Layer
              id="zone-forme-fill"
              type="fill"
              paint={{ 'fill-color': zoneActive?.couleur ?? '#4C7A9E', 'fill-opacity': 0.18 }}
            />
            <Layer
              id="zone-forme-line"
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
            tactile={tactile}
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

      </Map>

      {(dessinActif && !propose && trace.length === 0) || ajustActif ? (
        <p className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit max-w-[90%] rounded-full bg-[#1a2a56]/90 px-3.5 py-1.5 text-center text-[12.5px] font-medium text-white shadow-clay">
          {ajustActif ? 'Glissez un point pour ajuster' : 'Tracez le contour d’un seul geste'}
        </p>
      ) : null}

      {dessinActif && propose ? (
        <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setPropose(null)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-ink shadow-clay transition-colors hover:bg-[#F4F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a2a56]"
          >
            <RotateCcw size={14} strokeWidth={2.2} aria-hidden />
            Refaire
          </button>
          <button
            type="button"
            onClick={garderContour}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1a2a56] px-4 text-[13px] font-semibold text-white shadow-clay transition-colors hover:bg-[#152348] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a2a56]"
          >
            <Check size={14} strokeWidth={2.4} aria-hidden />
            Garder ce contour
          </button>
        </div>
      ) : null}
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
  tactile,
  onDeplacerSommet,
  onTirerMilieu,
  onRetirerSommet,
  onFinGeste,
}: {
  couleur: string;
  sommets: readonly Sommet[];
  milieux: readonly { apres: number; point: Sommet }[];
  avecMilieux: boolean;
  tactile: boolean;
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
              style={{ width: tactile ? 22 : 13, height: tactile ? 22 : 13, borderColor: couleur }}
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
                  style={{
                    width: tactile ? 16 : 9,
                    height: tactile ? 16 : 9,
                    backgroundColor: couleur,
                    opacity: 0.55,
                  }}
                />
              </Marker>
            );
          })
        : null}
    </>
  );
}
