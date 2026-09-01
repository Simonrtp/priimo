/**
 * Estimations dormantes — le gisement que toutes les agences laissent dormir.
 *
 * Une agence accumule des dizaines d'estimations qui ne sont jamais rentrées
 * au mandat. Elles sont traitées comme des échecs, alors que ce sont des
 * vendeurs identifiés, dont on connaît le bien, l'adresse et le prix espéré :
 * la liste la plus qualifiée du fichier, et la seule que personne ne relit.
 *
 * Deux raisons de rappeler, et deux seulement — au-delà on harcèle :
 *   — le marché a rattrapé l'estimation. Le vendeur qui la trouvait trop basse
 *     obtient aujourd'hui le prix qu'il voulait. C'est un appel qui se gagne.
 *   — l'estimation a mûri. Un projet de vente met des mois à se décider ;
 *     repasser une fois, au bon moment, suffit.
 *
 * Le rythme est trimestriel par construction (clé de déduplication) : une
 * relance automatique trop fréquente vaut moins que pas de relance du tout.
 */

import { formatEuro } from '@/lib/estimation/resultat';
import { dedupKey, trimestreDe } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface EstimationsDormantesConfig {
  /** En deçà, l'estimation est encore chaude : l'agent la suit lui-même. */
  dormanceMinJours: number;
  /** Au-delà, le projet est enterré ou parti ailleurs. */
  dormanceMaxJours: number;
  /** Hausse du marché à partir de laquelle l'appel se justifie seul. */
  ecartMarcheSignificatif: number;
  /** Fenêtre où un projet de vente se décide vraiment. */
  maturiteMinJours: number;
  maturiteMaxJours: number;
  maxPropositions: number;
  expirationJours: number;
}

export const ESTIMATIONS_DORMANTES_CONFIG: EstimationsDormantesConfig = {
  dormanceMinJours: 90,
  dormanceMaxJours: 1_095,
  ecartMarcheSignificatif: 0.05,
  maturiteMinJours: 180,
  maturiteMaxJours: 540,
  maxPropositions: 8,
  expirationJours: 45,
};

/* -------------------------------------------------------------------------- */
/* Entrées                                                                    */
/* -------------------------------------------------------------------------- */

export interface EstimationDormante {
  id: string;
  bienId: string | null;
  adresse: string;
  codePostal: string | null;
  contactId: string | null;
  proprietaireName: string | null;
  proprietairePhone: string | null;
  /** Date de l'estimation (ISO). */
  estimeeLe: string;
  valeurEstimee: number | null;
  surfaceM2: number | null;
  assignedTo: string | null;
  createdBy: string | null;
  /** Le bien est-il finalement rentré (mandat, compromis, vendu) ? */
  rentree: boolean;
}

export interface EstimationsDormantesInput {
  estimations: readonly EstimationDormante[];
  /** Prix au m² actuel par code postal. Un secteur absent = pas de comparaison. */
  prixM2Actuels: Readonly<Record<string, number>>;
  now?: Date;
  config?: EstimationsDormantesConfig;
}

export type MotifRelance = 'marche_rattrape' | 'maturite';

/* -------------------------------------------------------------------------- */
/* Moteur                                                                     */
/* -------------------------------------------------------------------------- */

function joursDepuis(dateIso: string, now: Date): number | null {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

/** Écart entre le marché d'aujourd'hui et le prix au m² de l'estimation. */
export function ecartMarche(
  estimation: EstimationDormante,
  prixM2Actuels: Readonly<Record<string, number>>,
): number | null {
  if (!estimation.codePostal) return null;
  const actuel = prixM2Actuels[estimation.codePostal];
  if (!actuel || !Number.isFinite(actuel) || actuel <= 0) return null;

  const { valeurEstimee, surfaceM2 } = estimation;
  if (!valeurEstimee || !surfaceM2 || surfaceM2 <= 0) return null;

  const prixM2Estimation = valeurEstimee / surfaceM2;
  if (!Number.isFinite(prixM2Estimation) || prixM2Estimation <= 0) return null;

  return (actuel - prixM2Estimation) / prixM2Estimation;
}

function moisLisibles(jours: number): string {
  const mois = Math.round(jours / 30);
  if (mois <= 1) return 'un mois';
  if (mois < 12) return `${mois} mois`;
  const annees = Math.round(mois / 12);
  return annees === 1 ? 'un an' : `${annees} ans`;
}

/** La phrase d'appel, adaptée au motif : sans elle, l'agent n'appelle pas. */
export function argumentaireRelance(
  estimation: EstimationDormante,
  motif: MotifRelance,
  ecart: number | null,
): string {
  const proprio = estimation.proprietaireName?.trim();
  const bonjour = proprio ? `Bonjour ${proprio}, ` : 'Bonjour, ';

  if (motif === 'marche_rattrape' && ecart !== null) {
    const pourcent = Math.round(ecart * 100);
    return `${bonjour}je reviens vers vous au sujet de votre bien : les prix du secteur ont progressé d'environ ${pourcent} % depuis notre estimation. Ce que vous espériez en obtenir est aujourd'hui atteignable.`;
  }

  return `${bonjour}nous avions estimé votre bien il y a quelque temps. Où en êtes-vous de votre projet ? Je peux vous en donner la valeur actualisée si vous le souhaitez.`;
}

export function proposerEstimationsDormantes(
  input: EstimationsDormantesInput,
): ProposedAction[] {
  const now = input.now ?? new Date();
  const config = input.config ?? ESTIMATIONS_DORMANTES_CONFIG;
  const trimestre = trimestreDe(now);

  const propositions: ProposedAction[] = [];

  for (const estimation of input.estimations) {
    // Rentrée au mandat : ce n'est plus une estimation dormante, c'est un bien.
    if (estimation.rentree) continue;

    const dormance = joursDepuis(estimation.estimeeLe, now);
    if (dormance === null) continue;
    if (dormance < config.dormanceMinJours || dormance > config.dormanceMaxJours) continue;

    const ecart = ecartMarche(estimation, input.prixM2Actuels);
    const rattrape = ecart !== null && ecart >= config.ecartMarcheSignificatif;
    const mur =
      dormance >= config.maturiteMinJours && dormance <= config.maturiteMaxJours;

    // Ni le marché ni le calendrier ne justifient l'appel : on se tait.
    if (!rattrape && !mur) continue;

    const motif: MotifRelance = rattrape ? 'marche_rattrape' : 'maturite';
    const pourcent = ecart !== null ? Math.round(ecart * 100) : null;

    const detail = rattrape
      ? `Marché du ${estimation.codePostal} en hausse d'environ ${pourcent} % depuis l'estimation${
          estimation.valeurEstimee ? ` (${formatEuro(estimation.valeurEstimee)})` : ''
        }.`
      : `Estimée il y a ${moisLisibles(dormance)}, jamais rentrée. Le projet a eu le temps de mûrir.`;

    propositions.push({
      kind: 'estimation_dormante',
      // Trimestriel : la même estimation ne peut pas revenir chaque semaine.
      dedupKey: dedupKey('estimation_dormante', estimation.id, trimestre),
      titre: rattrape
        ? `Le marché a rattrapé votre estimation — ${estimation.adresse}`
        : `Estimation à relancer — ${estimation.adresse}`,
      detail,
      score: clampScore(50 + (rattrape ? 20 : 0) + (mur ? 10 : 0)),
      assignedTo: estimation.assignedTo ?? estimation.createdBy ?? null,
      expiresAt: expiresInDays(config.expirationJours, now),
      payload: {
        estimationId: estimation.id,
        bienId: estimation.bienId,
        contactId: estimation.contactId,
        adresse: estimation.adresse,
        codePostal: estimation.codePostal,
        proprietaireName: estimation.proprietaireName,
        proprietairePhone: estimation.proprietairePhone,
        valeurEstimee: estimation.valeurEstimee,
        estimeeLe: estimation.estimeeLe,
        motif,
        ecartMarchePourcent: pourcent,
        argumentaire: argumentaireRelance(estimation, motif, ecart),
      },
    });
  }

  propositions.sort((a, b) => b.score - a.score || a.titre.localeCompare(b.titre, 'fr'));
  return propositions.slice(0, config.maxPropositions);
}
