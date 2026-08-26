'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Locate, Navigation, Phone, Search, X } from 'lucide-react';
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
  readStoredMapLayers,
  withCadastreToggled,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import CadastreLayerControls from '@/components/dashboard/carte/CadastreLayerControls';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';
import {
  withoutPositionTotal,
  type MapPoint,
  type MapPointKind,
  type UnplacedRecord,
  type WithoutPositionCount,
} from '@/lib/carte/points';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { readDevicePosition } from '@/lib/voice/gps';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import { useAssistant } from '@/components/dashboard/assistant/AssistantProvider';
import { AssistantMobileSearchBar } from '@/components/dashboard/assistant/AssistantSearchButton';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import ImmeubleFacade from '@/components/dashboard/carte/ImmeubleFacade';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import MobileMapCanvas, { type MobileMapHandle } from './MobileMapCanvas';
import MobileSheet from './MobileSheet';
import MobileAccountMenu, { AvatarButton } from './MobileAccountMenu';
import CreateMenu from '@/components/dashboard/create/CreateMenu';
import ItineraireBanner from '@/components/dashboard/carte/ItineraireBanner';
import { useWalkingRoute } from '@/lib/today/use-walking-route';
import { readItineraireStops, type ItineraireStop } from '@/lib/today/directions';

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

function firstPhone(entities: readonly MapPoint[]): string | null {
  for (const item of entities) {
    if (item.phone) return item.phone;
  }
  return null;
}

export default function CarteMobile({
  points,
  withoutPosition,
  unplaced,
  center,
  initialBanId = null,
  fillParent = false,
  hideAccount = false,
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
  fillParent?: boolean;
  hideAccount?: boolean;
  itineraryStops?: readonly ItineraireStop[] | null;
  showItineraire?: boolean;
}) {
  const router = useRouter();
  const { openCapture } = useVoiceCapture();
  const { openMobileSearch, mobileSearchOpen, closeMobileSearch } = useAssistant();
  const mapApi = useRef<MobileMapHandle | null>(null);

  const [layers, setLayers] = useState<MapLayerState>(readStoredMapLayers);
  const [selectedBanId, setSelectedBanId] = useState<string | null>(initialBanId);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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
        postalCode: 'tous',
        assignedTo: 'tous',
        period: 'all' as MapPeriod,
        now: Date.now(),
      }),
    [points, kinds],
  );
  const filteredAllKinds = useMemo(
    () =>
      filterMapEntities(points, {
        kinds: new Set(MAP_LAYER_ORDER),
        postalCode: 'tous',
        assignedTo: 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [points],
  );
  const buildings = useMemo(() => groupEntitiesByBanId(filtered), [filtered]);
  const selected = buildings.find((b) => b.banId === selectedBanId) ?? null;
  const counts = useMemo(
    () => countKindsInViewport(filteredAllKinds, null),
    [filteredAllKinds],
  );
  const missingTotal = withoutPositionTotal(withoutPosition);

  useEffect(() => {
    persistMapLayers(layers);
  }, [layers]);

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

  const phone = selected ? firstPhone(selected.entities) : null;
  const floatBottom = 12;

  return (
    <div
      className={
        fillParent
          ? 'relative h-full overflow-hidden overscroll-none bg-soft-cool'
          : 'field-map fixed inset-x-0 top-0 overflow-hidden overscroll-none bg-soft-cool'
      }
      style={fillParent ? undefined : { height: 'calc(100dvh - var(--field-nav-height))' }}
    >
      <MobileMapCanvas
        buildings={buildings}
        center={center}
        selectedBanId={selectedBanId}
        mapRef={mapApi}
        onSelect={(building) => {
          parcelle.closeParcelle();
          setSelectedBanId(building.banId);
          setLayersOpen(false);
          setMissingOpen(false);
        }}
        onDeselect={() => {
          setSelectedBanId(null);
          parcelle.closeParcelle();
        }}
        onViewport={setViewport}
        onCluster={(children) => mapApi.current?.fitGroup(children)}
        itineraryStops={itineraryStops}
        itineraryGeometry={route?.geometry ?? null}
        parcellesEnabled={cadastreOn}
        activeParcelleIds={parcelle.immeubles.map((row) => row.parcelleId).filter((id): id is string => Boolean(id))}
        parcelleNoteMarkers={parcelle.noteMarkers}
        selectedParcelleId={parcelle.selectedParcelleId}
        cadastreImmeubles={parcelle.immeubles}
        cadastreLayers={{
          cadastreDpe: layers.cadastreDpe,
          cadastreVentes: layers.cadastreVentes,
          cadastreCopro: layers.cadastreCopro,
        }}
        onSelectParcelle={(parcelleId) => {
          setSelectedBanId(null);
          setLayersOpen(false);
          setMissingOpen(false);
          parcelle.openParcelle(parcelleId);
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 z-20 px-4"
        style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-md">
          <button
            type="button"
            onClick={openMobileSearch}
            className="app-press flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-1 text-left"
            aria-label="Rechercher une adresse, un contact"
          >
            <Search size={18} strokeWidth={2} className="flex-shrink-0 text-text-muted" aria-hidden />
            <span className="truncate text-[14px] text-text-muted">
              Rechercher une adresse, un contact
            </span>
          </button>
          {!hideAccount ? (
            <>
              <CreateMenu compact />
              <AvatarButton onClick={() => setAccountOpen(true)} />
            </>
          ) : null}
        </div>
        {itineraryStops && itineraryStops.length >= 2 ? (
          <div className="pointer-events-auto mt-2">
            <ItineraireBanner stops={itineraryStops} waypoints={waypoints} route={route} />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          setLayersOpen(true);
          setSelectedBanId(null);
        }}
        aria-label="Couches"
        className="app-press absolute left-4 z-20 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
        style={{ bottom: floatBottom }}
      >
        <Layers size={20} strokeWidth={2} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => {
          void readDevicePosition().then((pos) => {
            if (pos) mapApi.current?.recenter(pos);
          });
        }}
        aria-label="Recentrer sur ma position"
        className="app-press absolute right-4 z-20 flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
        style={{ bottom: floatBottom }}
      >
        <Locate size={20} strokeWidth={2} aria-hidden />
      </button>

      <MobileSheet
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        title="Couches"
        initialSnap={1}
      >
        <ul className="flex flex-col gap-1">
          {MAP_LAYER_ORDER.map((kind) => {
            const active = layers[kind];
            return (
              <li key={kind}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-1">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-black/20"
                    style={{ accentColor: '#E8743C' }}
                    checked={active}
                    onChange={() => setLayers((prev) => ({ ...prev, [kind]: !prev[kind] }))}
                  />
                  <span className={`flex-1 text-[14.5px] font-medium ${active ? 'text-text-strong' : 'text-text-muted'}`}>
                    {MAP_LAYER_LABELS[kind]}
                  </span>
                  <span className="tabular-nums text-[13px] text-text-subtle">{counts[kind]}</span>
                </label>
              </li>
            );
          })}
          <CadastreLayerControls
            layers={layers}
            onToggleCadastre={() =>
              setLayers((prev) => {
                const next = withCadastreToggled(prev);
                persistMapLayers(next);
                return next;
              })
            }
            onToggleOverlay={(id: CadastreLayerId) =>
              setLayers((prev) => {
                const next =
                  id === 'dpe'
                    ? { ...prev, cadastreDpe: !prev.cadastreDpe }
                    : id === 'ventes'
                      ? { ...prev, cadastreVentes: !prev.cadastreVentes }
                      : { ...prev, cadastreCopro: !prev.cadastreCopro };
                persistMapLayers(next);
                return next;
              })
            }
            mapZoom={mapZoom}
            compact
          />
        </ul>
        {missingTotal > 0 ? (
          <button
            type="button"
            onClick={() => {
              setLayersOpen(false);
              setMissingOpen(true);
            }}
            className="app-press mt-4 flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-left"
          >
            <span className="text-[14.5px] font-medium text-text">Fiches sans position</span>
            <span className="tabular-nums text-[13px] text-accent">{missingTotal}</span>
          </button>
        ) : null}
      </MobileSheet>

      <MobileSheet
        open={Boolean(selected)}
        onClose={() => setSelectedBanId(null)}
        title={selected?.title ?? 'Immeuble'}
        initialSnap={1}
        footer={
          selected ? (
            <div className="flex gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="app-press flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay bg-black/[0.05] text-[13.5px] font-semibold text-text"
              >
                <Navigation size={16} strokeWidth={2} aria-hidden />
                Itinéraire
              </a>
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s+/g, '')}`}
                  className="app-press flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-clay bg-black/[0.05] text-[13.5px] font-semibold text-text"
                >
                  <Phone size={16} strokeWidth={2} aria-hidden />
                  Appeler
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => openCapture({ adresse: selected.title })}
                className="app-press flex min-h-[44px] flex-1 items-center justify-center rounded-clay bg-accent text-[13.5px] font-semibold text-white"
              >
                Dicter ici
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <ImmeubleFacade latitude={selected.latitude} longitude={selected.longitude} />
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
                        className="block rounded-xl px-2 py-2 field-fiche-enter"
                      >
                        <p className="truncate text-[14px] font-medium text-text-strong">{item.title}</p>
                        {item.subtitle ? (
                          <p className="mt-0.5 truncate text-[12.5px] text-text-muted">{item.subtitle}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11.5px] text-text-subtle">{formatDate(item.occurredAt)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <section>
              <p className="mb-2 font-semibold uppercase text-text-subtle" style={{ fontSize: 11 }}>
                Notes terrain
              </p>
              <NotesTerrainList entiteType="immeuble" entiteId={selected.banId} />
            </section>
          </div>
        ) : null}
      </MobileSheet>

      <MobileSheet
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        title="Fiches sans position"
        initialSnap={1}
      >
        <p className="mb-3 text-pretty text-[13px] text-text-muted">
          Corrigez l&apos;adresse pour les placer sur la carte.
        </p>
        <ul className="flex flex-col gap-1">
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
                  className="flex min-h-[44px] items-center justify-between rounded-xl px-1"
                >
                  <span className="text-[14.5px] font-medium text-text-strong">{label}</span>
                  <span className="tabular-nums text-[13px] text-text-subtle">{count}</span>
                </Link>
              </li>
            ))}
        </ul>
        {unplaced.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-1 border-t border-black/[0.06] pt-3">
            {unplaced.slice(0, 12).map((row) => (
              <li key={`${row.kind}:${row.recordId}`}>
                <Link href={row.href} className="block rounded-xl px-1 py-2">
                  <p className="truncate text-[13.5px] font-medium text-text-strong">{row.title}</p>
                  <p className="text-[11.5px] text-text-subtle">{MAP_LAYER_LABELS[row.kind]}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </MobileSheet>

      {mobileSearchOpen ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-surface"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 py-2">
            <div className="min-w-0 flex-1">
              <AssistantMobileSearchBar />
            </div>
            <button
              type="button"
              onClick={closeMobileSearch}
              aria-label="Fermer la recherche"
              className="app-press flex size-11 items-center justify-center rounded-full text-text"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
      <ParcelleDrawer
        fiche={parcelle.fiche}
        loading={parcelle.loading}
        onClose={parcelle.closeParcelle}
        onNotesChanged={parcelle.refreshAfterNotes}
      />
    </div>
  );
}
