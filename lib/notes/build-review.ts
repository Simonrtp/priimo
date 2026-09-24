import type { Contact } from '@/types/contact';
import type { NoteSourceInfo } from '@/types/contact';
import { normalizeName } from '@/lib/import/normalize';
import { confianceImmeuble, matchContacts, type ContactMatch } from '@/lib/notes/match';
import {
  extraireTelephones,
  guessAdresseFromTranscript,
  guessPersonnesFromTranscript,
  matchContactsInTranscript,
  personneFromMatch,
  rattacherTelephonePersonne,
  recadrerPersonne,
} from '@/lib/notes/from-transcript';
import type { ExtractedPersonne, ExtractedRelance, ExtractedPromesse, ExtractedRendezVous, ExtractedVisite, NoteExtraction } from '@/lib/notes/propositions';
import { lignesFicheNote, relanceAtFromJours } from '@/lib/notes/propositions';
import { biensCitesDansTexte } from '@/lib/notes/rattacher-catalogue';

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

export type BienProposal = {
  id: string;
  label: string;
};

export type ActionProposee = {
  id: string;
  titre: string;
  detail: string | null;
};

export type NoteReviewPayload = {
  voiceNoteId: string;
  transcript: string | null;
  visibilite: 'agence' | 'privee';
  sourceInfo: NoteSourceInfo | null;
  extractFailed: boolean;
  personnes: PersonneProposal[];
  immeuble: ImmeubleProposal | null;
  biens: BienProposal[];
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
    biens: [],
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
  biensAgence?: readonly { id: string; address: string; city?: string | null }[];
}): NoteReviewPayload {
  const extraction = args.extraction;
  const cited = args.transcript?.trim() ?? '';
  const extractedPersonnes = (extraction?.personnes ?? [])
    .map((personne) => (cited ? recadrerPersonne(personne, cited) : personne))
    .filter((personne): personne is ExtractedPersonne => personne !== null);
  const personnes: PersonneProposal[] = extractedPersonnes.map((personne, i) => ({
    id: `p${i}`,
    personne,
    matches: matchContacts(personne, args.contacts, args.agencyId),
  }));

  if (cited) {
    const coveredKeys = new Set(
      personnes.map(
        (p) => `${normalizeName(p.personne.firstName)}|${normalizeName(p.personne.lastName)}`,
      ),
    );
    for (const guessed of guessPersonnesFromTranscript(cited)) {
      const key = `${normalizeName(guessed.firstName)}|${normalizeName(guessed.lastName)}`;
      if (coveredKeys.has(key)) continue;
      coveredKeys.add(key);
      personnes.push({
        id: `p-guess-${personnes.length}`,
        personne: guessed,
        matches: matchContacts(guessed, args.contacts, args.agencyId),
      });
    }

    const coveredIds = new Set(personnes.flatMap((p) => p.matches.map((m) => m.contactId)));
    for (const match of matchContactsInTranscript(cited, args.contacts, args.agencyId)) {
      if (coveredIds.has(match.contactId)) continue;
      coveredIds.add(match.contactId);
      personnes.push({
        id: `t-${match.contactId}`,
        personne: personneFromMatch(match, args.contacts),
        matches: [match],
      });
    }

    const telephones = extraireTelephones(cited);
    for (const p of personnes) {
      p.personne = rattacherTelephonePersonne(p.personne, telephones);
    }
    if (telephones[0] && personnes.length === 0) {
      const phone = telephones[0];
      personnes.push({
        id: 'p-tel',
        personne: { firstName: '', lastName: '', phone, email: null, type: 'autre' },
        matches: matchContacts(
          { firstName: '', lastName: '', phone, email: null },
          args.contacts,
          args.agencyId,
        ),
      });
    }
  }

  let immeuble: ImmeubleProposal | null = null;
  const address =
    extraction?.address ?? guessAdresseFromTranscript(cited) ?? args.geo.adresse_normalisee;
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
    biens: cited ? biensCitesDansTexte(cited, args.biensAgence ?? []) : [],
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

export function actionsDepuisReview(review: NoteReviewPayload): ActionProposee[] {
  const out: ActionProposee[] = [];
  for (const p of review.personnes) {
    const match = p.matches[0];
    const nom =
      match?.label ||
      [p.personne.firstName, p.personne.lastName].filter(Boolean).join(' ') ||
      p.personne.phone ||
      'Contact';
    if (match) {
      out.push({
        id: `relier-${match.contactId}`,
        titre: `Rattacher à ${nom}`,
        detail: 'Déjà dans l’agence',
      });
    } else {
      out.push({
        id: `creer-${p.id}`,
        titre: `Créer le contact ${nom}`,
        detail: p.personne.phone,
      });
    }
  }
  for (const bien of review.biens) {
    out.push({
      id: `bien-${bien.id}`,
      titre: 'Rattacher au bien',
      detail: bien.label,
    });
  }
  if (review.immeuble) {
    out.push({
      id: 'immeuble',
      titre: 'Rattacher à l’adresse',
      detail: review.immeuble.adresseNormalisee ?? review.immeuble.address,
    });
  }
  if (review.relance) {
    out.push({ id: 'relance', titre: review.relance.libelle, detail: null });
  }
  if (review.promesse?.accepted) {
    out.push({ id: 'promesse', titre: `Promesse · ${review.promesse.intitule}`, detail: null });
  }
  if (review.rendezVous?.accepted) {
    out.push({ id: 'rdv', titre: `Rendez-vous · ${review.rendezVous.type}`, detail: null });
  }
  if (review.visite?.accepted) {
    out.push({ id: 'visite', titre: 'Visite effectuée', detail: review.visite.retour });
  }
  return out;
}
