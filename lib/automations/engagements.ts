/**
 * Boucle de contrôle des promesses.
 *
 * L'écran Aujourd'hui sait déjà afficher une promesse à honorer. Ce module
 * s'occupe de ce qui vient *après*, et qui décide de tout : est-ce qu'elle a
 * été tenue ?
 *
 * Personne ne coche « fait ». Une liste de tâches que l'on ne clôture jamais
 * se remplit de faux retards, l'agent apprend à ne plus la lire, et l'outil
 * perd sa crédibilité en quelques semaines. C'est la façon la plus banale de
 * tuer une bonne fonctionnalité.
 *
 * D'où deux propositions, symétriques :
 *   — il s'est passé quelque chose avec le contact depuis la promesse :
 *     « ça a l'air fait, on clôture ? » — un geste, la liste reste vraie.
 *   — l'échéance est passée et il ne s'est rien passé du tout :
 *     « vous aviez dit… » — la seule relance que l'agent s'adresse à lui-même.
 */

import { dedupKey, jourDe } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface EngagementsConfig {
  /**
   * Jours de retard au-delà desquels une promesse sans trace devient une
   * proposition. En deçà, la carte Aujourd'hui suffit — inutile de doubler.
   */
  retardEscaladeJours: number;
  /** Au-delà, la promesse est morte : on propose de la clore, pas de la tenir. */
  retardAbandonJours: number;
  maxPropositions: number;
  expirationJours: number;
}

export const ENGAGEMENTS_CONFIG: EngagementsConfig = {
  retardEscaladeJours: 3,
  retardAbandonJours: 30,
  maxPropositions: 12,
  expirationJours: 14,
};

/* -------------------------------------------------------------------------- */
/* Entrées                                                                    */
/* -------------------------------------------------------------------------- */

export interface PromesseOuverte {
  id: string;
  profileId: string;
  contactId: string | null;
  contactName: string | null;
  intitule: string;
  /** Échéance (YYYY-MM-DD). */
  echeance: string;
  createdAt: string;
}

/** Une trace d'échange avec un contact. */
export interface TraceInteraction {
  contactId: string;
  /** 'note' exclu par l'appelant : écrire une note ne prouve pas qu'on a appelé. */
  occurredAt: string;
}

export interface EngagementsInput {
  promesses: readonly PromesseOuverte[];
  interactions: readonly TraceInteraction[];
  now?: Date;
  config?: EngagementsConfig;
}

/* -------------------------------------------------------------------------- */
/* Moteur                                                                     */
/* -------------------------------------------------------------------------- */

function joursDeRetard(echeance: string, now: Date): number | null {
  const t = Date.parse(`${echeance}T12:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  const midi = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  return Math.floor((midi - t) / 86_400_000);
}

/**
 * Une trace postérieure à la promesse vaut présomption : on a rappelé, on a
 * visité, on a écrit. Présomption seulement — d'où une proposition à valider,
 * jamais une clôture automatique.
 */
export function promesseTenue(
  promesse: PromesseOuverte,
  interactions: readonly TraceInteraction[],
): boolean {
  if (!promesse.contactId) return false;
  const depuis = Date.parse(promesse.createdAt);
  if (!Number.isFinite(depuis)) return false;

  return interactions.some((i) => {
    if (i.contactId !== promesse.contactId) return false;
    const t = Date.parse(i.occurredAt);
    return Number.isFinite(t) && t > depuis;
  });
}

function nommer(promesse: PromesseOuverte): string {
  return promesse.contactName ?? 'ce contact';
}

export function proposerEngagements(input: EngagementsInput): ProposedAction[] {
  const now = input.now ?? new Date();
  const config = input.config ?? ENGAGEMENTS_CONFIG;
  const aujourdhui = jourDe(now);

  const propositions: ProposedAction[] = [];

  for (const promesse of input.promesses) {
    const retard = joursDeRetard(promesse.echeance, now);
    if (retard === null) continue;

    if (promesseTenue(promesse, input.interactions)) {
      propositions.push({
        kind: 'engagement_note',
        dedupKey: dedupKey('engagement_note', promesse.id, 'tenue'),
        titre: `Promesse tenue ? — ${promesse.intitule}`,
        detail: `Un échange a eu lieu avec ${nommer(promesse)} depuis. Clôturer la promesse ?`,
        score: clampScore(45),
        assignedTo: promesse.profileId,
        expiresAt: expiresInDays(config.expirationJours, now),
        payload: {
          promesseId: promesse.id,
          contactId: promesse.contactId,
          contactName: promesse.contactName,
          intitule: promesse.intitule,
          echeance: promesse.echeance,
          suggestion: 'cloturer',
        },
      });
      continue;
    }

    // Pas encore en retard, ou à peine : la carte Aujourd'hui fait le travail.
    if (retard < config.retardEscaladeJours) continue;

    const abandon = retard >= config.retardAbandonJours;
    propositions.push({
      kind: 'engagement_note',
      // Récurrence quotidienne bornée par la péremption : tant que la promesse
      // traîne, elle revient — mais une seule fois par jour.
      dedupKey: dedupKey('engagement_note', promesse.id, 'retard', aujourdhui),
      titre: abandon
        ? `Promesse oubliée depuis ${retard} jours — ${promesse.intitule}`
        : `Vous aviez dit : ${promesse.intitule}`,
      detail: abandon
        ? `${nommer(promesse)} n'a eu aucune nouvelle. Tenir ou abandonner, mais décider.`
        : `Échéance dépassée de ${retard} jour${retard > 1 ? 's' : ''}, aucun échange avec ${nommer(promesse)} depuis.`,
      // Une promesse qui pourrit est plus urgente qu'une promesse fraîche,
      // jusqu'au point où il faut simplement trancher.
      score: clampScore(abandon ? 70 : 60 + retard * 2),
      assignedTo: promesse.profileId,
      expiresAt: expiresInDays(config.expirationJours, now),
      payload: {
        promesseId: promesse.id,
        contactId: promesse.contactId,
        contactName: promesse.contactName,
        intitule: promesse.intitule,
        echeance: promesse.echeance,
        joursDeRetard: retard,
        suggestion: abandon ? 'trancher' : 'tenir',
      },
    });
  }

  propositions.sort((a, b) => b.score - a.score || a.titre.localeCompare(b.titre, 'fr'));
  return propositions.slice(0, config.maxPropositions);
}
