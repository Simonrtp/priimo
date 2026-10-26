'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCibleCarte } from '@/lib/carte/cible';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Layers, Locate, Navigation, Navigation2, PencilLine, Phone, Play, Plus, Square, X } from 'lucide-react';
import { toast } from 'sonner';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import Switch from '@/components/ui/Switch';
import { createBanGeocodeCache, geocodeAdresse, reverseGeocode } from '@/lib/geo/ban';
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
  readStoredMapLayers,
  showParcellesPlan,
  withCadastreLayerToggled,
  withCadastreMenuToggled,
  withDpeAgeSpan,
  type CadastreLayerId,
  type MapLayerState,
} from '@/lib/carte/layers';
import CadastreLayerControls from '@/components/dashboard/carte/CadastreLayerControls';
import { AnnoncesLayerControls } from '@/components/dashboard/annonces/AnnoncesCoucheCarte';
import AnnonceVolet from '@/components/dashboard/annonces/AnnonceVolet';
import type { Annonce } from '@/lib/annonces/types';
import EmpriseCapsules, { type OngletCarte } from '@/components/dashboard/carte/EmpriseCapsules';
import { useCarteSecteurs } from '@/lib/zones/useCarteSecteurs';
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
  zoneIdInitial,
  zoneParDefautProspection,
  type PorteeSecteurs,
} from '@/lib/carte/emprise';
import { zoneProspectionParDefaut } from '@/lib/zones/jour';
import {
  type MapPoint,
  type MapPointKind,
  type UnplacedRecord,
  type WithoutPositionCount,
} from '@/lib/carte/points';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { requestDevicePosition } from '@/lib/voice/gps';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';
import NotePlusSurPlace from '@/components/dashboard/notes/NotePlusSurPlace';
import ImmeubleFacade from '@/components/dashboard/carte/ImmeubleFacade';
import { ParcelleDrawer } from '@/components/dashboard/carte/ParcellePanel';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import MobileMapCanvas, { type MobileMapHandle, type VueCarte } from './MobileMapCanvas';
import MobileSheet from './MobileSheet';
import MobileAccountMenu from './MobileAccountMenu';
import MobileSearchCapsule from './MobileSearchCapsule';
import ItineraireBanner from '@/components/dashboard/carte/ItineraireBanner';
import { useWalkingRoute } from '@/lib/today/use-walking-route';
import type { GeoCoord } from '@/lib/carte/coords';
import CarteTourneeBriefCard from './CarteTourneeBriefCard';
import CarteTourneeDoneCard from './CarteTourneeDoneCard';
import CarteTourneePanel from './CarteTourneePanel';
import CarteTourneeSetupSheet from './CarteTourneeSetupSheet';
import { useTourneeCarte } from './useTourneeCarte';
import { readItineraireStops, type ItineraireStop } from '@/lib/today/directions';
import {
  cameraFor,
  persistMapDimension,
  readMapDimension,
  toggleDimension,
  type MapDimension,
} from '@/lib/map/view-mode';
import { FIELD, formatDistance } from '@/lib/today/field';
import { vibrateBrief } from './aujourdhui/tap';
import { bboxDeZone, bboxVersBounds, fusionnerBbox, type Bbox } from '@/lib/zones/geometrie';
import { pointDansZone } from '@/lib/zones/leads';
import type { Zone } from '@/lib/zones/types';

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
  withoutPosition: _withoutPosition,
  unplaced,
  agencyPostalCodes = [],
  center,
  members,
  isDirector,
  profileId = '',
  initialBanId = null,
  initialBanPos = null,
  initialParcelleId = null,
  fillParent = false,
  hideAccount = false,
  itineraryStops: itineraryStopsProp = null,
  showItineraire = false,
  autoTournee = false,
  zones = [],
  initialZoneId = null,
  initialAtelier = null,
  viewSwitcher = null,
}: {
  points: MapPoint[];
  withoutPosition: WithoutPositionCount;
  unplaced: UnplacedRecord[];
  agencyPostalCodes: string[];
  center: { latitude: number | null; longitude: number | null };
  members: readonly AssigneeOption[];
  isDirector: boolean;
  profileId?: string;
  initialBanId?: string | null;
  initialBanPos?: RepliImmeuble | null;
  initialParcelleId?: string | null;
  fillParent?: boolean;
  hideAccount?: boolean;
  itineraryStops?: readonly ItineraireStop[] | null;
  showItineraire?: boolean;
  /** Entrée « tournée » depuis l'accueil : la préparation s'ouvre seule, ou la tournée reprend. */
  autoTournee?: boolean;
  zones?: readonly Zone[];
  initialZoneId?: string | null;
  /** « nouveau », ou le secteur à retoucher : l'atelier s'ouvre dès l'arrivée. */
  initialAtelier?: string | null;
  viewSwitcher?: ReactNode;
}) {
  const router = useRouter();
  const { openCapture } = useVoiceCapture();
  const mapApi = useRef<MobileMapHandle | null>(null);

  const [layers, setLayers] = useState<MapLayerState>(readStoredMapLayers);
  const [annonceOuverte, setAnnonceOuverte] = useState<{ annonce: Annonce; soeurs: Annonce[] } | null>(null);
  const [zoneId, setZoneId] = useState(() => zoneIdInitial(initialZoneId, zones));
  // Venu de l'Accueil (« Modifier les parcelles », « Créer mon secteur ») : l'atelier est déjà ouvert.
  const zoneARetoucher = initialAtelier ? (zones.find((z) => z.id === initialAtelier) ?? null) : null;
  const [atelier, setAtelier] = useState(initialAtelier === 'nouveau' || zoneARetoucher !== null);
  const [atelierZone, setAtelierZone] = useState<Zone | null>(zoneARetoucher);
  // L'onglet d'arrivée suit le secteur ouvert : le mien, celui d'un collègue, ou aucun.
  const [portee, setPortee] = useState<PorteeSecteurs>(() => {
    const ouvert = zones.find((z) => z.id === initialZoneId);
    if (ouvert) return ouvert.assignedTo === profileId ? 'mes' : 'agence';
    return isDirector ? 'agence' : 'mes';
  });
  const [onglet, setOnglet] = useState<OngletCarte>(() =>
    empriseDepuisZoneId(zoneIdInitial(initialZoneId, zones)) === 'code_postal' ? 'code_postal' : portee,
  );
  const [secteurConfirme, setSecteurConfirme] = useState(false);
  const [dimension, setDimension] = useState<MapDimension>(readMapDimension);
  const [vue, setVue] = useState<VueCarte | null>(null);
  const [selectedBanId, setSelectedBanId] = useState<string | null>(initialBanId);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const cible = useCibleCarte();
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const geocodeStarted = useRef(false);
  const [storedStops, setStoredStops] = useState<ItineraireStop[] | null>(null);
  /** En préparation : le prochain appui sur la carte ajoute une adresse de passage. */
  const [picking, setPicking] = useState(false);
  const [confirmerFin, setConfirmerFin] = useState(false);
  /** Le temps que le tap « Terminer » retombe : la barre d'onglets reste cachée. */
  const [gardeFin, setGardeFin] = useState(false);
  const gardeFinTimer = useRef<number | null>(null);

  const cadre = useMemo(
    () => cadrageCarte({ zoneId, zones, profileId, directeur: isDirector, portee }),
    [zoneId, zones, profileId, isDirector, portee],
  );
  const { proposes, voirTous, zoneChoisie, affiches } = cadre;
  const monSecteurId = zoneProspectionParDefaut(zones, profileId);
  const annoncesQui = useMemo(
    () => ({
      zones,
      directeur: isDirector,
      profileId,
      zoneCadree: zoneChoisie,
      zonesCadrees: voirTous ? affiches : null,
    }),
    [zones, isDirector, profileId, zoneChoisie, voirTous, affiches],
  );

  const tournee = useTourneeCarte({
    profileId,
    isDirector,
    zoneId: zoneChoisie?.id ?? null,
    aUnSecteur: Boolean(monSecteurId) || (isDirector && zoneChoisie !== null),
    autoTournee,
    mapApi,
  });
  const tourShown = tournee.traceVisible;
  /** Recherche, filtres, boutons et onglets : hors tournée, ou en pause. */
  const chromeVisible = tournee.chrome;

  useEffect(() => {
    setDimension(readMapDimension());
    setStoredStops(readItineraireStops());
  }, []);

  const itineraryStops = tourShown
    ? tournee.itineraire
    : showItineraire
      ? storedStops ?? itineraryStopsProp
      : null;
  const { route, waypoints } = useWalkingRoute(tourShown ? null : itineraryStops);
  const itineraryGeometry = tourShown ? tournee.geometrie : route?.geometry ?? null;

  const kinds = useMemo(() => activeKindSet(layers), [layers]);
  const overlaysCadastre = anyCadastreOverlay(layers);
  const planParcelles = showParcellesPlan(layers);
  const parcelle = useParcelleMap(overlaysCadastre, viewport, {
    dpeAges: layers.cadastreDpeAges,
    includeDpeDetail: layers.cadastreDpe,
  });
  const { suivis: immeublesSuivis, recharger: rechargerSuivis } = useImmeublesSuivisCarte();
  const suiviParcelleIds = useMemo(
    () => immeublesSuivis.map((s) => s.parcelleId),
    [immeublesSuivis],
  );
  const { closeParcelle } = parcelle;
  const mapZoom = viewport?.zoom ?? null;
  const carteSecteurs = useCarteSecteurs(onglet !== 'code_postal' || atelier);
  const secteursAffiches = useMemo(() => new Set(affiches.map((z) => z.id)), [affiches]);
  const validerDessin = useCallback((id: string) => {
    setSecteurConfirme(true);
    setAtelier(false);
    setPortee('mes');
    setOnglet('mes');
    setZoneId(id);
    router.refresh();
  }, [router]);
  const fermerAtelier = useCallback(() => setAtelier(false), []);
  const dessin = useDessinSecteur({
    ouvert: atelier,
    zone: atelierZone,
    zones,
    carte: carteSecteurs,
    centre: center,
    onValider: validerDessin,
    onFermer: fermerAtelier,
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
  const pointsDuSecteur = useMemo(
    () =>
      affiches.length > 0
        ? points.filter((p) => affiches.some((z) => pointDansZone(p, z)))
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
        assignedTo: 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [pointsDuSecteur, kinds],
  );
  const filteredAllKinds = useMemo(
    () =>
      filterMapEntities(pointsDuSecteur, {
        kinds: new Set(MAP_LAYER_ORDER),
        assignedTo: 'tous',
        period: 'all',
        now: Date.now(),
      }),
    [pointsDuSecteur],
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
  const counts = useMemo(() => countKindsInViewport(filteredAllKinds, null), [filteredAllKinds]);

  const parcelleOuverte = useRef(false);
  useEffect(() => {
    if (!initialParcelleId || parcelleOuverte.current) return;
    parcelleOuverte.current = true;
    parcelle.openParcelle(initialParcelleId);
  }, [initialParcelleId, parcelle.openParcelle]);

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

  const finirTournee = useCallback(() => {
    armPointerShield(900);
    setGardeFin(true);
    if (gardeFinTimer.current != null) window.clearTimeout(gardeFinTimer.current);
    gardeFinTimer.current = window.setTimeout(() => {
      gardeFinTimer.current = null;
      setGardeFin(false);
    }, 900);
    tournee.terminer();
  }, [tournee.terminer]);

  useEffect(
    () => () => {
      if (gardeFinTimer.current != null) window.clearTimeout(gardeFinTimer.current);
    },
    [],
  );

  /** Point libre : l'adresse la plus proche, sinon les coordonnées brutes. */
  const ajouterPointCarte = useCallback(
    (coord: GeoCoord) => {
      setPicking(false);
      void reverseGeocode(coord.latitude, coord.longitude).then((hit) => {
        const label = hit?.adresse_normalisee ?? 'Point sur la carte';
        tournee.preparation.ajouterAncre({
          label,
          latitude: hit?.lat ?? coord.latitude,
          longitude: hit?.lng ?? coord.longitude,
          city: '',
          postcode: /\b\d{5}\b/.exec(label)?.[0] ?? '',
          id: hit?.ban_id,
        });
      });
    },
    [tournee.preparation],
  );

  const handleMapSelect = useCallback(
    (building: BuildingMarker) => {
      if (tournee.phase === 'preparation') {
        setPicking(false);
        tournee.preparation.ajouterAncre({
          label: building.title,
          latitude: building.latitude,
          longitude: building.longitude,
          city: '',
          postcode: building.postalCode ?? '',
          // `bien:…` et `gps:…` placent une fiche sans adresse BAN : pas un identifiant d'immeuble.
          id: building.banId.includes(':') ? undefined : building.banId,
        });
        return;
      }
      if (tournee.enCours) return;
      const note = building.appearance.kind === 'note' ? building.appearance : null;
      if (note) {
        setSelectedBanId(null);
        setLayersOpen(false);
        const params = new URLSearchParams({
          ban: building.banId,
          lat: String(building.latitude),
          lon: String(building.longitude),
        });
        if (building.postalCode) params.set('cp', building.postalCode);
        void fetch(`/api/carte/parcelle-au-point?${params.toString()}`)
          .then(async (res) => {
            const data = (await res.json()) as {
              parcelleId?: string | null;
              surfaceM2?: number | null;
            };
            if (!res.ok || !data.parcelleId) throw new Error('parcelle');
            setFocusNoteId(note.recordId);
            parcelle.openParcelle(data.parcelleId, { surfaceM2: data.surfaceM2 ?? null });
          })
          .catch(() => {
            setFocusNoteId(null);
            setSelectedBanId(building.banId);
          });
        return;
      }
      setFocusNoteId(null);
      closeParcelle();
      setSelectedBanId(building.banId);
      setLayersOpen(false);
    },
    [tournee.phase, tournee.preparation, tournee.enCours, closeParcelle, parcelle],
  );

  const choisirArretCarte = useCallback(
    (stop: ItineraireStop) => {
      const arret = tournee.arrets.find((a) => a.leadId === stop.leadId);
      if (!arret) return;
      tournee.choisirArret(arret.key);
      mapApi.current?.recenter(arret, 17);
    },
    [tournee],
  );

  const switchDimension = useCallback(() => {
    setDimension((prev) => {
      const next = toggleDimension(prev);
      persistMapDimension(next);
      return next;
    });
    vibrateBrief();
  }, []);

  const phone = selected ? firstPhone(selected.entities) : null;
  /** Au-dessus de la barre d'onglets (carte plein écran derrière). */
  const floatBottom = 'calc(12px + var(--field-nav-height))';
  const cameraMode = cameraFor(dimension);
  const vueTournee =
    vue !== null &&
    (Math.abs((((vue.bearing - cameraMode.bearing) % 360) + 540) % 360 - 180) > 3 ||
      Math.abs(vue.pitch - cameraMode.pitch) > 3);
  const boussole = vueTournee ? (
    <button
      type="button"
      onClick={() => mapApi.current?.remettreVue()}
      aria-label="Remettre la carte droite"
      className="app-press flex size-12 items-center justify-center rounded-full bg-surface text-text-strong shadow-md"
    >
      <Navigation2
        size={20}
        strokeWidth={2.1}
        style={{ transform: `rotate(${-(vue?.bearing ?? 0)}deg)` }}
        aria-hidden
      />
    </button>
  ) : null;
  const contexteBrief = tournee.sansPosition
    ? 'Pense à activer ta localisation !'
    : tournee.distanceDepartM !== null
      ? `Ta tournée commence à ${formatDistance(tournee.distanceDepartM)} d’ici.`
      : null;
  const libelleCodePostal =
    agencyPostalCodes.length === 1 ? `Tout le ${agencyPostalCodes[0]}` : 'Tout le code postal';

  const recenterGps = useCallback(() => {
    void requestDevicePosition().then((pos) => {
      if (!pos) {
        toast('Pense à activer ta localisation !');
        return;
      }
      mapApi.current?.recenter(pos, 16);
    });
  }, []);

  return (
    <div
      data-tournee-active={tournee.enCours || gardeFin ? '' : undefined}
      className={
        fillParent
          ? 'field-map relative h-full min-h-0 overflow-hidden overscroll-none bg-soft-cool'
          : 'field-map fixed inset-0 overflow-hidden overscroll-none bg-soft-cool'
      }
    >
      <MobileMapCanvas
        buildings={buildings}
        center={center}
        cible={cible}
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
        secteurs={onglet === 'code_postal' && !atelier ? null : { carte: carteSecteurs, affichees: secteursAffiches }}
        dimension={dimension}
        onVue={setVue}
        selectedBanId={selectedBanId}
        mapRef={mapApi}
        onSelect={handleMapSelect}
        onDeselect={() => {
          if (tournee.phase === 'route') {
            tournee.choisirArret(null);
            return;
          }
          if (tournee.enCours) return;
          setFocusNoteId(null);
          setSelectedBanId(null);
          closeParcelle();
        }}
        onViewport={setViewport}
        onCluster={(children) => mapApi.current?.fitGroup(children)}
        itineraryStops={itineraryStops}
        itineraryGeometry={itineraryGeometry}
        onStopTap={tournee.phase === 'route' ? choisirArretCarte : undefined}
        currentLeadId={tourShown ? ((tournee.arretChoisi ?? tournee.prochain)?.leadId ?? null) : null}
        // Une parcelle ouverte (par la recherche, plan éteint) reste détourée.
        parcellesEnabled={!tournee.immersion && (planParcelles || Boolean(parcelle.selectedParcelleId))}
        activeParcelleIds={activeParcelleIds}
        suiviParcelleIds={suiviParcelleIds}
        parcelleNoteMarkers={parcelleNoteMarkers}
        selectedParcelleId={parcelle.selectedParcelleId}
        cadastreImmeubles={cadastreImmeubles}
        cadastreLayers={{
          cadastreDpe: layers.cadastreDpe,
          cadastreVentes: layers.cadastreVentes,
          cadastreCopro: layers.cadastreCopro,
          cadastreDpeAges: layers.cadastreDpeAges,
        }}
        onSelectParcelle={(parcelleId, extra) => {
          if (tournee.enCours) return;
          setFocusNoteId(null);
          setSelectedBanId(null);
          setLayersOpen(false);
          parcelle.openParcelle(parcelleId, extra);
        }}
        onPrefetchParcelle={parcelle.prefetchParcelle}
        annoncesCouche={{
          layers,
          zones,
          zoneCadree: zoneChoisie,
          zonesCadrees: voirTous ? affiches : null,
          directeur: isDirector,
          profileId,
          onChoisir: (annonce, soeurs) => {
            setLayersOpen(false);
            setAnnonceOuverte({ annonce, soeurs });
          },
          ouverteId: annonceOuverte?.annonce.id ?? null,
        }}
        agentPosition={tournee.agentPosition}
        completedLeadIds={tournee.arretsFaitsIds}
        highlightBanIds={tournee.highlightBanIds}
        // Une adresse cherchée ou une tournée gardent la main : la carte ne repart pas sur tout le secteur.
        suppressAutoFit={tournee.phase !== 'off' || Boolean(cible) || Boolean(initialParcelleId) || Boolean(focusLien)}
        focus={focusLien}
        navigation={tournee.immersion}
        onMapPoint={picking ? ajouterPointCarte : undefined}
      />

      {picking ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-[72] px-4"
          style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#1A2A56] py-1.5 pl-4 pr-1.5 shadow-lg">
            <p className="min-w-0 flex-1 text-[13.5px] font-medium text-white">
              Touche la carte là où tu veux passer
            </p>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="app-press flex min-h-[38px] flex-shrink-0 items-center rounded-full bg-white/15 px-3 text-[13px] font-semibold text-white"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {chromeVisible ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 px-4"
          style={{ top: 'calc(10px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="pointer-events-auto">
            <MobileSearchCapsule
              translucent
              hideAccount={hideAccount}
              onAccount={() => setAccountOpen(true)}
              accountOpen={accountOpen}
            />
          </div>
          {viewSwitcher ? (
            <div className="pointer-events-auto mt-2 flex justify-end">{viewSwitcher}</div>
          ) : null}
          {itineraryStops && itineraryStops.length >= 2 ? (
            <div className="pointer-events-auto mt-2">
              <ItineraireBanner stops={itineraryStops} waypoints={waypoints} route={route} />
            </div>
          ) : null}
        </div>
      ) : null}

      {chromeVisible ? (
        <>
          {tournee.phase === 'pause' ? (
            <div
              className="absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5"
              style={{ bottom: 'calc(72px + var(--field-nav-height))' }}
            >
              {confirmerFin ? (
                <div className="flex items-center gap-1.5 rounded-full bg-surface p-1.5 shadow-lg ring-1 ring-black/[0.06]">
                  <span className="whitespace-nowrap pl-2.5 text-[14px] font-semibold text-text-strong">
                    Terminer la tournée ?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmerFin(false)}
                    className="app-press flex h-10 items-center rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
                  >
                    Non
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setConfirmerFin(false);
                      finirTournee();
                    }}
                    className="app-press flex h-10 items-center rounded-full bg-primary-500 px-3.5 text-[13.5px] font-semibold text-white"
                    style={{ touchAction: 'manipulation' }}
                  >
                    Oui
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBanId(null);
                      closeParcelle();
                      tournee.reprendre();
                    }}
                    className="app-press flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-500 px-4 py-2.5 font-semibold text-white shadow-[0_10px_24px_-8px_rgba(99,102,241,0.65)] ring-2 ring-white"
                    style={{ fontSize: 14 }}
                  >
                    <Play size={16} strokeWidth={2.4} aria-hidden />
                    Reprendre ma tournée
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmerFin(true)}
                    aria-label="Terminer la tournée"
                    className="app-press flex size-10 items-center justify-center rounded-full bg-surface text-text-muted shadow-md"
                  >
                    <X size={18} strokeWidth={2.3} aria-hidden />
                  </button>
                </>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setLayersOpen(true);
              setSelectedBanId(null);
            }}
            aria-label="Couches"
            className="app-press absolute left-4 z-20 flex size-12 items-center justify-center rounded-full bg-[#1A2A56] text-white shadow-[0_10px_24px_-8px_rgba(26,42,86,0.55)] ring-2 ring-white"
            style={{ bottom: floatBottom }}
          >
            <Layers size={20} strokeWidth={2.2} aria-hidden />
          </button>

          <div
            className="absolute right-4 z-20 flex flex-col-reverse items-center gap-2"
            style={{ bottom: floatBottom }}
          >
            <button
              type="button"
              onClick={switchDimension}
              aria-label={dimension === '3d' ? 'Passer en plan 2D' : 'Passer en relief 3D'}
              aria-pressed={dimension === '3d'}
              className="app-press flex size-12 flex-col items-center justify-center gap-0.5 rounded-full bg-surface shadow-md"
              style={{ color: dimension === '3d' ? FIELD.orange : undefined }}
            >
              {dimension === '3d' ? (
                <Box size={17} strokeWidth={2.2} aria-hidden />
              ) : (
                <Square size={17} strokeWidth={2.2} className="text-text" aria-hidden />
              )}
              <span
                className="text-[10px] font-bold leading-none"
                style={{ color: dimension === '3d' ? FIELD.orange : '#64748B' }}
              >
                {dimension === '3d' ? '3D' : '2D'}
              </span>
            </button>
            <button
              type="button"
              onClick={recenterGps}
              aria-label="Recentrer sur ma position"
              className="app-press flex size-12 items-center justify-center rounded-full bg-surface text-text shadow-md"
            >
              <Locate size={20} strokeWidth={2} aria-hidden />
            </button>
            {boussole}
          </div>
        </>
      ) : boussole ? (
        <div className="absolute right-4 z-[71]" style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
          {boussole}
        </div>
      ) : null}

      {tournee.phase === 'preparation' && !picking ? (
        <CarteTourneeSetupSheet
          aUnSecteur={Boolean(monSecteurId) || (isDirector && zoneChoisie !== null)}
          libelleCodePostal={libelleCodePostal}
          perimetre={tournee.preparation.perimetre}
          onPerimetre={tournee.preparation.choisirPerimetre}
          ancres={tournee.preparation.ancres}
          onAjouter={tournee.preparation.ajouterAncre}
          onRetirer={tournee.preparation.retirerAncre}
          duree={tournee.preparation.duree}
          onDuree={tournee.preparation.choisirDuree}
          localisation={tournee.preparation.localisation}
          postcodeFilter={agencyPostalCodes[0]}
          generating={tournee.preparation.generation}
          message={tournee.preparation.message}
          onPickOnMap={() => setPicking(true)}
          onGenerate={() => void tournee.generer()}
          onClose={() => {
            setPicking(false);
            tournee.fermerPreparation();
          }}
        />
      ) : null}

      {tournee.phase === 'brief' ? (
        <CarteTourneeBriefCard
          stopCount={tournee.arrets.length}
          minutes={tournee.prevu.minutes}
          distanceM={tournee.prevu.distanceM}
          contexte={contexteBrief}
          onDone={tournee.finBrief}
        />
      ) : null}

      {tournee.phase === 'route' ? (
        <CarteTourneePanel
          arrets={tournee.arrets}
          faits={tournee.faits}
          prochain={tournee.prochain}
          arretChoisi={tournee.arretChoisi}
          onChoisir={(key) => {
            tournee.choisirArret(key);
            const arret = tournee.arrets.find((a) => a.key === key);
            if (arret) mapApi.current?.recenter(arret, 17);
          }}
          tempsMs={tournee.tempsMs}
          distanceM={tournee.distanceMarcheeM}
          routage={tournee.routage}
          sansPosition={tournee.sansPosition && !tournee.agentPosition}
          onPause={tournee.pause}
          onTerminer={finirTournee}
          onNoter={tournee.noter}
          onFait={tournee.marquerFait}
          onRetirer={tournee.retirerArret}
        />
      ) : null}

      {tournee.phase === 'bilan' && tournee.bilan ? (
        <CarteTourneeDoneCard bilan={tournee.bilan} onClose={tournee.fermerBilan} />
      ) : null}

      {annonceOuverte && !tournee.enCours ? (
        <div className="pointer-events-auto absolute inset-x-3 z-[72] flex max-h-[55%] flex-col overflow-hidden" style={{ bottom: 'calc(12px + var(--field-nav-height))' }}>
          <AnnonceVolet
            annonce={annonceOuverte.annonce}
            soeurs={annonceOuverte.soeurs}
            onFermer={() => setAnnonceOuverte(null)}
          />
        </div>
      ) : null}

      <MobileSheet
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        title="Couches"
        initialSnap={2}
      >
        {atelier ? null : <EmpriseCapsules value={onglet} onChange={choisirOnglet} />}
        {onglet === 'mes' && !secteurConfirme && !aUnSecteurDefini(proposes) ? (
          dessin.panneau ?? (
            <button type="button" onClick={() => ouvrirAtelier(null)} className={`${BOUTON_CARTE_VIDE} w-full`}>
              Créer mon secteur
            </button>
          )
        ) : (
        dessin.panneau ?? (
        <ul className="flex flex-col gap-1">
          {MAP_LAYER_ORDER.map((kind) => {
            const active = layers[kind];
            return (
              <li key={kind}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setLayers((prev) => ({ ...prev, [kind]: !prev[kind] }))}
                  className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A2A56]"
                >
                  <Switch checked={active} />
                  <span
                    className={`flex-1 text-[14.5px] font-medium ${active ? 'text-text-strong' : 'text-text-muted'}`}
                  >
                    {MAP_LAYER_LABELS[kind]}
                  </span>
                  <span className="tabular-nums text-[13px] text-text-subtle">{counts[kind]}</span>
                </button>
              </li>
            );
          })}
          <CadastreLayerControls
            layers={layers}
            onToggleLayer={(id: CadastreLayerId) =>
              setLayers((prev) => {
                const next = withCadastreLayerToggled(prev, id);
                persistMapLayers(next);
                return next;
              })
            }
            onChangeDpeAge={(from, to) =>
              setLayers((prev) => {
                const next = withDpeAgeSpan(prev, from, to);
                persistMapLayers(next);
                return next;
              })
            }
            onToggleMenu={() =>
              setLayers((prev) => {
                const next = withCadastreMenuToggled(prev);
                persistMapLayers(next);
                return next;
              })
            }
            mapZoom={mapZoom}
            compact
          />
          <AnnoncesLayerControls
            layers={layers}
            compact
            qui={annoncesQui}
            onChange={(patch) =>
              setLayers((prev) => {
                const next = { ...prev, ...patch };
                persistMapLayers(next);
                setAnnonceOuverte(null);
                return next;
              })
            }
          />
          {onglet === 'code_postal' ? null : (
            <>
              <ChoixSecteurs
                zones={proposes}
                zoneId={zoneId}
                onZone={setZoneId}
                tous={isDirector || portee === 'agence'}
                profileId={profileId}
                membres={members}
              />
              {onglet === 'agence' && proposes.length === 0 ? (
                <li className="px-1 text-[13px] text-text-muted">Aucun secteur dans l’agence pour l’instant.</li>
              ) : null}
              <li className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => ouvrirAtelier(null)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
                >
                  <Plus size={15} strokeWidth={2.2} aria-hidden />
                  Nouveau secteur
                </button>
                {modifierSecteur ? (
                  <button
                    type="button"
                    onClick={modifierSecteur}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/[0.05] px-3.5 text-[13.5px] font-semibold text-text-strong"
                  >
                    <PencilLine size={15} strokeWidth={2.2} aria-hidden />
                    Modifier ce secteur
                  </button>
                ) : null}
              </li>
            </>
          )}
        </ul>
        )
        )}
      </MobileSheet>

      <MobileSheet
        open={Boolean(selected) && !tourShown}
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
                className="app-press flex min-h-[44px] flex-1 items-center justify-center rounded-clay bg-ia text-[13.5px] font-semibold text-white"
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
                      <Link href={item.href} className="block rounded-xl px-2 py-2 field-fiche-enter">
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
              <NotePlusSurPlace adresse={selected.title} banId={selected.banId} />
              <NotesTerrainList entiteType="immeuble" entiteId={selected.banId} />
            </section>
          </div>
        ) : null}
      </MobileSheet>

      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
      <ParcelleDrawer
        fiche={parcelle.fiche}
        loading={parcelle.loading}
        onClose={() => {
          setFocusNoteId(null);
          parcelle.closeParcelle();
        }}
        onNotesChanged={parcelle.refreshAfterNotes}
        onSuiviChanged={rechargerSuivis}
        focusNoteId={focusNoteId}
      />
    </div>
  );
}
