'use client';

import { useId, useMemo } from 'react';
import { Layer, Marker, Source } from 'react-map-gl';
import type { DevicePosition } from '@/lib/voice/gps';

/** Repère agence — distinct du bleu « vous êtes ici ». */
const AGENT_BLUE = '#2B6CB0';

/** Bleu du point de position, le même registre que le point Google. */
const ICI = '#4285F4';

const SOURCE = 'priimo-precision-agent';
const REMPLISSAGE = 'priimo-precision-agent-fill';
const CONTOUR = 'priimo-precision-agent-line';

/** Au-delà, le GPS ne situe plus une rue : le disque n'apporte rien. */
const PRECISION_MAX_M = 2_000;

/**
 * Cône d'orientation, pointe vers le nord. La rotation suit le cap.
 * Éventail étroit, fondu vers le transparent : un faisceau, pas une flèche.
 */
/** Éventail de 76°, pointe au nord. Le petit arc (sweep 0) passe par le haut. */
const CONE = 'M 48 48 L 20.91 13.33 A 44 44 0 0 0 75.09 13.33 Z';

function cercle(lng: number, lat: number, rayonM: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const n = 72;
  const coords: [number, number][] = [];
  const mLat = 111_320;
  const mLng = Math.max(1, 111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    coords.push([lng + (rayonM * Math.cos(a)) / mLng, lat + (rayonM * Math.sin(a)) / mLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Disque de précision en mètres : il grandit et rétrécit avec le zoom, collé au sol. */
function DisquePrecision({
  longitude,
  latitude,
  rayonM,
}: {
  longitude: number;
  latitude: number;
  rayonM: number;
}) {
  const data = useMemo(
    () => cercle(longitude, latitude, rayonM),
    [longitude, latitude, rayonM],
  );
  return (
    <Source id={SOURCE} type="geojson" data={data}>
      <Layer
        id={REMPLISSAGE}
        type="fill"
        paint={{ 'fill-color': ICI, 'fill-opacity': 0.15 }}
      />
      <Layer
        id={CONTOUR}
        type="line"
        paint={{
          'line-color': ICI,
          'line-opacity': 0.38,
          'line-width': 1.25,
        }}
      />
    </Source>
  );
}

function ConeCap({ heading }: { heading: number }) {
  const brut = useId().replace(/:/g, '');
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      className="absolute left-1/2 top-1/2"
      style={{ transform: `translate(-50%, -50%) rotate(${heading}deg)` }}
      aria-hidden
    >
      <defs>
        <radialGradient id={brut} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ICI} stopOpacity="0.42" />
          <stop offset="42%" stopColor={ICI} stopOpacity="0.16" />
          <stop offset="100%" stopColor={ICI} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={CONE} fill={`url(#${brut})`} />
    </svg>
  );
}

/**
 * Point « vous êtes ici ».
 * Le disque est géographique (il suit le zoom). La pastille, elle, reste nette à l'écran.
 */
export default function AgentLocationMarker({
  position,
  zIndex = 40,
}: {
  position: DevicePosition;
  zIndex?: number;
}) {
  const accuracy =
    position.accuracyM != null && position.accuracyM > 0 && position.accuracyM <= PRECISION_MAX_M
      ? position.accuracyM
      : null;
  const enMarche = position.speedMs == null || position.speedMs > 0.5;
  const heading =
    enMarche && position.headingDeg != null && Number.isFinite(position.headingDeg)
      ? position.headingDeg
      : null;

  return (
    <>
      {accuracy != null ? (
        <DisquePrecision
          longitude={position.longitude}
          latitude={position.latitude}
          rayonM={accuracy}
        />
      ) : null}
      <Marker
        longitude={position.longitude}
        latitude={position.latitude}
        anchor="center"
        style={{ zIndex, pointerEvents: 'none' }}
      >
        <div className="pointer-events-none relative flex size-6 items-center justify-center" aria-hidden>
          {heading != null ? <ConeCap heading={heading} /> : null}
          <span
            className="relative block size-[14px] rounded-full"
            style={{
              backgroundColor: ICI,
              boxShadow:
                '0 0 0 3px #ffffff, 0 1px 3px rgba(60, 64, 67, 0.32), 0 2px 8px rgba(60, 64, 67, 0.16)',
            }}
          />
        </div>
      </Marker>
    </>
  );
}

export { AGENT_BLUE };
