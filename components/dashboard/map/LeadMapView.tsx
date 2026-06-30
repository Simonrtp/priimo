'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, Popup, type MapRef } from 'react-map-gl';
import { Minus, Plus, Maximize2, X, MapPin } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { getMainSignalLabel, ML_FEEDBACK_OPTIONS } from '@/lib/lead-meta';
import {
  buildScoreHeatScale,
  computeLeadBounds,
  hasCoordinates,
  type GeoLead,
} from '@/lib/lead-geo';
import { geocodeBanQuery } from '@/lib/ban';
import LeadMapCard from './LeadMapCard';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAP_STYLE = 'mapbox://styles/mapbox/light-v11';
const FRANCE_CENTER = { longitude: 2.3522, latitude: 48.8566, zoom: 5 };

interface LeadMapViewProps {
  leads: Lead[];
  /** Ouvre le détail complet (drawer existant). */
  onOpenDetail: (id: string) => void;
  /** Persiste les coordonnées géocodées (BAN) pour ne pas re-géocoder. */
  onGeocoded: (id: string, latitude: number, longitude: number) => void;
}

function mlFeedbackLabel(value: string | null): string | null {
  if (!value) return null;
  return ML_FEEDBACK_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export default function LeadMapView({ leads, onOpenDetail, onGeocoded }: LeadMapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const geocodeAttempted = useRef<Set<string>>(new Set());

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);

  const geoLeads = useMemo<GeoLead[]>(() => leads.filter(hasCoordinates), [leads]);
  const missingCount = leads.length - geoLeads.length;

  const heatFor = useMemo(
    () => buildScoreHeatScale(geoLeads.map((l) => l.score)),
    [geoLeads],
  );

  const activeLead = useMemo(
    () => geoLeads.find((l) => l.id === activeId) ?? null,
    [geoLeads, activeId],
  );

  // Signature stable du jeu de leads géolocalisés (pour refit bounds au filtre).
  const idsSignature = useMemo(
    () => geoLeads.map((l) => l.id).sort().join(','),
    [geoLeads],
  );

  const initialBounds = useMemo(() => computeLeadBounds(geoLeads), []); // eslint-disable-line react-hooks/exhaustive-deps

  const fitToLeads = useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = computeLeadBounds(geoLeads);
      if (!bounds) return;
      const [[west, south], [east, north]] = bounds;
      if (west === east && south === north) {
        map.easeTo({ center: [west, south], zoom: 14, duration: animate ? 700 : 0 });
        return;
      }
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 15,
        duration: animate ? 700 : 0,
      });
    },
    [geoLeads],
  );

  // Géocodage de secours (BAN) pour les leads sans coordonnées.
  useEffect(() => {
    const missing = leads.filter(
      (l) => !hasCoordinates(l) && !geocodeAttempted.current.has(l.id),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const lead of missing) {
        if (cancelled) break;
        geocodeAttempted.current.add(lead.id);
        const query = [lead.address, lead.postalCode, lead.city].filter(Boolean).join(' ');
        try {
          const coords = await geocodeBanQuery(query);
          if (coords && !cancelled) {
            onGeocoded(lead.id, coords.latitude, coords.longitude);
          }
        } catch {
          // silencieux : un lead non géocodé reste simplement hors carte
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leads, onGeocoded]);

  // Refit quand le jeu de pins change (filtre, géocodage…).
  useEffect(() => {
    fitToLeads(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSignature]);

  const focusLead = useCallback(
    (lead: GeoLead) => {
      setActiveId(lead.id);
      setShowMobileList(false);
      mapRef.current?.flyTo({
        center: [lead.longitude, lead.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 14),
        duration: 800,
        essential: true,
      });
    },
    [],
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-black/8 bg-[#F4F4F2] px-6 py-16 text-center shadow-soft">
        <MapPin className="mb-4 text-accent" size={36} strokeWidth={2} aria-hidden />
        <p className="mb-1 font-semibold text-ink" style={{ fontSize: 15 }}>
          Carte indisponible
        </p>
        <p className="max-w-sm text-mute" style={{ fontSize: 13, lineHeight: 1.55 }}>
          La variable <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> n&apos;est
          pas configurée. Ajoutez-la dans <code className="rounded bg-black/5 px-1">.env.local</code> pour
          activer la vue carte.
        </p>
      </div>
    );
  }

  const resultsList = (
    <div className="flex flex-col gap-2">
      {geoLeads.map((lead) => (
        <LeadMapCard
          key={lead.id}
          lead={lead}
          heat={heatFor(lead.score)}
          active={lead.id === activeId}
          onClick={() => focusLead(lead)}
          onHover={(h) => setHoveredId(h ? lead.id : null)}
        />
      ))}
      {missingCount > 0 && (
        <p className="px-1 py-2 text-center text-mute" style={{ fontSize: 11.5 }}>
          {missingCount} prospect{missingCount > 1 ? 's' : ''} en cours de localisation…
        </p>
      )}
      {geoLeads.length === 0 && missingCount === 0 && (
        <p className="px-1 py-6 text-center text-mute" style={{ fontSize: 12.5 }}>
          Aucun prospect à afficher sur la carte.
        </p>
      )}
    </div>
  );

  return (
    <div className="relative flex h-[calc(100dvh-240px)] min-h-[480px] overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft md:h-[calc(100dvh-260px)]">
      {/* Panneau résultats (desktop) */}
      <aside className="hidden w-[380px] flex-shrink-0 flex-col border-r border-black/8 md:flex">
        <div className="border-b border-black/[0.06] px-4 py-3">
          <p className="font-semibold text-ink" style={{ fontSize: 13.5 }}>
            {geoLeads.length} prospect{geoLeads.length !== 1 ? 's' : ''} sur la carte
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{resultsList}</div>
      </aside>

      {/* Carte */}
      <div className="relative min-w-0 flex-1">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={MAP_STYLE}
          initialViewState={
            initialBounds
              ? {
                  bounds: initialBounds,
                  fitBoundsOptions: { padding: 70, maxZoom: 15 },
                }
              : FRANCE_CENTER
          }
          attributionControl={false}
          onLoad={() => fitToLeads(false)}
          onClick={() => setActiveId(null)}
          style={{ width: '100%', height: '100%' }}
        >
          {geoLeads.map((lead) => {
            const heat = heatFor(lead.score);
            const emphasized = lead.id === hoveredId || lead.id === activeId;
            return (
              <Marker
                key={lead.id}
                longitude={lead.longitude}
                latitude={lead.latitude}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  focusLead(lead);
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Prospect ${lead.address}, score ${lead.score}`}
                  onMouseEnter={() => setHoveredId(lead.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="flex cursor-pointer items-center justify-center rounded-full font-bold tabular transition-all duration-200 ease-out"
                  style={{
                    width: heat.size,
                    height: heat.size,
                    backgroundColor: heat.color,
                    color: heat.text,
                    fontSize: Math.round(heat.size * 0.34),
                    border: '2px solid rgba(255,255,255,0.9)',
                    boxShadow: emphasized
                      ? `0 0 0 6px ${heat.glow}, 0 6px 16px rgba(0,0,0,0.28)`
                      : '0 2px 6px rgba(0,0,0,0.22)',
                    transform: emphasized ? 'scale(1.18)' : 'scale(1)',
                    zIndex: emphasized ? 10 : 1,
                  }}
                >
                  {lead.score}
                </div>
              </Marker>
            );
          })}

          {activeLead && (
            <Popup
              longitude={activeLead.longitude}
              latitude={activeLead.latitude}
              anchor="bottom"
              offset={26}
              closeButton={false}
              closeOnClick={false}
              onClose={() => setActiveId(null)}
              maxWidth="300px"
            >
              <LeadMapPopup lead={activeLead} onOpenDetail={onOpenDetail} onClose={() => setActiveId(null)} />
            </Popup>
          )}
        </Map>

        {/* Contrôles de zoom custom */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <MapButton label="Zoom avant" onClick={() => mapRef.current?.zoomIn({ duration: 300 })}>
            <Plus size={18} strokeWidth={2.4} />
          </MapButton>
          <MapButton label="Zoom arrière" onClick={() => mapRef.current?.zoomOut({ duration: 300 })}>
            <Minus size={18} strokeWidth={2.4} />
          </MapButton>
          <MapButton label="Tout afficher" onClick={() => fitToLeads(true)}>
            <Maximize2 size={16} strokeWidth={2.4} />
          </MapButton>
        </div>

        {/* Bascule liste (mobile) */}
        <button
          type="button"
          onClick={() => setShowMobileList(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg md:hidden"
        >
          Voir la liste ({geoLeads.length})
        </button>
      </div>

      {/* Bottom sheet résultats (mobile) */}
      {showMobileList && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobileList(false)}
            aria-hidden
          />
          <div className="relative max-h-[72%] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <p className="font-semibold text-ink" style={{ fontSize: 14 }}>
                {geoLeads.length} prospect{geoLeads.length !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                onClick={() => setShowMobileList(false)}
                className="rounded-lg p-1.5 text-mute hover:bg-black/[0.04]"
                aria-label="Fermer"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="max-h-[calc(72vh-52px)] overflow-y-auto p-3">{resultsList}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white/95 text-ink shadow-sm backdrop-blur transition-colors hover:bg-white"
    >
      {children}
    </button>
  );
}

function LeadMapPopup({
  lead,
  onOpenDetail,
  onClose,
}: {
  lead: Lead;
  onOpenDetail: (id: string) => void;
  onClose: () => void;
}) {
  const typeLabel = lead.ownerType === 'entreprise' ? 'SCI / Entreprise' : 'Particulier';
  const signal = getMainSignalLabel(lead);
  const ml = mlFeedbackLabel(lead.mlFeedback);

  return (
    <div className="min-w-[220px] font-sans">
      <div className="flex items-start justify-between gap-2">
        <p className="text-pretty font-semibold leading-snug text-ink" style={{ fontSize: 13.5 }}>
          {lead.address}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 rounded p-1 text-mute hover:bg-black/[0.05]"
          aria-label="Fermer"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold tabular text-white">
          {lead.score}
        </span>
        <span className="text-mute" style={{ fontSize: 11.5 }}>
          {typeLabel}
          {lead.postalCode ? ` · ${lead.postalCode}` : ''}
        </span>
      </div>

      <p className="mt-2 text-[#374151]" style={{ fontSize: 12 }}>
        {signal}
      </p>

      {ml && (
        <p className="mt-1.5 inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
          {ml}
        </p>
      )}

      <button
        type="button"
        onClick={() => onOpenDetail(lead.id)}
        className="mt-2.5 w-full rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-dark"
      >
        Voir le détail
      </button>
    </div>
  );
}
