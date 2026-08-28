/**
 * Le parcours de prise en main du négociateur.
 *
 * Cinq étapes, dont aucune ne montre un écran sans faire agir. Deux d'entre
 * elles dépendent des données réellement présentes sur le secteur : si le
 * cadastre n'est pas encore chargé ou si aucune sortie n'est calculable, on
 * saute l'étape plutôt que d'afficher un écran vide — un écran vide au
 * premier contact coûte plus cher qu'une étape en moins.
 */

export type EtapeId = 'secteur' | 'lead' | 'note' | 'immeuble' | 'sortie';

export const TOUTES_LES_ETAPES: readonly EtapeId[] = [
  'secteur',
  'lead',
  'note',
  'immeuble',
  'sortie',
];

export type ContexteParcours = {
  /** Des leads non assignés existent : sans eux, la prise n'a rien à prendre. */
  aDesLeads: boolean;
  /** Le secteur a des parcelles avec de l'historique public. */
  aDesParcelles: boolean;
  /** Une sortie est calculable depuis l'adresse de l'agence. */
  aUneSortie: boolean;
  /** Sur téléphone, la dictée passe en deuxième : c'est le geste naturel. */
  mobile: boolean;
};

export function buildParcours(ctx: ContexteParcours): EtapeId[] {
  const etapes: EtapeId[] = ['secteur'];

  if (ctx.mobile) {
    // La dictée d'abord : sur un téléphone, appuyer et parler est le geste
    // qui demande le moins d'explication.
    etapes.push('note');
    if (ctx.aDesLeads) etapes.push('lead');
  } else {
    if (ctx.aDesLeads) etapes.push('lead');
    etapes.push('note');
  }

  if (ctx.aDesParcelles) etapes.push('immeuble');
  if (ctx.aUneSortie) etapes.push('sortie');

  return etapes;
}

/** Rang de l'étape courante dans le parcours réel, à partir de 1. */
export function rangEtape(parcours: readonly EtapeId[], etape: EtapeId): number {
  const index = parcours.indexOf(etape);
  return index < 0 ? 1 : index + 1;
}

/** L'étape suivante, ou null si celle-ci est la dernière. */
export function etapeSuivante(
  parcours: readonly EtapeId[],
  etape: EtapeId,
): EtapeId | null {
  const index = parcours.indexOf(etape);
  if (index < 0 || index >= parcours.length - 1) return null;
  return parcours[index + 1]!;
}

/**
 * Où reprendre. Une étape enregistrée qui n'existe plus dans le parcours
 * (le secteur a changé, les données ont été chargées depuis) ne doit pas
 * bloquer la reprise : on repart de la première étape non atteinte.
 */
export function etapeDeReprise(
  parcours: readonly EtapeId[],
  currentStep: string | null,
  stepsReached: readonly string[],
): EtapeId {
  if (currentStep && (parcours as readonly string[]).includes(currentStep)) {
    return currentStep as EtapeId;
  }
  const premiereNonAtteinte = parcours.find((e) => !stepsReached.includes(e));
  return premiereNonAtteinte ?? parcours[parcours.length - 1] ?? 'secteur';
}

/* -------------------------------------------------------------------------- */
/* État vu du dashboard et du directeur                                       */
/* -------------------------------------------------------------------------- */

export type EtatOnboarding = 'jamais_ouvert' | 'en_cours' | 'termine' | 'passe';

export type LigneOnboarding = {
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
} | null;

export function etatOnboarding(ligne: LigneOnboarding): EtatOnboarding {
  if (!ligne || !ligne.startedAt) return 'jamais_ouvert';
  if (ligne.completedAt) return 'termine';
  if (ligne.skippedAt) return 'passe';
  return 'en_cours';
}

export const ETAT_LABEL: Record<EtatOnboarding, string> = {
  jamais_ouvert: 'Jamais ouvert',
  en_cours: 'En cours',
  termine: 'Terminée',
  passe: 'Passée',
};

/**
 * Faut-il proposer de reprendre ?
 *
 * Une seule relance : commencée mais pas finie, et la bande jamais refermée.
 * Un agent qui a cliqué « Passer » a répondu ; on ne lui repose pas la question.
 */
export function doitProposerReprise(
  ligne: {
    startedAt: string | null;
    completedAt: string | null;
    skippedAt: string | null;
    relanceDismissedAt: string | null;
  } | null,
): boolean {
  if (!ligne || !ligne.startedAt) return false;
  if (ligne.completedAt || ligne.skippedAt) return false;
  return !ligne.relanceDismissedAt;
}

/** Minutes restantes annoncées dans la bande de reprise — jamais optimistes. */
export function minutesRestantes(
  parcours: readonly EtapeId[],
  stepsReached: readonly string[],
): number {
  const restantes = parcours.filter((e) => !stepsReached.includes(e)).length;
  return Math.max(1, Math.round(restantes * 0.8));
}

/* -------------------------------------------------------------------------- */
/* Ce que l'Accueil affiche                                                    */
/* -------------------------------------------------------------------------- */

export type AffichagePriseEnMain = 'onboarding' | 'bande' | 'rien';

/** Au-delà, l'agent est revenu plus tard : on ne lui réimpose pas le parcours. */
export const REPRISE_FENETRE_MINUTES = 30;

/**
 * Le parcours s'impose à la première ouverture et tant que la session dure.
 * Un agent qui revient le lendemain retrouve son Accueil normal, avec une
 * bande discrète — jamais le parcours en travers de sa journée.
 */
export function decideAffichage(
  ligne: {
    startedAt: string | null;
    lastSeenAt: string | null;
    completedAt: string | null;
    skippedAt: string | null;
    relanceDismissedAt: string | null;
  } | null,
  options: { demandeExplicite: boolean; now?: Date },
): AffichagePriseEnMain {
  // « Reprendre » l'emporte sur tout, sauf sur un parcours déjà terminé.
  if (ligne?.completedAt) return 'rien';
  if (options.demandeExplicite) return 'onboarding';
  if (ligne?.skippedAt) return 'rien';
  if (!ligne || !ligne.startedAt) return 'onboarding';

  const vu = ligne.lastSeenAt ? Date.parse(ligne.lastSeenAt) : NaN;
  const now = (options.now ?? new Date()).getTime();
  const memeSession =
    Number.isFinite(vu) && now - vu < REPRISE_FENETRE_MINUTES * 60_000;

  if (memeSession) return 'onboarding';
  return ligne.relanceDismissedAt ? 'rien' : 'bande';
}
