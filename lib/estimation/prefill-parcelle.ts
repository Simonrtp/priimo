import { parseDpeLetter } from '@/lib/carte/dpe-public';
import { BIEN_VIDE, type EstimationBien } from '@/lib/estimation/objet';

/**
 * Ce qu'une fiche parcelle peut proposer à une estimation.
 *
 * Un immeuble collectif ne dit pas quel logement l'agent veut estimer :
 * on ne retient que le type, l'année et la hauteur du bâtiment.
 * Une maison est le bâtiment lui-même : le diagnostic et la vente peuvent
 * remplir la surface, les pièces, l'étage et le DPE, tant qu'ils décrivent
 * le même bien.
 */

export type PrefillLogementParcelle = {
  date?: string | null;
  etiquette?: string | null;
  etiquetteGes?: string | null;
  consoKwhM2?: number | null;
  surface?: number | null;
  etage?: number | null;
};

export type PrefillVenteParcelle = {
  typeLocal?: string | null;
  nombrePieces?: number | null;
  surface?: number | null;
};

export type PrefillBatimentParcelle = {
  usage?: string | null;
  anneeConstruction?: number | null;
  niveaux?: number | null;
  nbLogements?: number | null;
};

const ECART_SURFACE = 0.12;
const MAX_LIGNES = 120;

function texte(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const propre = value.trim();
  return propre ? propre.slice(0, max) : null;
}

function nombreBorne(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function entier(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const arrondi = Math.round(value);
  if (Math.abs(value - arrondi) > 0.001 || arrondi < min || arrondi > max) return null;
  return arrondi;
}

function objet(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function anneePlausible(value: unknown, maintenant: Date): number | null {
  return entier(value, 1600, maintenant.getFullYear());
}

/** Collectif → appartement. Individuel → maison. Résidentiel nombreux → appartement. */
export function typeDepuisBatiment(
  usage: string | null,
  nbLogements: number | null,
): 'appartement' | 'maison' | null {
  const u = usage ?? '';
  const collectif = /collectif/i.test(u);
  const individuel = /individuel/i.test(u);
  if (collectif && !individuel) return 'appartement';
  if (individuel && !collectif) return 'maison';
  if (/r[ée]sidentiel/i.test(u) && (nbLogements ?? 0) > 1) return 'appartement';
  return null;
}

function surfacesCompatibles(surfaces: number[]): boolean {
  if (surfaces.length <= 1) return true;
  const min = Math.min(...surfaces);
  const max = Math.max(...surfaces);
  if (min <= 0) return false;
  return max / min <= 1 + ECART_SURFACE;
}

function plusRecent(logements: PrefillLogementParcelle[]): PrefillLogementParcelle[] {
  return [...logements].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** Étage ADEME : 0 est une valeur par défaut, pas un rez-de-chaussée. */
function etageVersFloor(etage: number | null | undefined): string | null {
  if (etage == null || !Number.isFinite(etage)) return null;
  const n = Math.round(etage);
  if (n < 1) return null;
  if (n >= 20) return '20+';
  return String(n);
}

function lettre(value: string | null | undefined): string | null {
  return parseDpeLetter(value);
}

function lireLogement(raw: unknown): PrefillLogementParcelle | null {
  const o = objet(raw);
  if (!o) return null;
  return {
    date: texte(o.date, 40),
    etiquette: texte(o.etiquette, 8),
    etiquetteGes: texte(o.etiquetteGes, 8),
    consoKwhM2: nombreBorne(o.consoKwhM2, 1, 1500),
    surface: nombreBorne(o.surface, 8, 2000),
    etage: entier(o.etage, -5, 80),
  };
}

function lireVente(raw: unknown): PrefillVenteParcelle | null {
  const o = objet(raw);
  if (!o) return null;
  return {
    typeLocal: texte(o.typeLocal, 40),
    nombrePieces: entier(o.nombrePieces, 1, 30),
    surface: nombreBorne(o.surface, 8, 2000),
  };
}

function lireBatiment(raw: unknown, maintenant: Date): PrefillBatimentParcelle | null {
  const o = objet(raw);
  if (!o) return null;
  return {
    usage: texte(o.usage, 120),
    anneeConstruction: anneePlausible(o.anneeConstruction, maintenant),
    niveaux: entier(o.niveaux, 1, 40),
    nbLogements: entier(o.nbLogements, 0, 5000),
  };
}

function lignes<T>(raw: unknown, lire: (value: unknown) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw.slice(0, MAX_LIGNES)) {
    const lu = lire(item);
    if (lu) out.push(lu);
  }
  return out;
}

/**
 * Colonnes d'insertion. Null si la parcelle n'a pas d'identifiant :
 * on ne crée pas une estimation vide déguisée.
 */
export function prefillColonnesParcelle(
  raw: unknown,
  maintenant: Date = new Date(),
): Record<string, unknown> | null {
  const value = objet(raw);
  if (!value) return null;
  const parcelleId = texte(value.id, 160);
  if (!parcelleId) return null;

  const codePostalBrut = texte(value.codePostal, 5);
  const batiment = lireBatiment(value.batiment, maintenant);
  const logements = lignes(value.logements, lireLogement);
  const ventes = lignes(value.ventes, lireVente);
  const type = typeDepuisBatiment(batiment?.usage ?? null, batiment?.nbLogements ?? null);

  const bien: EstimationBien = { ...BIEN_VIDE };
  let bienTouche = false;
  const poser = <K extends keyof EstimationBien>(cle: K, v: EstimationBien[K]) => {
    if (v == null) return;
    bien[cle] = v;
    bienTouche = true;
  };

  if (batiment?.anneeConstruction) poser('anneeConstruction', batiment.anneeConstruction);

  const colonnes: Record<string, unknown> = {
    parcelle_id: parcelleId,
    address: texte(value.adresse, 300),
    postal_code: codePostalBrut && /^\d{5}$/.test(codePostalBrut) ? codePostalBrut : null,
    city: texte(value.ville, 160),
    ban_id: texte(value.banId, 180),
    latitude: nombreBorne(value.latitude, -90, 90),
    longitude: nombreBorne(value.longitude, -180, 180),
  };
  if (type) colonnes.property_type = type;

  if (type === 'appartement' && batiment?.niveaux) {
    poser('etagesImmeuble', batiment.niveaux);
  }

  if (type === 'maison') {
    if (batiment?.niveaux) poser('niveaux', batiment.niveaux);
    const habitation = habitationMaison(logements, ventes, batiment?.nbLogements ?? null);
    if (habitation.surface != null) colonnes.surface_m2 = habitation.surface;
    if (habitation.rooms != null) colonnes.rooms = habitation.rooms;
    if (habitation.floor) colonnes.floor = habitation.floor;
    if (habitation.dpe) colonnes.dpe_class = habitation.dpe;
    poser('ges', habitation.ges);
    poser('consoKwh', habitation.consoKwh);
  }

  if (bienTouche) colonnes.bien = bien;
  return colonnes;
}

function habitationMaison(
  logements: PrefillLogementParcelle[],
  ventes: PrefillVenteParcelle[],
  nbLogements: number | null,
): {
  surface: number | null;
  rooms: number | null;
  floor: string | null;
  dpe: string | null;
  ges: string | null;
  consoKwh: number | null;
} {
  const vide = { surface: null, rooms: null, floor: null, dpe: null, ges: null, consoKwh: null };
  if (!uneSeuleMaison(logements, ventes, nbLogements)) return vide;

  const ordonnes = plusRecent(logements);
  const surfaceDpe = ordonnes.find((l) => l.surface != null)?.surface ?? null;
  const surfaceVente = ventesMaisons(ventes).find((v) => v.surface != null)?.surface ?? null;
  const surface = surfaceDpe ?? surfaceVente;
  const avecLettre = ordonnes.find((l) => lettre(l.etiquette));
  const floor = etageVersFloor(ordonnes.find((l) => etageVersFloor(l.etage))?.etage);

  return {
    surface,
    rooms: piecesMaison(ventes, surface),
    floor,
    dpe: lettre(avecLettre?.etiquette),
    ges: lettre(avecLettre?.etiquetteGes),
    consoKwh: avecLettre?.consoKwhM2 ?? null,
  };
}

/** Plusieurs surfaces incompatibles, ou plusieurs logements sans surface : on ne choisit pas. */
function uneSeuleMaison(
  logements: PrefillLogementParcelle[],
  ventes: PrefillVenteParcelle[],
  nbLogements: number | null,
): boolean {
  const surfaces = [
    ...logements.map((l) => l.surface),
    ...ventesMaisons(ventes).map((v) => v.surface),
  ].filter((s): s is number => s != null);
  if (surfaces.length > 0) return surfacesCompatibles(surfaces);
  return (nbLogements ?? 1) <= 1;
}

function ventesMaisons(ventes: PrefillVenteParcelle[]): PrefillVenteParcelle[] {
  return ventes.filter((v) => v.typeLocal != null && /^maison$/i.test(v.typeLocal));
}

/** Un seul nombre de pièces parmi les ventes de maison dont la surface colle. */
function piecesMaison(ventes: PrefillVenteParcelle[], surface: number | null): number | null {
  const maisons = ventesMaisons(ventes).filter((v) => v.nombrePieces != null);
  if (maisons.length === 0) return null;
  const avecSurface =
    surface == null ? maisons : maisons.filter((v) => v.surface != null && surfacesCompatibles([v.surface, surface]));
  const ventesChiffrees = maisons.some((v) => v.surface != null);
  const pool = avecSurface.length > 0 ? avecSurface : ventesChiffrees ? [] : maisons;
  if (pool.length === 0) return null;
  const pieces = new Set(pool.map((v) => v.nombrePieces));
  if (pieces.size !== 1) return null;
  return [...pieces][0] ?? null;
}
