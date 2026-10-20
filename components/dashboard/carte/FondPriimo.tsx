'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl';
import type { Map as MapboxMap, TargetFeature } from 'mapbox-gl';
import { FOND_IMPORT_ID, PRIIMO_MAP_CONFIG } from '@/lib/map/style';
import { resoudreLumiere, useChoixLumiere, type Lumiere } from '@/lib/map/lumiere';

/**
 * Où ranger une couche Priimo dans les étages (slots) de Standard :
 *   - « middle » : posée au sol, au-dessus des rues, sous les immeubles 3D et
 *     les noms (secteurs, parcelles, tracé de tournée) ;
 *   - sans étage : au-dessus de tout, comme avant (pastilles DPE, épingles,
 *     prix de vente).
 * Une couche peut choisir elle-même : `metadata: { 'priimo:etage': 'top' }`.
 */
const ETAGE_PAR_TYPE: Record<string, string | null> = {
  fill: 'middle',
  line: 'middle',
  'fill-extrusion': 'middle',
  heatmap: 'middle',
  circle: null,
  symbol: null,
};

/**
 * Nos données gardent leurs vraies couleurs la nuit : elles « émettent » leur
 * lumière au lieu d'être éteintes avec le fond. Un voile (masque hors secteur)
 * s'y refuse : `metadata: { 'priimo:eteint': true }`.
 */
const EMISSIF_PAR_TYPE: Record<string, string[]> = {
  fill: ['fill-emissive-strength'],
  line: ['line-emissive-strength'],
  circle: ['circle-emissive-strength'],
  symbol: ['icon-emissive-strength', 'text-emissive-strength'],
};

type Couche = { id: string; type: string; metadata?: unknown };

function meta(couche: Couche, cle: string): unknown {
  const m = couche.metadata;
  return m && typeof m === 'object' ? (m as Record<string, unknown>)[cle] : undefined;
}

/** Nos couches : celles du style racine (le fond Standard vit dans son import). */
function nosCouches(map: MapboxMap): Couche[] {
  try {
    return ((map.getStyle()?.layers ?? []) as Couche[]).filter((l) => l.type !== 'slot');
  } catch {
    return [];
  }
}

function rangerCouches(map: MapboxMap, etageSol: string): void {
  for (const couche of nosCouches(map)) {
    try {
      const voulu = meta(couche, 'priimo:etage');
      const parType = ETAGE_PAR_TYPE[couche.type] ?? null;
      const etage = typeof voulu === 'string' ? voulu : parType === 'middle' ? etageSol : parType;
      if ((map.getSlot(couche.id) ?? null) !== etage) map.setSlot(couche.id, etage);
      const force = meta(couche, 'priimo:eteint') === true ? 0 : 1;
      for (const propriete of EMISSIF_PAR_TYPE[couche.type] ?? []) {
        if (map.getPaintProperty(couche.id, propriete as never) !== force) {
          map.setPaintProperty(couche.id, propriete as never, force as never);
        }
      }
    } catch {
      /* couche retirée entre-temps, ou style en cours de chargement */
    }
  }
}

function centre(map: MapboxMap): { lat: number; lng: number } {
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng };
}

/** L'immeuble 3D sous un point de la carte (adresse BAN : souvent sur le trottoir, d'où la marge). */
function immeubleAuPoint(map: MapboxMap, latitude: number, longitude: number): TargetFeature | null {
  const p = map.project([longitude, latitude]);
  const cible = { target: { featuresetId: 'buildings', importId: FOND_IMPORT_ID } };
  for (const marge of [0, 8, 16]) {
    try {
      const zone: [[number, number], [number, number]] | [number, number] =
        marge === 0 ? [p.x, p.y] : [[p.x - marge, p.y - marge], [p.x + marge, p.y + marge]];
      const trouves = map.queryRenderedFeatures(zone as never, cible as never) as unknown as TargetFeature[];
      if (trouves.length > 0) return trouves[0]!;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Le fond Priimo d'une carte, à poser parmi ses enfants (`<FondPriimo />`).
 * Lumière (choix de l'agent ou soleil), étages et éclat de nos couches,
 * immeuble choisi allumé en orange.
 */
export default function FondPriimo({
  immeuble = null,
  relief = true,
  etageSol = 'middle',
}: {
  /** Le lieu choisi (épingle, parcelle, adresse) : son immeuble s'allume. */
  immeuble?: { latitude: number; longitude: number } | null;
  /** Faux : immeubles, arbres et monuments à plat (plan 2D du mobile, tournée). */
  relief?: boolean;
  /**
   * Où poser nos aplats et nos traits. « top » : au-dessus des immeubles
   * (atelier secteurs, où le contour doit rester visible pour être retouché).
   */
  etageSol?: 'middle' | 'top';
}) {
  const { current } = useMap();
  const map = current?.getMap() ?? null;
  const choix = useChoixLumiere();

  // Palette, voile CSS retiré, rangement des couches à chaque changement du style.
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.filter = 'none';
    let prevu = false;
    const ranger = () => {
      if (prevu) return;
      prevu = true;
      requestAnimationFrame(() => {
        prevu = false;
        rangerCouches(map, etageSol);
      });
    };
    const fond = () => {
      try {
        // Cartes créées sans `config` : la palette arrive ici.
        if (map.getConfigProperty(FOND_IMPORT_ID, 'colorLand') !== PRIIMO_MAP_CONFIG[FOND_IMPORT_ID].colorLand) {
          map.setConfig(FOND_IMPORT_ID, { ...PRIIMO_MAP_CONFIG[FOND_IMPORT_ID] });
        }
      } catch {
        /* fond pas encore chargé */
      }
      ranger();
    };
    if (map.isStyleLoaded()) fond();
    map.on('style.load', fond);
    map.on('styledata', ranger);
    return () => {
      map.off('style.load', fond);
      map.off('styledata', ranger);
    };
  }, [map, etageSol]);

  // Lumière : le choix de l'agent, ou le soleil au-dessus de la carte (revu toutes les 5 min).
  const derniere = useRef<Lumiere | null>(null);
  useEffect(() => {
    if (!map) return;
    const appliquer = () => {
      const { lat, lng } = centre(map);
      const lumiere = resoudreLumiere(choix, new Date(), lat, lng);
      if (lumiere === derniere.current) return;
      try {
        map.setConfigProperty(FOND_IMPORT_ID, 'lightPreset', lumiere);
        derniere.current = lumiere;
      } catch {
        /* fond pas encore chargé : on réessaie au chargement */
      }
    };
    derniere.current = null;
    if (map.isStyleLoaded()) appliquer();
    map.on('style.load', appliquer);
    const minuteur = choix === 'auto' ? window.setInterval(appliquer, 5 * 60_000) : null;
    return () => {
      map.off('style.load', appliquer);
      if (minuteur != null) window.clearInterval(minuteur);
    };
  }, [map, choix]);

  // Relief : immeubles, arbres et monuments debout, ou plan à plat.
  useEffect(() => {
    if (!map) return;
    const appliquer = () => {
      try {
        if (map.getConfigProperty(FOND_IMPORT_ID, 'show3dObjects') !== relief) {
          map.setConfigProperty(FOND_IMPORT_ID, 'show3dObjects', relief);
        }
      } catch {
        /* fond pas encore chargé */
      }
    };
    if (map.isStyleLoaded()) appliquer();
    map.on('style.load', appliquer);
    return () => {
      map.off('style.load', appliquer);
    };
  }, [map, relief]);

  // L'immeuble choisi, allumé : retrouvé dès qu'il est dessiné (après le vol de la caméra).
  const lat = immeuble?.latitude ?? null;
  const lng = immeuble?.longitude ?? null;
  useEffect(() => {
    if (!map) return;
    let allume: TargetFeature | null = null;
    const eteindre = () => {
      if (!allume) return;
      try {
        map.setFeatureState(allume, { select: false });
      } catch {
        /* style rechargé */
      }
      allume = null;
    };
    if (lat == null || lng == null) return eteindre;
    const chercher = () => {
      if (allume) return;
      const trouve = immeubleAuPoint(map, lat, lng);
      if (!trouve) return;
      try {
        map.setFeatureState(trouve, { select: true });
        allume = trouve;
      } catch {
        /* immeuble sans identifiant */
      }
    };
    chercher();
    map.on('idle', chercher);
    return () => {
      map.off('idle', chercher);
      eteindre();
    };
  }, [map, lat, lng]);

  return null;
}
