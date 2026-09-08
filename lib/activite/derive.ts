import { dateKeyParis } from '@/lib/today/calendar';
import { dansLaSemaine, type Intervalle, type Semaine } from './semaines';
import { compteurVide, type Activite } from './types';

/**
 * Dérivation des compteurs d'activité.
 *
 * Fonction pure : mêmes lignes de journal + même semaine = mêmes chiffres.
 * C'est la propriété qui compte. Elle interdit de matérialiser les compteurs
 * dérivés dans une table — une ligne écrite une fois ne se recalcule plus, et
 * une semaine passée deviendrait une réconciliation au lieu d'une lecture.
 *
 * Réserve honnête : une transition porte le `ban_id` actuel du lead, pas celui
 * qu'il avait le jour de la transition. Si un lead est regéocodé, le compteur
 * « immeubles » d'une semaine passée peut bouger d'une unité. Le cas est rare
 * et le prix à payer pour ne pas figer une copie du journal.
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

/** Une note vocale, avec son rattachement terrain. */
export type NoteRow = {
  auteurId: string | null;
  createdAt: string;
  banId: string | null;
  /** Note liée à un immeuble ou à une parcelle via `note_liens`. */
  rattacheeTerrain: boolean;
};

/** Un contact physique déclaré : `sortie_events` avec kind = `rencontre`. */
export type ContactPhysiqueRow = {
  profileId: string;
  /** Jour civil parisien déjà normalisé côté base (`sortie_events.day`). */
  jour: string;
  banId: string | null;
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

    // Toute transition signifie que l'agent a touché cet immeuble.
    if (t.banId) immeubles.add(t.banId);

    if (t.versCle === 'contacte') compteurs.contacts_qualifies += 1;
    else if (t.versCle === 'estimation') compteurs.estimations += 1;
    else if (t.versCle === 'mandat') compteurs.mandats += 1;
  }

  for (const n of journal.notes) {
    if (n.auteurId !== profileId) continue;
    const jour = jourDe(n.createdAt);
    if (!jour || !dansLaSemaine(jour, semaine)) continue;

    if (n.banId) immeubles.add(n.banId);
    if (n.rattacheeTerrain) compteurs.informations_terrain += 1;
  }

  for (const c of journal.contactsPhysiques) {
    if (c.profileId !== profileId) continue;
    if (!dansLaSemaine(c.jour, semaine)) continue;

    compteurs.contacts_physiques += 1;
    if (c.banId) immeubles.add(c.banId);
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
    total.contacts_physiques += c.contacts_physiques;
    total.immeubles_prospectes += c.immeubles_prospectes;
    total.contacts_qualifies += c.contacts_qualifies;
    total.estimations += c.estimations;
    total.informations_terrain += c.informations_terrain;
    total.mandats += c.mandats;
  }
  return total;
}
