/**
 * Ce que la dictée propose au-delà des contacts : actions datées, mises à jour
 * de fiches, recherche d'acquéreur, prospect, e-mail.
 *
 * Pur et sans base : il reçoit l'extraction et le contexte de l'agence, il rend
 * des propositions que l'agent coche ou décoche. Rien n'est écrit ici.
 */

import type { Contact } from '@/types/contact';
import { aLeRole } from '@/types/contact';
import type { MandatStatut } from '@/types/bien';
import { MANDAT_STATUT_LABELS, bienIsActive } from '@/types/bien';
import { normalizeName } from '@/lib/import/normalize';
import { evaluerCorrespondance } from '@/lib/matching/rapprochement';
import { biensCitesDansTexte } from '@/lib/notes/rattacher-catalogue';
import { dateParisIso } from '@/lib/notes/date-relative';
import type {
  ActionType,
  EtapeProspectDictee,
  ExtractedPersonne,
  ExtractedRendezVous,
  ExtractedVisite,
  NoteExtraction,
  StatutMandatDicte,
} from '@/lib/notes/propositions';

/* -------------------------------------------------------------------------- */
/* Types exposés à l'interface                                                 */
/* -------------------------------------------------------------------------- */

export type ActionProposal = {
  id: string;
  type: ActionType;
  intitule: string;
  /** « AAAA-MM-JJ ». */
  date: string;
  /** La dictée ne disait pas quand : Priimo a mis demain, à confirmer. */
  dateDeduite: boolean;
  heure: string | null;
  personne: string | null;
  /** Personne de la revue à laquelle l'action se rapporte. */
  personneRef: string | null;
  lieu: string | null;
  rdvType: ExtractedRendezVous['type'] | null;
  interet: ExtractedVisite['interet'];
  accepted: boolean;
};

export type MiseAJourProposal = {
  id: string;
  bienId: string;
  bienLabel: string;
  accepted: boolean;
} & (
  | { champ: 'prix'; avant: number | null; apres: number }
  | { champ: 'statut_mandat'; avant: MandatStatut; apres: StatutMandatDicte }
);

export type BienCorrespondant = { id: string; label: string; score: number; raisons: string[] };

export type RechercheProposal = {
  personneRef: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  surfaceMin: number | null;
  roomsMin: number | null;
  codesPostaux: string[];
  villes: string[];
  typeBien: string | null;
  correspondances: BienCorrespondant[];
  accepted: boolean;
};

export type ProspectProposal = {
  leadId: string;
  adresse: string;
  etapeActuelle: string | null;
  stageId: string;
  stageLibelle: string;
  etape: EtapeProspectDictee;
  motif: string | null;
  accepted: boolean;
};

export type EmailProposal = {
  personneRef: string | null;
  destinataire: string | null;
  email: string | null;
  objet: string;
  corps: string;
};

export type LeadLie = { id: string; label: string };

/* -------------------------------------------------------------------------- */
/* Contexte de l'agence                                                        */
/* -------------------------------------------------------------------------- */

export type BienContexte = {
  id: string;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  price?: number | null;
  surfaceM2?: number | null;
  rooms?: number | null;
  mandatStatut?: MandatStatut | null;
  banId?: string | null;
};

export type LeadContexte = {
  id: string;
  address: string;
  banId: string | null;
  stageId: string | null;
};

export type EtapeContexte = { id: string; cle: string; libelle: string };

/** Personne telle qu'elle sort de la revue : de quoi la reconnaître par son nom. */
export type PersonneRef = {
  id: string;
  personne: ExtractedPersonne;
  matches: readonly { contactId: string; label: string; email: string | null }[];
};

/* -------------------------------------------------------------------------- */
/* Personnes                                                                   */
/* -------------------------------------------------------------------------- */

function mots(nom: string): string[] {
  return normalizeName(nom)
    .split(/\s+/)
    .filter((m) => m.length >= 3 && !['mme', 'madame', 'monsieur', 'mlle'].includes(m));
}

/** « Rappeler Mme Martin » → la personne « Janine Martin » de la revue. */
export function trouverPersonne(nom: string | null, personnes: readonly PersonneRef[]): string | null {
  if (!nom) return null;
  const cherche = mots(nom);
  if (cherche.length === 0) return null;
  let meilleur: { id: string; score: number } | null = null;
  for (const p of personnes) {
    const noms = [
      `${p.personne.firstName} ${p.personne.lastName}`,
      ...p.matches.map((m) => m.label),
    ];
    const connus = new Set(noms.flatMap(mots));
    const score = cherche.filter((m) => connus.has(m)).length;
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { id: p.id, score };
  }
  return meilleur?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

function lendemain(noteDate: Date): string {
  return dateParisIso(new Date(noteDate.getTime() + 86_400_000));
}

export function actionsProposees(
  extraction: NoteExtraction | null,
  personnes: readonly PersonneRef[],
  noteDate: Date,
): ActionProposal[] {
  // « Envoyer un mail à… » a déjà sa carte e-mail, brouillon rédigé : pas de tâche en double.
  const actions = (extraction?.actions ?? []).filter(
    (a) => !(extraction?.email && a.type === 'tache' && /\b(e-?mail|mail|courriel)\b/i.test(a.intitule)),
  );
  if (actions.length > 0) {
    return actions.map((a, i) => ({
      id: `a${i}`,
      type: a.type,
      intitule: a.intitule,
      date: a.date ?? (a.type === 'visite_faite' ? dateParisIso(noteDate) : lendemain(noteDate)),
      dateDeduite: !a.date && a.type !== 'visite_faite',
      heure: a.heure,
      personne: a.personne,
      personneRef: trouverPersonne(a.personne ?? a.intitule, personnes),
      lieu: a.lieu,
      rdvType: a.rdvType,
      interet: a.interet,
      accepted: true,
    }));
  }

  // Note analysée avant les actions multiples : on repart des anciens champs.
  const out: ActionProposal[] = [];
  if (extraction?.promesse) {
    out.push({
      id: 'a-promesse',
      type: 'rappel',
      intitule: extraction.promesse.intitule,
      date: extraction.promesse.echeance,
      dateDeduite: false,
      heure: null,
      personne: null,
      personneRef: trouverPersonne(extraction.promesse.intitule, personnes),
      lieu: null,
      rdvType: null,
      interet: null,
      accepted: true,
    });
  }
  if (extraction?.rendezVous) {
    const debut = new Date(extraction.rendezVous.debut);
    const heure = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
    }).format(debut);
    out.push({
      id: 'a-rdv',
      type: 'rdv',
      intitule: `Rendez-vous ${extraction.rendezVous.type === 'autre' ? '' : extraction.rendezVous.type}`.trim(),
      date: dateParisIso(debut),
      dateDeduite: false,
      heure,
      personne: null,
      personneRef: null,
      lieu: extraction.rendezVous.lieu,
      rdvType: extraction.rendezVous.type,
      interet: null,
      accepted: true,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Mises à jour de biens                                                       */
/* -------------------------------------------------------------------------- */

function bienVise(
  description: string | null,
  transcript: string,
  biens: readonly BienContexte[],
  banId: string | null,
): BienContexte | null {
  if (description) {
    const cites = biensCitesDansTexte(description, biens);
    if (cites.length === 1) return biens.find((b) => b.id === cites[0]!.id) ?? null;
  }
  const dansNote = biensCitesDansTexte(transcript, biens);
  if (dansNote.length === 1) return biens.find((b) => b.id === dansNote[0]!.id) ?? null;
  if (banId) {
    const surPlace = biens.filter((b) => b.banId === banId);
    if (surPlace.length === 1) return surPlace[0]!;
  }
  return null;
}

export function misesAJourProposees(
  extraction: NoteExtraction | null,
  transcript: string,
  biens: readonly BienContexte[],
  banId: string | null,
): MiseAJourProposal[] {
  const out: MiseAJourProposal[] = [];
  for (const [i, maj] of (extraction?.misesAJour ?? []).entries()) {
    const bien = bienVise(maj.bien, transcript, biens, banId);
    if (!bien) continue;
    if (maj.champ === 'prix') {
      if (bien.price === maj.valeur) continue;
      out.push({
        id: `m${i}`,
        bienId: bien.id,
        bienLabel: bien.address,
        champ: 'prix',
        avant: bien.price ?? null,
        apres: maj.valeur,
        accepted: true,
      });
    } else {
      const avant = bien.mandatStatut ?? 'estimation';
      if (avant === maj.valeur) continue;
      out.push({
        id: `m${i}`,
        bienId: bien.id,
        bienLabel: bien.address,
        champ: 'statut_mandat',
        avant,
        apres: maj.valeur,
        accepted: true,
      });
    }
  }
  return out;
}

export function libelleMiseAJour(m: MiseAJourProposal): { avant: string; apres: string; quoi: string } {
  if (m.champ === 'prix') {
    const euros = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} €`;
    return { quoi: 'Prix', avant: m.avant != null ? euros(m.avant) : '—', apres: euros(m.apres) };
  }
  return {
    quoi: 'Mandat',
    avant: MANDAT_STATUT_LABELS[m.avant],
    apres: MANDAT_STATUT_LABELS[m.apres],
  };
}

/* -------------------------------------------------------------------------- */
/* Recherche d'acquéreur                                                       */
/* -------------------------------------------------------------------------- */

const MAX_CORRESPONDANCES = 3;

export function rechercheProposee(
  extraction: NoteExtraction | null,
  personnes: readonly PersonneRef[],
  biens: readonly BienContexte[],
): RechercheProposal | null {
  const r = extraction?.recherche;
  if (!r) return null;
  const personneRef =
    trouverPersonne(r.personne, personnes) ??
    personnes.find((p) => aLeRole(p.personne, 'acquereur'))?.id ??
    (personnes.length === 1 ? personnes[0]!.id : null);

  // Un contact fictif porte les critères dictés : le moteur de rapprochement
  // de l'agence les juge comme ceux de n'importe quel acquéreur.
  const acquereur = {
    id: 'dictee',
    fullName: 'Acquéreur dicté',
    type: 'acquereur',
    criteria: {
      budgetMin: r.budgetMin,
      budgetMax: r.budgetMax,
      surfaceMin: r.surfaceMin,
      surfaceMax: null,
      roomsMin: r.roomsMin,
      postalCodes: r.codesPostaux,
    },
  } as unknown as Contact;

  const correspondances: BienCorrespondant[] = [];
  for (const bien of biens) {
    if (!bien.mandatStatut || !bienIsActive(bien.mandatStatut)) continue;
    const match = evaluerCorrespondance(
      {
        id: bien.id,
        address: bien.address,
        postalCode: bien.postalCode ?? null,
        price: bien.price ?? null,
        surfaceM2: bien.surfaceM2 ?? null,
        rooms: bien.rooms ?? null,
      },
      acquereur,
    );
    if (match) {
      correspondances.push({ id: bien.id, label: bien.address, score: match.score, raisons: match.raisons });
    }
  }
  correspondances.sort((a, b) => b.score - a.score);

  return {
    personneRef,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    surfaceMin: r.surfaceMin,
    roomsMin: r.roomsMin,
    codesPostaux: r.codesPostaux,
    villes: r.villes,
    typeBien: r.typeBien,
    correspondances: correspondances.slice(0, MAX_CORRESPONDANCES),
    accepted: true,
  };
}

export function lignesRecherche(r: Pick<RechercheProposal, 'budgetMin' | 'budgetMax' | 'surfaceMin' | 'roomsMin' | 'codesPostaux' | 'villes' | 'typeBien'>): string[] {
  const k = (n: number) =>
    n >= 1_000_000
      ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n / 1_000_000)} M€`
      : `${Math.round(n / 1000)} k€`;
  const out: string[] = [];
  if (r.typeBien) out.push(r.typeBien);
  if (r.roomsMin) out.push(`${r.roomsMin} pièces et +`);
  if (r.surfaceMin) out.push(`${r.surfaceMin} m² et +`);
  if (r.budgetMax && r.budgetMin) out.push(`${k(r.budgetMin)} – ${k(r.budgetMax)}`);
  else if (r.budgetMax) out.push(`jusqu’à ${k(r.budgetMax)}`);
  else if (r.budgetMin) out.push(`à partir de ${k(r.budgetMin)}`);
  const lieux = [...r.villes, ...r.codesPostaux];
  if (lieux.length) out.push(lieux.join(', '));
  return out;
}

/* -------------------------------------------------------------------------- */
/* Prospect DPE                                                                */
/* -------------------------------------------------------------------------- */

/** Les prospects de l'agence à l'adresse de la note. */
export function leadsALAdresse(banId: string | null, leads: readonly LeadContexte[]): LeadLie[] {
  if (!banId) return [];
  return leads.filter((l) => l.banId === banId).map((l) => ({ id: l.id, label: l.address }));
}

export function prospectPropose(
  extraction: NoteExtraction | null,
  banId: string | null,
  leads: readonly LeadContexte[],
  etapes: readonly EtapeContexte[],
): ProspectProposal | null {
  const p = extraction?.prospect;
  if (!p || !banId) return null;
  const aLAdresse = leads.filter((l) => l.banId === banId);
  if (aLAdresse.length !== 1) return null;
  const lead = aLAdresse[0]!;
  const cible = etapes.find((e) => e.cle === p.etape);
  if (!cible || cible.id === lead.stageId) return null;
  return {
    leadId: lead.id,
    adresse: lead.address,
    etapeActuelle: etapes.find((e) => e.id === lead.stageId)?.libelle ?? null,
    stageId: cible.id,
    stageLibelle: cible.libelle,
    etape: p.etape,
    motif: p.motif,
    accepted: true,
  };
}

/* -------------------------------------------------------------------------- */
/* E-mail                                                                      */
/* -------------------------------------------------------------------------- */

export function emailPropose(
  extraction: NoteExtraction | null,
  personnes: readonly PersonneRef[],
): EmailProposal | null {
  const e = extraction?.email;
  if (!e) return null;
  // Jamais de destinataire deviné : le rabattre sur la seule personne citée
  // envoyait l'avenant de la vendeuse à l'acquéreur (constaté en test).
  const personneRef = trouverPersonne(e.personne, personnes);
  const p = personnes.find((x) => x.id === personneRef) ?? null;
  const match = p?.matches[0] ?? null;
  const nom =
    match?.label ?? ([p?.personne.firstName, p?.personne.lastName].filter(Boolean).join(' ') || e.personne);
  return {
    personneRef,
    destinataire: nom || null,
    email: match?.email ?? p?.personne.email ?? null,
    objet: e.objet,
    corps: e.corps,
  };
}

/** Lien qui ouvre la messagerie de l'agent, brouillon rempli. */
export function mailtoBrouillon(e: Pick<EmailProposal, 'email' | 'objet' | 'corps'>): string {
  const params = new URLSearchParams({ subject: e.objet, body: e.corps });
  // URLSearchParams code les espaces en « + », que les clients mail affichent tels quels.
  return `mailto:${encodeURIComponent(e.email ?? '')}?${params.toString().replace(/\+/g, '%20')}`;
}
