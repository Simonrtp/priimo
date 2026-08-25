import type { Contact } from '@/types/contact';
import type { NoteSourceInfo } from '@/types/contact';
import { confianceImmeuble, matchContacts, type ContactMatch } from '@/lib/notes/match';
import type { ExtractedPersonne, ExtractedRelance, ExtractedPromesse, ExtractedRendezVous, ExtractedVisite, NoteExtraction } from '@/lib/notes/propositions';
import { lignesFicheNote, relanceAtFromJours } from '@/lib/notes/propositions';

export type PersonneProposal = {
  id: string;
  personne: ExtractedPersonne;
  matches: ContactMatch[];
};

export type ImmeubleProposal = {
  address: string;
  banId: string | null;
  adresseNormalisee: string | null;
  score: number | null;
  confiance: 'certain' | 'probable' | null;
};

export type RelanceProposal = {
  at: string;
  jours: number;
  libelle: string;
};

export type PromesseProposal = ExtractedPromesse & { accepted: boolean };
export type RendezVousProposal = ExtractedRendezVous & { accepted: boolean };
export type VisiteProposal = ExtractedVisite & { accepted: boolean };

export type NoteReviewPayload = {
  voiceNoteId: string;
  transcript: string | null;
  visibilite: 'agence' | 'privee';
  sourceInfo: NoteSourceInfo | null;
  extractFailed: boolean;
  personnes: PersonneProposal[];
  immeuble: ImmeubleProposal | null;
  relance: RelanceProposal | null;
  promesse: PromesseProposal | null;
  rendezVous: RendezVousProposal | null;
  visite: VisiteProposal | null;
  details: string[];
  prix: number | null;
  rooms: number | null;
  surface: number | null;
  secteur: string | null;
};

export function emptyReviewPayload(
  voiceNoteId: string,
  transcript: string | null,
  visibilite: NoteReviewPayload['visibilite'] = 'agence',
): NoteReviewPayload {
  return {
    voiceNoteId,
    transcript,
    visibilite,
    sourceInfo: null,
    extractFailed: false,
    personnes: [],
    immeuble: null,
    relance: null,
    promesse: null,
    rendezVous: null,
    visite: null,
    details: [],
    prix: null,
    rooms: null,
    surface: null,
    secteur: null,
  };
}

export function buildReviewPayload(args: {
  voiceNoteId: string;
  transcript: string | null;
  visibilite: 'agence' | 'privee';
  extraction: NoteExtraction | null;
  extractFailed: boolean;
  contacts: readonly Pick<
    Contact,
    'id' | 'agencyId' | 'firstName' | 'lastName' | 'fullName' | 'phone' | 'email' | 'address' | 'banId'
  >[];
  agencyId: string;
  geo: {
    ban_id: string | null;
    adresse_normalisee: string | null;
    geocode_score: number | null;
  };
}): NoteReviewPayload {
  const extraction = args.extraction;
  const personnes: PersonneProposal[] = (extraction?.personnes ?? []).map((personne, i) => ({
    id: `p${i}`,
    personne,
    matches: matchContacts(personne, args.contacts, args.agencyId),
  }));

  let immeuble: ImmeubleProposal | null = null;
  const address = extraction?.address ?? args.geo.adresse_normalisee;
  if (address) {
    const score = args.geo.geocode_score;
    immeuble = {
      address,
      banId: args.geo.ban_id,
      adresseNormalisee: args.geo.adresse_normalisee,
      score,
      confiance: confianceImmeuble(score),
    };
  }

  const relanceRaw: ExtractedRelance | null = extraction?.relance ?? null;
  const relance = relanceRaw
    ? {
        at: relanceAtFromJours(relanceRaw.jours),
        jours: relanceRaw.jours,
        libelle: relanceRaw.libelle,
      }
    : null;

  const displayAddress = immeuble?.adresseNormalisee ?? extraction?.address ?? null;
  const secteur = extraction?.secteur ?? null;
  const prix = extraction?.prix ?? null;
  const rooms = extraction?.rooms ?? null;
  const surface = extraction?.surface ?? null;

  return {
    voiceNoteId: args.voiceNoteId,
    transcript: args.transcript,
    visibilite: args.visibilite,
    sourceInfo: extraction?.sourceInfo ?? null,
    extractFailed: args.extractFailed,
    personnes,
    immeuble,
    relance,
    promesse: extraction?.promesse ? { ...extraction.promesse, accepted: true } : null,
    rendezVous: extraction?.rendezVous ? { ...extraction.rendezVous, accepted: true } : null,
    visite: extraction?.visite ? { ...extraction.visite, accepted: true } : null,
    details: lignesFicheNote({ address: displayAddress, secteur, prix, rooms, surface }),
    prix,
    rooms,
    surface,
    secteur,
  };
}
