import type { CarteImport } from '@/lib/annonces/import/carte';
import type { AdressePossible } from '@/lib/annonces/types';
import { noteDepuisAnnonce } from './entrer';
import type { DemandePipeline } from './envoyer';

/**
 * « Nouveau bien » : la seule façon d'entrer au pipeline depuis le tableau.
 * Un lien d'annonce remplit la fiche ; l'adresse choisie et le type la
 * complètent. Pur.
 */

export type AdresseBien = {
  /** « 10 rue des Maraîchers » */
  rue: string;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  banId: string | null;
};

export type TypeBien = 'appartement' | 'maison';

export type AnnonceLue = {
  portail: string;
  portailCle: string;
  url: string;
  photo: string | null;
  particulier: boolean;
  agence: string | null;
  dpe: string | null;
  etage: string | null;
  /** Sans adresse sûre : les immeubles possibles, l'agent désigne le bon. */
  adressesPossibles: AdressePossible[];
};

export type FormulaireBien = {
  adresse: AdresseBien | null;
  type: TypeBien | null;
  surface: string;
  pieces: string;
  prix: string;
  annonce: AnnonceLue | null;
};

export const FORMULAIRE_VIDE: FormulaireBien = {
  adresse: null,
  type: null,
  surface: '',
  pieces: '',
  prix: '',
  annonce: null,
};

/** « 10 Rue des Maraîchers 75020 Paris » → la rue, le code postal, la ville. */
export function decouperAdresse(
  label: string,
  point: { latitude: number | null; longitude: number | null },
): AdresseBien | null {
  const propre = label.trim().replace(/\s+/g, ' ');
  if (propre.length < 3) return null;
  const m = propre.match(/^(.*?),?\s+(\d{5})\s+(.+)$/);
  return {
    rue: (m?.[1] ?? propre).trim(),
    postalCode: m?.[2] ?? null,
    city: m?.[3]?.trim() ?? null,
    latitude: point.latitude,
    longitude: point.longitude,
    banId: null,
  };
}

function texteNombre(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
}

/**
 * L'annonce lue remplit ce qui est vide. Une adresse affirmée devient celle du
 * bien ; un simple repère reste une proposition, jamais une adresse.
 */
export function remplirDepuisAnnonce(form: FormulaireBien, carte: CarteImport): FormulaireBien {
  const choisie = carte.adresseChoisie
    ? carte.adressesPossibles.find((p) => p.adresse === carte.adresseChoisie) ?? null
    : null;
  const adresseLue = choisie
    ? decouperAdresse(choisie.adresse, choisie)
    : !carte.approximative && carte.adresse
      ? decouperAdresse(carte.adresse, carte)
      : null;
  const type = carte.typeBien === 'appartement' || carte.typeBien === 'maison' ? carte.typeBien : null;
  return {
    adresse: form.adresse ?? adresseLue,
    type: form.type ?? type,
    surface: form.surface || texteNombre(carte.surface),
    pieces: form.pieces || texteNombre(carte.pieces),
    prix: form.prix || texteNombre(carte.prix),
    annonce: {
      portail: carte.portail,
      portailCle: carte.portailCle,
      url: carte.url,
      photo: carte.photo,
      particulier: carte.particulier,
      agence: carte.agence,
      dpe: carte.dpe,
      etage: carte.etage,
      adressesPossibles: carte.approximative ? carte.adressesPossibles : [],
    },
  };
}

function nombre(v: string): number | null {
  const n = Number(v.replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** « 450000 » → « 450 000 » à l'écran ; la saisie ne garde que les chiffres. */
export function prixAffiche(chiffres: string): string {
  const n = Number(chiffres.replace(/\D/g, ''));
  return chiffres && Number.isFinite(n) && n > 0 ? new Intl.NumberFormat('fr-FR').format(n) : '';
}

/** Sans adresse, pas de bien : c'est la seule saisie obligatoire. */
export function demandeDepuisFormulaire(form: FormulaireBien): DemandePipeline | null {
  if (!form.adresse) return null;
  const a = form.annonce;
  const prix = nombre(form.prix);
  return {
    address: form.adresse.rue,
    city: form.adresse.city,
    postalCode: form.adresse.postalCode,
    latitude: form.adresse.latitude,
    longitude: form.adresse.longitude,
    banId: form.adresse.banId,
    propertyType: form.type,
    surfaceM2: nombre(form.surface),
    rooms: nombre(form.pieces),
    price: prix,
    photos: a?.photo ? [a.photo] : [],
    dpeClass: a?.dpe ?? null,
    etage: a?.etage ?? null,
    ownerType: a && !a.particulier ? 'entreprise' : 'particulier',
    companyName: a && !a.particulier ? a.agence : null,
    notes: a ? noteDepuisAnnonce(a.portailCle, prix) : null,
    lien: a?.url ?? null,
    provenance: a ? 'portail' : 'terrain',
  };
}
