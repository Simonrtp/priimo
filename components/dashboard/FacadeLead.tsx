'use client';

import { useRef, useState } from 'react';
import { Building, ChevronLeft, ChevronRight, Compass, ExternalLink, RotateCcw } from 'lucide-react';

/** URL unique par lead — liste et drawer partagent le même cache navigateur. */
export function facadeLeadSrc(leadId: string, format: 'liste' | 'detail' = 'detail'): string {
  return `/api/facade/${leadId}?format=${format}`;
}

export function facadeGeoSrc(
  latitude: number,
  longitude: number,
  format: 'liste' | 'detail' | 'carre' = 'detail',
): string {
  return `/api/facade/geo?lat=${latitude.toFixed(5)}&lng=${longitude.toFixed(5)}&format=${format}`;
}

type FacadeImageProps = {
  src: string;
  className?: string;
  lazy?: boolean;
};

function FacadeFallback({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-lg ${className ?? ''}`}
      style={{ backgroundColor: '#F1EFE8' }}
      aria-hidden
    >
      <Building size={20} strokeWidth={1.8} className="text-[#9CA3AF]" />
    </div>
  );
}

function FacadeImage({ src, className, lazy = false }: FacadeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <FacadeFallback className={className} />;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      className={`object-cover object-top rounded-lg ${className ?? ''}`}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

type FacadeLeadProps = {
  leadId: string;
  className?: string;
  /** Lazy-load pour les vignettes hors écran dans la liste. */
  lazy?: boolean;
  format?: 'liste' | 'detail';
};

export default function FacadeLead({
  leadId,
  className,
  lazy = false,
  format = 'detail',
}: FacadeLeadProps) {
  return <FacadeImage src={facadeLeadSrc(leadId, format)} className={className} lazy={lazy} />;
}

export function FacadeStreetView({
  latitude,
  longitude,
  className,
  lazy = false,
  format = 'detail',
}: {
  latitude: number;
  longitude: number;
  className?: string;
  lazy?: boolean;
  format?: 'liste' | 'detail';
}) {
  const src = facadeGeoSrc(latitude, longitude, format);
  return <FacadeImage key={src} src={src} className={className} lazy={lazy} />;
}

/** Un pas de rotation : six vues font le tour de la rue. */
const PAS_ROTATION = 60;

function normaliserTour(deg: number): number {
  const t = ((deg % 360) + 360) % 360;
  return t > 180 ? t - 360 : t;
}

function vueTourneeSrc(latitude: number, longitude: number, tour: number): string {
  // Carrée comme le cadre : rien n'est rogné, ni la façade ni les mentions Google.
  const base = facadeGeoSrc(latitude, longitude, 'carre');
  return tour === 0 ? base : `${base}&tourner=${tour}`;
}

/** Street View dans Google Maps, dans un nouvel onglet : pour qui veut s'y promener. */
function streetViewGoogleMaps(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    api: '1',
    map_action: 'pano',
    viewpoint: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
  });
  return `https://www.google.com/maps/@?${params.toString()}`;
}

/**
 * La façade, et la rue autour : on tourne la tête par pas de 60°, avec les
 * flèches, en glissant, ou au clavier. Chaque vue est une photo servie par
 * Priimo depuis le même point de prise de vue — aucun habillage Google.
 * La façade revient d'un geste.
 */
export function FacadeStreetLook({
  latitude,
  longitude,
  className,
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  const [tour, setTour] = useState(0);
  const [affiche, setAffiche] = useState(() => vueTourneeSrc(latitude, longitude, 0));
  const [charge, setCharge] = useState(false);
  const [echec, setEchec] = useState(false);
  const demandee = useRef<string | null>(null);
  const prechargees = useRef(false);
  const depart = useRef<number | null>(null);

  function precharger(t: number) {
    const img = new Image();
    img.src = vueTourneeSrc(latitude, longitude, normaliserTour(t));
  }

  /** Au premier survol, les deux vues voisines arrivent : la rotation est instantanée. */
  function prechargerVoisines() {
    if (prechargees.current || echec) return;
    prechargees.current = true;
    precharger(PAS_ROTATION);
    precharger(-PAS_ROTATION);
  }

  function allerA(t: number) {
    const suivant = normaliserTour(t);
    const url = vueTourneeSrc(latitude, longitude, suivant);
    setTour(suivant);
    demandee.current = url;
    setCharge(true);
    const img = new Image();
    img.onload = () => {
      if (demandee.current !== url) return;
      setAffiche(url);
      setCharge(false);
      precharger(suivant + PAS_ROTATION);
      precharger(suivant - PAS_ROTATION);
    };
    img.onerror = () => {
      if (demandee.current === url) setCharge(false);
    };
    img.src = url;
  }

  const tourner = (sens: -1 | 1) => allerA(tour + sens * PAS_ROTATION);

  if (echec) {
    return <FacadeFallback className={`aspect-square w-full !rounded-2xl ${className ?? ''}`} />;
  }

  const bouton =
    'flex size-10 items-center justify-center rounded-full bg-white/95 text-text-strong shadow-[0_2px_10px_rgba(26,42,86,0.18)] transition-[opacity,transform] duration-fluid-subtle ease-in-out hover:bg-white active:scale-95 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  const visibleAuSurvol = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100';

  return (
    <div
      className={`group relative aspect-square w-full touch-pan-y select-none overflow-hidden rounded-2xl bg-bg-subtle outline-none ${className ?? ''}`}
      tabIndex={0}
      role="group"
      aria-roledescription="vue de la rue"
      aria-label={
        tour === 0
          ? 'Façade de l’immeuble — flèches gauche et droite pour regarder la rue'
          : `Vue de la rue, tournée de ${Math.abs(tour)}° vers la ${tour > 0 ? 'droite' : 'gauche'}`
      }
      onMouseEnter={prechargerVoisines}
      onFocus={prechargerVoisines}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          tourner(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          tourner(1);
        }
      }}
      onPointerDown={(e) => {
        depart.current = e.clientX;
      }}
      onPointerUp={(e) => {
        // Glisser vers la gauche fait regarder à droite, comme on fait tourner la vue.
        const dx = depart.current === null ? 0 : e.clientX - depart.current;
        depart.current = null;
        if (Math.abs(dx) > 40) tourner(dx < 0 ? 1 : -1);
      }}
    >
      <img
        key={affiche}
        src={affiche}
        alt=""
        draggable={false}
        decoding="async"
        onError={() => {
          if (affiche === vueTourneeSrc(latitude, longitude, 0)) setEchec(true);
        }}
        className="absolute inset-0 h-full w-full animate-[field-fade-in_var(--dur-fluid-subtle)_var(--ease-soft)_both] object-cover motion-reduce:animate-none"
      />

      <button
        type="button"
        onClick={() => tourner(-1)}
        aria-label="Regarder à gauche"
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${bouton} ${visibleAuSurvol}`}
      >
        <ChevronLeft size={20} strokeWidth={2.2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => tourner(1)}
        aria-label="Regarder à droite"
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${bouton} ${visibleAuSurvol}`}
      >
        <ChevronRight size={20} strokeWidth={2.2} aria-hidden />
      </button>

      <a
        href={streetViewGoogleMaps(latitude, longitude)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ouvrir Street View dans Google Maps"
        title="Ouvrir dans Google Maps"
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute right-2.5 top-2.5 !size-8 ${bouton} ${visibleAuSurvol}`}
      >
        <ExternalLink size={14} strokeWidth={2.2} aria-hidden />
      </a>

      {/* L'orientation, en haut : le bas de la photo porte les mentions Google, qu'on ne couvre pas. */}
      {tour === 0 ? (
        <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[12px] font-semibold text-text-strong shadow-[0_2px_10px_rgba(26,42,86,0.18)]">
          <Compass size={13} strokeWidth={2.2} aria-hidden className={charge ? 'animate-spin' : ''} />
          Façade
        </span>
      ) : (
        <button
          type="button"
          onClick={() => allerA(0)}
          className="absolute left-2.5 top-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1a2a56] px-3 text-[12px] font-semibold text-white shadow-[0_2px_10px_rgba(26,42,86,0.28)] transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <RotateCcw size={13} strokeWidth={2.4} aria-hidden className={charge ? 'animate-spin' : ''} />
          Revenir à la façade
        </button>
      )}
    </div>
  );
}
