/**
 * Parcours de prise en main du négociateur (v2).
 *
 * Ouverture (salut → lettre → anniversaire → avatar), puis 5 gestes réels,
 * puis écran final. Mobile-first : la dictée ouvre les cinq gestes.
 */

export type EtapeId =
  | 'salut'
  | 'lettre'
  | 'anniversaire'
  | 'avatar'
  | 'secteur'
  | 'lead'
  | 'note'
  | 'immeuble'
  | 'sortie'
  | 'final';

/** Toutes les étapes possibles (mesure / validation API). */
export const TOUTES_LES_ETAPES: readonly EtapeId[] = [
  'salut',
  'lettre',
  'anniversaire',
  'avatar',
  'secteur',
  'lead',
  'note',
  'immeuble',
  'sortie',
  'final',
];

/** À partir de cette étape, « Passer » est proposé. */
export const ETAPE_PASSER_DES_DE: EtapeId = 'anniversaire';

export type ContexteParcours = {
  aDesLeads: boolean;
  aDesParcelles: boolean;
  aUneSortie: boolean;
  /** Sur téléphone, la dictée ouvre les cinq gestes. */
  mobile: boolean;
};

const OUVERTURE: readonly EtapeId[] = ['salut', 'lettre', 'anniversaire', 'avatar'];

function gestes(ctx: ContexteParcours): EtapeId[] {
  const etapes: EtapeId[] = [];

  if (ctx.mobile) {
    etapes.push('note');
    etapes.push('secteur');
    if (ctx.aDesLeads) etapes.push('lead');
  } else {
    etapes.push('secteur');
    if (ctx.aDesLeads) etapes.push('lead');
    etapes.push('note');
  }

  if (ctx.aDesParcelles) etapes.push('immeuble');
  if (ctx.aUneSortie) etapes.push('sortie');
  return etapes;
}

export function buildParcours(ctx: ContexteParcours): EtapeId[] {
  return [...OUVERTURE, ...gestes(ctx), 'final'];
}

/** Rang 1-based dans le parcours réel. */
export function rangEtape(parcours: readonly EtapeId[], etape: EtapeId): number {
  const index = parcours.indexOf(etape);
  return index < 0 ? 1 : index + 1;
}

export function etapeSuivante(
  parcours: readonly EtapeId[],
  etape: EtapeId,
): EtapeId | null {
  const index = parcours.indexOf(etape);
  if (index < 0 || index >= parcours.length - 1) return null;
  return parcours[index + 1]!;
}

export function etapePrecedente(
  parcours: readonly EtapeId[],
  etape: EtapeId,
): EtapeId | null {
  const index = parcours.indexOf(etape);
  if (index <= 0) return null;
  return parcours[index - 1]!;
}

export function etapeDeReprise(
  parcours: readonly EtapeId[],
  currentStep: string | null,
  stepsReached: readonly string[],
): EtapeId {
  if (currentStep && (parcours as readonly string[]).includes(currentStep)) {
    return currentStep as EtapeId;
  }
  const premiereNonAtteinte = parcours.find((e) => !stepsReached.includes(e));
  return premiereNonAtteinte ?? parcours[parcours.length - 1] ?? 'salut';
}

/** « Passer » visible à partir de l’anniversaire (3ᵉ écran). */
export function peutPasser(etape: EtapeId, parcours: readonly EtapeId[]): boolean {
  const i = parcours.indexOf(etape);
  const from = parcours.indexOf(ETAPE_PASSER_DES_DE);
  if (i < 0 || from < 0) return false;
  return i >= from;
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

export function minutesRestantes(
  parcours: readonly EtapeId[],
  stepsReached: readonly string[],
): number {
  const restantes = parcours.filter((e) => !stepsReached.includes(e)).length;
  return Math.max(1, Math.round(restantes * 0.55));
}

export type AffichagePriseEnMain = 'onboarding' | 'rien';

export const REPRISE_FENETRE_MINUTES = 30;

/**
 * Le parcours s'impose à la première connexion et dans la même session.
 * Plus tard : Accueil + éventuelle bande de reprise (doitProposerReprise).
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
  if (ligne?.completedAt) return 'rien';
  if (options.demandeExplicite) return 'onboarding';
  if (ligne?.skippedAt) return 'rien';
  if (!ligne || !ligne.startedAt) return 'onboarding';

  const vu = ligne.lastSeenAt ? Date.parse(ligne.lastSeenAt) : NaN;
  const now = (options.now ?? new Date()).getTime();
  const memeSession =
    Number.isFinite(vu) && now - vu < REPRISE_FENETRE_MINUTES * 60_000;

  return memeSession ? 'onboarding' : 'rien';
}

/** Avatars illustrés — déposer avatar-01.png … avatar-12.png (SVG placeholder en attendant). */
export const AVATAR_PRESETS: readonly string[] = Array.from(
  { length: 12 },
  (_, i) => `/avatars/avatar-${String(i + 1).padStart(2, '0')}.svg`,
);
