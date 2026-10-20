'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Popup, Source, useMap, type SymbolLayer } from 'react-map-gl';
import type { MapMouseEvent } from 'mapbox-gl';
import MapHoverBubble from '@/components/dashboard/carte/MapHoverBubble';
import { CADASTRE_DPE_LABEL_LAYER_ID, CADASTRE_DPE_LAYER_ID } from '@/components/dashboard/carte/ParcellesLayer';
import type { HoverPreview } from '@/lib/carte/hover-preview';
import {
  EPINGLES_DESSUS_LAYER_ID,
  EPINGLES_LAYER_ID,
  cleImageEpingle,
  dessinDepuisCle,
  dessinerEpingle,
  epingleSous,
  type EpingleKind,
} from '@/lib/carte/epingles';

const SOURCE_ID = 'priimo-epingles';
const SOURCE_DESSUS_ID = 'priimo-epingles-dessus';

export type Epingle = {
  id: string;
  longitude: number;
  latitude: number;
  couleur: string;
  kind: EpingleKind;
  /** Fiches à cette adresse, ou taille de l'amas. */
  nombre: number;
  /** Ouverte ou retenue : anneau orange, au-dessus des autres. */
  enAvant?: boolean;
  /** Arrêt de tournée : liseré blanc en plus de l'anneau. */
  lisere?: boolean;
};

const LAYOUT: SymbolLayer['layout'] = {
  'icon-image': ['get', 'image'],
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
  'icon-pitch-alignment': 'viewport',
  'icon-rotation-alignment': 'viewport',
  // Ordre de la source, sans clé de tri : une clé force un dessin par épingle.
  'symbol-z-order': 'source',
};

type Collection = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; image: string; ordre: number }>;

/**
 * Les épingles CRM (fiches, amas) dessinées par la carte : elles suivent le
 * zoom image par image, sans rien retirer pendant le geste.
 * Le clic se lit côté carte avec `epingleSous` ; le survol (souris) affiche
 * la même bulle qu'avant.
 */
export default function EpinglesCalque({
  epingles,
  bordure,
  anneau,
  apercu,
}: {
  epingles: readonly Epingle[];
  /** Bordure de la pastille : crème au bureau, blanche sur le terrain. */
  bordure: string;
  /** Opacité de l'anneau d'une épingle en avant. */
  anneau: number;
  /** Bulle au survol de la souris ; rien sur le terrain. */
  apercu?: (id: string) => HoverPreview | null;
}) {
  const { current: carte } = useMap();
  const [survol, setSurvol] = useState<string | null>(null);

  const { base, cles } = useMemo(() => {
    const cles = new Set<string>();
    const features = epingles.map((e, ordre) => {
      const image = cleImageEpingle({
        couleur: e.couleur,
        kind: e.kind,
        nombre: e.nombre,
        anneau: e.enAvant ? anneau : 0,
        lisere: Boolean(e.lisere),
        bordure,
      });
      cles.add(image);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [e.longitude, e.latitude] },
        properties: { id: e.id, image, ordre },
      };
    });
    const base: Collection = { type: 'FeatureCollection', features };
    return { base, cles };
  }, [epingles, anneau, bordure]);

  // Le survol ne touche que la petite source du dessus.
  const dessus = useMemo<Collection>(
    () => ({
      type: 'FeatureCollection',
      features: base.features.filter((f, i) => epingles[i]?.enAvant || f.properties.id === survol),
    }),
    [base, epingles, survol],
  );

  // Images dessinées à la demande : avant l'affichage, et de nouveau si le
  // style les perd (changement de fond).
  const ratio = useRef(2);
  const police = useRef('system-ui, sans-serif');
  useEffect(() => {
    const map = carte?.getMap();
    if (!map) return;
    ratio.current = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
    police.current = getComputedStyle(document.body).fontFamily || police.current;
    const ajouter = (cle: string) => {
      const dessin = dessinDepuisCle(cle);
      if (!dessin || map.hasImage(cle)) return;
      const image = dessinerEpingle(dessin, ratio.current, police.current);
      if (image) map.addImage(cle, image, { pixelRatio: ratio.current });
    };
    const manquante = (e: { id: string }) => ajouter(e.id);
    map.on('styleimagemissing', manquante);
    return () => {
      map.off('styleimagemissing', manquante);
    };
  }, [carte]);

  useEffect(() => {
    const map = carte?.getMap();
    if (!map) return;
    for (const cle of cles) {
      if (map.hasImage(cle)) continue;
      const dessin = dessinDepuisCle(cle);
      const image = dessin ? dessinerEpingle(dessin, ratio.current, police.current) : null;
      if (image) map.addImage(cle, image, { pixelRatio: ratio.current });
    }
  }, [carte, cles]);

  // Une couche ajoutée après coup (plan cadastral) passerait au-dessus :
  // les épingles remontent en tête, sous les seules pastilles DPE.
  useEffect(() => {
    const map = carte?.getMap();
    if (!map) return;
    let aVerifier = true;
    const marquer = () => {
      aVerifier = true;
    };
    const remonter = () => {
      if (!aVerifier) return;
      aVerifier = false;
      try {
        const ordre = map.getStyle()?.layers?.map((l) => l.id) ?? [];
        const nos: string[] = [EPINGLES_LAYER_ID, EPINGLES_DESSUS_LAYER_ID].filter((id) => ordre.includes(id));
        if (nos.length === 0) return;
        const dpe: string[] = ordre.filter(
          (id) => id === CADASTRE_DPE_LAYER_ID || id === CADASTRE_DPE_LABEL_LAYER_ID,
        );
        const attendu = [...ordre.filter((id) => !nos.includes(id) && !dpe.includes(id)), ...nos, ...dpe];
        if (attendu.every((id, i) => ordre[i] === id)) return;
        for (const id of nos) map.moveLayer(id, dpe[0]);
      } catch {
        /* style en cours de chargement */
      }
    };
    map.on('styledata', marquer);
    map.on('idle', remonter);
    return () => {
      map.off('styledata', marquer);
      map.off('idle', remonter);
    };
  }, [carte]);

  // Survol à la souris : curseur main et bulle d'aperçu.
  const aSurvol = Boolean(apercu);
  useEffect(() => {
    const map = carte?.getMap();
    if (!map || !aSurvol) return;
    let dernier: string | null = null;
    const bouger = (e: MapMouseEvent) => {
      const id = map.isMoving() ? null : epingleSous(map, e.point);
      if (id === dernier) return;
      const canvas = map.getCanvas();
      if (id) canvas.style.cursor = 'pointer';
      else if (dernier) canvas.style.cursor = '';
      dernier = id;
      setSurvol(id);
    };
    const sortir = () => {
      if (!dernier) return;
      dernier = null;
      setSurvol(null);
    };
    map.on('mousemove', bouger);
    map.on('mouseout', sortir);
    map.on('movestart', sortir);
    return () => {
      map.off('mousemove', bouger);
      map.off('mouseout', sortir);
      map.off('movestart', sortir);
    };
  }, [carte, aSurvol]);

  const survolee = survol ? epingles.find((e) => e.id === survol) : null;
  const bulle = survolee && apercu ? apercu(survolee.id) : null;

  return (
    <>
      <Source id={SOURCE_ID} type="geojson" data={base}>
        <Layer id={EPINGLES_LAYER_ID} type="symbol" layout={LAYOUT} />
      </Source>
      <Source id={SOURCE_DESSUS_ID} type="geojson" data={dessus}>
        <Layer id={EPINGLES_DESSUS_LAYER_ID} type="symbol" layout={LAYOUT} />
      </Source>
      {survolee && bulle ? (
        <Popup
          longitude={survolee.longitude}
          latitude={survolee.latitude}
          closeButton={false}
          closeOnClick={false}
          offset={18}
          anchor="bottom"
          className="priimo-hover-popup"
        >
          <MapHoverBubble preview={bulle} />
        </Popup>
      ) : null}
    </>
  );
}
