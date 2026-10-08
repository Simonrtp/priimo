'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { SelectedAddress } from '@/components/AddressAutocomplete';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import type { GeoCoord } from '@/lib/carte/coords';
import { haversineM } from '@/lib/geo/distance';
import { MAPBOX_TOKEN } from '@/lib/map/style';
import { newOfflineId, postJsonOrQueue } from '@/lib/offline/queue';
import { dateKeyParis } from '@/lib/today/calendar';
import { fetchWalkingRoute, toItineraireStops, writeItineraireStops } from '@/lib/today/directions';
import { applyTripOrder, fetchOptimizedTrip, MAX_TRIP_COORDS } from '@/lib/today/optimized-trip';
import { loopWaypoints } from '@/lib/today/route-optimize';
import { lineGeoJson } from '@/lib/today/sortie';
import { rebuildPlanFromStops, todaySortieDay } from '@/lib/today/sortie-session';
import {
  DUREE_TOURNEE_DEFAUT,
  DUREES_TOURNEE,
  MAX_ADRESSES_IMPOSEES,
  MINUTES_PAR_PORTE,
  type ArretTournee,
  type PerimetreTournee,
  type TourneeReponse,
} from '@/lib/tournee/reglages';
import {
  chargerTournee,
  enregistrerTournee,
  oublierTournee,
  type TrajetSauve,
} from '@/lib/tournee/sauvegarde';
import {
  avancerSuivi,
  caloriesMarchees,
  mettreEnPause,
  reprendreSuivi,
  suiviNeuf,
  tempsActifMs,
  tourneeVraimentFaite,
  type SuiviTournee,
} from '@/lib/tournee/suivi';
import { requestDevicePosition, watchDevicePosition, type DevicePosition } from '@/lib/voice/gps';
import { vibrateBrief } from './aujourdhui/tap';
import type { MobileMapHandle } from './MobileMapCanvas';

/**
 * `preparation` = adresses et temps, `brief` = ouverture, `route` = tournée en cours,
 * `pause` = carte normale avec reprise en un geste, `bilan` = bravo de fin.
 */
export type PhaseTournee = 'off' | 'preparation' | 'brief' | 'route' | 'pause' | 'bilan';
export type Localisation = 'attente' | 'ok' | 'absente';
export type BilanTournee = { faites: number; total: number; distanceM: number; actifMs: number; calories: number };

const DUREE_KEY = 'priimo-tournee-duree';
const PERIMETRE_KEY = 'priimo-tournee-perimetre';
/** Assez près pour dire qu'on est passé devant la porte, pas assez pour la frôler en voiture. */
const PASSAGE_RAYON_M = 25;
const PASSAGE_PRECISION_M = 35;
const PASSAGE_VITESSE_MAX_MS = 2.5;
const ATTENTE_POSITION_MS = 6_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lireReglage<T>(cle: string, valides: readonly T[], defaut: T): T {
  try {
    const brut = window.localStorage.getItem(cle);
    const valeur = (typeof defaut === 'number' ? Number(brut) : brut) as T;
    return valides.includes(valeur) ? valeur : defaut;
  } catch {
    return defaut;
  }
}

function ecrireReglage(cle: string, valeur: string | number): void {
  try {
    window.localStorage.setItem(cle, String(valeur));
  } catch {
    /* mode privé */
  }
}

function cleDuTrajet(arrets: readonly ArretTournee[], depart: GeoCoord | null): string {
  const cles = arrets.map((a) => a.key).sort().join('|');
  return depart ? `${cles}@${depart.latitude.toFixed(5)},${depart.longitude.toFixed(5)}` : cles;
}

async function calculerTrajet(
  arrets: readonly ArretTournee[],
  depart: GeoCoord | null,
): Promise<Omit<TrajetSauve, 'cle'> | null> {
  const jeton = MAPBOX_TOKEN;
  if (!jeton) return null;
  if (depart && arrets.length + 1 <= MAX_TRIP_COORDS) {
    const optimise = await fetchOptimizedTrip([depart, ...arrets], jeton);
    const ordre = optimise ? applyTripOrder(arrets, optimise) : null;
    if (optimise && ordre) {
      return {
        keys: ordre.map((a) => a.key),
        geometry: optimise.geometry,
        distanceM: optimise.distanceM,
        durationS: optimise.durationS,
      };
    }
  }
  const marche = await fetchWalkingRoute(loopWaypoints(arrets, depart), jeton);
  return marche ? { keys: arrets.map((a) => a.key), ...marche } : null;
}

function messageVide(reponse: TourneeReponse): string {
  if (reponse.adressesAFaire === 0 && reponse.dejaFaites > 0) {
    return 'Toutes les portes du coin sont déjà faites. Bravo !';
  }
  if (reponse.adressesAFaire === 0) return 'Pas de DPE récent par ici pour le moment.';
  return 'Rien ne rentre dans ce temps-là. Essaie un peu plus long.';
}

function memeAdresse(a: SelectedAddress, b: SelectedAddress): boolean {
  if (a.id && b.id) return a.id === b.id;
  return haversineM(a, b) < 5;
}

export function useTourneeCarte({
  profileId,
  isDirector,
  zoneId,
  aUnSecteur,
  autoTournee,
  mapApi,
}: {
  profileId: string;
  isDirector: boolean;
  zoneId: string | null;
  aUnSecteur: boolean;
  autoTournee: boolean;
  mapApi: MutableRefObject<MobileMapHandle | null>;
}) {
  const { openCapture } = useVoiceCapture();

  const [phase, setPhase] = useState<PhaseTournee>('off');
  const [arrets, setArrets] = useState<ArretTournee[]>([]);
  const [depart, setDepart] = useState<GeoCoord | null>(null);
  const [trajet, setTrajet] = useState<TrajetSauve | null>(null);
  const [echecTrajet, setEchecTrajet] = useState<string | null>(null);
  const [faits, setFaits] = useState<readonly string[]>([]);
  const [suivi, setSuivi] = useState<SuiviTournee>(() => suiviNeuf(0));
  const [prevuServeur, setPrevuServeur] = useState({ minutes: 0, distanceM: 0 });
  const [sansPosition, setSansPosition] = useState(false);
  const [distanceDepartM, setDistanceDepartM] = useState<number | null>(null);
  const [arretChoisi, setArretChoisi] = useState<string | null>(null);
  const [agentPosition, setAgentPosition] = useState<DevicePosition | null>(null);
  const [maintenant, setMaintenant] = useState(0);
  const [bilan, setBilan] = useState<BilanTournee | null>(null);

  const [ancres, setAncres] = useState<SelectedAddress[]>([]);
  const [duree, setDuree] = useState<number>(() =>
    lireReglage<number>(DUREE_KEY, DUREES_TOURNEE, DUREE_TOURNEE_DEFAUT),
  );
  const [perimetre, setPerimetre] = useState<PerimetreTournee>(() =>
    lireReglage<PerimetreTournee>(PERIMETRE_KEY, ['secteur', 'code_postal'], 'secteur'),
  );
  const [localisation, setLocalisation] = useState<Localisation>('attente');
  const [generation, setGeneration] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const positionPromesse = useRef<Promise<DevicePosition | null> | null>(null);
  const faitsRef = useRef<ReadonlySet<string>>(new Set());
  const arretsSuivis = useRef<readonly ArretTournee[]>([]);
  const restauree = useRef(false);

  const perimetreEffectif: PerimetreTournee = aUnSecteur ? perimetre : 'code_postal';
  const traceVisible = phase === 'brief' || phase === 'route' || phase === 'bilan';
  const suiviActif = phase === 'brief' || phase === 'route';

  const cleTrajet = useMemo(() => cleDuTrajet(arrets, depart), [arrets, depart]);
  const planLocal = useMemo(() => {
    const parCle = new Map(arrets.map((a) => [a.key, a]));
    const plan = rebuildPlanFromStops(arrets, depart);
    return plan ? plan.ordered.map((s) => parCle.get(s.key)!).filter(Boolean) : [];
  }, [arrets, depart]);
  const trajetValide = trajet !== null && trajet.cle === cleTrajet ? trajet : null;
  const trajetAJour = trajetValide !== null;

  const ordonnes = useMemo(() => {
    if (!trajetValide) return planLocal;
    const parCle = new Map(arrets.map((a) => [a.key, a]));
    const routes = trajetValide.keys
      .map((k) => parCle.get(k))
      .filter((a): a is ArretTournee => Boolean(a));
    return routes.length === arrets.length ? routes : planLocal;
  }, [trajetValide, arrets, planLocal]);

  const routage =
    traceVisible && arrets.length > 0 && Boolean(MAPBOX_TOKEN) && !trajetAJour && echecTrajet !== cleTrajet;

  useEffect(() => {
    if (!routage) return;
    let annule = false;
    void calculerTrajet(planLocal, depart).then((calcule) => {
      if (annule) return;
      if (calcule) setTrajet({ cle: cleTrajet, ...calcule });
      else setEchecTrajet(cleTrajet);
    });
    return () => {
      annule = true;
    };
  }, [routage, cleTrajet, planLocal, depart]);

  /** Le tracé se dessine d'un trait une fois le chemin connu ; à vol d'oiseau si la rue ne répond pas. */
  const geometrie = useMemo(() => {
    if (!traceVisible || routage || ordonnes.length === 0) return null;
    if (trajetValide) return trajetValide.geometry;
    const points = depart ? [depart, ...ordonnes, depart] : ordonnes;
    return points.length >= 2 ? lineGeoJson(points).geometry : null;
  }, [traceVisible, routage, ordonnes, trajetValide, depart]);

  const itineraire = useMemo(
    () => (traceVisible && !routage && ordonnes.length > 0 ? toItineraireStops(ordonnes) : null),
    [traceVisible, routage, ordonnes],
  );

  const faitsSet = useMemo(() => new Set(faits), [faits]);
  const arretsFaitsIds = useMemo(
    () => ordonnes.filter((a) => faitsSet.has(a.key)).map((a) => a.leadId),
    [ordonnes, faitsSet],
  );
  const prochain = ordonnes.find((a) => !faitsSet.has(a.key)) ?? null;

  const prevu = useMemo(() => {
    if (trajetValide) {
      return {
        minutes: trajetValide.durationS / 60 + ordonnes.length * MINUTES_PAR_PORTE,
        distanceM: trajetValide.distanceM,
      };
    }
    return prevuServeur;
  }, [trajetValide, ordonnes.length, prevuServeur]);

  const cadrer = useCallback(
    (origine: GeoCoord | null, points: readonly GeoCoord[]) => {
      if (points.length === 0) return;
      mapApi.current?.fitStops(origine ? [origine, ...points] : points);
    },
    [mapApi],
  );

  const marquer = useCallback(
    (cibles: readonly ArretTournee[]) => {
      const nouveaux = cibles.filter((a) => !faitsRef.current.has(a.key));
      if (nouveaux.length === 0) return;
      faitsRef.current = new Set([...faitsRef.current, ...nouveaux.map((a) => a.key)]);
      setFaits([...faitsRef.current]);
      vibrateBrief();
      // Le journal de sortie est réservé aux collaborateurs.
      if (isDirector) return;
      for (const arret of nouveaux) {
        void postJsonOrQueue('/api/dashboard/sortie/events', {
          kind: 'passer',
          leadId: UUID.test(arret.leadId) ? arret.leadId : null,
          stopKey: arret.key,
          banId: arret.banId,
          payload: { source: 'carte' },
          clientId: newOfflineId(),
          day: todaySortieDay(),
        });
      }
    },
    [isDirector],
  );

  useEffect(() => {
    arretsSuivis.current = suiviActif ? arrets : [];
  }, [suiviActif, arrets]);

  /** Une porte longée à pied devient un passage : la prochaine tournée ne la reproposera pas. */
  const surPosition = useCallback(
    (pos: DevicePosition) => {
      setAgentPosition(pos);
      setSuivi((s) => avancerSuivi(s, { ...pos, t: Date.now() }));
      if (pos.accuracyM === null || pos.accuracyM > PASSAGE_PRECISION_M) return;
      if (pos.speedMs !== null && pos.speedMs > PASSAGE_VITESSE_MAX_MS) return;
      marquer(arretsSuivis.current.filter((a) => haversineM(pos, a) <= PASSAGE_RAYON_M));
    },
    [marquer],
  );

  useEffect(() => {
    if (!suiviActif) return;
    return watchDevicePosition(surPosition, {
      pauseWhenHidden: true,
      highAccuracy: true,
      minUpdateM: 10,
      maximumAge: 2_000,
    });
  }, [suiviActif, surPosition]);

  useEffect(() => {
    if (phase !== 'route') return;
    const id = window.setInterval(() => setMaintenant(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'brief' && phase !== 'route' && phase !== 'pause') return;
    enregistrerTournee(profileId, {
      v: 1,
      jour: dateKeyParis(new Date()),
      phase: phase === 'pause' ? 'pause' : 'route',
      arrets,
      depart,
      trajet: trajetValide,
      faits: [...faits],
      suivi,
      prevuMinutes: prevuServeur.minutes,
      sansPosition,
    });
  }, [profileId, phase, arrets, depart, trajetValide, faits, suivi, prevuServeur, sansPosition]);

  /** L'itinéraire retenu reste lisible depuis l'accueil. */
  useEffect(() => {
    if (phase !== 'route' || ordonnes.length < 2) return;
    writeItineraireStops(toItineraireStops(ordonnes));
  }, [phase, ordonnes]);

  const reinitialiser = useCallback(() => {
    faitsRef.current = new Set();
    setPhase('off');
    setArrets([]);
    setDepart(null);
    setTrajet(null);
    setEchecTrajet(null);
    setFaits([]);
    setArretChoisi(null);
    setBilan(null);
    setDistanceDepartM(null);
  }, []);

  const ouvrirPreparation = useCallback(() => {
    setMessage(null);
    setAncres([]);
    setLocalisation('attente');
    setPhase('preparation');
    const promesse = requestDevicePosition();
    positionPromesse.current = promesse;
    void promesse.then((pos) => {
      if (positionPromesse.current === promesse) setLocalisation(pos ? 'ok' : 'absente');
    });
  }, []);

  /** Retour d'une page ou de l'application : la tournée reprend où elle était. */
  useEffect(() => {
    if (restauree.current) return;
    // Une image plus tard, la carte est montée et peut cadrer la tournée.
    const id = window.requestAnimationFrame(() => {
      restauree.current = true;
      const sauvee = chargerTournee(profileId);
      if (!sauvee) {
        if (autoTournee) ouvrirPreparation();
        return;
      }
      const t = Date.now();
      const reprise = autoTournee && sauvee.phase === 'pause';
      faitsRef.current = new Set(sauvee.faits);
      setArrets(sauvee.arrets);
      setDepart(sauvee.depart);
      setTrajet(sauvee.trajet);
      setFaits(sauvee.faits);
      setPrevuServeur({ minutes: sauvee.prevuMinutes, distanceM: 0 });
      setSansPosition(sauvee.sansPosition);
      setSuivi(reprise ? reprendreSuivi(sauvee.suivi, t) : sauvee.suivi);
      setMaintenant(t);
      setPhase(reprise ? 'route' : sauvee.phase);
      if (reprise || sauvee.phase === 'route') cadrer(sauvee.depart, sauvee.arrets);
    });
    return () => window.cancelAnimationFrame(id);
  }, [profileId, autoTournee, ouvrirPreparation, cadrer]);

  const fermerPreparation = useCallback(() => {
    positionPromesse.current = null;
    setAncres([]);
    setMessage(null);
    setPhase('off');
  }, []);

  const ajouterAncre = useCallback(
    (adresse: SelectedAddress) => {
      if (ancres.some((a) => memeAdresse(a, adresse))) return;
      if (ancres.length >= MAX_ADRESSES_IMPOSEES) {
        setMessage(`${MAX_ADRESSES_IMPOSEES} adresses au plus : retires-en une pour en ajouter une autre.`);
        return;
      }
      setMessage(null);
      setAncres([...ancres, adresse]);
      vibrateBrief();
    },
    [ancres],
  );

  const retirerAncre = useCallback((index: number) => {
    setMessage(null);
    setAncres((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const choisirDuree = useCallback((minutes: number) => {
    setDuree(minutes);
    setMessage(null);
    ecrireReglage(DUREE_KEY, minutes);
  }, []);

  const choisirPerimetre = useCallback((valeur: PerimetreTournee) => {
    setPerimetre(valeur);
    setMessage(null);
    ecrireReglage(PERIMETRE_KEY, valeur);
  }, []);

  const generer = useCallback(async () => {
    if (generation) return;
    setGeneration(true);
    setMessage(null);
    const position = await Promise.race([
      positionPromesse.current ?? requestDevicePosition(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ATTENTE_POSITION_MS)),
    ]);
    setLocalisation(position ? 'ok' : 'absente');

    let reponse: TourneeReponse | null = null;
    try {
      const res = await fetch('/api/dashboard/tournee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dureeMinutes: duree,
          zoneId,
          perimetre: perimetreEffectif,
          ancres: ancres.map((a) => ({
            label: a.label,
            latitude: a.latitude,
            longitude: a.longitude,
            banId: a.id ?? null,
            codePostal: a.postcode || null,
          })),
          position: position ? { latitude: position.latitude, longitude: position.longitude } : null,
        }),
      });
      if (res.ok) {
        reponse = (await res.json()) as TourneeReponse;
      } else {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(corps?.error ?? 'Oups, ça n’a pas marché. Réessaie !');
      }
    } catch {
      setMessage('Pas de réseau pour le moment. Réessaie dans un instant.');
    }
    setGeneration(false);
    if (!reponse) return;
    if (reponse.arrets.length === 0) {
      setMessage(messageVide(reponse));
      return;
    }

    const t = Date.now();
    faitsRef.current = new Set();
    setArrets(reponse.arrets);
    setDepart(reponse.depart);
    setTrajet(null);
    setEchecTrajet(null);
    setFaits([]);
    setSuivi(suiviNeuf(t));
    setMaintenant(t);
    setPrevuServeur({ minutes: reponse.minutes, distanceM: reponse.distanceM });
    setSansPosition(!position);
    setDistanceDepartM(reponse.distanceDepartM);
    setArretChoisi(null);
    setAncres([]);
    if (position) setAgentPosition(position);
    setPhase('brief');
    cadrer(reponse.depart, reponse.arrets);
  }, [generation, duree, zoneId, perimetreEffectif, ancres, cadrer]);

  const finBrief = useCallback(() => setPhase('route'), []);

  const pause = useCallback(() => {
    setSuivi((s) => mettreEnPause(s, Date.now()));
    setArretChoisi(null);
    setPhase('pause');
  }, []);

  const reprendre = useCallback(() => {
    const t = Date.now();
    setSuivi((s) => reprendreSuivi(s, t));
    setMaintenant(t);
    setPhase('route');
    cadrer(depart, ordonnes);
  }, [cadrer, depart, ordonnes]);

  /** Pas de bilan pour une tournée ouverte puis refermée : aucune calorie inventée. */
  const terminer = useCallback(() => {
    const final = mettreEnPause(suivi, Date.now());
    const faites = arrets.filter((a) => faitsRef.current.has(a.key)).length;
    oublierTournee(profileId);
    if (!tourneeVraimentFaite(final, faites)) {
      reinitialiser();
      return;
    }
    setArretChoisi(null);
    setBilan({
      faites,
      total: arrets.length,
      distanceM: final.distanceM,
      actifMs: final.actifMs,
      calories: caloriesMarchees(final.distanceM),
    });
    setPhase('bilan');
  }, [suivi, arrets, profileId, reinitialiser]);

  const marquerFait = useCallback(
    (key: string, fait: boolean) => {
      const arret = arrets.find((a) => a.key === key);
      if (!arret) return;
      if (fait) {
        marquer([arret]);
        return;
      }
      const reste = new Set(faitsRef.current);
      reste.delete(key);
      faitsRef.current = reste;
      setFaits([...reste]);
    },
    [arrets, marquer],
  );

  const retirerArret = useCallback(
    (key: string) => {
      const restants = arrets.filter((a) => a.key !== key);
      setArretChoisi(null);
      if (restants.length === 0) {
        oublierTournee(profileId);
        reinitialiser();
        return;
      }
      const reste = new Set(faitsRef.current);
      reste.delete(key);
      faitsRef.current = reste;
      setFaits([...reste]);
      setArrets(restants);
    },
    [arrets, profileId, reinitialiser],
  );

  const noter = useCallback(
    (arret: ArretTournee) => {
      openCapture({ adresse: arret.address, banId: arret.banId ?? undefined, resterSurPage: true });
      marquer([arret]);
    },
    [openCapture, marquer],
  );

  const highlightBanIds = useMemo(() => {
    if (!traceVisible) return null;
    return new Set(arrets.map((a) => a.banId).filter((id): id is string => Boolean(id)));
  }, [traceVisible, arrets]);

  return {
    phase,
    /** Le chrome de la carte s'efface dès qu'on prépare une tournée. */
    enCours: phase === 'preparation' || phase === 'brief' || phase === 'route' || phase === 'bilan',
    traceVisible,
    arrets: ordonnes,
    faits: faitsSet,
    prochain,
    arretChoisi: ordonnes.find((a) => a.key === arretChoisi) ?? null,
    choisirArret: setArretChoisi,
    itineraire,
    geometrie,
    arretsFaitsIds,
    highlightBanIds,
    agentPosition: suiviActif ? agentPosition : null,
    routage,
    prevu,
    sansPosition,
    distanceDepartM,
    tempsMs: tempsActifMs(suivi, maintenant),
    distanceMarcheeM: suivi.distanceM,
    bilan,
    preparation: {
      ancres,
      ajouterAncre,
      retirerAncre,
      duree,
      choisirDuree,
      perimetre: perimetreEffectif,
      choisirPerimetre,
      localisation,
      generation,
      message,
    },
    ouvrirPreparation,
    fermerPreparation,
    generer,
    finBrief,
    pause,
    reprendre,
    terminer,
    fermerBilan: reinitialiser,
    marquerFait,
    retirerArret,
    noter,
  };
}
