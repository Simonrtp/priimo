'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl';

const ZOOM = 17.5;
const LARGEUR_BUREAU_PX = 768;

/**
 * La carte se pose sur le lieu d'une note. Le décalage laisse le volet
 * (gauche sur ordinateur, bas sur téléphone) dégager le point.
 */
export default function VolCarte({
  latitude,
  longitude,
  cle,
}: {
  latitude: number;
  longitude: number;
  cle: string;
}) {
  const { current: map } = useMap();
  const fait = useRef<string | null>(null);

  useEffect(() => {
    if (!map || fait.current === cle) return;
    fait.current = cle;
    const carte = map.getMap();
    const { clientWidth: largeur, clientHeight: hauteur } = carte.getContainer();
    const offset: [number, number] =
      largeur < LARGEUR_BUREAU_PX
        ? [0, -Math.round(hauteur * 0.26)]
        : [Math.round(Math.min(420, largeur * 0.4) / 2), 0];
    carte.flyTo({
      center: [longitude, latitude],
      zoom: ZOOM,
      offset,
      duration: 1100,
      essential: true,
    });
  }, [map, cle, latitude, longitude]);

  return null;
}
