'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MapboxMap, { Marker, type MapRef } from 'react-map-gl';
import { Locate, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { Lead } from '@/types/lead';
import type { GeoCoord } from '@/lib/carte/coords';
import { MAPBOX_TOKEN, PRIIMO_MAP_STYLE } from '@/lib/map/style';
import { MAP_3D_BEARING, MAP_3D_PITCH } from '@/lib/map/camera';
import { LEAD_FIELD_COLOR } from '@/lib/carte/colors';
import { FIELD, formatDistance } from '@/lib/today/field';
import {
  fetchWalkingRoute,
  formatWalkingDuration,
  routeWaypoints,
  toItineraireStops,
} from '@/lib/today/directions';
import {
  activeStops,
  completedCount,
  currentStop,
  emptySortieSession,
  estimateWalkDurationS,
  readSortieSession,
  rebuildPlanFromStops,
  shouldOfferFieldRecalc,
  todaySortieDay,
  writeSortieSession,
  type SortieSession,
} from '@/lib/today/sortie-session';
import {
  requestDevicePosition,
  watchDevicePosition,
  type DevicePosition,
} from '@/lib/voice/gps';
import { postJsonOrQueue, newOfflineId } from '@/lib/offline/queue';
import { useOfflineQueue } from '@/components/dashboard/field/OfflineQueueProvider';
import { useTourneeDictation } from '@/components/dashboard/field/TourneeDictationProvider';
import AgentLocationMarker from '@/components/dashboard/field/AgentLocationMarker';
import AgencyLocationMarker from '@/components/dashboard/field/AgencyLocationMarker';
import OfflineIndicator from '@/components/dashboard/field/OfflineIndicator';
import ScoreRing from '@/components/dashboard/ScoreRing';
import MapTokenMissing from '@/components/dashboard/map/MapTokenMissing';
import ItineraireLayer from '@/components/dashboard/carte/ItineraireLayer';
import { vibrateBrief } from '@/app/dashboard/_mobile/aujourdhui/tap';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ApproachVariante } from '@/lib/script-approche';
import {
  buildSortie,
  sortieStorageKey,
  type SortiePlan,
  type SortieStop,
} from '@/lib/today/sortie';

import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/dashboard/carte/carte.css';

type BuildingHint = {
  ventes: number | null;
  lots: number | null;
  procedureCopro: boolean | null;
  dpe: string | null;
};

async function logEvent(args: {
  kind: string;
  leadId?: string | null;
  stopKey?: string | null;
  payload?: Record<string, unknown>;
}) {
  const clientId = newOfflineId();
  await postJsonOrQueue('/api/dashboard/sortie/events', {
    kind: args.kind,
    leadId: args.leadId ?? null,
    stopKey: args.stopKey ?? null,
    payload: args.payload ?? {},
    clientId,
    day: todaySortieDay(),
  });
}

function porteScript(lead: Lead | undefined): ApproachVariante | null {
  return lead?.scriptApproche?.porte ?? null;
}

export default function TourneeMobile({
  initialLeads,
  profileId,
  agencyOrigin,
}: {
  initialLeads: Lead[];
  profileId: string;
  agencyOrigin: GeoCoord | null;
}) {
  const router = useRouter();
  const day = todaySortieDay();
  const storageKey = sortieStorageKey(profileId, day);
  const { refresh: refreshQueue } = useOfflineQueue();
  const { setStop: setDictationStop, dicteeCount, leadId: dictationLeadId } = useTourneeDictation();

  const [origin, setOrigin] = useState<GeoCoord | null>(agencyOrigin);
  const [originSource, setOriginSource] = useState<'agency' | 'field'>('agency');
  const [offerRecalc, setOfferRecalc] = useState(false);
  const [session, setSession] = useState<SortieSession>(() => emptySortieSession());
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distanceM: number; durationS: number } | null>(null);
  const [agentPos, setAgentPos] = useState<DevicePosition | null>(null);
  const [tracking, setTracking] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [buildingHint, setBuildingHint] = useState<BuildingHint | null>(null);
  const [swipeKey, setSwipeKey] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const mapRef = useRef<MapRef | null>(null);
  const touchStartX = useRef(0);

  const basePlan = useMemo(
    () => buildSortie(initialLeads, profileId, origin),
    [initialLeads, profileId, origin],
  );

  const plan = useMemo(() => {
    if (!basePlan) return null;
    const kept = activeStops(basePlan, session);
    return rebuildPlanFromStops(kept, origin);
  }, [basePlan, session, origin]);

  const leadsById = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const l of initialLeads) map.set(l.id, l);
    return map;
  }, [initialLeads]);

  // Hydrate session
  useEffect(() => {
    const stored = readSortieSession(storageKey);
    const signature = basePlan?.signature ?? '';
    if (stored && (stored.signature === signature || stored.phase !== 'prep')) {
      // Reprise : garder signature stockée si tournée déjà commencée
      setSession(stored);
      if (stored.origin) {
        setOrigin(stored.origin);
        setOriginSource(stored.originSource);
      }
      return;
    }
    setSession((prev) => ({
      ...emptySortieSession(signature),
      removed: prev.removed,
      phase: 'prep',
      originSource: 'agency',
      origin: agencyOrigin,
      plannedDistanceM: basePlan?.distanceM ?? 0,
    }));
  }, [storageKey, basePlan?.signature, agencyOrigin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    writeSortieSession(storageKey, {
      ...session,
      signature: plan?.signature ?? session.signature,
      origin,
      originSource,
    });
  }, [storageKey, session, plan?.signature, origin, originSource]);

  // Offrir recalcul GPS si déjà dehors (sans l'imposer)
  useEffect(() => {
    if (session.phase !== 'prep') return;
    void requestDevicePosition().then((gps) => {
      if (!gps) return;
      setOfferRecalc(shouldOfferFieldRecalc(agencyOrigin, gps));
    });
  }, [agencyOrigin, session.phase]);

  const stops = plan?.ordered ?? [];
  const active = currentStop(stops, session);
  const doneN = completedCount(session);
  const totalN = stops.length;

  // Dictée pré-rattachée
  useEffect(() => {
    if (session.phase === 'active' && active) {
      setDictationStop({ adresse: active.address, leadId: active.leadId });
    } else {
      setDictationStop(null);
    }
    return () => setDictationStop(null);
  }, [session.phase, active, setDictationStop]);

  // Comptage dictées pour le bilan
  useEffect(() => {
    if (session.phase !== 'active' || !active || dicteeCount === 0) return;
    const key = active.key;
    const lead = dictationLeadId ?? active.leadId;
    setSession((s) =>
      s.dictees.includes(key) ? s : { ...s, dictees: [...s.dictees, key] },
    );
    void logEvent({
      kind: 'dictee',
      leadId: lead,
      stopKey: key,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dicteeCount]);

  // Route marche
  useEffect(() => {
    let cancelled = false;
    if (!plan || stops.length === 0 || !MAPBOX_TOKEN) {
      setRouteGeometry(null);
      setRouteMeta(null);
      return;
    }
    const itin = toItineraireStops(stops);
    const waypoints = routeWaypoints(itin, origin);
    void fetchWalkingRoute(waypoints, MAPBOX_TOKEN).then((route) => {
      if (cancelled) return;
      if (route) {
        setRouteGeometry(route.geometry);
        setRouteMeta({ distanceM: route.distanceM, durationS: route.durationS });
        setSession((s) => ({
          ...s,
          plannedDistanceM: route.distanceM,
          plannedDurationS: route.durationS,
        }));
      } else {
        setRouteGeometry(null);
        setRouteMeta({
          distanceM: plan.distanceM,
          durationS: estimateWalkDurationS(plan.distanceM),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [plan?.signature, origin?.latitude, origin?.longitude, stops.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS watch pendant tournée active
  useEffect(() => {
    if (session.phase !== 'active' || !tracking) return;
    return watchDevicePosition(setAgentPos, { pauseWhenHidden: true });
  }, [session.phase, tracking]);

  // Building hint for current stop
  useEffect(() => {
    if (!active?.banId) {
      setBuildingHint(null);
      return;
    }
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    void supabase
      .from('building_activity')
      .select('nb_transactions_total, nb_lots, procedure_copro, etiquette_dpe')
      .eq('ban_id', active.banId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) {
          if (!cancelled) setBuildingHint(null);
          return;
        }
        setBuildingHint({
          ventes: data.nb_transactions_total ?? null,
          lots: data.nb_lots ?? null,
          procedureCopro: data.procedure_copro ?? null,
          dpe: data.etiquette_dpe ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [active?.banId]);

  // Fin automatique
  useEffect(() => {
    if (session.phase !== 'active') return;
    if (totalN > 0 && doneN >= totalN) {
      setSession((s) => ({
        ...s,
        phase: 'bilan',
        finishedAt: new Date().toISOString(),
      }));
      void logEvent({ kind: 'finish', payload: { stops: totalN, rencontres: session.rencontres.length } });
      setTracking(false);
    }
  }, [doneN, totalN, session.phase, session.rencontres.length]);

  const persist = useCallback((updater: (s: SortieSession) => SortieSession) => {
    setSession(updater);
  }, []);

  async function recalcFromGps() {
    const gps = await requestDevicePosition();
    if (!gps) return;
    setOrigin({ latitude: gps.latitude, longitude: gps.longitude });
    setOriginSource('field');
    setOfferRecalc(false);
    void logEvent({ kind: 'recalc_origin', payload: { source: 'field' } });
    void refreshQueue();
  }

  function removeStop(key: string) {
    vibrateBrief();
    persist((s) => ({ ...s, removed: s.removed.includes(key) ? s.removed : [...s.removed, key] }));
    const stop = basePlan?.ordered.find((x) => x.key === key);
    void logEvent({
      kind: 'remove_stop',
      leadId: stop?.leadId,
      stopKey: key,
    });
    void refreshQueue();
  }

  async function startTour() {
    if (!plan || plan.ordered.length === 0) return;
    vibrateBrief();
    const gps = await requestDevicePosition();
    if (gps) setAgentPos(gps);
    setTracking(true);
    persist((s) => ({
      ...s,
      phase: 'active',
      startedAt: s.startedAt ?? new Date().toISOString(),
      signature: plan.signature,
      origin,
      originSource,
      plannedDistanceM: routeMeta?.distanceM ?? plan.distanceM,
      plannedDurationS: routeMeta?.durationS ?? estimateWalkDurationS(plan.distanceM),
    }));
    void logEvent({
      kind: 'start',
      payload: {
        stops: plan.ordered.length,
        originSource,
        distanceM: routeMeta?.distanceM ?? plan.distanceM,
      },
    });
    void refreshQueue();
  }

  function pauseTour() {
    vibrateBrief();
    setTracking(false);
    persist((s) => ({ ...s, phase: 'prep' }));
    void logEvent({ kind: 'pause', payload: { done: doneN, total: totalN } });
  }

  function advance(kind: 'rencontre' | 'absent' | 'passer', stop: SortieStop) {
    vibrateBrief();
    persist((s) => {
      const next = { ...s };
      if (kind === 'rencontre') {
        next.rencontres = s.rencontres.includes(stop.key) ? s.rencontres : [...s.rencontres, stop.key];
        next.done = s.done.includes(stop.key) ? s.done : [...s.done, stop.key];
      } else if (kind === 'absent') {
        next.absents = s.absents.includes(stop.key) ? s.absents : [...s.absents, stop.key];
        next.done = s.done.includes(stop.key) ? s.done : [...s.done, stop.key];
      } else {
        next.skipped = s.skipped.includes(stop.key) ? s.skipped : [...s.skipped, stop.key];
      }
      return next;
    });
    setScriptOpen(false);
    void logEvent({ kind, leadId: stop.leadId, stopKey: stop.key });
    void refreshQueue();
  }

  function recenter() {
    void requestDevicePosition().then((pos) => {
      if (!pos) return;
      setAgentPos(pos);
      if (!tracking && session.phase === 'active') setTracking(true);
      mapRef.current?.easeTo({
        center: [pos.longitude, pos.latitude],
        zoom: 16,
        pitch: MAP_3D_PITCH,
        bearing: MAP_3D_BEARING,
        duration: 400,
      });
    });
  }

  const distanceLabel = formatDistance(routeMeta?.distanceM ?? plan?.distanceM ?? 0);
  const durationLabel = routeMeta
    ? formatWalkingDuration(routeMeta.durationS)
    : plan
      ? formatWalkingDuration(estimateWalkDurationS(plan.distanceM))
      : null;

  const lead = active ? leadsById.get(active.leadId) : undefined;
  const script = porteScript(lead);

  // ——— BILAN ———
  if (session.phase === 'bilan' && plan) {
    return (
      <BilanView
        plan={plan}
        session={session}
        onClose={() => router.push('/dashboard')}
      />
    );
  }

  // ——— ACTIVE ———
  if (session.phase === 'active' && plan) {
    if (!active) {
      return (
        <BilanView
          plan={plan}
          session={session}
          onClose={() => router.push('/dashboard')}
        />
      );
    }

    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-[#15202F]"
        style={{ height: '100dvh' }}
      >
        <div className="relative min-h-0 flex-1">
          {!MAPBOX_TOKEN ? (
            <MapTokenMissing />
          ) : (
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={PRIIMO_MAP_STYLE}
              initialViewState={{
                longitude: active.longitude,
                latitude: active.latitude,
                zoom: 15,
                pitch: MAP_3D_PITCH,
                bearing: MAP_3D_BEARING,
              }}
              attributionControl={false}
              dragRotate={false}
              style={{ width: '100%', height: '100%' }}
            >
              {stops.length >= 2 ? (
                <ItineraireLayer
                  geometry={routeGeometry}
                  stops={toItineraireStops(stops)}
                />
              ) : null}
              {stops.map((stop, i) => {
                const closed =
                  session.rencontres.includes(stop.key) ||
                  session.absents.includes(stop.key) ||
                  session.skipped.includes(stop.key) ||
                  session.done.includes(stop.key);
                const isActive = stop.key === active.key;
                return (
                  <Marker
                    key={stop.key}
                    longitude={stop.longitude}
                    latitude={stop.latitude}
                    anchor="center"
                  >
                    <span
                      className="flex size-8 items-center justify-center rounded-full border-2 border-white text-[12px] font-bold text-white shadow-md"
                      style={{
                        backgroundColor: closed
                          ? FIELD.vert
                          : isActive
                            ? LEAD_FIELD_COLOR
                            : FIELD.ardoise,
                        opacity: closed ? 0.7 : 1,
                      }}
                    >
                      {i + 1}
                    </span>
                  </Marker>
                );
              })}
              {agencyOrigin ? (
                <Marker
                  longitude={agencyOrigin.longitude}
                  latitude={agencyOrigin.latitude}
                  anchor="center"
                  style={{ zIndex: 25 }}
                >
                  <AgencyLocationMarker />
                </Marker>
              ) : null}
              {agentPos ? (
                <Marker
                  longitude={agentPos.longitude}
                  latitude={agentPos.latitude}
                  anchor="center"
                  style={{ zIndex: 30 }}
                >
                  <AgentLocationMarker position={agentPos} />
                </Marker>
              ) : null}
            </MapboxMap>
          )}

          <header
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3"
            style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}
          >
            <button
              type="button"
              onClick={pauseTour}
              className="pointer-events-auto app-press flex min-h-[44px] items-center rounded-full bg-white/95 px-3.5 text-[14px] font-medium text-text-strong shadow-md"
            >
              Pause
            </button>
            <p className="pointer-events-auto rounded-full bg-white/95 px-3 py-2 text-[13px] font-semibold tabular-nums text-text-strong shadow-md">
              {doneN + 1} sur {totalN}
            </p>
          </header>

          <button
            type="button"
            onClick={recenter}
            aria-label="Recentrer sur ma position"
            className="app-press absolute right-4 z-20 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
            style={{ bottom: 'calc(280px + env(safe-area-inset-bottom, 0px))' }}
          >
            <Locate size={20} strokeWidth={2} aria-hidden />
          </button>

          <div
            className="absolute inset-x-0 bottom-0 z-20 rounded-t-[24px] bg-surface shadow-[0_-8px_32px_rgba(15,23,34,0.2)]"
            style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="px-4 pt-3">
              <OfflineIndicator className="mb-2" />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                Arrêt en cours
              </p>
              <h2
                className="mt-1 text-balance font-semibold text-text-strong"
                style={{ fontSize: 18, lineHeight: 1.25 }}
              >
                {active.address}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <ScoreRing score={active.score} size={36} />
                {active.etage ? (
                  <span className="text-[13.5px] font-medium text-text-muted">
                    Étage {active.etage}
                  </span>
                ) : null}
                {active.surfaceM2 ? (
                  <span className="text-[13.5px] text-text-muted">{active.surfaceM2} m²</span>
                ) : null}
              </div>
              {(buildingHint || active.mainSignalLabel) && (
                <p className="mt-2 text-[13px] text-text-muted">
                  {[
                    buildingHint?.ventes != null && buildingHint.ventes > 0
                      ? `${buildingHint.ventes} vente${buildingHint.ventes > 1 ? 's' : ''}`
                      : null,
                    buildingHint?.lots != null
                      ? `${buildingHint.lots} lot${buildingHint.lots > 1 ? 's' : ''}`
                      : null,
                    buildingHint?.procedureCopro ? 'Procédure copro' : null,
                    buildingHint?.dpe ? `DPE ${buildingHint.dpe}` : null,
                    active.mainSignalLabel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}

              <button
                type="button"
                onClick={() => setScriptOpen((v) => !v)}
                className="mt-2 flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-left text-[13.5px] font-semibold"
                style={{ color: FIELD.ardoise }}
              >
                Script d&apos;approche
                {scriptOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {scriptOpen ? (
                <div
                  className="mb-2 max-h-36 overflow-y-auto rounded-xl px-3 py-2.5 text-[13.5px] leading-snug text-text"
                  style={{ backgroundColor: FIELD.creme }}
                >
                  {script?.ouverture || script?.angle || active.notes || 'Pas de script pour cette adresse.'}
                </div>
              ) : null}

              <div className="mt-1 grid grid-cols-3 gap-2 pb-1">
                <ActionBtn
                  label="Rencontré"
                  tone="vert"
                  onClick={() => advance('rencontre', active)}
                />
                <ActionBtn
                  label="Absent"
                  tone="ardoise"
                  onClick={() => advance('absent', active)}
                />
                <ActionBtn
                  label="Passer"
                  tone="muted"
                  onClick={() => advance('passer', active)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ——— PREP ———
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-base">
      <header
        className="flex flex-shrink-0 items-center justify-between border-b border-black/[0.06] bg-surface px-3"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          minHeight: 'calc(52px + env(safe-area-inset-top, 0px))',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="app-press flex min-h-[44px] items-center px-2 text-[14px] font-medium text-text-muted"
        >
          Fermer
        </button>
        <h1 className="font-semibold text-text-strong" style={{ fontSize: 17 }}>
          Tournée
        </h1>
        <span className="w-16" aria-hidden />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-28 pt-5">
        <OfflineIndicator className="mb-3" />

        {!plan || stops.length === 0 ? (
          <div className="pt-10 text-center">
            <p className="text-pretty text-[15px] text-text-muted">
              Aucune adresse à prospecter aujourd&apos;hui.
            </p>
            <button
              type="button"
              onClick={() => router.push('/dashboard/prospection')}
              className="mt-4 text-[14px] font-semibold text-text-strong underline decoration-black/25"
            >
              Voir la prospection
            </button>
          </div>
        ) : (
          <>
            <p className="text-balance font-semibold text-text-strong" style={{ fontSize: 22 }}>
              {stops.length} adresse{stops.length > 1 ? 's' : ''}
            </p>
            <p className="mt-1 text-[14px] text-text-muted">
              {distanceLabel}
              {durationLabel ? ` · ${durationLabel}` : ''} à pied
              {originSource === 'agency' ? ' · départ agence' : ' · départ position'}
            </p>

            {offerRecalc && originSource === 'agency' ? (
              <button
                type="button"
                onClick={() => void recalcFromGps()}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl px-4 text-[14px] font-semibold"
                style={{ backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }}
              >
                Recalculer depuis ma position
              </button>
            ) : null}

            {session.startedAt && doneN > 0 ? (
              <p className="mt-3 text-[13px] font-medium" style={{ color: FIELD.orange }}>
                Reprise · {doneN}/{totalN} déjà faites
              </p>
            ) : null}

            <ul className="mt-5 flex flex-col gap-2">
              {stops.map((stop, i) => (
                <li
                  key={stop.key}
                  className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white"
                  onTouchStart={(e) => {
                    touchStartX.current = e.touches[0]?.clientX ?? 0;
                    setSwipeKey(stop.key);
                    setSwipeX(0);
                  }}
                  onTouchMove={(e) => {
                    if (swipeKey !== stop.key) return;
                    const x = e.touches[0]?.clientX ?? 0;
                    setSwipeX(Math.min(0, x - touchStartX.current));
                  }}
                  onTouchEnd={() => {
                    if (swipeKey === stop.key && swipeX < -80) removeStop(stop.key);
                    setSwipeKey(null);
                    setSwipeX(0);
                  }}
                >
                  <div
                    className="absolute inset-y-0 right-0 flex w-20 items-center justify-center"
                    style={{ backgroundColor: FIELD.rouge }}
                    aria-hidden
                  >
                    <X size={18} className="text-white" />
                  </div>
                  <div
                    className="relative flex min-h-[56px] items-center gap-3 bg-white px-3.5 py-2.5"
                    style={{
                      transform:
                        swipeKey === stop.key ? `translateX(${swipeX}px)` : undefined,
                      transition: swipeKey === stop.key ? undefined : 'transform 0.15s ease',
                    }}
                  >
                    <span
                      className="flex size-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                      style={{ backgroundColor: FIELD.ardoise }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-text-strong">
                        {stop.address}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-text-muted">
                        Score {Math.round(stop.score)}
                        {stop.etage ? ` · Étage ${stop.etage}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Retirer cette adresse"
                      onClick={() => removeStop(stop.key)}
                      className="app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full text-text-muted"
                    >
                      <X size={18} strokeWidth={2} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-[12px] text-text-subtle">
              Glisser vers la gauche pour retirer
            </p>
          </>
        )}
      </div>

      {plan && stops.length > 0 ? (
        <div
          className="fixed inset-x-0 z-40 border-t border-black/[0.06] bg-surface px-4 pt-3"
          style={{ bottom: 'var(--field-nav-height)' }}
        >
          <button
            type="button"
            onClick={() => void startTour()}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl font-semibold text-white"
            style={{ backgroundColor: FIELD.orange, fontSize: 16 }}
          >
            {session.startedAt && doneN > 0 ? 'Reprendre la tournée' : 'Lancer la tournée'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ActionBtn({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: 'vert' | 'ardoise' | 'muted';
  onClick: () => void;
}) {
  const style =
    tone === 'vert'
      ? { backgroundColor: FIELD.vert, color: '#fff' }
      : tone === 'ardoise'
        ? { backgroundColor: FIELD.ardoise, color: '#fff' }
        : { backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] items-center justify-center rounded-xl text-[13.5px] font-semibold"
      style={style}
    >
      {label}
    </button>
  );
}

function BilanView({
  plan,
  session,
  onClose,
}: {
  plan: SortiePlan;
  session: SortieSession;
  onClose: () => void;
}) {
  const n = plan.ordered.length;
  const rencontres = session.rencontres.length;
  const absents = session.absents.length;
  const passes = session.skipped.length;
  const dictees = session.dictees.length;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-bg-base"
      style={{ paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))' }}
    >
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-full"
        style={{ backgroundColor: FIELD.vertPastel }}
        aria-hidden
      >
        <span className="text-[22px] font-bold" style={{ color: FIELD.vert }}>
          {rencontres}
        </span>
      </div>
      <h2 className="mt-5 text-center text-balance font-semibold text-text-strong" style={{ fontSize: 22 }}>
        Tournée terminée
      </h2>
      <p className="mt-1 text-center text-[14px] text-text-muted">
        {n} adresse{n > 1 ? 's' : ''} · {formatDistance(session.plannedDistanceM)}
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-3">
        <Stat label="Rencontres" value={rencontres} />
        <Stat label="Absents" value={absents} />
        <Stat label="Passées" value={passes} />
        <Stat label="Notes dictées" value={dictees} />
      </dl>

      <ul className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {plan.ordered.map((stop) => {
          let status = 'Passée';
          if (session.rencontres.includes(stop.key)) status = 'Rencontré';
          else if (session.absents.includes(stop.key)) status = 'Absent';
          else if (session.dictees.includes(stop.key)) status = 'Dictée';
          return (
            <li key={stop.key} className="border-t border-black/[0.06] py-2.5">
              <p className="text-[14px] font-medium text-text-strong">{stop.address}</p>
              <p className="text-[12.5px] text-text-muted">{status}</p>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onClose}
        className="mb-6 mt-4 flex min-h-[52px] w-full flex-shrink-0 items-center justify-center rounded-2xl font-semibold text-white"
        style={{
          backgroundColor: FIELD.orange,
          marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        Retour à l&apos;accueil
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl px-3 py-3" style={{ backgroundColor: FIELD.ardoisePastel }}>
      <dt className="text-[12px] font-medium text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-[22px] font-semibold tabular-nums text-text-strong">{value}</dd>
    </div>
  );
}
