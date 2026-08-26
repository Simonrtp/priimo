'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronUp, Layers, X } from 'lucide-react';
import { createBanGeocodeCache, geocodeAdresse } from '@/lib/geo/ban';
import {
  countKindsInViewport,
  entitiesByKind,
  filterMapEntities,
  groupEntitiesByBanId,
  type MapPeriod,
  type MapViewport,
} from '@/lib/carte/buildings';
import {
  MAP_LAYER_LABELS,
  MAP_LAYER_ORDER,
  activeKindSet,
  anyCadastreLayer,
  persistMapLayers,
  persistLayersPanelOpen,
  readLayersPanelOpen,
  readStoredMapLayers,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import CadastreLayerControls from '@/components/dashboard/carte/CadastreLayerControls';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';
import ImmeubleFacade from '@/components/dashboard/carte/ImmeubleFacade';
import {
  postalCodesFromPoints,
  withoutPositionTotal,
  type MapPoint,
  type MapPointKind,
  type UnplacedRecord,
  type WithoutPositionCount,
} from '@/lib/carte/points';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Select from '@/components/ui/Select';
import WorkspaceCard, { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import { Field } from '@/components/dashboard/workspace/Field';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import ItineraireBanner from '@/components/dashboard/carte/ItineraireBanner';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import { useWalkingRoute } from '@/lib/today/use-walking-route';
import { readItineraireStops, type ItineraireStop } from '@/lib/today/directions';

const SectorMapCanvas = dynamic(() => import('./SectorMapCanvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/[0.04]" aria-hidden />,
});

const PERIOD_OPTIONS: { value: MapPeriod; label: string }[] = [
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
  { value: 365, label: '365 jours' },
  { value: 'all', label: 'Tout' },
];

const GEO_TABLE: Record<MapPointKind, 'leads' | 'contacts' | 'biens' | 'voice_notes'> = {
  lead: 'leads',
  contact: 'contacts',
  bien: 'biens',
  note: 'voice_notes',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function LayersPanel({
  layers,
  onToggle,
  onToggleCadastre,
  onToggleCadastreOverlay,
  mapZoom,
  counts,
  postal,
  onPostal,
  codes,
  assignedTo,
  onAssigned,
  members,
  showAssignee,
  period,
  onPeriod,
  onCollapse,
}: {
  layers: MapLayerState;
  onToggle: (kind: MapPointKind) => void;
  onToggleCadastre: () => void;
  onToggleCadastreOverlay: (id: CadastreLayerId) => void;
  mapZoom: number | null;
  counts: Record<MapPointKind, number>;
  postal: string;
  onPostal: (v: string) => void;
  codes: string[];
  assignedTo: string;
  onAssigned: (v: string) => void;
  members: readonly AssigneeOption[];
  showAssignee: boolean;
  period: MapPeriod;
  onPeriod: (v: MapPeriod) => void;
  onCollapse?: () => void;
}) {
  return (
    <WorkspaceCard className="shadow-clay-sm">
      <div className="flex items-start justify-between gap-2">
        <CardEyebrow>Couches</CardEyebrow>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Replier les couches"
            aria-expanded
            title="Replier les couches"
            className="-mr-1 -mt-0.5 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Replier
            <ChevronUp size={14} strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {MAP_LAYER_ORDER.map((kind) => {
          const active = layers[kind];
          return (
            <li key={kind}>
              <label
                className={`flex min-h-[40px] cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 transition-colors ${
                  active ? 'bg-accent/10' : 'hover:bg-black/[0.03]'
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-black/20 text-accent focus:ring-accent/30"
                  style={{ accentColor: '#E8743C' }}
                  checked={active}
                  onChange={() => onToggle(kind)}
                />
                <span
                  className={`min-w-0 flex-1 text-[13.5px] font-medium ${active ? 'text-text-strong' : 'text-text-muted'}`}
                >
                  {MAP_LAYER_LABELS[kind]}
                </span>
                <span className="tabular-nums text-[12.5px] text-text-subtle">{counts[kind]}</span>
              </label>
            </li>
          );
        })}
        <CadastreLayerControls
          layers={layers}
          onToggleCadastre={onToggleCadastre}
          onToggleOverlay={onToggleCadastreOverlay}
          mapZoom={mapZoom}
        />
      </ul>

      <div className="mt-4 flex flex-col gap-3 border-t border-black/[0.06] pt-4">
        {codes.length > 0 ? (
          <Field label="Code postal" htmlFor="carte-cp">
            <Select
              id="carte-cp"
              aria-label="Filtrer par code postal"
              value={postal}
              onChange={onPostal}
              options={[
                { value: 'tous', label: 'Tout le secteur' },
                ...codes.map((code) => ({ value: code, label: code })),
              ]}
            />
          </Field>
        ) : null}

        {showAssignee ? (
          <Field label="Assigné à" htmlFor="carte-assigne">
            <Select
              id="carte-assigne"
              aria-label="Filtrer par membre"
              value={assignedTo}
              onChange={onAssigned}
              options={[
                { value: 'tous', label: "Toute l'équipe" },
                ...members.map((m) => ({ value: m.id, label: m.fullName })),
              ]}
            />
          </Field>
        ) : null}

        <Field label="Période" htmlFor="carte-periode">
          <Select
            id="carte-periode"
            aria-label="Filtrer par période"
            value={String(period)}
            onChange={(v) => onPeriod((v === 'all' ? 'all' : Number(v)) as MapPeriod)}
            options={PERIOD_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
          />
        </Field>
      </div>
    </WorkspaceCard>
  );
}

export default function SectorMapClient({
  points,
  withoutPosition,
  unplaced,
  agencyPostalCodes,
  center,
  members,
  isDirector,
  initialBanId = null,
  embedded = false,
  itineraryStops: itineraryStopsProp = null,
  showItineraire = false,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  agencyPostalCodes: string[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  initialBanId?: string | null;
  /** Dans Prospection : laisse de la place au sélecteur de vue. */
  embedded?: boolean;
  itineraryStops?: readonly ItineraireStop[] | null;
  showItineraire?: boolean;
}) {
  const router = useRouter();
  const [layers, setLayers] = useState<MapLayerState>(readStoredMapLayers);
  const [layersPanelOpen, setLayersPanelOpen] = useState(readLayersPanelOpen);
  const [postal, setPostal] = useState('tous');
  const [assignedTo, setAssignedTo] = useState('tous');
  const [period, setPeriod] = useState<MapPeriod>('all');
  const [selectedBanId, setSelectedBanId] = useState<string | null>(initialBanId);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const panelTitleRef = useRef<HTMLHeadingElement>(null);
  const geocodeStarted = useRef(false);
  const [storedStops, setStoredStops] = useState<ItineraireStop[] | null>(null);

  useEffect(() => {
    setStoredStops(readItineraireStops());
  }, []);

  const itineraryStops = showItineraire ? (storedStops ?? itineraryStopsProp) : null;
  const { route, waypoints } = useWalkingRoute(itineraryStops);

  const kinds = useMemo(() => activeKindSet(layers), [layers]);
  const cadastreOn = anyCadastreLayer(layers);
  const parcelle = useParcelleMap(cadastreOn, viewport);
  const mapZoom = viewport?.zoom ?? null;

  const filtered = useMemo(
    () =>
      filterMapEntities(points, {
        kinds,
        postalCode: postal,
        assignedTo: isDirector ? assignedTo : 'tous',
        period,
        now: Date.now(),
      }),
    [points, kinds, postal, assignedTo, isDirector, period],
  );

  const filteredAllKinds = useMemo(
    () =>
      filterMapEntities(points, {
        kinds: new Set(MAP_LAYER_ORDER),
        postalCode: postal,
        assignedTo: isDirector ? assignedTo : 'tous',
        period,
        now: Date.now(),
      }),
    [points, postal, assignedTo, isDirector, period],
  );

  const buildings = useMemo(() => groupEntitiesByBanId(filtered), [filtered]);
  const selected = buildings.find((b) => b.banId === selectedBanId) ?? null;

  const counts = useMemo(
    () => countKindsInViewport(filteredAllKinds, null),
    [filteredAllKinds],
  );

  const codes = useMemo(
    () => postalCodesFromPoints(agencyPostalCodes, points),
    [agencyPostalCodes, points],
  );

  const missingTotal = withoutPositionTotal(withoutPosition);

  useEffect(() => {
    persistMapLayers(layers);
  }, [layers]);

  useEffect(() => {
    persistLayersPanelOpen(layersPanelOpen);
  }, [layersPanelOpen]);

  useEffect(() => {
    if (selected) panelTitleRef.current?.focus();
  }, [selected]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedBanId(null);
        setSheetOpen(false);
        setMissingOpen(false);
        parcelle.closeParcelle();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [parcelle.closeParcelle]);

  useEffect(() => {
    if (geocodeStarted.current) return;
    const jobs = unplaced.filter((row) => (row.geocodeQuery ?? '').trim().length >= 3);
    if (jobs.length === 0) return;
    geocodeStarted.current = true;
    const supabase = createSupabaseBrowserClient();
    const cache = createBanGeocodeCache();
    let cancelled = false;
    (async () => {
      let persisted = 0;
      for (const job of jobs) {
        if (cancelled) break;
        const hit = await geocodeAdresse(job.geocodeQuery ?? '', job.postalCode ?? undefined, cache);
        if (!hit) continue;
        const { error } = await supabase
          .from(GEO_TABLE[job.kind])
          .update({
            ban_id: hit.ban_id,
            latitude: hit.lat,
            longitude: hit.lng,
            adresse_normalisee: hit.adresse_normalisee,
            geocode_score: hit.score,
            geocode_le: new Date().toISOString(),
          })
          .eq('id', job.recordId);
        if (!error) persisted += 1;
      }
      if (!cancelled && persisted > 0) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [unplaced, router]);

  function toggleLayer(kind: MapPointKind) {
    setLayers((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  function toggleCadastre() {
    setLayers((prev) => ({ ...prev, cadastre: !prev.cadastre }));
  }

  function toggleCadastreOverlay(id: CadastreLayerId) {
    setLayers((prev) => {
      if (id === 'dpe') return { ...prev, cadastreDpe: !prev.cadastreDpe };
      if (id === 'ventes') return { ...prev, cadastreVentes: !prev.cadastreVentes };
      return { ...prev, cadastreCopro: !prev.cadastreCopro };
    });
  }

  const cadastreLayerFlags = {
    cadastreDpe: layers.cadastreDpe,
    cadastreVentes: layers.cadastreVentes,
    cadastreCopro: layers.cadastreCopro,
  };

  const layersUi = (
    <LayersPanel
      layers={layers}
      onToggle={toggleLayer}
      onToggleCadastre={toggleCadastre}
      onToggleCadastreOverlay={toggleCadastreOverlay}
      mapZoom={mapZoom}
      counts={counts}
      postal={postal}
      onPostal={setPostal}
      codes={codes}
      assignedTo={assignedTo}
      onAssigned={setAssignedTo}
      members={members}
      showAssignee={isDirector}
      period={period}
      onPeriod={setPeriod}
    />
  );

  return (
    <div
      className={
        embedded
          ? 'relative flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col md:-mx-6 md:h-[calc(100dvh-9.5rem)] lg:-mx-8'
          : 'relative -mx-4 flex h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-7.5rem-env(safe-area-inset-bottom,0px))] flex-col md:-m-6 md:h-[calc(100dvh-5rem)] lg:-m-8'
      }
    >
      <div className="relative min-h-0 flex-1">
        <SectorMapCanvas
          buildings={buildings}
          center={center}
          selectedBanId={selectedBanId}
          onSelect={(building) => {
            parcelle.closeParcelle();
            setSelectedBanId(building.banId);
            setSheetOpen(false);
            setMissingOpen(false);
          }}
          onDeselect={() => {
            setSelectedBanId(null);
            parcelle.closeParcelle();
          }}
          onViewport={setViewport}
          itineraryStops={itineraryStops}
          itineraryGeometry={route?.geometry ?? null}
          parcellesEnabled={cadastreOn}
          activeParcelleIds={parcelle.immeubles.map((row) => row.parcelleId).filter((id): id is string => Boolean(id))}
          parcelleNoteMarkers={parcelle.noteMarkers}
          selectedParcelleId={parcelle.selectedParcelleId}
          cadastreImmeubles={parcelle.immeubles}
          cadastreLayers={cadastreLayerFlags}
          onSelectParcelle={(parcelleId) => {
            setSelectedBanId(null);
            setSheetOpen(false);
            setMissingOpen(false);
            parcelle.openParcelle(parcelleId);
          }}
        />

        {itineraryStops && itineraryStops.length >= 2 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 w-[min(100%-1.5rem,380px)]">
            <div className="pointer-events-auto">
              <ItineraireBanner stops={itineraryStops} waypoints={waypoints} route={route} />
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute right-3 top-3 z-20 hidden md:block">
          <div className="pointer-events-auto">
            {layersPanelOpen ? (
              <div className="w-[min(100vw-1.5rem,320px)]">
                <LayersPanel
                  layers={layers}
                  onToggle={toggleLayer}
                  onToggleCadastre={toggleCadastre}
                  onToggleCadastreOverlay={toggleCadastreOverlay}
                  mapZoom={mapZoom}
                  counts={counts}
                  postal={postal}
                  onPostal={setPostal}
                  codes={codes}
                  assignedTo={assignedTo}
                  onAssigned={setAssignedTo}
                  members={members}
                  showAssignee={isDirector}
                  period={period}
                  onPeriod={setPeriod}
                  onCollapse={() => setLayersPanelOpen(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLayersPanelOpen(true)}
                aria-label="Afficher les couches"
                aria-expanded={false}
                title="Couches"
                className="flex size-10 items-center justify-center rounded-clay border border-black/[0.08] bg-surface/95 text-text shadow-clay-sm backdrop-blur-sm transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Layers size={18} strokeWidth={2} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {missingTotal > 0 ? (
          <button
            type="button"
            onClick={() => {
              setMissingOpen(true);
              setSelectedBanId(null);
            }}
            className="absolute left-3 top-3 z-20 rounded-clay border border-black/[0.08] bg-surface/95 px-3 py-2 text-left text-[12.5px] font-medium text-text shadow-clay-sm backdrop-blur-sm hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="tabular-nums text-accent">{missingTotal}</span>
            {missingTotal > 1 ? ' fiches sans position' : ' fiche sans position'}
          </button>
        ) : null}

        <button
          type="button"
          className="absolute bottom-3 left-3 z-20 inline-flex min-h-[44px] items-center gap-2 rounded-clay border border-black/[0.08] bg-surface px-3.5 text-[13.5px] font-semibold text-text shadow-clay-sm md:hidden"
          onClick={() => setSheetOpen(true)}
        >
          <Layers size={16} strokeWidth={2} aria-hidden />
          Couches
        </button>

        {sheetOpen ? (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[75%] overflow-y-auto rounded-t-clay border border-black/[0.08] bg-surface p-4 shadow-clay-lg md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold text-text-strong">Carte</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Fermer"
                className="flex size-9 items-center justify-center rounded-lg text-text-subtle hover:bg-black/[0.04]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            {layersUi}
          </div>
        ) : null}

        {selected ? (
          <aside
            className="absolute inset-x-3 bottom-3 z-20 max-h-[70%] overflow-y-auto rounded-clay border border-black/[0.08] bg-surface p-4 shadow-clay-lg sm:inset-x-auto sm:left-3 sm:top-3 sm:bottom-auto sm:w-[min(100%-1.5rem,360px)] sm:max-h-[calc(100%-1.5rem)]"
            role="dialog"
            aria-labelledby="carte-immeuble-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                  Immeuble
                  {selected.count > 1 ? (
                    <span className="ml-1.5 tabular-nums">· {selected.count} fiches</span>
                  ) : null}
                </p>
                <h2
                  id="carte-immeuble-title"
                  ref={panelTitleRef}
                  tabIndex={-1}
                  className="mt-1 text-balance text-[16px] font-semibold text-text-strong"
                >
                  {selected.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBanId(null)}
                aria-label="Fermer la fiche"
                className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <ImmeubleFacade latitude={selected.latitude} longitude={selected.longitude} />

            <div className="mt-4 flex flex-col gap-4">
              {entitiesByKind(selected.entities.filter((e) => e.kind !== 'note')).map((group) => (
                <section key={group.kind}>
                  <p className="font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                    {group.label}
                    <span className="ml-1.5 tabular-nums">{group.items.length}</span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="block rounded-xl px-2.5 py-2 hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          <p className="truncate text-[13.5px] font-medium text-text-strong">{item.title}</p>
                          {item.subtitle ? (
                            <p className="mt-0.5 truncate text-pretty text-[12.5px] text-text-muted">
                              {item.subtitle}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[11.5px] text-text-subtle">{formatDate(item.occurredAt)}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <p className="mb-3 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                Notes terrain
              </p>
              <NotesTerrainList entiteType="immeuble" entiteId={selected.banId} />
            </div>
          </aside>
        ) : null}

        {missingOpen ? (
          <aside
            className="absolute inset-x-3 bottom-3 z-20 max-h-[70%] overflow-y-auto rounded-clay border border-black/[0.08] bg-surface p-4 shadow-clay-lg sm:inset-x-auto sm:left-3 sm:top-3 sm:w-[min(100%-1.5rem,360px)]"
            role="dialog"
            aria-labelledby="carte-sans-position-title"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="carte-sans-position-title"
                className="text-balance text-[16px] font-semibold text-text-strong"
              >
                Fiches sans position
              </h2>
              <button
                type="button"
                onClick={() => setMissingOpen(false)}
                aria-label="Fermer"
                className="flex size-9 items-center justify-center rounded-lg text-text-subtle hover:bg-black/[0.04]"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-pretty text-[13px] text-text-muted">
              Corrigez l&apos;adresse pour les placer sur la carte.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {(
                [
                  ['lead', 'Prospects', '/dashboard/prospection?filtre=sans-position', withoutPosition.leads],
                  ['contact', 'Contacts', '/dashboard/contacts?filtre=sans-position', withoutPosition.contacts],
                  ['bien', 'Biens', '/dashboard/biens?filtre=sans-position', withoutPosition.biens],
                  ['note', 'Notes terrain', '/dashboard', withoutPosition.notes],
                ] as const
              )
                .filter((row) => row[3] > 0)
                .map(([kind, label, href, count]) => (
                  <li key={kind}>
                    <Link
                      href={href}
                      className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-black/[0.04]"
                    >
                      <span className="text-[13.5px] font-medium text-text-strong">{label}</span>
                      <span className="tabular-nums text-[13px] text-text-subtle">{count}</span>
                    </Link>
                  </li>
                ))}
            </ul>
            {unplaced.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-1 border-t border-black/[0.06] pt-3">
                {unplaced.slice(0, 12).map((row) => (
                  <li key={`${row.kind}:${row.recordId}`}>
                    <Link
                      href={row.href}
                      className="block rounded-xl px-2.5 py-2 hover:bg-black/[0.04]"
                    >
                      <p className="truncate text-[13px] font-medium text-text-strong">{row.title}</p>
                      <p className="text-[11.5px] text-text-subtle">{MAP_LAYER_LABELS[row.kind]}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </aside>
        ) : null}
      </div>
      <ParcelleDrawer
        fiche={parcelle.fiche}
        loading={parcelle.loading}
        onClose={parcelle.closeParcelle}
        onNotesChanged={parcelle.refreshAfterNotes}
      />
    </div>
  );
}
