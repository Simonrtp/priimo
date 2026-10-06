import type { GeoCoord } from '@/lib/carte/coords';
import { haversineM } from '@/lib/geo/distance';
import { dateKeyParis } from '@/lib/today/calendar';
import { loopDistanceM, optimizeLoopOrder } from '@/lib/today/route-optimize';
import type { SortieStop } from '@/lib/today/sortie';
import { adresseAJuger } from '@/lib/zones/adresse';
import { zoneDeLAdresse } from '@/lib/zones/appartenance';
import type { PassageObserve } from '@/lib/zones/fraicheur';
import { zoneProspectionParDefaut } from '@/lib/zones/jour';
import type { Zone } from '@/lib/zones/types';
import { MAX_ARRETS_TOURNEE, type DepartTournee } from './reglages';

export const FENETRE_DPE_JOURS = 183;
export const MINUTES_PAR_PORTE = 5;

const METRES_PAR_MINUTE = 80;
/** La rue n'est jamais à vol d'oiseau. */
const DETOUR = 1.25;
const DEMI_VIE_DPE_JOURS = 45;
/** Un lead sans DPE frais passe après les diagnostics de moins de cinq mois. */
const PLANCHER_LEAD = 0.08;
const PASSAGE_RECENT_JOURS = 7;
const RAYON_MAX_M = 3_000;
const DEPART_PROCHE_M = 1_000;
const VIVIER_MAX = 300;
const GRAINES_MAX = 10;
const GRAINES_CANDIDATES = 600;
const VOISINAGE_M = 400;
const LETTRES_PASSOIRE = new Set(['F', 'G']);

export type DpeTournee = {
  numeroDpe: string | null;
  banId: string;
  adresse: string;
  codePostal: string | null;
  latitude: number;
  longitude: number;
  /** YYYY-MM-DD */
  date: string;
  lettre: string | null;
  surfaceM2: number | null;
  typeBatiment: string | null;
  parcelleId: string | null;
};

export type LeadTournee = {
  id: string;
  banId: string;
  adresse: string;
  codePostal: string | null;
  latitude: number;
  longitude: number;
  score: number;
  signal: string | null;
  dpeDate: string | null;
  dpeLettre: string | null;
  surfaceM2: number | null;
};

export type AdresseTournee = {
  key: string;
  banId: string | null;
  adresse: string;
  codePostal: string | null;
  latitude: number;
  longitude: number;
  parcelleId: string | null;
  /** DPE le plus récent de l'adresse, YYYY-MM-DD. */
  dernierDpe: string | null;
  nbDpe: number;
  lettre: string | null;
  passoire: boolean;
  surfaceM2: number | null;
  typeBatiment: string | null;
  leadId: string | null;
  leadScore: number | null;
  leadSignal: string | null;
  /** Dernier passage observé dans l'agence, YYYY-MM-DD. */
  dernierPassage: string | null;
};

export type TourneeGeneree = {
  arrets: AdresseTournee[];
  depart: GeoCoord | null;
  departSource: DepartTournee | null;
  minutes: number;
  distanceM: number;
};


function jourUtc(jour: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(jour);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** `dateKeyParis` construit un Intl.DateTimeFormat : une fois par instant, pas une fois par adresse. */
let aujourdhui: { instant: number; utc: number | null } | null = null;

function aujourdhuiUtc(maintenant: Date): number | null {
  const instant = maintenant.getTime();
  if (aujourdhui?.instant !== instant) aujourdhui = { instant, utc: jourUtc(dateKeyParis(maintenant)) };
  return aujourdhui.utc;
}

export function joursDepuis(jour: string, maintenant: Date): number {
  const debut = jourUtc(jour);
  const fin = aujourdhuiUtc(maintenant);
  if (debut === null || fin === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((fin - debut) / 86_400_000));
}

function estPassoire(lettre: string | null): boolean {
  return lettre !== null && LETTRES_PASSOIRE.has(lettre);
}

function point(a: GeoCoord): GeoCoord {
  return { latitude: a.latitude, longitude: a.longitude };
}

/** Tous les collaborateurs comptent : une porte faite par un collègue est faite. */
export function derniersPassagesAgence(passages: readonly PassageObserve[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of passages) {
    if (!p.banId || !p.jour) continue;
    const actuel = out.get(p.banId);
    if (!actuel || p.jour > actuel) out.set(p.banId, p.jour);
  }
  return out;
}

/** Une adresse = un immeuble BAN, avec ses diagnostics et son éventuel lead. */
export function regrouperAdresses(input: {
  dpes: readonly DpeTournee[];
  leads: readonly LeadTournee[];
  passages: ReadonlyMap<string, string>;
}): AdresseTournee[] {
  const dpeVus = new Set<string>();
  const parBan = new Map<string, AdresseTournee>();

  for (const dpe of input.dpes) {
    const cleDpe = dpe.numeroDpe ?? `${dpe.banId}|${dpe.date}|${dpe.surfaceM2 ?? ''}`;
    if (dpeVus.has(cleDpe)) continue;
    dpeVus.add(cleDpe);

    const lettre = dpe.lettre?.trim().toUpperCase() || null;
    const actuelle = parBan.get(dpe.banId);
    if (!actuelle) {
      parBan.set(dpe.banId, {
        key: `ban:${dpe.banId}`,
        banId: dpe.banId,
        adresse: dpe.adresse,
        codePostal: dpe.codePostal,
        latitude: dpe.latitude,
        longitude: dpe.longitude,
        parcelleId: dpe.parcelleId,
        dernierDpe: dpe.date,
        nbDpe: 1,
        lettre,
        passoire: estPassoire(lettre),
        surfaceM2: dpe.surfaceM2,
        typeBatiment: dpe.typeBatiment,
        leadId: null,
        leadScore: null,
        leadSignal: null,
        dernierPassage: null,
      });
      continue;
    }

    actuelle.nbDpe += 1;
    if (estPassoire(lettre)) actuelle.passoire = true;
    if (!actuelle.parcelleId && dpe.parcelleId) actuelle.parcelleId = dpe.parcelleId;
    if (!actuelle.dernierDpe || dpe.date > actuelle.dernierDpe) {
      actuelle.dernierDpe = dpe.date;
      actuelle.lettre = lettre;
      actuelle.surfaceM2 = dpe.surfaceM2;
      actuelle.typeBatiment = dpe.typeBatiment;
    }
  }

  for (const lead of input.leads) {
    const actuelle = parBan.get(lead.banId);
    if (actuelle) {
      if (actuelle.leadScore === null || lead.score > actuelle.leadScore) {
        actuelle.leadId = lead.id;
        actuelle.leadScore = lead.score;
        actuelle.leadSignal = lead.signal;
      }
      continue;
    }
    const lettre = lead.dpeLettre?.trim().toUpperCase() || null;
    const dpeDate = lead.dpeDate?.slice(0, 10) || null;
    parBan.set(lead.banId, {
      key: `ban:${lead.banId}`,
      banId: lead.banId,
      adresse: lead.adresse,
      codePostal: lead.codePostal,
      latitude: lead.latitude,
      longitude: lead.longitude,
      parcelleId: null,
      dernierDpe: dpeDate,
      nbDpe: dpeDate ? 1 : 0,
      lettre,
      passoire: estPassoire(lettre),
      surfaceM2: lead.surfaceM2,
      typeBatiment: null,
      leadId: lead.id,
      leadScore: lead.score,
      leadSignal: lead.signal,
      dernierPassage: null,
    });
  }

  const adresses = [...parBan.values()];
  for (const a of adresses) {
    a.dernierPassage = a.banId ? (input.passages.get(a.banId) ?? null) : null;
  }
  return adresses;
}

/** Faite si on y est passé depuis son dernier DPE, ou dans la semaine. */
export function dejaProspectee(a: AdresseTournee, maintenant: Date): boolean {
  if (!a.dernierPassage) return false;
  if (joursDepuis(a.dernierPassage, maintenant) <= PASSAGE_RECENT_JOURS) return true;
  return !a.dernierDpe || a.dernierPassage >= a.dernierDpe;
}

export function valeurAdresse(a: AdresseTournee, maintenant: Date): number {
  const recence = a.dernierDpe ? 0.5 ** (joursDepuis(a.dernierDpe, maintenant) / DEMI_VIE_DPE_JOURS) : 0;
  const base = a.leadId ? Math.max(recence, PLANCHER_LEAD) : recence;
  const volume = 1 + 0.35 * Math.log2(Math.max(1, a.nbDpe));
  const passoire = a.passoire ? 1.2 : 1;
  const lead = a.leadScore !== null ? 1 + (Math.min(100, Math.max(0, a.leadScore)) / 100) * 0.6 : 1;
  const revisite = a.dernierPassage ? 0.85 : 1;
  return base * volume * passoire * lead * revisite;
}

/** Le secteur choisi sur la carte s'il est le sien, sinon son secteur du jour. */
export function secteurDeTournee(params: {
  zones: readonly Zone[];
  profileId: string;
  directeur: boolean;
  zoneId: string | null;
  maintenant?: Date;
}): Zone | null {
  const actives = params.zones.filter((z) => z.actif);
  const demandee = params.zoneId ? actives.find((z) => z.id === params.zoneId) ?? null : null;
  if (demandee && (params.directeur || demandee.assignedTo === params.profileId)) return demandee;
  const defaut = zoneProspectionParDefaut(actives, params.profileId, params.maintenant);
  return defaut ? actives.find((z) => z.id === defaut) ?? null : null;
}

/** Sans secteur, tout le territoire de l'agence, moins les secteurs des collègues. */
export function adresseDansSecteur(
  a: AdresseTournee,
  ctx: {
    secteur: Zone | null;
    zones: readonly Zone[];
    profileId: string;
    directeur: boolean;
    codesPostaux: ReadonlySet<string>;
  },
): boolean {
  const zone = zoneDeLAdresse(
    adresseAJuger({
      address: a.adresse,
      postalCode: a.codePostal,
      latitude: a.latitude,
      longitude: a.longitude,
      parcelleId: a.parcelleId,
    }),
    ctx.zones,
  );
  if (ctx.secteur) return zone?.id === ctx.secteur.id;
  if (a.codePostal && ctx.codesPostaux.size > 0 && !ctx.codesPostaux.has(a.codePostal)) return false;
  if (!ctx.directeur && zone?.assignedTo && zone.assignedTo !== ctx.profileId) return false;
  return true;
}

function minutesDeMarche(a: GeoCoord, b: GeoCoord): number {
  return (haversineM(a, b) * DETOUR) / METRES_PAR_MINUTE;
}

/** Marche (boucle depuis le départ, sinon chemin ouvert) plus le temps passé à chaque porte. */
export function dureeTourneeMinutes(arrets: readonly GeoCoord[], depart: GeoCoord | null): number {
  if (arrets.length === 0) return 0;
  let marche = 0;
  let precedent: GeoCoord = depart ?? arrets[0]!;
  for (const arret of arrets) {
    marche += minutesDeMarche(precedent, arret);
    precedent = arret;
  }
  if (depart) marche += minutesDeMarche(precedent, depart);
  return marche + arrets.length * MINUTES_PAR_PORTE;
}

export function rayonTourneeM(budgetMinutes: number): number {
  return Math.min(RAYON_MAX_M, ((budgetMinutes / 2) * METRES_PAR_MINUTE) / DETOUR);
}

/** Mètres sur un plan local : à l'échelle d'une ville, l'écart avec la sphère est négligeable. */
type Plan = { x: number; y: number };
type Noeud = Plan & { adresse: AdresseTournee; valeur: number };

const METRES_PAR_DEGRE = 111_320;

function projeteur(latitudeReference: number): (c: GeoCoord) => Plan {
  const kx = Math.cos((latitudeReference * Math.PI) / 180) * METRES_PAR_DEGRE;
  return (c) => ({ x: c.longitude * kx, y: c.latitude * METRES_PAR_DEGRE });
}

function distancePlan(a: Plan, b: Plan): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function minutesPlan(a: Plan, b: Plan): number {
  return (distancePlan(a, b) * DETOUR) / METRES_PAR_MINUTE;
}

function dureePlan(route: readonly Plan[], depart: Plan): number {
  if (route.length === 0) return 0;
  let marche = 0;
  let precedent = depart;
  for (const arret of route) {
    marche += minutesPlan(precedent, arret);
    precedent = arret;
  }
  return marche + minutesPlan(precedent, depart) + route.length * MINUTES_PAR_PORTE;
}

function surcoutInsertion(route: readonly Plan[], depart: Plan, cible: Plan): { position: number; minutes: number } {
  let meilleur = { position: 0, minutes: Number.POSITIVE_INFINITY };
  for (let i = 0; i <= route.length; i += 1) {
    const avant = i === 0 ? depart : route[i - 1]!;
    const apres = i === route.length ? depart : route[i]!;
    const minutes = minutesPlan(avant, cible) + minutesPlan(cible, apres) - minutesPlan(avant, apres);
    if (minutes < meilleur.minutes) meilleur = { position: i, minutes };
  }
  return meilleur;
}

function reordonner(route: readonly Noeud[], depart: GeoCoord): Noeud[] {
  const parCle = new Map(route.map((n) => [n.adresse.key, n]));
  return optimizeLoopOrder(
    route.map((n) => n.adresse),
    depart,
  ).map((a) => parCle.get(a.key)!);
}

type Remplissage = { arrets: AdresseTournee[]; minutes: number; valeur: number };

/** Insertion gloutonne au meilleur rapport valeur / minutes, tant que le temps le permet. */
function remplir(params: {
  vivier: readonly Noeud[];
  depart: GeoCoord;
  departPlan: Plan;
  imposees: readonly Noeud[];
  budget: number;
  max: number;
}): Remplissage {
  const imposeesCles = new Set(params.imposees.map((n) => n.adresse.key));
  let route: Noeud[] = params.imposees.slice(0, params.max);
  const restants = params.vivier.filter((n) => !imposeesCles.has(n.adresse.key));
  let minutes = dureePlan(route, params.departPlan);
  let reordonnee = false;

  while (route.length < params.max && restants.length > 0) {
    let choix = -1;
    let position = 0;
    let cout = 0;
    let meilleurRatio = -1;
    for (let i = 0; i < restants.length; i += 1) {
      const candidat = restants[i]!;
      const insertion = surcoutInsertion(route, params.departPlan, candidat);
      const delta = insertion.minutes + MINUTES_PAR_PORTE;
      if (minutes + delta > params.budget) continue;
      const ratio = candidat.valeur / delta;
      if (ratio > meilleurRatio) {
        meilleurRatio = ratio;
        choix = i;
        position = insertion.position;
        cout = delta;
      }
    }
    if (choix < 0) {
      // Réordonner libère souvent assez de marche pour une porte de plus.
      if (reordonnee || route.length < 3) break;
      route = reordonner(route, params.depart);
      minutes = dureePlan(route, params.departPlan);
      reordonnee = true;
      continue;
    }
    route.splice(position, 0, restants[choix]!);
    restants.splice(choix, 1);
    minutes += cout;
    reordonnee = false;
  }

  route = reordonner(route, params.depart);
  const exactes = (r: readonly Noeud[]) =>
    dureeTourneeMinutes(
      r.map((n) => n.adresse),
      params.depart,
    );
  let minutesExactes = exactes(route);
  // Le plan arrondit : si la sphère déborde d'un cheveu, la porte la moins rentable saute.
  while (minutesExactes > params.budget && route.length > params.imposees.length) {
    let pire = -1;
    for (let i = 0; i < route.length; i += 1) {
      if (imposeesCles.has(route[i]!.adresse.key)) continue;
      if (pire < 0 || route[i]!.valeur < route[pire]!.valeur) pire = i;
    }
    if (pire < 0) break;
    route.splice(pire, 1);
    minutesExactes = exactes(route);
  }

  return {
    arrets: route.map((n) => n.adresse),
    minutes: minutesExactes,
    valeur: route.reduce((somme, n) => somme + n.valeur, 0),
  };
}

/** Les coins les plus denses en DPE frais, assez espacés pour ne pas tester deux fois le même. */
function grainesDuSecteur(noeuds: readonly Noeud[]): Noeud[] {
  const tete = noeuds.slice(0, GRAINES_CANDIDATES);
  const voisinage = new Map<Noeud, number>();
  for (const a of tete) {
    let somme = 0;
    for (const b of tete) {
      if (distancePlan(a, b) <= VOISINAGE_M) somme += b.valeur;
    }
    voisinage.set(a, somme);
  }
  const tries = [...tete].sort((a, b) => (voisinage.get(b) ?? 0) - (voisinage.get(a) ?? 0));

  const graines: Noeud[] = [];
  for (const a of tries) {
    if (graines.length >= GRAINES_MAX) break;
    if (graines.some((g) => distancePlan(g, a) < VOISINAGE_M)) continue;
    graines.push(a);
  }
  return graines;
}

/** Départ : l'adresse imposée, sinon l'agent sur place, sinon l'agence, sinon le meilleur coin du secteur. */
export function genererTournee(input: {
  adresses: readonly AdresseTournee[];
  ancre: AdresseTournee | null;
  position: GeoCoord | null;
  agence: GeoCoord | null;
  budgetMinutes: number;
  maintenant: Date;
  maxArrets?: number;
}): TourneeGeneree {
  const max = Math.max(1, Math.min(input.maxArrets ?? MAX_ARRETS_TOURNEE, MAX_ARRETS_TOURNEE));
  const budget = Math.max(MINUTES_PAR_PORTE, input.budgetMinutes);
  const reference =
    input.ancre?.latitude ?? input.position?.latitude ?? input.agence?.latitude ?? input.adresses[0]?.latitude ?? 0;
  const projeter = projeteur(reference);
  const noeud = (adresse: AdresseTournee, valeur: number): Noeud => ({ ...projeter(adresse), adresse, valeur });

  const noeuds: Noeud[] = [];
  for (const adresse of input.adresses) {
    if (adresse.key === input.ancre?.key) continue;
    const valeur = valeurAdresse(adresse, input.maintenant);
    if (valeur > 0) noeuds.push(noeud(adresse, valeur));
  }
  noeuds.sort((a, b) => b.valeur - a.valeur);

  const rayon = rayonTourneeM(budget);
  function essayer(depart: GeoCoord, source: DepartTournee, imposees: Noeud[]) {
    const departPlan = projeter(depart);
    const vivier: Noeud[] = [];
    for (const n of noeuds) {
      if (vivier.length >= VIVIER_MAX) break;
      if (distancePlan(departPlan, n) <= rayon) vivier.push(n);
    }
    return { ...remplir({ vivier, depart, departPlan, imposees, budget, max }), depart, departSource: source };
  }

  function finaliser(r: ReturnType<typeof essayer>): TourneeGeneree {
    return {
      arrets: r.arrets,
      depart: r.depart,
      departSource: r.departSource,
      minutes: r.minutes,
      distanceM: loopDistanceM(r.arrets, r.depart) * DETOUR,
    };
  }

  if (input.ancre) {
    const ancre = point(input.ancre);
    const surPlace = input.position !== null && haversineM(input.position, ancre) <= DEPART_PROCHE_M;
    const imposee = noeud(input.ancre, valeurAdresse(input.ancre, input.maintenant));
    return finaliser(essayer(surPlace ? point(input.position!) : ancre, surPlace ? 'position' : 'ancre', [imposee]));
  }

  const departsProches: [GeoCoord | null, DepartTournee][] = [
    [input.position, 'position'],
    [input.agence, 'agence'],
  ];
  for (const [depart, source] of departsProches) {
    if (!depart) continue;
    const departPlan = projeter(depart);
    if (noeuds.some((n) => distancePlan(departPlan, n) <= DEPART_PROCHE_M)) {
      return finaliser(essayer(point(depart), source, []));
    }
  }

  let meilleure: ReturnType<typeof essayer> | null = null;
  for (const graine of grainesDuSecteur(noeuds)) {
    const essai = essayer(point(graine.adresse), 'secteur', [graine]);
    if (!meilleure || essai.valeur > meilleure.valeur) meilleure = essai;
  }
  if (!meilleure) return { arrets: [], depart: null, departSource: null, minutes: 0, distanceM: 0 };
  return finaliser(meilleure);
}

function ilYa(jours: number): string {
  if (!Number.isFinite(jours)) return '';
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  if (jours < 14) return 'la semaine dernière';
  if (jours < 60) return `il y a ${Math.round(jours / 7)} semaines`;
  if (jours < 365) return `il y a ${Math.round(jours / 30.4)} mois`;
  return 'il y a plus d’un an';
}

/** Pourquoi cette porte : ce que l'agent lit sous l'adresse. */
export function raisonArret(a: AdresseTournee, maintenant: Date): string | null {
  const morceaux: string[] = [];
  if (a.dernierDpe) {
    const quand = ilYa(joursDepuis(a.dernierDpe, maintenant));
    morceaux.push(
      a.nbDpe > 1
        ? `${a.nbDpe} DPE, le dernier ${quand}`
        : `DPE${a.lettre ? ` ${a.lettre}` : ''} ${quand}`.trim(),
    );
  }
  if (a.leadId) morceaux.push(a.leadSignal?.trim() || 'Lead');
  if (a.dernierPassage) morceaux.push('nouveau depuis votre passage');
  return morceaux.length > 0 ? morceaux.join(' · ') : null;
}

export function versArretSortie(
  a: AdresseTournee,
  maintenant: Date,
  options: { ancre?: boolean } = {},
): SortieStop {
  const key = a.leadId ?? a.key;
  return {
    key,
    leadId: key,
    address: a.adresse,
    latitude: a.latitude,
    longitude: a.longitude,
    score: a.leadScore ?? 0,
    surfaceM2: a.surfaceM2,
    etage: null,
    mainSignalLabel: raisonArret(a, maintenant) ?? (options.ancre ? 'Votre adresse de passage' : null),
    notes: null,
    banId: a.banId,
    postalCode: a.codePostal,
    dernierPassageJour: a.dernierPassage,
  };
}

export function adresseLibre(params: {
  label: string;
  latitude: number;
  longitude: number;
  banId: string | null;
  codePostal: string | null;
}): AdresseTournee {
  return {
    key: params.banId
      ? `ban:${params.banId}`
      : `pt:${params.latitude.toFixed(5)},${params.longitude.toFixed(5)}`,
    banId: params.banId,
    adresse: params.label,
    codePostal: params.codePostal,
    latitude: params.latitude,
    longitude: params.longitude,
    parcelleId: null,
    dernierDpe: null,
    nbDpe: 0,
    lettre: null,
    passoire: false,
    surfaceM2: null,
    typeBatiment: null,
    leadId: null,
    leadScore: null,
    leadSignal: null,
    dernierPassage: null,
  };
}
