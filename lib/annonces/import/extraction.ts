/**
 * Réponse de Mon assistant (JSON) → fiche d'annonce. Pur, sauf la recherche
 * d'adresse (BAN, publique, sans clé). Sans secret : testable hors serveur.
 */
import { searchBanDirect } from '@/lib/geo/ban';
import type { FicheAnnonce } from './types';
import type { UrlAnnonce } from './url';

export type Brut = Record<string, unknown>;

function nombre(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function lettre(v: unknown): string | null {
  const l = String(v ?? '').trim().toUpperCase();
  return /^[A-G]$/.test(l) ? l : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null;
}

/** Pur : la réponse de Mistral → fiche (sans le repère d'adresse). */
export function ficheDepuisExtraction(json: Brut, u: UrlAnnonce, description: string): FicheAnnonce {
  const cp = texte(json.code_postal)?.match(/\b\d{5}\b/)?.[0] ?? null;
  const type = json.type_bien === 'appartement' || json.type_bien === 'maison' ? json.type_bien : json.type_bien ? 'autre' : null;
  const agence = texte(json.agence);
  return {
    portail: u.portail,
    idPortail: u.idPortail,
    url: u.url,
    typeVendeur: json.vendeur === 'professionnel' || (json.vendeur !== 'particulier' && agence) ? 'professionnel' : 'particulier',
    agenceNom: agence,
    typeBien: type,
    titre: texte(json.titre),
    prix: nombre(json.prix),
    surface: nombre(json.surface),
    pieces: nombre(json.pieces),
    etage: nombre(json.etage),
    dpe: lettre(json.dpe),
    consoKwhM2: nombre(json.conso_kwh_m2),
    ges: lettre(json.ges),
    gesKgM2: nombre(json.ges_kg_m2),
    dpeApresJuillet2021: json.dpe_avant_2021 === true ? false : null,
    dateDpe: texte(json.date_dpe)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    anneeConstruction: nombre(json.annee_construction),
    chauffage: texte(json.chauffage),
    codePostal: cp,
    ville: texte(json.ville),
    quartier: texte(json.quartier),
    description: description.slice(0, 4000),
    datePublication: texte(json.date_publication)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    zone: null,
    photos: [],
  };
}

/**
 * Une adresse écrite dans l'annonce, retrouvée au numéro près par la BAN dans
 * le bon code postal, devient un repère exact. Sinon rien.
 */
export async function zoneDepuisAdresse(json: Brut, codePostal: string | null): Promise<FicheAnnonce['zone']> {
  const adresse = texte(json.adresse);
  if (!adresse || !codePostal) return null;
  const hits = await searchBanDirect(adresse, { limit: 1, postcode: codePostal, autocomplete: false }).catch(() => []);
  const props = (hits[0]?.properties ?? {}) as { type?: string; score?: number; postcode?: string };
  const coords = hits[0]?.geometry?.coordinates;
  if (props.type === 'housenumber' && (props.score ?? 0) >= 0.75 && props.postcode === codePostal && coords) {
    return { latitude: coords[1], longitude: coords[0], rayonM: 0 };
  }
  return null;
}

type Numero = { latitude: number; longitude: number; voie: string };

/** Ce numéro précis, dans ce code postal ; null si la BAN ne le connaît pas. */
async function numeroBan(numero: number, voie: string, codePostal: string): Promise<Numero | null> {
  const hits = await searchBanDirect(`${numero} ${voie}`, { limit: 1, postcode: codePostal, autocomplete: false }).catch(() => []);
  const props = (hits[0]?.properties ?? {}) as { type?: string; score?: number; postcode?: string; housenumber?: string; street?: string };
  const coords = hits[0]?.geometry?.coordinates;
  if (props.type !== 'housenumber' || (props.score ?? 0) < 0.75 || props.postcode !== codePostal || !coords) return null;
  if (props.housenumber !== String(numero) || !props.street) return null;
  return { latitude: coords[1], longitude: coords[0], voie: props.street };
}

function distanceM(a: Numero, b: Numero): number {
  return Math.hypot((a.longitude - b.longitude) * 73_000, (a.latitude - b.latitude) * 111_000);
}

/** Deux voisins plus éloignés que cela ne cernent plus un seul immeuble. */
const ECART_VOISINS_MAX_M = 150;

/**
 * L'adresse écrite par le site (programme neuf…). Connue de la BAN au numéro
 * près : point exact. Un immeuble neuf y manque souvent : il est placé entre
 * ses voisins du même côté de la rue (n − 2 et n + 2), ou contre le plus
 * proche, avec un rayon qui dit l'incertitude. Jamais au centre de la rue.
 */
export async function zoneDepuisAdressePubliee(adresse: string, codePostal: string): Promise<FicheAnnonce['zone']> {
  const exacte = await zoneDepuisAdresse({ adresse }, codePostal);
  if (exacte) return exacte;
  const m = adresse.match(/^(\d{1,4})\s*(?:bis|ter|quater|[a-d])?\s+(.{4,})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const voie = m[2]!;
  const [avant, apres] = await Promise.all([n > 2 ? numeroBan(n - 2, voie, codePostal) : null, numeroBan(n + 2, voie, codePostal)]);
  if (avant && apres && avant.voie === apres.voie && distanceM(avant, apres) <= ECART_VOISINS_MAX_M) {
    return {
      latitude: (avant.latitude + apres.latitude) / 2,
      longitude: (avant.longitude + apres.longitude) / 2,
      rayonM: Math.round(distanceM(avant, apres) / 2) + 10,
    };
  }
  const seul = avant ?? apres;
  return seul ? { latitude: seul.latitude, longitude: seul.longitude, rayonM: 40 } : null;
}
