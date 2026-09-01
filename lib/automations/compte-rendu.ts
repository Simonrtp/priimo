/**
 * Compte rendu de mandat — l'obligation que personne ne tient.
 *
 * Rendre compte au mandant est une obligation du mandat, et une clause
 * expresse de la plupart des mandats exclusifs. En pratique c'est une heure de
 * copier-coller par bien et par mois : ça ne se fait pas, ou mal, et le
 * vendeur en conclut qu'il ne se passe rien.
 *
 * L'agence a pourtant déjà toute la matière : diffusions, visites, offres.
 * Ce module l'assemble et surtout en tire la conclusion difficile — la
 * recommandation de prix. Une baisse argumentée par des chiffres passe ; la
 * même baisse demandée au téléphone sans preuve fâche.
 *
 * Le compte rendu n'est jamais envoyé tout seul : il est *proposé*, l'agent
 * relit et déclenche l'envoi.
 */

import type { MandatStatut } from '@/types/bien';
import { formatEuro } from '@/lib/estimation/resultat';
import { dedupKey, moisDe } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface CompteRenduConfig {
  /** Un mandat trop jeune n'a rien à raconter. */
  ancienneteMinJours: number;
  /** Sans une seule visite après ce délai, l'annonce ne déclenche pas. */
  sansVisiteJours: number;
  /** Des visites mais aucune offre après ce délai : le prix bloque à la décision. */
  sansOffreJours: number;
  /** Baisse conseillée quand personne ne visite. */
  baisseSansVisite: number;
  /** Baisse conseillée quand on visite sans offrir. */
  baisseSansOffre: number;
  expirationJours: number;
}

export const COMPTE_RENDU_CONFIG: CompteRenduConfig = {
  ancienneteMinJours: 25,
  sansVisiteJours: 30,
  sansOffreJours: 60,
  baisseSansVisite: 0.05,
  baisseSansOffre: 0.03,
  expirationJours: 20,
};

/* -------------------------------------------------------------------------- */
/* Entrées                                                                    */
/* -------------------------------------------------------------------------- */

export interface BienSousMandat {
  id: string;
  address: string;
  price: number | null;
  mandatStatut: MandatStatut;
  /** Date de signature du mandat (YYYY-MM-DD). */
  mandatDate: string | null;
  proprietaireName: string | null;
  proprietaireEmail: string | null;
  assignedTo: string | null;
  createdBy: string | null;
}

export interface ActiviteBien {
  /** Mises en ligne, une par portail. */
  diffusions: readonly { portail: string; publieLe: string }[];
  visites: readonly { date: string }[];
  offres: readonly { date: string; montant: number | null }[];
}

export interface CompteRenduInput {
  biens: readonly BienSousMandat[];
  /** Activité par bien. Un bien absent est traité comme sans activité. */
  activites: Readonly<Record<string, ActiviteBien>>;
  now?: Date;
  config?: CompteRenduConfig;
}

/* -------------------------------------------------------------------------- */
/* Recommandation de prix                                                     */
/* -------------------------------------------------------------------------- */

export type SensRecommandation = 'tenir' | 'baisser' | 'attendre';

export interface Recommandation {
  sens: SensRecommandation;
  /** Baisse conseillée (0.05 = 5 %). Nul si on tient ou si on attend. */
  pourcentage: number;
  prixConseille: number | null;
  /** Phrase destinée au vendeur, pas à l'agent. */
  motif: string;
}

function joursDepuis(dateIso: string | null, now: Date): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Arrondi commercial : on ne conseille pas un prix à 291 347 €. */
export function arrondiCommercial(prix: number): number {
  if (prix >= 500_000) return Math.round(prix / 10_000) * 10_000;
  if (prix >= 100_000) return Math.round(prix / 5_000) * 5_000;
  return Math.round(prix / 1_000) * 1_000;
}

/**
 * La conclusion du compte rendu. Volontairement lisible : le vendeur doit
 * pouvoir suivre le raisonnement sans connaître le métier.
 */
export function recommandationPrix(
  args: {
    prix: number | null;
    joursEnLigne: number | null;
    visites: number;
    offres: number;
  },
  config: CompteRenduConfig = COMPTE_RENDU_CONFIG,
): Recommandation {
  const { prix, joursEnLigne, visites, offres } = args;

  if (offres > 0) {
    return {
      sens: 'tenir',
      pourcentage: 0,
      prixConseille: prix,
      motif:
        offres === 1
          ? 'Une offre a été reçue : le prix affiché déclenche la décision. Rien à changer.'
          : `${offres} offres reçues : le prix affiché déclenche la décision. Rien à changer.`,
    };
  }

  if (joursEnLigne === null) {
    return {
      sens: 'attendre',
      pourcentage: 0,
      prixConseille: prix,
      motif: "Le bien n'est pas encore diffusé : aucun enseignement à en tirer pour l'instant.",
    };
  }

  if (visites === 0 && joursEnLigne >= config.sansVisiteJours) {
    const prixConseille = prix !== null ? arrondiCommercial(prix * (1 - config.baisseSansVisite)) : null;
    return {
      sens: 'baisser',
      pourcentage: config.baisseSansVisite,
      prixConseille,
      motif: `Aucune visite en ${joursEnLigne} jours de diffusion. Ce n'est pas le bien qui est en cause : à ce prix, les acquéreurs du secteur ne demandent même pas à le voir.`,
    };
  }

  if (visites > 0 && joursEnLigne >= config.sansOffreJours) {
    const prixConseille = prix !== null ? arrondiCommercial(prix * (1 - config.baisseSansOffre)) : null;
    return {
      sens: 'baisser',
      pourcentage: config.baisseSansOffre,
      prixConseille,
      motif: `${visites} visite${visites > 1 ? 's' : ''} en ${joursEnLigne} jours, mais aucune offre. Le bien plaît ; c'est au moment de se décider que le prix arrête les acquéreurs.`,
    };
  }

  return {
    sens: 'attendre',
    pourcentage: 0,
    prixConseille: prix,
    motif: `${visites} visite${visites > 1 ? 's' : ''} en ${joursEnLigne} jours de diffusion. Il est encore tôt pour conclure : on maintient le cap.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Le compte rendu lui-même                                                   */
/* -------------------------------------------------------------------------- */

export interface CompteRendu {
  bienId: string;
  adresse: string;
  periode: string;
  proprietaireName: string | null;
  proprietaireEmail: string | null;
  prixAffiche: number | null;
  portails: string[];
  joursEnLigne: number | null;
  visites: number;
  offres: number;
  meilleureOffre: number | null;
  recommandation: Recommandation;
}

const ACTIVITE_VIDE: ActiviteBien = { diffusions: [], visites: [], offres: [] };

export function construireCompteRendu(
  bien: BienSousMandat,
  activite: ActiviteBien = ACTIVITE_VIDE,
  now: Date = new Date(),
  config: CompteRenduConfig = COMPTE_RENDU_CONFIG,
): CompteRendu {
  const premiereDiffusion = activite.diffusions
    .map((d) => d.publieLe)
    .filter(Boolean)
    .sort()[0];

  const joursEnLigne = joursDepuis(premiereDiffusion ?? null, now);
  const offres = activite.offres.length;
  const montants = activite.offres
    .map((o) => o.montant)
    .filter((m): m is number => typeof m === 'number' && Number.isFinite(m));

  return {
    bienId: bien.id,
    adresse: bien.address,
    periode: moisDe(now),
    proprietaireName: bien.proprietaireName,
    proprietaireEmail: bien.proprietaireEmail,
    prixAffiche: bien.price,
    portails: [...new Set(activite.diffusions.map((d) => d.portail))].sort(),
    joursEnLigne,
    visites: activite.visites.length,
    offres,
    meilleureOffre: montants.length > 0 ? Math.max(...montants) : null,
    recommandation: recommandationPrix(
      { prix: bien.price, joursEnLigne, visites: activite.visites.length, offres },
      config,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Moteur                                                                     */
/* -------------------------------------------------------------------------- */

function detailCompteRendu(cr: CompteRendu): string {
  const bouts = [
    `${cr.visites} visite${cr.visites > 1 ? 's' : ''}`,
    `${cr.offres} offre${cr.offres > 1 ? 's' : ''}`,
  ];
  if (cr.recommandation.sens === 'baisser' && cr.recommandation.prixConseille !== null) {
    bouts.push(
      `baisse conseillée de ${Math.round(cr.recommandation.pourcentage * 100)} % (${formatEuro(cr.recommandation.prixConseille)})`,
    );
  }
  return `${bouts.join(', ')}.`;
}

export function proposerComptesRendus(input: CompteRenduInput): ProposedAction[] {
  const now = input.now ?? new Date();
  const config = input.config ?? COMPTE_RENDU_CONFIG;
  const periode = moisDe(now);

  const propositions: ProposedAction[] = [];

  for (const bien of input.biens) {
    // Seul un mandat de vente crée l'obligation de rendre compte.
    if (bien.mandatStatut !== 'mandat_simple' && bien.mandatStatut !== 'mandat_exclusif') continue;

    const anciennete = joursDepuis(bien.mandatDate, now);
    if (anciennete === null || anciennete < config.ancienneteMinJours) continue;

    const cr = construireCompteRendu(bien, input.activites[bien.id], now, config);

    // Un exclusif engage davantage, et une baisse à annoncer est la
    // conversation qu'on repousse le plus : elle passe devant.
    const score = clampScore(
      60 +
        (bien.mandatStatut === 'mandat_exclusif' ? 15 : 0) +
        (cr.recommandation.sens === 'baisser' ? 15 : 0),
    );

    propositions.push({
      kind: 'compte_rendu_mandat',
      // Récurrent : une fois par mois et par bien, jamais deux.
      dedupKey: dedupKey('compte_rendu_mandat', bien.id, periode),
      titre: `Compte rendu à envoyer — ${bien.address}`,
      detail: detailCompteRendu(cr),
      score,
      assignedTo: bien.assignedTo ?? bien.createdBy ?? null,
      expiresAt: expiresInDays(config.expirationJours, now),
      payload: { compteRendu: cr as unknown as Record<string, unknown> },
    });
  }

  propositions.sort((a, b) => b.score - a.score || a.titre.localeCompare(b.titre, 'fr'));
  return propositions;
}
