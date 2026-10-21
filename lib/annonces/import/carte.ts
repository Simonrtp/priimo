import { libellePortail } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import type { FicheAnnonce, LocalisationImport } from './types';

/** Ce que le panneau montre d'une annonce retrouvée : peu de texte, le point sur la carte. */
export type CarteImport = {
  /** Résultat en attente d'ajout (null : déjà dans les annonces de l'agence). */
  importId: string | null;
  annonceId: string | null;
  suivie: boolean;
  portail: string;
  /** Clé du portail (seloger, leboncoin…) : son logo. */
  portailCle: string;
  url: string;
  particulier: boolean;
  agence: string | null;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  etage: string | null;
  dpe: string | null;
  confiance: LocalisationImport['confiance'];
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Repère seulement (quartier, commune) : pas d'adresse affirmée. */
  approximative: boolean;
  /** Rayon du secteur, en mètres. Null : point d'immeuble. */
  rayonM: number | null;
  parcelleId: string | null;
  photo: string | null;
};

export function rayonDuRepere(
  confiance: LocalisationImport['confiance'],
  precision: LocalisationImport['precision'] | null | undefined,
  rayon: number | null | undefined,
): number | null {
  if (confiance !== 'incertaine') return null;
  if (rayon != null && rayon > 0) return rayon;
  if (precision === 'code_postal') return 700;
  return 300;
}

export function carteDepuisFiche(
  fiche: FicheAnnonce,
  loc: LocalisationImport,
  ids: { importId: string | null; annonceId: string | null; suivie: boolean },
): CarteImport {
  return {
    ...ids,
    portail: libellePortail(fiche.portail),
    portailCle: fiche.portail,
    url: fiche.url,
    particulier: fiche.typeVendeur === 'particulier',
    agence: fiche.agenceNom,
    prix: fiche.prix,
    surface: fiche.surface,
    pieces: fiche.pieces,
    etage: fiche.etage == null ? null : String(fiche.etage),
    dpe: fiche.dpe,
    confiance: loc.confiance,
    adresse: loc.adresse,
    latitude: loc.latitude,
    longitude: loc.longitude,
    approximative: loc.confiance === 'incertaine',
    rayonM: rayonDuRepere(loc.confiance, loc.precision, loc.rayonM ?? fiche.zone?.rayonM),
    parcelleId: loc.parcelleIds[0] ?? null,
    photo: fiche.photos[0] ?? null,
  };
}

export function carteDepuisAnnonce(a: Annonce, ids: { annonceId: string | null; suivie: boolean }): CarteImport {
  return {
    importId: null,
    ...ids,
    portail: libellePortail(a.portail),
    portailCle: a.portail,
    url: a.url,
    particulier: a.typeVendeur === 'particulier',
    agence: a.agenceNom,
    prix: a.prix,
    surface: a.surface,
    pieces: a.pieces,
    etage: a.etage,
    dpe: a.dpe,
    confiance: a.confiance,
    adresse: a.adresse,
    latitude: a.latitude,
    longitude: a.longitude,
    approximative: a.confiance === 'incertaine',
    rayonM: rayonDuRepere(a.confiance, a.localisationPrecision, null),
    parcelleId: a.parcelleIds[0] ?? null,
    photo: null,
  };
}

export function numeroEtVoie(adresse: string | null): { numero: string | null; voie: string | null } {
  const m = adresse?.match(/^\s*(\d+\s?[a-zA-Z]?)\s+(.+?)\s+\d{5}\b/);
  return m ? { numero: m[1]!.replace(/\s/g, ''), voie: m[2]! } : { numero: null, voie: null };
}

/** Une ligne de `public.annonces` (+ photos), prête à l'ajout. Null sans code postal. */
export function colonnesAnnonce(fiche: FicheAnnonce, loc: LocalisationImport, maintenant = new Date()): Record<string, unknown> | null {
  const codePostal = fiche.codePostal ?? loc.adresse?.match(/\b(\d{5})\b/)?.[1] ?? null;
  if (!codePostal) return null;
  const adresseAffichable = loc.adresse;
  const { numero, voie } = numeroEtVoie(adresseAffichable);
  const vu = maintenant.toISOString();
  return {
    portail: fiche.portail,
    id_portail: fiche.idPortail ?? fiche.url.slice(0, 500),
    url: fiche.url,
    type_vendeur: fiche.typeVendeur,
    agence_nom: fiche.agenceNom,
    statut: 'active',
    origine: 'manuelle',
    publiee_le: fiche.datePublication,
    premiere_vue_le: vu,
    derniere_vue_le: vu,
    type_bien: fiche.typeBien,
    titre: fiche.titre,
    prix_initial: fiche.prix != null ? Math.round(fiche.prix) : null,
    prix: fiche.prix != null ? Math.round(fiche.prix) : null,
    surface: fiche.surface != null ? Math.round(fiche.surface * 100) / 100 : null,
    pieces: fiche.pieces != null ? Math.round(fiche.pieces) : null,
    etage: fiche.etage != null ? Math.round(fiche.etage) : null,
    dpe: fiche.dpe,
    conso_kwh_m2: fiche.consoKwhM2,
    ges: fiche.ges,
    ges_kg_m2: fiche.gesKgM2,
    code_postal: codePostal,
    ville: fiche.ville,
    quartier: fiche.quartier,
    confiance: loc.confiance,
    localisation_precision: loc.precision ?? 'code_postal',
    adresse: adresseAffichable,
    adresse_numero: numero,
    adresse_voie: voie,
    parcelle_ids: loc.parcelleIds,
    numero_dpe: loc.numeroDpe,
    complement_dpe: loc.complementDpe,
    latitude: loc.latitude,
    longitude: loc.longitude,
    logement_cle: loc.numeroDpe,
    score_localisation: loc.score,
    raisons_localisation: loc.raisons,
    photos: fiche.photos,
  };
}
