/**
 * Modèle commun des automatisations.
 *
 * Une automatisation est une fonction pure : elle reçoit des données déjà
 * chargées, elle rend des propositions. Elle n'écrit rien, n'appelle rien,
 * ne connaît ni Supabase ni React — comme les autres moteurs du produit, elle
 * doit rester lisible et testable sans monter d'environnement.
 *
 * La règle qui tient tout l'édifice : une proposition n'est jamais une action.
 * Rien ne part vers un client sans qu'un humain ait validé.
 */

export type AutomationKind =
  | 'rapprochement_inverse'
  | 'veille_dpe'
  | 'veille_mutation'
  | 'compte_rendu_mandat'
  | 'engagement_note'
  | 'estimation_dormante';

export const AUTOMATION_KINDS: readonly AutomationKind[] = [
  'rapprochement_inverse',
  'veille_dpe',
  'veille_mutation',
  'compte_rendu_mandat',
  'engagement_note',
  'estimation_dormante',
];

export function isAutomationKind(value: unknown): value is AutomationKind {
  return typeof value === 'string' && (AUTOMATION_KINDS as readonly string[]).includes(value);
}

/** Libellés courts pour l'interface — jamais de `kind` brut à l'écran. */
export const AUTOMATION_LABELS: Record<AutomationKind, string> = {
  rapprochement_inverse: 'Acquéreur en attente',
  veille_dpe: 'Nouveau DPE',
  veille_mutation: 'Vente proche',
  compte_rendu_mandat: 'Compte rendu',
  engagement_note: 'Promesse à tenir',
  estimation_dormante: 'Estimation à relancer',
};

/**
 * Ce que produit un générateur. `dedupKey` est la mémoire du système : tant
 * qu'une clé existe pour l'agence, la proposition ne revient pas — même
 * ignorée, même résolue. Une proposition récurrente porte donc sa période
 * dans sa clé (voir `dedup.ts`).
 */
export interface ProposedAction {
  kind: AutomationKind;
  dedupKey: string;
  titre: string;
  detail?: string | null;
  /** Tout ce dont l'écran a besoin pour afficher et exécuter l'action. */
  payload: Record<string, unknown>;
  /** 0–100. Sert au tri de la boîte, pas à filtrer. */
  score: number;
  /** NULL = proposition d'agence, visible par tous. */
  assignedTo?: string | null;
  /** Au-delà, le signal est froid et la proposition s'efface d'elle-même. */
  expiresAt?: string | null;
}

export type ActionStatut = 'proposee' | 'validee' | 'ignoree' | 'expiree';

/** Une proposition telle que l'écran la lit. */
export interface AgencyAction extends ProposedAction {
  id: string;
  statut: ActionStatut;
  createdAt: string;
  resolvedAt: string | null;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Date ISO à J+n, pour poser une péremption sans se tromper de fuseau. */
export function expiresInDays(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
