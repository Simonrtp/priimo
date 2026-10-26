'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { oublierCible, useCibleCarte } from '@/lib/carte/cible';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronUp, Layers, PencilLine, X } from 'lucide-react';
import Switch from '@/components/ui/Switch';
import { createBanGeocodeCache, geocodeAdresse } from '@/lib/geo/ban';
import {
  countKindsInViewport,
  entitiesByKind,
  ficheImmeubleOuverte,
  filterMapEntities,
  groupEntitiesByBanId,
  pointDuLien,
  type BuildingMarker,
  type MapViewport,
  type RepliImmeuble,
} from '@/lib/carte/buildings';
import {
  MAP_LAYER_LABELS,
  MAP_LAYER_ORDER,
  activeKindSet,
  anyCadastreOverlay,
  persistMapLayers,
  persistLayersPanelOpen,
  readLayersPanelOpen,
  readStoredMapLayers,
  showParcellesPlan,
  withCadastreLayerToggled,
  withCadastreMenuToggled,
  withDpeAgeSpan,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import CadastreLayerControls from '@/components/dashboard/carte/CadastreLayerControls';
import { AnnoncesLayerControls, AnnoncesMarqueurs } from '@/components/dashboard/annonces/AnnoncesCoucheCarte';
import AnnonceVolet from '@/components/dashboard/annonces/AnnonceVolet';
import type { Annonce } from '@/lib/annonces/types';
import EmpriseCapsules, { type OngletCarte } from '@/components/dashboard/carte/EmpriseCapsules';
import { useDessinSecteur } from '@/components/dashboard/carte/CarteDessinSecteur';
import { ChoixSecteurs } from '@/components/dashboard/carte/FiltresHautCarte';
import { useParcelleMap } from '@/lib/carte/use-parcelle-map';
import { useImmeublesSuivisCarte } from '@/lib/carte/immeubles-suivis';
import { BOUTON_CARTE_VIDE } from '@/components/dashboard/accueil/CarteVideAccueil';
import {
  aUnSecteurDefini,
  cadastreDansEmprises,
  cadrageCarte,
  empriseDepuisZoneId,
  retientDansSecteur,
  secteursPeintsSurCarte,
  ZONE_TOUS_SECTEURS,
  zoneIdInitial,
  zoneParDefautProspection,
  type PorteeSecteurs,
} from '@/lib/carte/emprise';
import { useCarteSecteurs } from '@/lib/zones/useCarteSecteurs';
import { useUser } from '@/lib/hooks/useUser';
import ImmeubleFacade from '@/components/dashboard/carte/ImmeubleFacade';
import {
  type MapPoint,
  type MapPointKind,
  type UnplacedRecord,
  type WithoutPositionCount,
} from '@/lib/carte/points';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Select from '@/components/ui/Select';
import WorkspaceCard, { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import { Field } from '@/components/dashboard/workspace/Field';
import {
  assigneeSelectAvatar,
  type AssigneeOption,
} from '@/components/dashboard/workspace/AssigneeSelect';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import NotePlusSurPlace from '@/components/dashboard/notes/NotePlusSurPlace';
import ItineraireBanner from '@/components/dashboard/carte/ItineraireBanner';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import { useWalkingRoute } from '@/lib/today/use-walking-route';
import { readItineraireStops, type ItineraireStop } from '@/lib/today/directions';
import { bboxDeZone, bboxVersBounds, fusionnerBbox, type Bbox } from '@/lib/zones/geometrie';
import type { Zone } from '@/lib/zones/types';

const SectorMapCanvas = dynamic(() => import('./SectorMapCanvas'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/[0.04]" aria-hidden />,
});

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
  onToggleCadastreOverlay,
  onChangeDpeAge,
  onToggleCadastreMenu,
  onChangeAnnonces,
  mapZoom,
  counts,
  assignedTo,
  onAssigned,
  members,
  showAssignee,
  onCollapse,
  className = '',
  onglet,
  onOnglet,
  zones,
  zoneId,
  onZone,
  tousSecteurs = false,
  annoncesQui,
  atelier = null,
  onCreerSecteur,
  onModifierSecteur = null,
  secteurConfirme = false,
}: {
  layers: MapLayerState;
  onToggle: (kind: MapPointKind) => void;
  onToggleCadastreOverlay: (id: CadastreLayerId) => void;
  onChangeDpeAge: (from: number, to: number) => void;
  onToggleCadastreMenu: () => void;
  onChangeAnnonces: (patch: Partial<MapLayerState>) => void;
  mapZoom: number | null;
  counts: Record<MapPointKind, number>;
  assignedTo: string;
  onAssigned: (v: string) => void;
  members: readonly AssigneeOption[];
  showAssignee: boolean;
  onCollapse?: () => void;
  className?: string;
  onglet: OngletCarte;
  onOnglet: (next: OngletCarte) => void;
  zones: readonly Zone[];
  zoneId: string;
  onZone: (id: string) => void;
  tousSecteurs?: boolean;
  annoncesQui: { zones: readonly Zone[]; directeur: boolean; profileId: string };
  atelier?: ReactNode;
  onCreerSecteur: () => void;
  /** Le secteur choisi est à moi (ou je dirige) : on peut le retoucher. */
  onModifierSecteur?: (() => void) | null;
  /** Secteur vient d’être validé : les filtres s’affichent avant le rafraîchissement. */
  secteurConfirme?: boolean;
}) {
  const secteurVide = onglet === 'mes' && !secteurConfirme && !aUnSecteurDefini(zones);
  return (
    <WorkspaceCard className={`flex min-h-0 flex-col overflow-hidden !px-3.5 !py-3.5 ${className}`}>
      <div className="flex shrink-0 items-start justify-between gap-2">
        <CardEyebrow>Couches</CardEyebrow>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Replier les couches"
            aria-expanded
            title="Replier les couches"
            className="-mr-1 -mt-0.5 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Replier
            <ChevronUp size={14} strokeWidth={2} aria-hidden className="transition-transform duration-fluid-subtle ease-in-out" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {atelier ? null : (
          <EmpriseCapsules value={onglet} onChange={onOnglet} />
        )}
        {secteurVide ? (
          atelier ?? (
            <button type="button" onClick={onCreerSecteur} className={`${BOUTON_CARTE_VIDE} w-full`}>
              Créer mon secteur
            </button>
          )
        ) : (
        atelier ?? (
        <>
        <ul className="flex flex-col gap-1.5">
          {MAP_LAYER_ORDER.map((kind) => {
            const active = layers[kind];
            return (
              <li key={kind}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => onToggle(kind)}
                  className={`flex min-h-[40px] w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors duration-fluid-subtle ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56] ${
                    active ? 'bg-blue/10' : 'hover:bg-black/[0.03]'
                  }`}
                >
                  <Switch checked={active} />
                  <span
                    className={`min-w-0 flex-1 text-[13.5px] font-medium ${active ? 'text-text-strong' : 'text-text-muted'}`}
                  >
                    {MAP_LAYER_LABELS[kind]}
                  </span>
                  <span className="tabular-nums text-[12.5px] text-text-subtle">{counts[kind]}</span>
                </button>
              </li>
            );
          })}
          <CadastreLayerControls
            layers={layers}
            onToggleLayer={onToggleCadastreOverlay}
            onChangeDpeAge={onChangeDpeAge}
            onToggleMenu={onToggleCadastreMenu}
            mapZoom={mapZoom}
          />
          <AnnoncesLayerControls layers={layers} onChange={onChangeAnnonces} qui={annoncesQui} />
          {onglet === 'code_postal' ? null : (
            <>
              <ChoixSecteurs
                zones={zones}
                zoneId={zoneId}
                onZone={onZone}
                tous={tousSecteurs}
                profileId={annoncesQui.profileId}
                membres={members}
                onCreer={onCreerSecteur}
              />
              {onModifierSecteur ? (
                <li className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={onModifierSecteur}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-black/[0.04] px-3 text-[12.5px] font-semibold text-text-strong transition-colors duration-fluid-subtle hover:bg-black/[0.07]"
                  >
                    <PencilLine size={14} strokeWidth={2.2} aria-hidden />
                    Modifier ce secteur
                  </button>
                </li>
              ) : null}
            </>
          )}
        </ul>

        <div className="mt-4 flex flex-col gap-3 border-t border-black/[0.06] pt-4">
          {showAssignee ? (
            <Field label="Assigné à" htmlFor="carte-assigne">
              <Select
                id="carte-assigne"
                aria-label="Filtrer par membre"
                value={assignedTo}
                onChange={onAssigned}
                options={[
                  { value: 'tous', label: "Toute l'équipe" },
                  ...members.map((m) => ({
                    value: m.id,
                    label: m.fullName,
                    avatar: assigneeSelectAvatar(m),
                  })),
                ]}
              />
            </Field>
          ) : null}

        </div>
        </>
        )
        )}
      </div>
    </WorkspaceCard>
  );
}

export default function SectorMapClient({
  points,
  withoutPosition: _withoutPosition,
  unplaced,
  center,
  members,
  isDirector,
  initialBanId = null,
  initialBanPos = null,
  initialParcelleId = null,
  embedded = false,
  viewSwitcher = null,
  itineraryStops: itineraryStopsProp = null,
  showItineraire = false,
  zones = [],
  initialZoneId = null,
  initialAtelier = null,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  initialBanId?: string | null;
  /** Point de l'immeuble quand il n'est pas déjà une pastille de la carte. */
  initialBanPos?: RepliImmeuble | null;
  /** Ouvre le volet de cette parcelle dès l'arrivée. */
  initialParcelleId?: string | null;
  /** Dans Prospection : carte plein cadre, sans bandeau au-dessus. */
  embedded?: boolean;
  /** Liste / Pipeline / Carte — overlay haut-droite sur la carte. */
  viewSwitcher?: ReactNode;
  itineraryStops?: readonly ItineraireStop[] | null;
  showItineraire?: boolean;
  zones?: readonly Zone[];
  initialZoneId?: string | null;
  /** « nouveau », ou le secteur à retoucher : l'atelier s'ouvre dès l'arrivée. */
  initialAtelier?: string | null;
}) {
  const router = useRouter();
  const { profile } = useUser();
  const profileId = profile?.id ?? '';
  const [layers, setLayers] = useState<MapLayerState>(readStoredMapLayers);
  const [layersPanelOpen, setLayersPanelOpen] = useState(readLayersPanelOpen);
  const [zoneId, setZoneId] = useState(() => zoneIdInitial(initialZoneId, zones));
  // Venu de l'Accueil (« Modifier les parcelles », « Créer mon secteur ») : l'atelier est déjà ouvert.
  const zoneARetoucher = initialAtelier ? (zones.find((z) => z.id === initialAtelier) ?? null) : null;
  const [atelier, setAtelier] = useState(initialAtelier === 'nouveau' || zoneARetoucher !== null);
  const [atelierZone, setAtelierZone] = useState<Zone | null>(zoneARetoucher);
  const [portee, setPortee] = useState<PorteeSecteurs>('mes');
  const [onglet, setOnglet] = useState<OngletCarte>(() =>
    empriseDepuisZoneId(zoneIdInitial(initialZoneId, zones)) === 'code_postal' ? 'code_postal' : 'mes',
  );
  const [secteurConfirme, setSecteurConfirme] = useState(false);
  const [assignedTo, setAssignedTo] = useState('tous');
  const [selectedBanId, setSelectedBanId] = useState<string | null>(initialBanId);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const cible = useCibleCarte();
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const panelTitleRef = useRef<HTMLHeadingElement>(null);
  const geocodeStarted = useRef(false);
  const [storedStops, setStoredStops] = useState<ItineraireStop[] | null>(null);

  useEffect(() => {
    setStoredStops(readItineraireStops());
  }, []);

  const itineraryStops = showItineraire ? (storedStops ?? itineraryStopsProp) : null;
  const { route, waypoints } = useWalkingRoute(itineraryStops);

  const kinds = useMemo(() => activeKindSet(layers), [layers]);
  // Pastilles DPE/ventes/copro : fetch seulement si une couche est cochée.
  // Le plan PCI + clic parcelle → volet marche sans elles.
  const overlaysCadastre = anyCadastreOverlay(layers);
  const planParcelles = showParcellesPlan(layers);
  const parcelle = useParcelleMap(overlaysCadastre, viewport, {
    dpeAges: layers.cadastreDpeAges,
    includeDpeDetail: layers.cadastreDpe,
    includeVentes: layers.cadastreVentes,
  });
  const voletOuvertRef = useRef(false);
  voletOuvertRef.current = selectedBanId != null || parcelle.fiche != null || parcelle.loading;
  const fermerVolet = useCallback(() => {
    setFocusNoteId(null);
    setSelectedBanId(null);
    setSheetOpen(false);
    parcelle.closeParcelle();
    oublierCible();
  }, [parcelle.closeParcelle]);
  const { suivis: immeublesSuivis, recharger: rechargerSuivis } = useImmeublesSuivisCarte();
  const suiviParcelleIds = useMemo(
    () => immeublesSuivis.map((s) => s.parcelleId),
    [immeublesSuivis],
  );
  const mapZoom = viewport?.zoom ?? null;
  const cadre = useMemo(
    () => cadrageCarte({ zoneId, zones, profileId, directeur: isDirector, portee }),
    [zoneId, zones, profileId, isDirector, portee],
  );
  const { proposes, voirTous, zoneChoisie, affiches } = cadre;
  const carteSecteurs = useCarteSecteurs();
  const secteursPeints = useMemo(
    () => secteursPeintsSurCarte(zones, profileId, isDirector, onglet, affiches),
    [zones, profileId, isDirector, onglet, affiches],
  );
  const secteursAffiches = useMemo(() => new Set(secteursPeints.map((z) => z.id)), [secteursPeints]);
  const validerDessin = useCallback((id: string) => {
    setSecteurConfirme(true);
    setAtelier(false);
    setPortee('mes');
    setOnglet('mes');
    setZoneId(id);
    router.refresh();
  }, [router]);
  const fermerAtelier = useCallback(() => setAtelier(false), []);
  const apresSuppression = useCallback(() => {
    setAtelier(false);
    setAtelierZone(null);
    setZoneId(ZONE_TOUS_SECTEURS);
    router.refresh();
  }, [router]);
  const dessin = useDessinSecteur({
    ouvert: atelier,
    zone: atelierZone,
    zones,
    carte: carteSecteurs,
    centre: center,
    onValider: validerDessin,
    onFermer: fermerAtelier,
    onSupprime: apresSuppression,
  });
  const { surVue } = dessin;
  useEffect(() => {
    if (atelier && viewport) surVue(viewport);
  }, [atelier, viewport, surVue]);
  const ouvrirAtelier = (zone: Zone | null) => {
    setAtelierZone(zone);
    setAtelier(true);
  };
  const modifierSecteur =
    zoneChoisie && (isDirector || (zoneChoisie.assignedTo === profileId && !zoneChoisie.verrouillee))
      ? () => ouvrirAtelier(zoneChoisie)
      : null;
  const annoncesQui = useMemo(
    () => ({
      zones,
      directeur: isDirector,
      profileId,
      zoneCadree: zoneChoisie,
      zonesCadrees: voirTous ? affiches : null,
      toutLeCodePostal: onglet === 'code_postal',
    }),
    [zones, isDirector, profileId, zoneChoisie, voirTous, affiches, onglet],
  );
  const pointsDuSecteur = useMemo(
    () =>
      affiches.length > 0
        ? points.filter((p) => affiches.some((z) => retientDansSecteur(p, z)))
        : points,
    [points, affiches],
  );
  const focusBounds = useMemo(() => {
    const boite = fusionnerBbox(affiches.map(bboxDeZone).filter((b): b is Bbox => b !== null));
    return boite ? bboxVersBounds(boite) : null;
  }, [affiches]);

  const filtered = useMemo(
    () =>
      filterMapEntities(pointsDuSecteur, {
        kinds,
        assignedTo: isDirector ? assignedTo : 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [pointsDuSecteur, kinds, assignedTo, isDirector],
  );

  const filteredAllKinds = useMemo(
    () =>
      filterMapEntities(pointsDuSecteur, {
        kinds: new Set(MAP_LAYER_ORDER),
        assignedTo: isDirector ? assignedTo : 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [pointsDuSecteur, assignedTo, isDirector],
  );

  const buildings = useMemo(() => groupEntitiesByBanId(filtered), [filtered]);
  const selected = useMemo(
    () => ficheImmeubleOuverte(buildings, selectedBanId, initialBanPos),
    [buildings, selectedBanId, initialBanPos],
  );
  const focusLien = useMemo(
    () =>
      pointDuLien({
        parcelleDemandee: initialParcelleId,
        parcelleOuverte: parcelle.fiche,
        immeuble: selected,
        immeubleDemande: initialBanId,
      }),
    [initialParcelleId, parcelle.fiche, selected, initialBanId],
  );

  const counts = useMemo(
    () => countKindsInViewport(filteredAllKinds, null),
    [filteredAllKinds],
  );

  useEffect(() => {
    persistMapLayers(layers);
  }, [layers]);

  useEffect(() => {
    persistLayersPanelOpen(layersPanelOpen);
  }, [layersPanelOpen]);

  useEffect(() => {
    if (selected) panelTitleRef.current?.focus();
  }, [selected]);

  const parcelleOuverte = useRef(false);
  useEffect(() => {
    if (!initialParcelleId || parcelleOuverte.current) return;
    parcelleOuverte.current = true;
    parcelle.openParcelle(initialParcelleId);
  }, [initialParcelleId, parcelle.openParcelle]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (e.target instanceof Element && e.target.closest('[data-recherche-adresse]')) return;
      if (voletOuvertRef.current) {
        fermerVolet();
        return;
      }
      setSelectedBanId(null);
      setSheetOpen(false);
      parcelle.closeParcelle();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [parcelle.closeParcelle, fermerVolet]);

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

  function toggleCadastreOverlay(id: CadastreLayerId) {
    setLayers((prev) => withCadastreLayerToggled(prev, id));
  }

  function changeDpeAge(from: number, to: number) {
    setLayers((prev) => withDpeAgeSpan(prev, from, to));
  }

  function toggleCadastreMenu() {
    setLayers((prev) => withCadastreMenuToggled(prev));
  }

  function changeAnnonces(patch: Partial<MapLayerState>) {
    setLayers((prev) => ({ ...prev, ...patch }));
    setAnnonceOuverte(null);
  }

  const [annonceOuverte, setAnnonceOuverte] = useState<{ annonce: Annonce; soeurs: Annonce[] } | null>(null);

  function choisirOnglet(next: OngletCarte) {
    setAtelier(false);
    setOnglet(next);
    if (next === 'code_postal') {
      setZoneId('aucun');
      return;
    }
    setPortee(next);
    setZoneId(zoneParDefautProspection(zones, profileId, isDirector, next) ?? 'aucun');
  }

  const cadastreImmeubles = useMemo(
    () => parcelle.immeubles.filter((row) => cadastreDansEmprises(row, affiches.length > 0 ? affiches : null)),
    [parcelle.immeubles, affiches],
  );
  const activeParcelleIds = useMemo(
    () => cadastreImmeubles.map((row) => row.parcelleId).filter((id): id is string => Boolean(id)),
    [cadastreImmeubles],
  );
  const parcelleNoteMarkers = useMemo(
    () => parcelle.noteMarkers.filter((row) => cadastreDansEmprises(row, affiches.length > 0 ? affiches : null)),
    [parcelle.noteMarkers, affiches],
  );

  const ouvrirDepuisMarqueur = useCallback(
    async (building: BuildingMarker) => {
      const note = building.appearance.kind === 'note' ? building.appearance : null;
      if (!note) {
        setFocusNoteId(null);
        parcelle.closeParcelle();
        setSelectedBanId(building.banId);
        setSheetOpen(false);
        return;
      }

      setSelectedBanId(null);
      setSheetOpen(false);
      const params = new URLSearchParams({
        ban: building.banId,
        lat: String(building.latitude),
        lon: String(building.longitude),
      });
      if (building.postalCode) params.set('cp', building.postalCode);
      try {
        const res = await fetch(`/api/carte/parcelle-au-point?${params.toString()}`);
        const data = (await res.json()) as { parcelleId?: string | null; surfaceM2?: number | null };
        if (!res.ok || !data.parcelleId) throw new Error('parcelle');
        setFocusNoteId(note.recordId);
        parcelle.openParcelle(data.parcelleId, { surfaceM2: data.surfaceM2 ?? null });
      } catch {
        setFocusNoteId(null);
        setSelectedBanId(building.banId);
      }
    },
    [parcelle],
  );

  const cadastreLayerFlags = {
    cadastreDpe: layers.cadastreDpe,
    cadastreVentes: layers.cadastreVentes,
    cadastreCopro: layers.cadastreCopro,
    cadastreDpeAges: layers.cadastreDpeAges,
  };

  const layersUi = (
    <LayersPanel
      layers={layers}
      onToggle={toggleLayer}
      onToggleCadastreOverlay={toggleCadastreOverlay}
      onChangeDpeAge={changeDpeAge}
      onToggleCadastreMenu={toggleCadastreMenu}
      onChangeAnnonces={changeAnnonces}
      mapZoom={mapZoom}
      counts={counts}
      assignedTo={assignedTo}
      onAssigned={setAssignedTo}
      members={members}
      showAssignee={isDirector}
      onglet={onglet}
      onOnglet={choisirOnglet}
      zones={proposes}
      tousSecteurs={isDirector}
      annoncesQui={annoncesQui}
      zoneId={zoneId}
      onZone={setZoneId}
      atelier={dessin.panneau}
      onCreerSecteur={() => ouvrirAtelier(null)}
      onModifierSecteur={modifierSecteur}
      secteurConfirme={secteurConfirme}
    />
  );

  return (
    <div
      className={
        embedded
          ? 'relative flex min-h-0 flex-1 flex-col'
          : 'relative -mx-4 flex h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-7.5rem-env(safe-area-inset-bottom,0px))] flex-col md:-m-6 md:h-[calc(100dvh-5rem)] lg:-m-8'
      }
    >
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[32px]">
        <SectorMapCanvas
          buildings={buildings}
          center={center}
          cible={cible}
          focus={focusLien}
          tenirLaVue={Boolean(initialParcelleId) || Boolean(focusLien)}
          selectedBanId={selectedBanId}
          onSelect={(building) => {
            void ouvrirDepuisMarqueur(building);
          }}
          onDeselect={() => {
            if (selectedBanId != null || parcelle.fiche != null || parcelle.loading) {
              fermerVolet();
              return;
            }
            setFocusNoteId(null);
            setSelectedBanId(null);
            parcelle.closeParcelle();
          }}
          onViewport={setViewport}
          itineraryStops={itineraryStops}
          itineraryGeometry={route?.geometry ?? null}
          // Une parcelle ouverte (par la recherche, plan éteint) reste détourée.
          parcellesEnabled={planParcelles || Boolean(parcelle.selectedParcelleId)}
          activeParcelleIds={activeParcelleIds}
          suiviParcelleIds={suiviParcelleIds}
          parcelleNoteMarkers={parcelleNoteMarkers}
          selectedParcelleId={parcelle.selectedParcelleId}
          cadastreImmeubles={cadastreImmeubles}
          cadastreLayers={cadastreLayerFlags}
          showBuildingMarkers={!overlaysCadastre}
          onSelectParcelle={(parcelleId, extra) => {
            setFocusNoteId(null);
            setSelectedBanId(null);
            setSheetOpen(false);
            parcelle.openParcelle(parcelleId, extra);
          }}
          onPrefetchParcelle={parcelle.prefetchParcelle}
          focusBounds={focusBounds}
          zones={affiches}
          highlightedZoneId={zoneChoisie?.id ?? null}
          clipZones={affiches.length > 0 ? affiches : null}
          dessin={
            atelier
              ? {
                  couleur: dessin.couleur,
                  entourer: dessin.outil === 'entourer',
                  onContour: dessin.poserContour,
                  onParcelle: dessin.toucherParcelle,
                  calque: dessin.calque,
                }
              : null
          }
          secteurs={{ carte: carteSecteurs, affichees: secteursAffiches }}
          annoncesCouche={{
            layers,
            zones,
            zoneCadree: zoneChoisie,
            zonesCadrees: voirTous ? affiches : null,
            toutLeCodePostal: onglet === 'code_postal',
            directeur: isDirector,
            profileId,
            onChoisir: (annonce, soeurs) => setAnnonceOuverte({ annonce, soeurs }),
            ouverteId: annonceOuverte?.annonce.id ?? null,
          }}
        />

        {itineraryStops && itineraryStops.length >= 2 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 w-[min(100%-1.5rem,380px)] md:max-w-[calc(100%-22.5rem)]">
            <div className="pointer-events-auto">
              <ItineraireBanner stops={itineraryStops} waypoints={waypoints} route={route} />
            </div>
          </div>
        ) : null}

        {annonceOuverte ? (
          <div className="pointer-events-auto absolute bottom-3 left-3 z-30 flex max-h-[min(70%,520px)] w-[min(100%-1.5rem,340px)] flex-col md:max-w-[calc(100%-22.5rem)]">
            <AnnonceVolet
              annonce={annonceOuverte.annonce}
              soeurs={annonceOuverte.soeurs}
              onFermer={() => setAnnonceOuverte(null)}
            />
          </div>
        ) : null}

        {viewSwitcher ? (
          <div className="pointer-events-auto absolute top-0 right-0 z-30 isolate">
            {viewSwitcher}
          </div>
        ) : null}

        <div
          className={
            layersPanelOpen
              ? `pointer-events-none absolute bottom-3 right-3 z-20 hidden w-[min(100%-1.5rem,320px)] md:block ${
                  viewSwitcher ? 'top-14' : 'top-3'
                }`
              : `pointer-events-none absolute right-3 z-20 hidden md:block ${
                  viewSwitcher ? 'top-14' : 'top-3'
                }`
          }
        >
          {layersPanelOpen ? (
            <div className="pointer-events-auto flex h-full min-h-0 flex-col">
              <LayersPanel
                className="h-full shadow-clay-sm"
                layers={layers}
                onToggle={toggleLayer}
                onToggleCadastreOverlay={toggleCadastreOverlay}
                onChangeDpeAge={changeDpeAge}
                onToggleCadastreMenu={toggleCadastreMenu}
                onChangeAnnonces={changeAnnonces}
                mapZoom={mapZoom}
                counts={counts}
                assignedTo={assignedTo}
                onAssigned={setAssignedTo}
                members={members}
                showAssignee={isDirector}
                onglet={onglet}
                onOnglet={choisirOnglet}
                zones={proposes}
                tousSecteurs={isDirector}
                annoncesQui={annoncesQui}
                zoneId={zoneId}
                onZone={setZoneId}
                atelier={dessin.panneau}
                onCreerSecteur={() => ouvrirAtelier(null)}
                onModifierSecteur={modifierSecteur}
                secteurConfirme={secteurConfirme}
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
              className="pointer-events-auto flex size-11 items-center justify-center rounded-clay bg-[#1A2A56] text-white shadow-[0_10px_24px_-8px_rgba(26,42,86,0.55)] ring-2 ring-white transition-transform duration-fluid-subtle ease-in-out hover:scale-[1.04] hover:bg-[#243667] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Layers size={19} strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>

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
            className="absolute bottom-3 left-3 right-3 z-20 max-h-[70%] overflow-y-auto rounded-clay border border-black/[0.08] bg-surface p-4 shadow-clay-lg md:right-[21.5rem] lg:bottom-auto lg:top-3 lg:right-auto lg:max-h-[calc(100%-1.5rem)] lg:w-[min(360px,calc(100%-22.5rem))]"
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
                onClick={fermerVolet}
                aria-label="Fermer la fiche"
                className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
              <NotePlusSurPlace adresse={selected.title} banId={selected.banId} />
              <NotesTerrainList entiteType="immeuble" entiteId={selected.banId} />
            </div>
          </aside>
        ) : null}

        <ParcelleDrawer
          fiche={parcelle.fiche}
          loading={parcelle.loading}
          onClose={fermerVolet}
          onNotesChanged={parcelle.refreshAfterNotes}
          onSuiviChanged={rechargerSuivis}
          focusNoteId={focusNoteId}
        />
      </div>
    </div>
  );
}
