/**
 * Seuils de l'accueil directeur — une seule config, jamais en dur dans l'UI.
 */
export const DIRECTEUR_SEUILS = {
  /** Activité des 7 derniers jours vs moyenne des 4 semaines précédentes. */
  decrochageJoursRecents: 7,
  decrochageSemainesHistorique: 4,
  /** Alerte si activité récente < 50 % de la moyenne hebdo. */
  decrochageSeuilRatio: 0.5,
  /** Avis de valeur envoyé sans relance depuis N jours. */
  estimationSansRelanceJours: 7,
  /** Échéance de mandat dans les N jours. */
  mandatFinValiditeJours: 30,
  /** Mandat actif depuis plus de N jours. */
  mandatVieillitJours: 60,
  /** Moins de N visites pour un mandat qui vieillit. */
  mandatVieillitVisitesMax: 3,
  /** Prospects non assignés depuis plus de N jours. */
  prospectsSansNegociateurJours: 14,
  /** Prospects bloqués dans la même étape (panneau Préparer). */
  pipelineBloqueJours: 14,
  /** Statut rythme : au-dessus = En avance. */
  statutAvanceRatio: 1.2,
  /** Statut rythme : en dessous = À voir. */
  statutAVoirRatio: 0.6,
  /** Cartes max en zone 1 avant « Voir tout ». */
  cartesZone1Max: 4,
} as const;

export type DirecteurSeuils = typeof DIRECTEUR_SEUILS;
