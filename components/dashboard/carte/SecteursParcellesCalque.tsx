'use client';

import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl';
import type { CarteSecteurs } from '@/lib/zones/useCarteSecteurs';

export const SECTEURS_PRIS_LAYER_ID = 'secteurs-parcelles-fill';
export const ATELIER_LIBRE_LAYER_ID = 'atelier-parcelles-libre';
export const ATELIER_MIEN_LAYER_ID = 'atelier-parcelles-mien';
const ATELIER_SOURCE_ID = 'atelier-parcelles';

/** Parcelle de l'atelier : géométrie connue, avec son centre. */
export type ParcelleAtelier = { id: string; anneaux: [number, number][][]; centre: [number, number] };

export type AtelierCalque = {
  zoneId: string | null;
  mesIds: ReadonlySet<string>;
  couleur: string;
  /** Parcelles chargées autour de la vue : cliquables, une à une. */
  candidates: ReadonlyMap<string, ParcelleAtelier>;
  /** Retouche d'un secteur déjà posé. En création, les autres ne sont pas dessinés. */
  montrerAutres: boolean;
};

const OPACITE = 0.42;
const OPACITE_PRISE = 0.2;

/**
 * Les secteurs dessinés en parcelles : pas de contour, chaque parcelle remplie
 * de la couleur de son agent, ses initiales posées dès qu'on s'approche.
 *
 * En création, la carte ne montre que le secteur en train de naître.
 * En retouche, les parcelles déjà tenues par les autres restent pâles, et un
 * fin quadrillage montre les parcelles qu'on peut prendre.
 */
export default function SecteursParcellesCalque({
  carte,
  zonesAffichees,
  atelier = null,
}: {
  carte: CarteSecteurs;
  /** Secteurs à montrer hors atelier ; vide : aucun. */
  zonesAffichees: ReadonlySet<string>;
  atelier?: AtelierCalque | null;
}) {
  const secteurs = useMemo<GeoJSON.FeatureCollection>(() => {
    const features = !atelier
      ? carte.features.filter((f) => zonesAffichees.has(f.properties.zoneId))
      : atelier.montrerAutres
        ? carte.features.filter((f) => f.properties.zoneId !== atelier.zoneId)
        : [];
    return { type: 'FeatureCollection', features };
  }, [carte.features, zonesAffichees, atelier]);

  const atelierData = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!atelier) return null;
    const prises = new Set(
      carte.features.filter((f) => f.properties.zoneId !== atelier.zoneId).map((f) => f.properties.parcelleId),
    );
    const geometries = new Map<string, [number, number][][]>();
    for (const f of carte.features) {
      if (f.properties.zoneId === atelier.zoneId) {
        geometries.set(f.properties.parcelleId, f.geometry.coordinates as [number, number][][]);
      }
    }
    for (const p of atelier.candidates.values()) geometries.set(p.id, p.anneaux);
    const features: GeoJSON.Feature[] = [];
    for (const [id, anneaux] of geometries) {
      const etat = atelier.mesIds.has(id) ? 'mien' : prises.has(id) ? 'pris' : 'libre';
      if (etat === 'libre' && !atelier.candidates.has(id)) continue;
      features.push({
        type: 'Feature',
        id,
        properties: { parcelleId: id, etat },
        geometry: { type: 'Polygon', coordinates: anneaux },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [atelier, carte.features]);

  useSurvol(Boolean(atelier));

  return (
    <>
      <Source id="secteurs-parcelles" type="geojson" data={secteurs} promoteId="parcelleId">
        <Layer
          id={SECTEURS_PRIS_LAYER_ID}
          type="fill"
          paint={{
            'fill-color': ['get', 'couleur'],
            'fill-opacity': atelier ? OPACITE_PRISE : OPACITE,
          }}
        />
        <Layer
          id="secteurs-parcelles-initiales"
          type="symbol"
          minzoom={15.5}
          layout={{
            'text-field': ['get', 'initiales'],
            'text-size': 11,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': false,
            'text-padding': 6,
          }}
          paint={{
            'text-color': '#FFFFFF',
            'text-halo-color': ['get', 'couleur'],
            'text-halo-width': 1.6,
            'text-opacity': atelier ? 0.7 : 1,
          }}
        />
      </Source>
      {atelier && atelierData ? (
        <Source id={ATELIER_SOURCE_ID} type="geojson" data={atelierData} promoteId="parcelleId">
          <Layer
            id={ATELIER_LIBRE_LAYER_ID}
            type="fill"
            filter={['==', ['get', 'etat'], 'libre']}
            paint={{
              'fill-color': atelier.couleur,
              'fill-opacity': ['case', ['boolean', ['feature-state', 'survol'], false], 0.22, 0.01],
            }}
          />
          <Layer
            id={ATELIER_MIEN_LAYER_ID}
            type="fill"
            filter={['==', ['get', 'etat'], 'mien']}
            paint={{
              'fill-color': atelier.couleur,
              'fill-opacity': ['case', ['boolean', ['feature-state', 'survol'], false], 0.68, 0.52],
            }}
          />
          <Layer
            id="atelier-parcelles-trame"
            type="line"
            minzoom={15}
            filter={['!=', ['get', 'etat'], 'pris']}
            paint={{ 'line-color': '#1A2A56', 'line-opacity': 0.14, 'line-width': 0.6 }}
          />
        </Source>
      ) : null}
    </>
  );
}

/** Le survol éclaire la parcelle visée : on sait ce qu'un clic va prendre. */
function useSurvol(actif: boolean) {
  const { current: carte } = useMap();
  useEffect(() => {
    if (!carte || !actif) return;
    const map = carte.getMap();
    let survolee: string | number | null = null;
    const eteindre = () => {
      if (survolee == null) return;
      try {
        map.setFeatureState({ source: ATELIER_SOURCE_ID, id: survolee }, { survol: false });
      } catch {
        /* source retirée */
      }
      survolee = null;
    };
    const bouger = (e: { features?: { id?: string | number }[] }) => {
      const id = e.features?.[0]?.id ?? null;
      if (id === survolee) return;
      eteindre();
      if (id == null) return;
      survolee = id;
      map.setFeatureState({ source: ATELIER_SOURCE_ID, id }, { survol: true });
    };
    const couches = [ATELIER_LIBRE_LAYER_ID, ATELIER_MIEN_LAYER_ID];
    for (const c of couches) {
      map.on('mousemove', c, bouger);
      map.on('mouseleave', c, eteindre);
    }
    return () => {
      for (const c of couches) {
        map.off('mousemove', c, bouger);
        map.off('mouseleave', c, eteindre);
      }
      eteindre();
    };
  }, [carte, actif]);
}
