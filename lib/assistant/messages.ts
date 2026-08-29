import type { ProcheContact } from './collecte';
import { labelCherche, type AssistantIntent } from './intent';

/**
 * Un échec doit donner la marche à suivre. « Aucune information » tout seul
 * est exact et inutilisable.
 */

/** Exemples réellement traitables, un par famille de collecte. */
export const EXEMPLES_QUESTIONS: readonly string[] = [
  "Qu'est-ce qu'on sait sur le 12 rue Vitruve ?",
  'Des nouvelles de Cécile Martin ?',
  "Qu'est-ce qu'on a fait cette semaine ?",
];

/**
 * Classification en échec : on dit qu'on n'a pas compris, jamais qu'il n'y a
 * pas de données. Les deux ne veulent pas dire la même chose.
 */
export const MESSAGE_AIDE = [
  "Je n'ai pas compris la question.",
  'Je sais répondre sur une adresse, une personne, des acquéreurs, votre activité récente, et sur le fonctionnement de Priimo. Par exemple :',
  ...EXEMPLES_QUESTIONS.map((q) => `— ${q}`),
].join('\n');

function listeNoms(proches: readonly ProcheContact[]): string {
  const noms = proches.map((p) => p.nom);
  if (noms.length === 1) return noms[0]!;
  return `${noms.slice(0, -1).join(', ')} ou ${noms[noms.length - 1]}`;
}

/**
 * Message d'absence. Il nomme ce qui a été cherché, et propose les
 * correspondances proches quand il y en a.
 */
export function messageAucuneLigne(
  intent: AssistantIntent,
  proches: readonly ProcheContact[] = [],
): string {
  if (intent.type === 'personne') {
    const cherche = intent.nom ?? 'cette personne';
    if (proches.length > 0) {
      return `Aucun contact nommé ${cherche}. Vouliez-vous dire ${listeNoms(proches)} ?`;
    }
    return `Aucun contact nommé ${cherche} dans votre base.`;
  }

  if (intent.type === 'immeuble') {
    const cherche = intent.adresse ?? 'cette adresse';
    return `Rien en base sur ${cherche} : ni prospect, ni contact, ni bien, ni note. C'est une adresse à travailler.`;
  }

  if (intent.type === 'recherche_acquereur') {
    return `Aucun acquéreur de votre base ne correspond à ${labelCherche(intent)}.`;
  }

  if (intent.type === 'activite') {
    const n = intent.periode_jours ?? 7;
    return n === 1
      ? "Rien d'enregistré aujourd'hui : ni contact créé, ni échange, ni note."
      : `Rien d'enregistré sur les ${n} derniers jours.`;
  }

  return `Aucune information en base sur ${labelCherche(intent)}`;
}

/** Aucun sujet documenté ne répond à une question sur l'outil. */
export function messageProduitInconnu(): string {
  return [
    "Je n'ai pas de réponse documentée sur ce point.",
    'Je peux expliquer les écrans de Priimo, le score, la vérification marché, le pipeline, les types de contact, la couche cadastre, la tournée et l’estimation.',
  ].join('\n');
}
