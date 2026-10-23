/**
 * Localiser une annonce collée par l'agent : retrouver son logement dans la
 * base DPE de l'ADEME, puis l'immeuble (parcelle).
 *
 * Portage du localiseur du pipeline (recherche_adresse.py), avec une règle de
 * précision plus stricte : jamais d'adresse tirée du seul code postal sur la
 * surface. Dans un code postal parisien, 3 218 DPE font 32 m² à ±1 près ; 143
 * ont la même conso et les mêmes émissions à ±1 ; avec la surface en plus, il
 * en reste un ou deux. D'où :
 *   - conso chiffrée exigée pour chercher dans un code postal ;
 *   - sans conso, surface dans un repère de 250 m, ou 650 m avec la lettre DPE ;
 *   - une adresse seulement si le meilleur DPE devance nettement la meilleure
 *     autre adresse (mêmes seuils que le pipeline) ;
 *   - le quartier publié ET tout le code postal sont fouillés, puis notés
 *     ensemble : un quartier mal centré ne cache plus le bon logement, et un
 *     DPE seul dans le quartier ne l'emporte plus par forfait ;
 *   - jamais d'adresse affirmée dans un autre code postal que celui de l'annonce.
 *
 * Réseau : l'API ADEME en filtres `_gte`/`_lte`/`_eq` (le WAF refuse `qs`),
 * la BAN pour une adresse publiée, l'API Carto pour la parcelle.
 */
import { fetchParcelleAuPoint } from '@/lib/geo/cadastre-point';
import type { AdressePossible } from '@/lib/annonces/types';
import { RAYON_ECOLES_M } from './ecoles';
import type { FicheAnnonce, LocalisationImport } from './types';

const ADEME_BASE = process.env.ADEME_API_BASE ?? 'https://data.ademe.fr/data-fair/api/v1/datasets';
const DATASET = process.env.ADEME_DPE_DATASET ?? 'dpe03existant';
const BAN_REVERSE = 'https://api-adresse.data.gouv.fr/reverse/';
const ENTETES = { accept: 'application/json', 'user-agent': 'Priimo/1.0 (localisation-annonce)' } as const;

const CHAMPS = [
  'numero_dpe',
  'date_etablissement_dpe',
  'adresse_ban',
  'identifiant_ban',
  'code_postal_ban',
  'nom_rue_ban',
  '_geopoint',
  'type_batiment',
  'surface_habitable_logement',
  'numero_etage_appartement',
  'complement_adresse_logement',
  'etiquette_dpe',
  'conso_5_usages_par_m2_ep',
  'etiquette_ges',
  'emission_ges_5_usages_par_m2',
  'type_energie_principale_chauffage',
  'annee_construction',
  'periode_construction',
  'cout_total_5_usages',
].join(',');

/** Fenêtres de recherche autour des valeurs de l'annonce (souvent arrondies à l'unité). */
const FENETRE_CONSO = 1.5;
const FENETRE_GES = 1.5;
const FENETRE_SURFACE = 3;
/** Sans conso, la surface ne suffit que dans un repère serré. */
const RAYON_MAX_SANS_CONSO_M = 250;
/** Avec la lettre DPE, un quartier SeLoger (~500 m) reste assez petit pour départager. */
const RAYON_MAX_AVEC_LETTRE_M = 650;

/**
 * Le repère publié (quartier SeLoger, cercle Leboncoin) n'est qu'approché : le
 * vrai logement en sort parfois de 200 m (73 bd Richard Lenoir, 12e étage, hors
 * du quartier « République-Saint Ambroise », vu le 21/10/2026). Au-delà de la
 * première marge, au mieux « probable » ; au-delà de la seconde, jamais affirmé.
 */
const MARGE_HORS_REPERE_M = 150;
/** Carrez, mezzanine, arrondi : quelques m² d'écart entre l'annonce et le DPE, pas davantage. */
const ECART_SURFACE_MAX_M2 = 6;
/**
 * Au-delà de 1,5 m² d'écart, la surface ne départage plus un jumeau d'un autre
 * immeuble (même conso, même GES) quand le vrai DPE n'est pas encore publié :
 * seul l'étage confirmé autorise alors une adresse (banc d'essai du 22/10/2026).
 */
const ECART_SURFACE_SUR_M2 = 1.5;
/** Avance minimale d'une adresse « probable » quand l'annonce ne publie que les lettres du DPE. */
const ECART_PROBABLE_LETTRES = 15;
const MARGE_HORS_REPERE_MAX_M = 400;
/**
 * Un repère de 85 m au plus est un point retrouvé (distances aux écoles SeLoger,
 * immeuble neuf entre ses voisins) : le DPE doit y être, à 40 m près ; au-delà
 * de 120 m, c'est un autre immeuble.
 */
const RAYON_POINT_PRECIS_M = 85;
const MARGE_POINT_PRECIS_M = 40;
const LOIN_DU_POINT_PRECIS_M = 120;
/** Un DPE à plus de 80 m de l'adresse posée sur la carte (entrées d'un grand immeuble comprises) en est un autre. */
const LOIN_ADRESSE_PUBLIEE_M = 80;
/**
 * Un DPE aussi ressemblant (note sans le lieu), à moins de 600 m du point de la carte mais pas dessus :
 * l'un des deux trompe, les deux adresses sont proposées.
 */
const SCORE_DPE_CONTRADICTOIRE = 60;
const SOSIE_VOISIN_MAX_M = 600;

/**
 * Version des règles de localisation. À AVANCER À CHAQUE CHANGEMENT de règle :
 * une lecture gardée en cache avant cette date est refaite au lieu d'être
 * resservie (le 22/10/2026, « 14 rue du Surmelin », issu d'une règle corrigée
 * le matin même, revenait du cache pendant 7 jours).
 */
export const MOTEUR_LOCALISATION_DEPUIS = '2026-10-23T14:00:00Z';

/** (score minimal du meilleur, écart minimal avec la meilleure AUTRE adresse) — comme le pipeline. */
const SEUILS = { certaine: [60, 25], probable: [40, 10] } as const;

const PLAFONDS_CONSO: Record<string, number> = { A: 70, B: 110, C: 180, D: 250, E: 330, F: 420 };
const PLAFONDS_GES: Record<string, number> = { A: 6, B: 11, C: 30, D: 50, E: 70, F: 100 };

export type LigneDpe = Record<string, unknown>;
type Fetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function texteNormalise(t: string | null | undefined): string {
  return (t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* -------------------------------------------------------------------------- */
/*                         Valeurs comparables et requête                     */
/* -------------------------------------------------------------------------- */

/** Conso et émissions utilisables : une valeur hors de sa classe est une faute de saisie. */
export function valeursFiables(f: Pick<FicheAnnonce, 'consoKwhM2' | 'gesKgM2' | 'dpe' | 'ges' | 'dpeApresJuillet2021'>): {
  conso: number | null;
  ges: number | null;
} {
  if (f.dpeApresJuillet2021 === false) return { conso: null, ges: null };
  const plafondC = PLAFONDS_CONSO[(f.dpe ?? '').toUpperCase()];
  const plafondG = PLAFONDS_GES[(f.ges ?? '').toUpperCase()];
  const conso = f.consoKwhM2 != null && f.consoKwhM2 > 0 && !(plafondC && f.consoKwhM2 > 1.5 * plafondC) ? f.consoKwhM2 : null;
  const ges = f.gesKgM2 != null && f.gesKgM2 >= 0 && !(plafondG && f.gesKgM2 > 1.5 * plafondG) ? f.gesKgM2 : null;
  return { conso, ges };
}

export type RequeteDpe = { params: Record<string, string>; portee: 'zone' | 'code_postal' };

/* -------------------------------------------------------------------------- */
/*                  Empreinte : les dépenses annuelles d'énergie              */
/* -------------------------------------------------------------------------- */

/**
 * La fourchette légale de l'annonce (« entre 2 320 et 3 180 € par an ») est
 * centrée sur le coût du DPE, bornes arrondies à la dizaine : 2 750 € au milieu,
 * 2 750 € dans la base (73 bd Richard Lenoir) ; 1 055 / 1 057 (55 bd de Charonne) ;
 * 1 360 / 1 358 (24 rue de Lappe). Un autre logement s'en écarte : 778 / 909
 * (« 5 rue Titon »), 705 / 691 (58 bd de Charonne). Mesuré le 22/10/2026.
 */
export function milieuDepenses(f: Pick<FicheAnnonce, 'depensesEnergie'>): number | null {
  const d = f.depensesEnergie;
  return d && d.max > d.min ? (d.min + d.max) / 2 : null;
}
const ecartDepensesEgal = (milieu: number) => Math.max(6, milieu * 0.004);
const ecartDepensesAutre = (milieu: number) => Math.max(12, milieu * 0.01);

/** 'egal' : ce DPE est celui de l'annonce ; 'autre' : un autre logement ; null : rien à comparer. */
export function accordDepenses(f: Pick<FicheAnnonce, 'depensesEnergie'>, dpe: LigneDpe): 'egal' | 'autre' | null {
  const milieu = milieuDepenses(f);
  const cout = num(dpe.cout_total_5_usages);
  if (milieu == null || cout == null) return null;
  const e = Math.abs(cout - milieu);
  if (e <= ecartDepensesEgal(milieu)) return 'egal';
  return e > ecartDepensesAutre(milieu) ? 'autre' : null;
}

/** Par l'empreinte seule : Leboncoin et PAP n'ont souvent que des lettres, mais la fourchette est là. */
function requetesDepenses(f: FicheAnnonce): RequeteDpe[] {
  const milieu = milieuDepenses(f);
  if (milieu == null) return [];
  const lieux: { lieu: Record<string, string>; portee: RequeteDpe['portee'] }[] = [];
  const z = f.zone;
  if (z) lieux.push({ lieu: { geo_distance: `${z.longitude},${z.latitude},${Math.round(z.rayonM + MARGE_HORS_REPERE_MAX_M)}` }, portee: 'zone' });
  if (f.codePostal && /^\d{5}$/.test(f.codePostal)) lieux.push({ lieu: { code_postal_ban_eq: f.codePostal }, portee: 'code_postal' });
  const requetes: RequeteDpe[] = [];
  for (const { lieu, portee } of lieux) {
    const base: Record<string, string> = { ...lieu };
    fourchette(base, 'cout_total_5_usages', milieu, ecartDepensesAutre(milieu));
    if (f.surface) {
      const avecSurface = { ...base };
      fourchette(avecSurface, 'surface_habitable_logement', f.surface, ECART_SURFACE_MAX_M2);
      requetes.push({ params: avecSurface, portee });
    }
    requetes.push({ params: base, portee });
  }
  return requetes;
}

function fourchette(params: Record<string, string>, champ: string, valeur: number, fenetre: number) {
  params[`${champ}_gte`] = String(Math.round((valeur - fenetre) * 10) / 10);
  params[`${champ}_lte`] = String(Math.round((valeur + fenetre) * 10) / 10);
}

/** Les requêtes à tenter, de la plus serrée à la plus large. Vide : pas de localisation précise possible. */
/** La rue publiée, fouillée en entier (`nom_rue_ban`) : surface, puis conso ou étiquette. */
function requetesVoie(f: FicheAnnonce, conso: number | null, ges: number | null): RequeteDpe[] {
  if (!f.voiePubliee || !f.codePostal || !/^\d{5}$/.test(f.codePostal)) return [];
  const base: Record<string, string> = { nom_rue_ban_eq: f.voiePubliee, code_postal_ban_eq: f.codePostal };
  if (conso != null) {
    fourchette(base, 'conso_5_usages_par_m2_ep', conso, FENETRE_CONSO);
    if (ges != null) fourchette(base, 'emission_ges_5_usages_par_m2', ges, FENETRE_GES);
  } else {
    const etiquette = pireLettre(f.dpe, f.ges);
    if (etiquette) base.etiquette_dpe_eq = etiquette;
  }
  const requetes: RequeteDpe[] = [];
  if (f.surface) {
    const avecSurface = { ...base };
    fourchette(avecSurface, 'surface_habitable_logement', f.surface, FENETRE_SURFACE);
    requetes.push({ params: avecSurface, portee: 'zone' });
  }
  requetes.push({ params: base, portee: 'zone' });
  return requetes;
}

export function requetesDpe(f: FicheAnnonce): RequeteDpe[] {
  const { conso, ges } = valeursFiables(f);
  return [...requetesVoie(f, conso, ges), ...requetesHorsVoie(f, conso, ges), ...requetesDepenses(f)];
}

function requetesHorsVoie(f: FicheAnnonce, conso: number | null, ges: number | null): RequeteDpe[] {
  const z = f.zone;
  if (conso != null) {
    const lieux: { lieu: Record<string, string>; portee: RequeteDpe['portee'] }[] = [];
    if (z) lieux.push({ lieu: { geo_distance: `${z.longitude},${z.latitude},${Math.max(300, Math.round(z.rayonM + 150))}` }, portee: 'zone' });
    if (f.codePostal && /^\d{5}$/.test(f.codePostal)) lieux.push({ lieu: { code_postal_ban_eq: f.codePostal }, portee: 'code_postal' });
    const requetes: RequeteDpe[] = [];
    for (const { lieu, portee } of lieux) {
      const base: Record<string, string> = { ...lieu };
      fourchette(base, 'conso_5_usages_par_m2_ep', conso, FENETRE_CONSO);
      if (ges != null) fourchette(base, 'emission_ges_5_usages_par_m2', ges, FENETRE_GES);
      if (f.surface) {
        const avecSurface = { ...base };
        fourchette(avecSurface, 'surface_habitable_logement', f.surface, FENETRE_SURFACE);
        requetes.push({ params: avecSurface, portee });
      }
      // Surface de l'annonce parfois loin de celle du DPE (Carrez, mezzanine) : la conso tient seule.
      requetes.push({ params: base, portee });
    }
    return requetes;
  }
  if (z && f.surface) {
    const max = f.dpe ? RAYON_MAX_AVEC_LETTRE_M : RAYON_MAX_SANS_CONSO_M;
    if (z.rayonM <= max) {
      const params: Record<string, string> = {
        geo_distance: `${z.longitude},${z.latitude},${Math.round(z.rayonM + 120)}`,
      };
      fourchette(params, 'surface_habitable_logement', f.surface, FENETRE_SURFACE);
      // L'étiquette du DPE est la pire des classes énergie et climat.
      const etiquette = pireLettre(f.dpe, f.ges);
      if (etiquette) params.etiquette_dpe_eq = etiquette;
      return [{ params, portee: 'zone' }];
    }
  }
  return [];
}

export function urlAdeme(params: Record<string, string>, taille = 200): string {
  const url = new URL(`${ADEME_BASE}/${DATASET}/lines`);
  url.searchParams.set('size', String(taille));
  url.searchParams.set('select', CHAMPS);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

const fetcherParDefaut: Fetcher = (url) =>
  fetch(url, { headers: ENTETES, cache: 'no-store', signal: AbortSignal.timeout(8_000) });

/**
 * Toutes les requêtes, en parallèle, réunies sans doublon : le quartier ET le
 * code postal. La portée « zone » dit qu'un repère publié encadre la recherche
 * (le score pénalise ce qui en sort) ; « code_postal », qu'il n'y en a pas.
 */
export async function chercherCandidats(
  f: FicheAnnonce,
  fetcher: Fetcher = fetcherParDefaut,
): Promise<{ lignes: LigneDpe[]; portee: 'zone' | 'code_postal' | null }> {
  const requetes = requetesDpe(f);
  const reponses = await Promise.all(
    requetes.map(async (requete) => {
      try {
        const res = await fetcher(urlAdeme(requete.params));
        if (!res.ok) return [];
        const body = (await res.json()) as { results?: unknown };
        return Array.isArray(body.results) ? (body.results as LigneDpe[]) : [];
      } catch {
        // ADEME indisponible ou lente : les autres requêtes restent.
        return [];
      }
    }),
  );
  const vus = new Set<string>();
  const lignes: LigneDpe[] = [];
  for (const ligne of reponses.flat()) {
    const cle = String(ligne.numero_dpe ?? JSON.stringify(ligne));
    if (vus.has(cle)) continue;
    vus.add(cle);
    lignes.push(ligne);
  }
  if (lignes.length === 0) return { lignes, portee: null };
  return { lignes, portee: requetes.some((r) => r.portee === 'zone') ? 'zone' : 'code_postal' };
}

/* -------------------------------------------------------------------------- */
/*                                    Score                                   */
/* -------------------------------------------------------------------------- */

const RE_ETAGE = /(?:[ée]tage|etg|niveau)\s*[:.]?\s*(-?\d{1,2})\b|\b(\d{1,2})\s*(?:er|e|[èe]me)\s*[ée]tage/i;
const RE_RDC = /\brdc\b|rez[- ]de[- ]chauss/i;

/** Étage lu dans le complément d'adresse ; 0 dans `numero_etage_appartement` est une valeur par défaut. */
/** « BAT E 7EME GAUCHE », « 3ème droite », « R+3 » : l'étage sans le mot « étage ». */
const RE_ETAGE_COURT = /\bR\s*\+\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:er|[èe]me|eme)\b/i;

export function etageDpe(dpe: LigneDpe): number | null {
  const complement = String(dpe.complement_adresse_logement ?? '');
  const m = complement.match(RE_ETAGE);
  if (m) return Number(m[1] ?? m[2]);
  if (RE_RDC.test(complement)) return 0;
  const court = complement.match(RE_ETAGE_COURT);
  if (court) return Number(court[1] ?? court[2]);
  const n = num(dpe.numero_etage_appartement);
  return n == null || n === 0 ? null : n;
}

function geopoint(dpe: LigneDpe): { lat: number; lon: number } | null {
  const [lat, lon] = String(dpe._geopoint ?? '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat: lat!, lon: lon! } : null;
}

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const k = Math.cos((a.lat * Math.PI) / 180) * 111_320;
  return Math.hypot((a.lon - b.lon) * k, (a.lat - b.lat) * 110_540);
}

const TYPES_VOIE = ['rue', 'boulevard', 'bd', 'avenue', 'av', 'passage', 'impasse', 'cite', 'villa', 'quai', 'allee', 'square', 'faubourg', 'place', 'chemin', 'cours'];
const TYPES_RUE_RE = 'rue|boulevard|bd|avenue|av|passage|impasse|cit[ée]|villa|quai|all[ée]e|square|faubourg|place|chemin|cours';
const SYNONYMES: Record<string, string> = { bd: 'boulevard', av: 'avenue' };
const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux']);
const PROXIMITE = new Set(['pas', 'proche', 'proximite', 'pres', 'minutes', 'min', 'entre', 'face', 'vue', 'metro', 'station', 'voisin', 'environs', 'depuis']);
/** Une rue écrite près de ces mots est celle de l'agence, pas celle du bien. */
const CONTEXTE_AGENCE = new Set(['agence', 'agences', 'bureau', 'bureaux', 'contact', 'contactez', 'siege', 'cabinet', 'notre', 'nos', 'rendez', 'adresse']);

function sansParticules(mots: string[]): string[] {
  const m = [...mots];
  while (m.length && PARTICULES.has(m[0]!)) m.shift();
  return m;
}

/** La voie du DPE est-elle donnée comme adresse dans la description ? (pas « à deux pas de… »). */
export function rueCitee(adresseBan: string | null | undefined, description: string | null | undefined): boolean {
  const adresse = texteNormalise(adresseBan).replace(/\s\d{5}\b.*$/, '');
  const mots = adresse.split(' ').filter(Boolean);
  while (mots.length && /^(\d+[a-z]?|bis|ter|quater)$/.test(mots[0]!)) mots.shift();
  if (mots.length < 2) return false;
  const typeVoie = SYNONYMES[mots[0]!] ?? mots[0]!;
  const coeur = sansParticules(mots.slice(1));
  const desc = texteNormalise(description).split(' ').filter(Boolean);
  for (let i = 0; i < desc.length; i += 1) {
    const mot = SYNONYMES[desc[i]!] ?? desc[i]!;
    if (!TYPES_VOIE.includes(desc[i]!) && !TYPES_VOIE.includes(mot)) continue;
    if (desc.slice(Math.max(0, i - 5), i).some((x) => PROXIMITE.has(x))) continue;
    const suite = sansParticules(desc.slice(i + 1, i + 8));
    if (mot === typeVoie && coeur.length && coeur.every((c, j) => suite[j] === c)) return true;
  }
  return false;
}

/**
 * Rue écrite comme adresse du bien, pas comme un repère (« à deux pas de… »).
 * « 12 rue Oberkampf » ou « situé rue Mouraud ». La casse d’origine est gardée.
 */
export function rueDepuisTexte(source: string | null | undefined): string | null {
  if (!source) return null;
  const re = new RegExp(
    `(^|[^\\p{L}\\d])(?:n(?:°|o)?\\s*)?(\\d{1,4}[a-zA-Z]?(?:\\s*(?:bis|ter|quater))?)?\\s*(${TYPES_RUE_RE})\\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'\\- ]{1,40})`,
    'giu',
  );
  let trouvee: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const avant = texteNormalise(source.slice(Math.max(0, m.index - 48), m.index));
    if (avant.split(' ').some((x) => PROXIMITE.has(x) || CONTEXTE_AGENCE.has(x))) continue;
    const numero = m[2]?.trim() ?? '';
    const type = m[3]!;
    const gardes: string[] = [];
    for (const mot of m[4]!.trim().split(/\s+/)) {
      const n = texteNormalise(mot.replace(/[.,;:]+$/, ''));
      if (!n) break;
      if (TYPES_VOIE.includes(n) || TYPES_VOIE.includes(SYNONYMES[n] ?? '')) break;
      if (PROXIMITE.has(n) || /^(m2|piece|pieces|appartement|maison|dpe|etage|er|eme)$/.test(n)) break;
      if (/^\d{5}$/.test(n) || /^\d+[eè]?$/.test(n)) break;
      gardes.push(mot.replace(/[.,;:]+$/, ''));
      if (gardes.length >= 5 && !PARTICULES.has(n)) break;
    }
    while (gardes.length && PARTICULES.has(texteNormalise(gardes[gardes.length - 1]!))) gardes.pop();
    if (!sansParticules(gardes.map((g) => texteNormalise(g))).length) continue;
    const rue = [numero, type, gardes.join(' ')].filter(Boolean).join(' ');
    if (numero) return rue;
    if (!trouvee) trouvee = rue;
  }
  return trouvee;
}

function voieDe(adresse: unknown): string {
  return texteNormalise(String(adresse ?? ''))
    .replace(/^\d+[a-z]?\s+(?:bis|ter|quater)?\s*/i, '')
    .replace(/\s\d{5}\b.*$/, '')
    .trim();
}

function voieAffichable(adresse: unknown): string {
  return String(adresse ?? '')
    .replace(/^\s*\d+[a-z]?\s+(?:bis|ter|quater)?\s*/i, '')
    .replace(/\s+\d{5}\b.*$/, '')
    .trim();
}

/** Un DPE ne compte pour « la rue » qu'avec une note correcte ; il en faut deux au moins (un seul ne fait pas une rue). */
const SCORE_MEME_VOIE = 25;

/** Les meilleurs DPE du secteur tombent tous dans la même rue (deux au moins). */
function dpesMemeVoie(lignes: readonly LigneDpe[], f: FicheAnnonce): { voie: string; dpes: LigneDpe[] } | null {
  const notes = lignes.map((dpe) => ({ dpe, ...scorerCandidat(f, dpe) })).filter((n) => n.score >= SCORE_MEME_VOIE);
  if (notes.length < 2) return null;
  const voie = voieDe(notes[0]!.dpe.adresse_ban);
  if (!voie || voie.split(' ').length < 2) return null;
  if (!notes.every((n) => voieDe(n.dpe.adresse_ban) === voie)) return null;
  return { voie: voieAffichable(notes[0]!.dpe.adresse_ban) || voie, dpes: notes.map((n) => n.dpe) };
}

const FAMILLES: Record<string, string[]> = {
  electricite: ['electri'],
  gaz: ['gaz'],
  fioul: ['fioul', 'fuel'],
  bois: ['bois', 'granule'],
  reseau: ['reseau', 'urbain'],
};

function familles(t: string | null | undefined): Set<string> {
  const n = texteNormalise(t);
  return new Set(Object.entries(FAMILLES).filter(([, r]) => r.some((x) => n.includes(x))).map(([f]) => f));
}

function jours(a: string | null | undefined, b: string | null | undefined): number | null {
  const da = Date.parse(a ?? '');
  const db = Date.parse(b ?? '');
  return Number.isFinite(da) && Number.isFinite(db) ? Math.round((da - db) / 86_400_000) : null;
}

/** La plus mauvaise des deux lettres (A meilleure, G pire) ; l'autre si l'une manque. */
export function pireLettre(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = /^[A-G]$/i.test(a ?? '') ? a!.toUpperCase() : null;
  const y = /^[A-G]$/i.test(b ?? '') ? b!.toUpperCase() : null;
  if (!x) return y;
  if (!y) return x;
  return x > y ? x : y;
}

/** Le DPE est-il sur la rue publiée par le portail ? Nom BAN comparé sans casse ni accents. */
function surLaVoie(f: FicheAnnonce, dpe: LigneDpe): boolean {
  return Boolean(f.voiePubliee) && texteNormalise(String(dpe.nom_rue_ban ?? '')) === texteNormalise(f.voiePubliee);
}

function codePostalDpe(dpe: LigneDpe): string | null {
  return String(dpe.code_postal_ban ?? '').match(/^\d{5}$/)?.[0] ?? null;
}

/** Note un DPE candidat ; raisons lisibles (« +35 conso … »), comme le pipeline. */
export function scorerCandidat(f: FicheAnnonce, dpe: LigneDpe): { score: number; raisons: string[] } {
  let points = 0;
  const raisons: string[] = [];
  const note = (delta: number, raison: string) => {
    points += delta;
    raisons.push(`${delta > 0 ? '+' : ''}${delta} ${raison}`);
  };

  const typeDpe = String(dpe.type_batiment ?? '').toLowerCase();
  if (f.typeBien && f.typeBien !== 'autre' && typeDpe && typeDpe !== f.typeBien) {
    note(typeDpe === 'appartement' || typeDpe === 'maison' ? -20 : -10, `DPE de type « ${typeDpe} »`);
  }

  const { conso, ges } = valeursFiables(f);
  const consoD = num(dpe.conso_5_usages_par_m2_ep);
  if (conso != null && consoD != null) {
    const e = Math.abs(conso - consoD);
    if (e <= 1) note(35, `conso ${consoD} kWh/m² = annonce ${conso}`);
    else if (e <= 3) note(20, `conso ${consoD} kWh/m² ≈ annonce ${conso}`);
    else if (e > 8) note(-40, `conso ${consoD} kWh/m² ≠ annonce ${conso}`);
  }
  const gesD = num(dpe.emission_ges_5_usages_par_m2);
  if (ges != null && gesD != null) {
    const e = Math.abs(ges - gesD);
    if (e <= 1) note(15, `GES ${gesD} kg CO₂/m² = annonce ${ges}`);
    else if (e <= 2) note(6, `GES ${gesD} kg CO₂/m² ≈ annonce ${ges}`);
    else if (e > 4) note(-20, `GES ${gesD} kg CO₂/m² ≠ annonce ${ges}`);
  }
  const depenses = accordDepenses(f, dpe);
  if (depenses) {
    const libelle = `dépenses d'énergie ${Math.round(num(dpe.cout_total_5_usages)!)} €/an`;
    if (depenses === 'autre') note(-35, `${libelle} ≠ annonce ${Math.round(milieuDepenses(f)!)}`);
    // Un coût qui coïncide malgré une conso ou des émissions contraires ne prouve rien.
    else if (!chiffresContredits(f, dpe) && consoCompatible(f, dpe)) note(35, `${libelle} = annonce ${Math.round(milieuDepenses(f)!)}`);
  }
  if (f.dpeApresJuillet2021 !== false) {
    // Depuis 2021, l'étiquette du DPE est la pire des classes énergie et climat ;
    // SeLoger affiche la classe énergie seule (E à 325 kWh, GES F → étiquette F).
    const etiquetteAttendue = pireLettre(f.dpe, f.ges);
    for (const [lettreA, champ, nom, bonus, malus] of [
      [etiquetteAttendue, 'etiquette_dpe', 'DPE', 5, -30],
      [f.ges, 'etiquette_ges', 'GES', 3, -15],
    ] as const) {
      const lettreD = String(dpe[champ] ?? '');
      if (lettreA && lettreD) {
        if (lettreA.toUpperCase() === lettreD.toUpperCase()) note(bonus, `étiquette ${nom} ${lettreD}`);
        else note(malus, `étiquette ${nom} ${lettreD} ≠ annonce ${lettreA}`);
      }
    }
  }

  const surfaceD = num(dpe.surface_habitable_logement);
  if (f.surface && surfaceD) {
    const e = Math.abs(f.surface - surfaceD);
    const libelle = `surface ${surfaceD} m² / annonce ${f.surface}`;
    if (e <= 0.5) note(20, libelle);
    else if (e <= 1.5) note(12, libelle);
    else if (e <= 3) note(5, libelle);
    else if (e <= 6) note(-5, libelle);
    else note(-25, libelle);
  }

  const etageD = etageDpe(dpe);
  if (f.etage != null && etageD != null) {
    if (f.etage === etageD) note(8, `étage ${etageD}`);
    else note(-12, `étage ${etageD} ≠ annonce ${f.etage}`);
  }

  if (rueCitee(String(dpe.adresse_ban ?? ''), f.description)) note(12, 'voie citée dans la description');

  if (f.voiePubliee) {
    if (surLaVoie(f, dpe)) note(25, `sur la rue publiée (${f.voiePubliee})`);
    else note(-20, 'hors de la rue publiée');
  }

  const cpDpe = codePostalDpe(dpe);
  if (f.codePostal && cpDpe && cpDpe !== f.codePostal) note(-15, `code postal ${cpDpe} ≠ annonce ${f.codePostal}`);

  const point = geopoint(dpe);
  if (f.zone && point) {
    const d = distanceM(point, { lat: f.zone.latitude, lon: f.zone.longitude });
    if (f.zone.rayonM === 0) {
      const libelle = `à ${Math.round(d)} m de l'adresse publiée`;
      if (d <= 15) note(25, libelle);
      else if (d <= 30) note(15, libelle);
      else if (d <= 60) note(5, libelle);
      else if (d > MARGE_HORS_REPERE_MAX_M) note(-30, libelle);
      else if (d > 200) note(-10, libelle);
    } else if (f.zone.rayonM <= RAYON_POINT_PRECIS_M) {
      // Un point retrouvé à quelques dizaines de mètres (écoles SeLoger, numéros voisins) désigne l'immeuble.
      const libelle = `à ${Math.round(d)} m du point retrouvé`;
      if (d <= f.zone.rayonM) note(20, libelle);
      else if (d <= f.zone.rayonM + MARGE_POINT_PRECIS_M) note(5, libelle);
      else if (d > f.zone.rayonM + LOIN_DU_POINT_PRECIS_M) note(-40, libelle);
    } else if (d <= f.zone.rayonM) {
      note(4, 'dans le repère publié');
    } else if (d > f.zone.rayonM + MARGE_HORS_REPERE_MAX_M) {
      note(-30, `à ${Math.round(d - f.zone.rayonM)} m hors du repère publié`);
    } else if (d > f.zone.rayonM + MARGE_HORS_REPERE_M) {
      note(-15, `à ${Math.round(d - f.zone.rayonM)} m hors du repère publié`);
    }
  }

  const fa = familles(f.chauffage);
  const fd = familles(String(dpe.type_energie_principale_chauffage ?? ''));
  if (fa.size && fd.size) {
    if ([...fa].some((x) => fd.has(x))) note(3, 'chauffage concordant');
    else note(-6, 'chauffage différent');
  }

  if (f.anneeConstruction) {
    const anneeD = num(dpe.annee_construction);
    if (anneeD) note(Math.abs(anneeD - f.anneeConstruction) <= 5 ? 3 : -4, `construction ${anneeD}`);
  }

  if (f.dateDpe && dpe.date_etablissement_dpe) {
    const e = jours(f.dateDpe, String(dpe.date_etablissement_dpe));
    if (e != null) note(Math.abs(e) <= 1 ? 25 : Math.abs(e) <= 7 ? 8 : -15, `DPE du ${String(dpe.date_etablissement_dpe).slice(0, 10)}`);
  } else if (f.datePublication && dpe.date_etablissement_dpe) {
    const e = jours(f.datePublication, String(dpe.date_etablissement_dpe));
    if (e != null) {
      if (e < -3) note(-10, 'DPE établi après la mise en ligne');
      else if (e <= 30) note(8, `DPE établi ${Math.max(e, 0)} j avant la mise en ligne`);
      else if (e <= 180) note(4, `DPE établi ${e} j avant la mise en ligne`);
    }
  }

  return { score: Math.round(points * 10) / 10, raisons };
}

/** « 12 Rue X 75020 Paris » et « 12 Rue X » : même immeuble. */
function cleAdresse(adresse: unknown): string {
  return texteNormalise(String(adresse ?? '')).replace(/\s\d{5}\b.*$/, '');
}

/** Un chiffre publié qui contredit (conso à plus de 8 kWh, GES à plus de 4 kg) : un autre logement. */
function chiffresContredits(f: FicheAnnonce, dpe: LigneDpe): boolean {
  const { conso, ges } = valeursFiables(f);
  const c = num(dpe.conso_5_usages_par_m2_ep);
  const g = num(dpe.emission_ges_5_usages_par_m2);
  return (conso != null && c != null && Math.abs(conso - c) > 8) || (ges != null && g != null && Math.abs(ges - g) > 4);
}

/**
 * Le coût ne vaut empreinte qu'avec une conso publiée retrouvée à 3 kWh près : à
 * ±6 €, des dizaines de logements d'un arrondissement partagent le même coût
 * (banc d'essai du 23/10/2026, vrai DPE retiré : 24 jumeaux sur 70 affirmés).
 */
function consoCompatible(f: FicheAnnonce, dpe: LigneDpe): boolean {
  const { conso } = valeursFiables(f);
  const c = num(dpe.conso_5_usages_par_m2_ep);
  return conso == null || c == null || Math.abs(conso - c) <= 3;
}

/** Les chiffres publiés retrouvés à l'unité près (rien de publié : rien à redire). */
function chiffresExacts(f: FicheAnnonce, dpe: LigneDpe): boolean {
  const { conso, ges } = valeursFiables(f);
  const c = num(dpe.conso_5_usages_par_m2_ep);
  const g = num(dpe.emission_ges_5_usages_par_m2);
  return !(conso != null && c != null && Math.abs(conso - c) > 1) && !(ges != null && g != null && Math.abs(ges - g) > 1);
}

/** Même jour de diagnostic que l'annonce (à un jour près). */
function memeDateDpe(f: FicheAnnonce, dpe: LigneDpe): boolean {
  const e = f.dateDpe && dpe.date_etablissement_dpe ? jours(f.dateDpe, String(dpe.date_etablissement_dpe)) : null;
  return e != null && Math.abs(e) <= 1;
}

export type Decision = {
  statut: 'certaine' | 'probable' | 'incertaine';
  meilleur: { dpe: LigneDpe; score: number; raisons: string[] } | null;
  ecart: number | null;
};

export function decider(f: FicheAnnonce, lignes: readonly LigneDpe[], portee: 'zone' | 'code_postal' | null): Decision {
  const vus = new Set<string>();
  const notes = lignes
    .filter((l) => {
      const cle = String(l.numero_dpe ?? JSON.stringify(l));
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    })
    .map((dpe) => ({ dpe, ...scorerCandidat(f, dpe) }))
    .sort((a, b) => b.score - a.score);
  const meilleur = notes[0] ?? null;
  if (!meilleur) return { statut: 'incertaine', meilleur: null, ecart: null };
  const cle = cleAdresse(meilleur.dpe.adresse_ban);
  const autre = notes.find((n) => cleAdresse(n.dpe.adresse_ban) !== cle);
  const ecart = Math.round((meilleur.score - Math.max(autre?.score ?? 0, 0)) * 10) / 10;
  let statut: Decision['statut'] = 'incertaine';
  if (meilleur.score >= SEUILS.certaine[0] && ecart >= SEUILS.certaine[1]) statut = 'certaine';
  else if (meilleur.score >= SEUILS.probable[0] && ecart >= SEUILS.probable[1]) statut = 'probable';
  // Un chiffre publié qui contredit ferme la porte, même si le coût coïncide (« 10 rue Émile Lepeu » :
  // 783 €/an pour 779, mais 49 kg de CO₂ pour 33). L'empreinte des dépenses d'énergie : à quelques
  // euros près et sans contradiction, ce DPE est celui de l'annonce ; loin, c'est un autre logement.
  const contredit = chiffresContredits(f, meilleur.dpe);
  const accord = accordDepenses(f, meilleur.dpe);
  if (accord === 'autre' || contredit) statut = 'incertaine';
  const empreinte = accord === 'egal' && !contredit && consoCompatible(f, meilleur.dpe) ? 'egal' : null;
  // Même date de diagnostic et même coût : l'identité du DPE est prouvée, quoi que dise la surface
  // de l'annonce (10 rue Filaterie, Annecy : 183 m² annoncés, 122 au DPE du 16/04/2025).
  const prouve = empreinte === 'egal' && memeDateDpe(f, meilleur.dpe);
  const { conso, ges } = valeursFiables(f);
  // Sans conso chiffrée, lettre et surface ne départagent que dans un repère serré :
  // à 650 m, un 32 m² classé E a des dizaines de jumeaux, et le vrai DPE peut manquer.
  if (conso == null && empreinte !== 'egal' && !(f.zone && f.zone.rayonM <= RAYON_MAX_SANS_CONSO_M) && !surLaVoie(f, meilleur.dpe)) statut = 'incertaine';
  // Une surface à plus de 6 m² de l'annonce : un autre logement (55 bd de Charonne, 41,7 m² pour 88).
  const surfaceD = num(meilleur.dpe.surface_habitable_logement);
  if (!prouve && f.surface && surfaceD && Math.abs(f.surface - surfaceD) > ECART_SURFACE_MAX_M2) statut = 'incertaine';
  const point = geopoint(meilleur.dpe);
  const d = f.zone && point ? distanceM(point, { lat: f.zone.latitude, lon: f.zone.longitude }) : null;
  // Un jumeau d'un autre immeuble ressemble trait pour trait quand le vrai DPE n'est pas encore
  // publié. Sans l'adresse publiée au point près : « sûre » exige la surface à 1,5 m² ; un autre
  // étage, c'est un autre logement ; plus loin que 1,5 m² (Carrez contre habitable : 36 m² pour
  // 33,1 rue Saint-Maur) ou hors du cercle publié, l'étage doit être confirmé.
  // L'empreinte (coût à quelques euros) avec la conso et les émissions publiées à l'unité près vaut
  // la surface exacte : 73 bd Richard Lenoir, 75 m² annoncés, 71,5 au DPE, 2 750 €/an des deux côtés.
  const empreinteForte = empreinte === 'egal' && conso != null && chiffresExacts(f, meilleur.dpe);
  if (!prouve && !(f.zone?.rayonM === 0 && d != null && d <= 30)) {
    const surfaceSure = f.surface != null && surfaceD != null && Math.abs(f.surface - surfaceD) <= ECART_SURFACE_SUR_M2;
    const etageD = etageDpe(meilleur.dpe);
    const etageConnu = f.etage != null && etageD != null;
    const etageConfirme = etageConnu && f.etage === etageD;
    const limite = !f.zone ? 0 : f.zone.rayonM <= RAYON_POINT_PRECIS_M ? f.zone.rayonM + MARGE_POINT_PRECIS_M : f.zone.rayonM;
    const horsDuCercle = f.zone != null && f.zone.rayonM > 0 && d != null && d > limite;
    if (etageConnu && !etageConfirme) statut = 'incertaine';
    else if (horsDuCercle && !etageConfirme) statut = 'incertaine';
    else if (!surfaceSure && !etageConfirme && !empreinteForte) statut = 'incertaine';
    if (statut === 'certaine') {
      // « Sûre » : la surface à 1,5 m² (ou l'empreinte forte), la conso publiée à l'unité près
      // (55 bd de Charonne : 175 kWh pour 172, sans doute un DPE refait), et l'étage confirmé
      // ou l'empreinte.
      if (!surfaceSure && !empreinteForte) statut = 'probable';
      else if (conso != null && !chiffresExacts(f, meilleur.dpe)) statut = 'probable';
      else if (!etageConfirme && !(empreinte === 'egal' && (conso == null || empreinteForte))) statut = 'probable';
    }
  }
  // Hors du repère publié : au mieux probable, puis jamais affirmé.
  if (f.zone && d != null) {
    // Rayon 0 (adresse publiée) : un sosie à un kilomètre n'est pas ce logement.
    if (d > f.zone.rayonM + MARGE_HORS_REPERE_MAX_M) statut = 'incertaine';
    // Loin d'un point retrouvé à quelques mètres, ou de l'adresse posée sur la carte : un autre immeuble
    // (ou une adresse décalée par l'agence) ; jamais affirmé.
    else if (f.zone.rayonM > 0 && f.zone.rayonM <= RAYON_POINT_PRECIS_M && d > f.zone.rayonM + LOIN_DU_POINT_PRECIS_M) statut = 'incertaine';
    else if (f.zone.rayonM === 0 && d > LOIN_ADRESSE_PUBLIEE_M) statut = 'incertaine';
    else if (d > f.zone.rayonM + MARGE_HORS_REPERE_M && statut === 'certaine') statut = 'probable';
  }
  // Le code postal de l'annonce fait foi : un DPE de l'autre côté du boulevard n'est pas affirmé.
  const cpMeilleur = codePostalDpe(meilleur.dpe);
  if (f.codePostal && cpMeilleur && cpMeilleur !== f.codePostal && !(f.zone && f.zone.rayonM === 0)) statut = 'incertaine';
  // Code postal entier sans émissions chiffrées : on n'affirme une adresse que sans hésitation.
  if (statut === 'probable' && portee === 'code_postal' && ges == null && empreinte !== 'egal') statut = 'incertaine';
  // En lettres seules (Leboncoin, PAP), « probable » exige 15 points d'avance : à 10, un jumeau
  // passait une fois sur dix (banc d'essai du 23/10/2026).
  if (statut === 'probable' && conso == null && ecart < ECART_PROBABLE_LETTRES) statut = 'incertaine';
  return { statut, meilleur, ecart };
}

/* -------------------------------------------------------------------------- */
/*                             Adresses possibles                             */
/* -------------------------------------------------------------------------- */

/** Un candidat ne devient « possible » qu'avec une note solide (conso, surface concordantes)… */
const SCORE_POSSIBLE = 40;
/** …proche du meilleur : au-delà, ce n'est plus une hésitation. */
const ECART_POSSIBLE = 20;
const POSSIBLES_MAX = 3;

/**
 * Sans adresse sûre, les deux ou trois immeubles qui restent possibles, à
 * vérifier sur place. Mêmes garde-fous qu'une adresse (surface à 6 m², 400 m
 * autour du repère publié), sauf le code postal : un immeuble de l'autre côté
 * du boulevard reste une piste (58 bd de Charonne 75020 / 44 rue Chanzy 75011).
 */
export function adressesPossibles(f: FicheAnnonce, lignes: readonly LigneDpe[]): AdressePossible[] {
  const notes = lignes
    .map((dpe) => ({ dpe, ...scorerCandidat(f, dpe), point: geopoint(dpe) }))
    .filter((n) => n.score >= SCORE_POSSIBLE && n.point && String(n.dpe.adresse_ban ?? '').trim())
    .filter((n) => !chiffresContredits(f, n.dpe) && accordDepenses(f, n.dpe) !== 'autre')
    .filter((n) => {
      const s = num(n.dpe.surface_habitable_logement);
      return !(f.surface && s && Math.abs(f.surface - s) > ECART_SURFACE_MAX_M2);
    })
    .filter((n) => !f.zone || distanceM(n.point!, { lat: f.zone.latitude, lon: f.zone.longitude }) <= f.zone.rayonM + MARGE_HORS_REPERE_MAX_M)
    .sort((a, b) => b.score - a.score);
  if (notes.length === 0) return [];
  const meilleur = notes[0]!.score;
  const vus = new Set<string>();
  const possibles: AdressePossible[] = [];
  for (const n of notes) {
    if (n.score < meilleur - ECART_POSSIBLE || possibles.length >= POSSIBLES_MAX) break;
    const cle = cleAdresse(n.dpe.adresse_ban);
    if (vus.has(cle)) continue;
    vus.add(cle);
    possibles.push({ adresse: String(n.dpe.adresse_ban).trim(), latitude: n.point!.lat, longitude: n.point!.lon });
  }
  return possibles;
}

/* -------------------------------------------------------------------------- */
/*                                  Localiser                                 */
/* -------------------------------------------------------------------------- */

async function adresseDuPoint(lat: number, lon: number): Promise<{ libelle: string; distance: number } | null> {
  try {
    const url = new URL(BAN_REVERSE);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('limit', '1');
    const res = await fetch(url, { headers: ENTETES, cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: Array<{ properties?: Record<string, unknown> }> };
    const p = body.features?.[0]?.properties;
    if (!p || p.type !== 'housenumber' || typeof p.label !== 'string') return null;
    return { libelle: p.label, distance: num(p.distance) ?? 0 };
  } catch {
    return null;
  }
}

/** Les numéros de la BAN autour d'un point retrouvé (trois au plus, du plus proche au plus loin). */
async function numerosAutour(lat: number, lon: number, rayonM: number): Promise<AdressePossible[]> {
  try {
    const url = new URL(BAN_REVERSE);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('type', 'housenumber');
    url.searchParams.set('limit', '6');
    const res = await fetch(url, { headers: ENTETES, cache: 'no-store', signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    const body = (await res.json()) as { features?: Array<{ properties?: Record<string, unknown>; geometry?: { coordinates?: number[] } }> };
    const vus = new Set<string>();
    const out: AdressePossible[] = [];
    for (const f of body.features ?? []) {
      const p = f.properties ?? {};
      const c = f.geometry?.coordinates;
      if (p.type !== 'housenumber' || typeof p.label !== 'string' || !c || (num(p.distance) ?? Infinity) > rayonM || vus.has(p.label)) continue;
      vus.add(p.label);
      out.push({ adresse: p.label, latitude: c[1]!, longitude: c[0]! });
    }
    return out.slice(0, POSSIBLES_MAX);
  } catch {
    return [];
  }
}

function repereApproximatif(f: FicheAnnonce): Pick<LocalisationImport, 'latitude' | 'longitude' | 'precision'> {
  if (!f.zone) return { latitude: null, longitude: null, precision: null };
  return {
    latitude: f.zone.latitude,
    longitude: f.zone.longitude,
    precision: f.zone.rayonM <= 600 ? 'quartier' : 'code_postal',
  };
}

/** Rayon d'un immeuble placé entre ses voisins (zoneDepuisAdressePubliee : 85 m au plus). */
const RAYON_ENTRE_VOISINS_MAX_M = 85;

export async function localiserFiche(f: FicheAnnonce, fetcher?: Fetcher): Promise<LocalisationImport> {
  const { lignes, portee } = await chercherCandidats(f, fetcher);
  const decision = decider(f, lignes, portee);
  const point = decision.meilleur ? geopoint(decision.meilleur.dpe) : null;

  if ((decision.statut === 'certaine' || decision.statut === 'probable') && decision.meilleur && point) {
    const parcelle = await fetchParcelleAuPoint({ latitude: point.lat, longitude: point.lon });
    return {
      confiance: decision.statut,
      precision: 'logement',
      adresse: String(decision.meilleur.dpe.adresse_ban ?? '') || null,
      latitude: point.lat,
      longitude: point.lon,
      parcelleIds: parcelle ? [parcelle.parcelleId] : [],
      numeroDpe: String(decision.meilleur.dpe.numero_dpe ?? '') || null,
      complementDpe: String(decision.meilleur.dpe.complement_adresse_logement ?? '') || null,
      score: decision.meilleur.score,
      raisons: decision.meilleur.raisons,
    };
  }

  // Un DPE ressemblant trait pour trait, mais loin du point exact de la carte : l'un des deux trompe
  // (adresse décalée par l'agence, ou logement jumeau). Les deux immeubles, à vérifier : 24 rue de
  // Lappe contre 12 rue des Taillandiers, 82 rue de la Folie-Méricourt contre 8 passage du Jeu-de-Boules.
  const pointCarte = f.zone && f.zone.rayonM <= RAYON_ECOLES_M ? f.zone : null;
  // La ressemblance se mesure sans le lieu : la rue posée par le point pénalise déjà le sosie.
  const sansLieu: FicheAnnonce = { ...f, zone: null, voiePubliee: null };
  const sosie = pointCarte
    ? lignes
        .filter((l) => !chiffresContredits(f, l) && accordDepenses(f, l) !== 'autre' && !(f.codePostal && codePostalDpe(l) && codePostalDpe(l) !== f.codePostal))
        .map((dpe) => ({ dpe, score: scorerCandidat(sansLieu, dpe).score, point: geopoint(dpe) }))
        .sort((a, b) => b.score - a.score)[0]
    : undefined;
  if (pointCarte && sosie?.point && sosie.score >= SCORE_DPE_CONTRADICTOIRE) {
    const d = distanceM(sosie.point, { lat: pointCarte.latitude, lon: pointCarte.longitude });
    const loin = pointCarte.rayonM === 0 ? LOIN_ADRESSE_PUBLIEE_M : pointCarte.rayonM + MARGE_POINT_PRECIS_M;
    const adresseDpe = String(sosie.dpe.adresse_ban ?? '').trim();
    if (d > loin && d <= SOSIE_VOISIN_MAX_M && adresseDpe) {
      const lieuSosie = sosie.point;
      const auPoint = await numerosAutour(pointCarte.latitude, pointCarte.longitude, Math.max(pointCarte.rayonM, 15));
      return {
        confiance: 'incertaine',
        precision: 'immeuble',
        adresse: null,
        latitude: pointCarte.latitude,
        longitude: pointCarte.longitude,
        rayonM: Math.max(pointCarte.rayonM, 30),
        parcelleIds: [],
        numeroDpe: null,
        complementDpe: null,
        score: sosie.score,
        raisons: ['le point de la carte et le DPE le plus ressemblant désignent deux immeubles différents'],
        adressesPossibles: [...auPoint.slice(0, 2), { adresse: adresseDpe, latitude: lieuSosie.lat, longitude: lieuSosie.lon }],
      };
    }
  }

  // Adresse écrite par le site mais absente de la BAN (immeuble neuf) : placée entre ses numéros
  // voisins. L'adresse montrée reste celle de l'annonce ; aucune parcelle n'est devinée.
  if (
    f.adressePubliee &&
    /^\d/.test(f.adressePubliee) &&
    f.zone &&
    f.zone.rayonM > 0 &&
    f.zone.rayonM <= RAYON_ENTRE_VOISINS_MAX_M
  ) {
    return {
      confiance: 'adresse_publiee',
      precision: 'immeuble',
      adresse: [f.adressePubliee, f.codePostal, f.ville].filter(Boolean).join(' '),
      latitude: f.zone.latitude,
      longitude: f.zone.longitude,
      parcelleIds: [],
      numeroDpe: null,
      complementDpe: null,
      score: decision.meilleur?.score ?? null,
      raisons: ["adresse publiée sur l'annonce, placée entre ses numéros voisins (BAN)"],
    };
  }

  // Aucun DPE concordant, mais l'agence a publié l'adresse au point près : l'immeuble reste connu.
  if (f.zone && f.zone.rayonM === 0) {
    const publiee = await adresseDuPoint(f.zone.latitude, f.zone.longitude);
    if (publiee && publiee.distance <= 15) {
      const parcelle = await fetchParcelleAuPoint({ latitude: f.zone.latitude, longitude: f.zone.longitude });
      return {
        confiance: 'adresse_publiee',
        precision: 'immeuble',
        adresse: publiee.libelle,
        latitude: f.zone.latitude,
        longitude: f.zone.longitude,
        parcelleIds: parcelle ? [parcelle.parcelleId] : [],
        numeroDpe: null,
        complementDpe: null,
        score: decision.meilleur?.score ?? null,
        raisons: ["adresse publiée sur l'annonce, aucun DPE concordant"],
      };
    }
  }

  // Emplacement retrouvé à une vingtaine de mètres près (écoles SeLoger) sans DPE qui l'affirme : les
  // immeubles au point, à vérifier (le voisin peut l'être : 27 pour 29 bd Jules Ferry). Un seul : probable.
  if (f.zone && f.zone.rayonM > 0 && f.zone.rayonM <= RAYON_ECOLES_M && !f.adressePubliee) {
    const parDpe = adressesPossibles(f, lignes);
    const autour = parDpe.length ? parDpe : await numerosAutour(f.zone.latitude, f.zone.longitude, f.zone.rayonM);
    const raisons = ["emplacement retrouvé par les distances aux écoles publiées sur l'annonce"];
    if (autour.length === 1 && !parDpe.length) {
      const seul = autour[0]!;
      const parcelle = await fetchParcelleAuPoint({ latitude: seul.latitude, longitude: seul.longitude });
      return {
        confiance: 'probable',
        precision: 'immeuble',
        adresse: seul.adresse,
        latitude: seul.latitude,
        longitude: seul.longitude,
        parcelleIds: parcelle ? [parcelle.parcelleId] : [],
        numeroDpe: null,
        complementDpe: null,
        score: decision.meilleur?.score ?? null,
        raisons,
      };
    }
    if (autour.length) {
      return {
        confiance: 'incertaine',
        precision: 'immeuble',
        adresse: null,
        latitude: f.zone.latitude,
        longitude: f.zone.longitude,
        rayonM: f.zone.rayonM,
        parcelleIds: [],
        numeroDpe: null,
        complementDpe: null,
        score: decision.meilleur?.score ?? null,
        raisons,
        adressesPossibles: autour,
      };
    }
  }

  const memeVoie = dpesMemeVoie(lignes, f);
  if (memeVoie) {
    const points = memeVoie.dpes.map(geopoint).filter((p): p is { lat: number; lon: number } => p != null);
    const lat = points.reduce((s, p) => s + p.lat, 0) / Math.max(points.length, 1);
    const lon = points.reduce((s, p) => s + p.lon, 0) / Math.max(points.length, 1);
    const rayon = points.length
      ? Math.max(...points.map((p) => distanceM(p, { lat, lon }))) + 30
      : 80;
    return {
      confiance: 'incertaine',
      precision: 'quartier',
      adresse: [memeVoie.voie, f.codePostal, f.ville].filter(Boolean).join(' '),
      latitude: points.length ? lat : f.zone?.latitude ?? null,
      longitude: points.length ? lon : f.zone?.longitude ?? null,
      rayonM: Math.round(Math.min(Math.max(rayon, 60), 180)),
      parcelleIds: [],
      numeroDpe: null,
      complementDpe: null,
      score: decision.meilleur?.score ?? null,
      raisons: [`tous les DPE concordants sont ${memeVoie.voie}`],
      adressesPossibles: adressesPossibles(f, lignes),
    };
  }

  const rue = rueDepuisTexte(f.adressePubliee);
  const libelle = rue ? [f.adressePubliee, f.codePostal, f.ville].filter(Boolean).join(' ') : null;
  return {
    confiance: 'incertaine',
    ...repereApproximatif(f),
    adresse: libelle,
    rayonM: rue ? Math.min(f.zone?.rayonM || 80, 120) : f.zone?.rayonM ?? null,
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    score: decision.meilleur?.score ?? null,
    raisons: rue ? ["adresse publiée sur l'annonce, immeuble non départagé"] : [],
    adressesPossibles: adressesPossibles(f, lignes),
  };
}
