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
 *   - sans conso, seulement dans un repère publié de 250 m au plus ;
 *   - une adresse seulement si le meilleur DPE devance nettement la meilleure
 *     autre adresse (mêmes seuils que le pipeline).
 *
 * Réseau : l'API ADEME en filtres `_gte`/`_lte`/`_eq` (le WAF refuse `qs`),
 * la BAN pour une adresse publiée, l'API Carto pour la parcelle.
 */
import { fetchParcelleAuPoint } from '@/lib/geo/cadastre-point';
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
].join(',');

/** Fenêtres de recherche autour des valeurs de l'annonce (souvent arrondies à l'unité). */
const FENETRE_CONSO = 1.5;
const FENETRE_GES = 1.5;
const FENETRE_SURFACE = 3;
/** Sans conso, la surface ne suffit que dans un repère serré. */
const RAYON_MAX_SANS_CONSO_M = 250;

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

function fourchette(params: Record<string, string>, champ: string, valeur: number, fenetre: number) {
  params[`${champ}_gte`] = String(Math.round((valeur - fenetre) * 10) / 10);
  params[`${champ}_lte`] = String(Math.round((valeur + fenetre) * 10) / 10);
}

/** Les requêtes à tenter, de la plus serrée à la plus large. Vide : pas de localisation précise possible. */
export function requetesDpe(f: FicheAnnonce): RequeteDpe[] {
  const { conso, ges } = valeursFiables(f);
  const z = f.zone;
  if (conso != null) {
    const lieu: Record<string, string> | null = z
      ? { geo_distance: `${z.longitude},${z.latitude},${Math.max(300, Math.round(z.rayonM + 150))}` }
      : f.codePostal && /^\d{5}$/.test(f.codePostal)
        ? { code_postal_ban_eq: f.codePostal }
        : null;
    if (!lieu) return [];
    const portee = z ? 'zone' : 'code_postal';
    const base: Record<string, string> = { ...lieu };
    fourchette(base, 'conso_5_usages_par_m2_ep', conso, FENETRE_CONSO);
    if (ges != null) fourchette(base, 'emission_ges_5_usages_par_m2', ges, FENETRE_GES);
    const requetes: RequeteDpe[] = [];
    if (f.surface) {
      const avecSurface = { ...base };
      fourchette(avecSurface, 'surface_habitable_logement', f.surface, FENETRE_SURFACE);
      requetes.push({ params: avecSurface, portee });
    }
    // Surface de l'annonce parfois loin de celle du DPE (Carrez, mezzanine) : la conso tient seule.
    requetes.push({ params: base, portee });
    return requetes;
  }
  if (z && z.rayonM <= RAYON_MAX_SANS_CONSO_M && f.surface) {
    const params: Record<string, string> = { geo_distance: `${z.longitude},${z.latitude},${Math.round(z.rayonM + 120)}` };
    fourchette(params, 'surface_habitable_logement', f.surface, FENETRE_SURFACE);
    return [{ params, portee: 'zone' }];
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

export async function chercherCandidats(
  f: FicheAnnonce,
  fetcher: Fetcher = fetcherParDefaut,
): Promise<{ lignes: LigneDpe[]; portee: 'zone' | 'code_postal' | null }> {
  for (const requete of requetesDpe(f)) {
    try {
      const res = await fetcher(urlAdeme(requete.params));
      if (!res.ok) continue;
      const body = (await res.json()) as { results?: unknown };
      const lignes = Array.isArray(body.results) ? (body.results as LigneDpe[]) : [];
      if (lignes.length > 0) return { lignes, portee: requete.portee };
    } catch {
      // ADEME indisponible ou lente : la requête suivante, puis rien.
    }
  }
  return { lignes: [], portee: null };
}

/* -------------------------------------------------------------------------- */
/*                                    Score                                   */
/* -------------------------------------------------------------------------- */

const RE_ETAGE = /(?:[ée]tage|etg|niveau)\s*[:.]?\s*(-?\d{1,2})\b|\b(\d{1,2})\s*(?:er|e|[èe]me)\s*[ée]tage/i;
const RE_RDC = /\brdc\b|rez[- ]de[- ]chauss/i;

/** Étage lu dans le complément d'adresse ; 0 dans `numero_etage_appartement` est une valeur par défaut. */
export function etageDpe(dpe: LigneDpe): number | null {
  const complement = String(dpe.complement_adresse_logement ?? '');
  const m = complement.match(RE_ETAGE);
  if (m) return Number(m[1] ?? m[2]);
  if (RE_RDC.test(complement)) return 0;
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

const TYPES_VOIE = ['rue', 'boulevard', 'bd', 'avenue', 'av', 'passage', 'impasse', 'cite', 'villa', 'quai', 'allee', 'square', 'faubourg', 'place'];
const SYNONYMES: Record<string, string> = { bd: 'boulevard', av: 'avenue' };
const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'a', 'au', 'aux']);
const PROXIMITE = new Set(['pas', 'proche', 'proximite', 'pres', 'minutes', 'min', 'entre', 'face', 'vue', 'metro', 'station', 'voisin', 'environs', 'depuis']);

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
  if (f.dpeApresJuillet2021 !== false) {
    for (const [lettreA, champ, nom, bonus, malus] of [
      [f.dpe, 'etiquette_dpe', 'DPE', 5, -30],
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

  const point = geopoint(dpe);
  if (f.zone && point) {
    const d = distanceM(point, { lat: f.zone.latitude, lon: f.zone.longitude });
    if (f.zone.rayonM === 0) {
      const libelle = `à ${Math.round(d)} m de l'adresse publiée`;
      if (d <= 15) note(25, libelle);
      else if (d <= 30) note(15, libelle);
      else if (d <= 60) note(5, libelle);
      else if (d > 200) note(-10, libelle);
    } else if (d <= f.zone.rayonM) {
      note(4, 'dans le repère publié');
    } else if (d > f.zone.rayonM + 100) {
      note(-10, `à ${Math.round(d - f.zone.rayonM)} m hors du repère publié`);
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
  // Code postal entier sans émissions chiffrées : on n'affirme une adresse que sans hésitation.
  const { ges } = valeursFiables(f);
  if (statut === 'probable' && portee === 'code_postal' && ges == null) statut = 'incertaine';
  return { statut, meilleur, ecart };
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

  // Adresse écrite par le site mais absente de la BAN (immeuble neuf) : placée entre ses numéros
  // voisins. L'adresse montrée reste celle de l'annonce ; aucune parcelle n'est devinée.
  if (f.adressePubliee && f.zone && f.zone.rayonM > 0 && f.zone.rayonM <= RAYON_ENTRE_VOISINS_MAX_M) {
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

  const libelle =
    f.adressePubliee
      ? [f.adressePubliee, f.codePostal, f.ville].filter(Boolean).join(' ')
      : f.quartier ?? null;
  return {
    confiance: 'incertaine',
    ...repereApproximatif(f),
    adresse: libelle,
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    score: decision.meilleur?.score ?? null,
    raisons: f.adressePubliee
      ? ["adresse publiée sur l'annonce, immeuble non départagé"]
      : [],
  };
}
