import { dateKeyParis } from '@/lib/today/calendar';
import { dansLaSemaine, type Intervalle, type Semaine } from './semaines';
import { compteurVide, type Activite } from './types';

/**
 * Dérivation des compteurs d'activité.
 *
 * Fonction pure : mêmes lignes de journal + même semaine = mêmes chiffres.
 * Chaque action tombe dans une seule carte :
 *   - une note (échange ou rattachée) → Notes terrain ;
 *   - une note rattachée à une adresse → aussi Immeubles ;
 *   - une sortie (vu, absent, rencontré) → Immeubles seulement ;
 *   - une transition de pipeline → l'étape visée, pas l'immeuble.
 */

/** Une transition du journal `lead_stage_events`, aplatie. */
export type TransitionRow = {
  /** Le lead concerné — indispensable pour suivre une cohorte. */
  leadId: string;
  profileId: string | null;
  /** Clé de l'étape de départ. `null` = entrée du lead dans le pipeline. */
  depuisCle: string | null;
  /** Clé de l'étape d'arrivée : `contacte`, `estimation`, `mandat`… */
  versCle: string | null;
  createdAt: string;
  /** `ban_id` du lead concerné, quand il est géocodé. */
  banId: string | null;
};

/** Une note vocale, avec son rattachement terrain et si elle décrit un échange. */
export type NoteRow = {
  auteurId: string | null;
  createdAt: string;
  banId: string | null;
  /** Note liée à un immeuble ou à une parcelle via `note_liens`. */
  rattacheeTerrain: boolean;
  /** Note liée à un contact : c'est un échange, pas une simple info terrain. */
  echange: boolean;
};

/** Un arrêt de sortie observé : `sortie_events` (rencontre, absent, passer). */
export type ContactPhysiqueRow = {
  profileId: string;
  /** Jour civil parisien déjà normalisé côté base (`sortie_events.day`). */
  jour: string;
  banId: string | null;
  /** Absent de l'ancien journal : une rencontre est le défaut. */
  kind?: 'rencontre' | 'absent' | 'passer';
};

/**
 * État de lecture de chaque journal.
 *
 * Sans ça, une table absente et un agent qui n'a rien fait rendent le même
 * tableau vide, donc le même « 0 » à l'écran. Ce n'est pas la même information :
 * l'un demande de sortir prospecter, l'autre demande d'appeler le support.
 */
export type EtatLecture = 'ok' | 'erreur';

export type LecturesJournal = {
  transitions: EtatLecture;
  notes: EtatLecture;
  contactsPhysiques: EtatLecture;
};

export type JournalActivite = {
  transitions: readonly TransitionRow[];
  notes: readonly NoteRow[];
  contactsPhysiques: readonly ContactPhysiqueRow[];
  lectures: LecturesJournal;
  /**
   * Rang de progression par clé d'étape, tiré de `lead_stages.ordre`.
   * Les étapes de type « perdu » valent 0 : perdre n'est pas avancer, et sans
   * ça un lead perdu passerait pour le plus abouti de la cohorte.
   */
  rangParCle: Readonly<Record<string, number>>;
};

/**
 * Rangs de repli quand l'agence n'expose pas ses étapes — ordre canonique du
 * seed `seed_lead_stages_for_agency`.
 */
export const RANGS_CANONIQUES: Readonly<Record<string, number>> = {
  pris: 1,
  contacte: 2,
  rendez_vous: 3,
  estimation: 4,
  mandat: 5,
  perdu: 0,
};

export function journalVide(): JournalActivite {
  return {
    transitions: [],
    notes: [],
    contactsPhysiques: [],
    lectures: { transitions: 'ok', notes: 'ok', contactsPhysiques: 'ok' },
    rangParCle: RANGS_CANONIQUES,
  };
}

function jourDe(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return dateKeyParis(new Date(t));
}

function kindSortie(c: ContactPhysiqueRow): 'rencontre' | 'absent' | 'passer' {
  return c.kind ?? 'rencontre';
}

/**
 * Les six compteurs d'un collaborateur sur une semaine.
 * Les lignes d'autres collaborateurs sont ignorées : on filtre ici plutôt
 * qu'à la lecture, pour qu'un directeur puisse charger l'agence une fois et
 * dériver chaque membre sans requête supplémentaire.
 */
export function compteursSemaine(params: {
  journal: JournalActivite;
  profileId: string;
  semaine: Semaine;
}): Record<Activite, number> {
  const { journal, profileId, semaine } = params;
  const compteurs = compteurVide();
  const immeubles = new Set<string>();

  for (const t of journal.transitions) {
    if (t.profileId !== profileId) continue;
    const jour = jourDe(t.createdAt);
    if (!jour || !dansLaSemaine(jour, semaine)) continue;

    // La transition compte l'étape, pas l'immeuble : qualifier un lead
    // n'alimente pas « Immeubles travaillés ».
    if (t.versCle === 'contacte') compteurs.contacts_qualifies += 1;
    else if (t.versCle === 'estimation') compteurs.estimations += 1;
    else if (t.versCle === 'mandat') compteurs.mandats += 1;
  }

  for (const n of journal.notes) {
    if (n.auteurId !== profileId) continue;
    const jour = jourDe(n.createdAt);
    if (!jour || !dansLaSemaine(jour, semaine)) continue;

    if (n.echange || n.rattacheeTerrain) compteurs.informations_terrain += 1;
    if (n.banId && n.rattacheeTerrain) immeubles.add(n.banId);
  }

  for (const c of journal.contactsPhysiques) {
    if (c.profileId !== profileId) continue;
    if (!dansLaSemaine(c.jour, semaine)) continue;
    const kind = kindSortie(c);
    if (c.banId && (kind === 'rencontre' || kind === 'absent' || kind === 'passer')) {
      immeubles.add(c.banId);
    }
  }

  compteurs.immeubles_prospectes = immeubles.size;
  return compteurs;
}

/**
 * Cumul sur une fenêtre de plusieurs semaines. Passer la fenêtre entière
 * comme une seule « semaine » suffit — sauf pour les immeubles, dont le
 * distinct doit se faire sur toute la fenêtre, ce que fait déjà
 * `compteursSemaine` puisque le Set n'est pas remis à zéro par semaine.
 */
export function compteursFenetre(params: {
  journal: JournalActivite;
  profileId: string;
  fenetre: Intervalle;
}): Record<Activite, number> {
  return compteursSemaine({
    journal: params.journal,
    profileId: params.profileId,
    semaine: params.fenetre,
  });
}

/**
 * Somme des compteurs de plusieurs collaborateurs — vue agence.
 *
 * `immeubles_prospectes` y est une somme de distincts individuels, pas un
 * distinct d'agence : deux agents sur le même immeuble comptent deux fois.
 * C'est voulu — la cascade de ratios n'utilise pas ce compteur, et un directeur
 * qui lit « immeubles couverts par l'agence » attend un vrai distinct, ce qui
 * sera le sujet du chantier secteurs.
 */
export function compteursAgence(params: {
  journal: JournalActivite;
  profileIds: readonly string[];
  fenetre: Intervalle;
}): Record<Activite, number> {
  const total = compteurVide();
  for (const profileId of params.profileIds) {
    const c = compteursFenetre({ journal: params.journal, profileId, fenetre: params.fenetre });
    total.immeubles_prospectes += c.immeubles_prospectes;
    total.contacts_qualifies += c.contacts_qualifies;
    total.estimations += c.estimations;
    total.informations_terrain += c.informations_terrain;
    total.mandats += c.mandats;
  }
  return total;
}
