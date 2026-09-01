/**
 * Rapprochement inversé — la prise de mandat par l'acquéreur.
 *
 * Le rapprochement classique répond à « qui pourrait acheter ce bien ? » sur le
 * stock au mandat. Celui-ci pose la question dans l'autre sens, et sur le stock
 * qu'on n'a *pas* : les biens estimés qui ne sont jamais rentrés.
 *
 * Le résultat est le meilleur prétexte d'appel du métier — « j'ai un acquéreur
 * pour votre bien » — aujourd'hui produit de mémoire, au hasard des relectures.
 *
 * Module pur : il réutilise le moteur de `lib/matching/rapprochement` sans le
 * dupliquer, et se contente de choisir les biens et d'écrire les phrases.
 */

import type { Contact } from '@/types/contact';
import type { MandatStatut } from '@/types/bien';
import {
  RAPPROCHEMENT_CONFIG,
  rapprocherAcquereurs,
  type MatchAcquereur,
  type RapprochableBien,
} from '@/lib/matching/rapprochement';
import { formatEuro } from '@/lib/estimation/resultat';
import { dedupKey } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';

/* -------------------------------------------------------------------------- */
/* Configuration — les seuls réglages à toucher                               */
/* -------------------------------------------------------------------------- */

export interface RapprochementInverseConfig {
  /**
   * Plus exigeant que le rapprochement consulté à l'écran : une proposition
   * non sollicitée doit être bonne, sinon l'agent apprend à ignorer la boîte.
   */
  scoreMinimum: number;
  /** Acquéreurs cités dans la proposition. */
  maxAcquereurs: number;
  /** Propositions produites par passage, pour ne pas noyer la boîte. */
  maxPropositions: number;
  /** Une estimation plus vieille que ça n'est plus un prétexte d'appel crédible. */
  ageEstimationMaxJours: number;
  /** Durée de vie de la proposition. */
  expirationJours: number;
}

export const RAPPROCHEMENT_INVERSE_CONFIG: RapprochementInverseConfig = {
  scoreMinimum: 70,
  maxAcquereurs: 3,
  maxPropositions: 10,
  ageEstimationMaxJours: 540,
  expirationJours: 30,
};

/* -------------------------------------------------------------------------- */
/* Entrées                                                                    */
/* -------------------------------------------------------------------------- */

/** Un bien estimé, pas encore au mandat. */
export interface BienHorsMandat extends RapprochableBien {
  mandatStatut: MandatStatut;
  proprietaireName: string | null;
  proprietairePhone: string | null;
  /** Qui a fait l'estimation : c'est lui qui rappelle. */
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface RapprochementInverseInput {
  biens: readonly BienHorsMandat[];
  acquereurs: readonly Contact[];
  now?: Date;
  config?: RapprochementInverseConfig;
}

/* -------------------------------------------------------------------------- */
/* Formulation                                                                */
/* -------------------------------------------------------------------------- */

const MOIS_MS = 30 * 86_400_000;

function anciennete(createdAt: string, now: Date): string | null {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return null;
  const mois = Math.floor((now.getTime() - t) / MOIS_MS);
  if (mois < 1) return 'estimé ce mois-ci';
  if (mois === 1) return 'estimé le mois dernier';
  if (mois < 12) return `estimé il y a ${mois} mois`;
  const annees = Math.floor(mois / 12);
  return annees === 1 ? 'estimé il y a un an' : `estimé il y a ${annees} ans`;
}

function titre(nb: number, adresse: string): string {
  return nb === 1 ? `Un acquéreur pour le ${adresse}` : `${nb} acquéreurs pour le ${adresse}`;
}

function detail(bien: BienHorsMandat, matches: readonly MatchAcquereur[], now: Date): string {
  const bouts: string[] = [];
  const age = anciennete(bien.createdAt, now);
  if (age) bouts.push(`${age.charAt(0).toUpperCase()}${age.slice(1)}`);
  if (bien.price !== null) bouts.push(formatEuro(bien.price));
  bouts.push('jamais rentré au mandat');

  const premier = matches[0];
  const raisons = premier?.raisons.slice(0, 2).join(', ');
  const qui = premier ? `${premier.contact.fullName}${raisons ? ` — ${raisons}` : ''}` : '';

  return qui ? `${bouts.join(' · ')}. ${qui}.` : `${bouts.join(' · ')}.`;
}

/**
 * La phrase à dire au téléphone. C'est elle qui transforme une donnée en
 * mandat : sans elle, l'agent doit réinventer son accroche à chaque appel.
 */
export function argumentaireVendeur(
  bien: BienHorsMandat,
  matches: readonly MatchAcquereur[],
): string {
  const nb = matches.length;
  const proprio = bien.proprietaireName?.trim();
  const bonjour = proprio ? `Bonjour ${proprio}, ` : 'Bonjour, ';
  const acquereurs =
    nb === 1
      ? "j'ai actuellement un acquéreur qui cherche exactement votre type de bien"
      : `j'ai actuellement ${nb} acquéreurs qui cherchent exactement votre type de bien`;
  const secteur = bien.postalCode ? ` sur le ${bien.postalCode}` : '';
  return `${bonjour}${acquereurs}${secteur}. Est-ce que votre projet de vente est toujours d'actualité ?`;
}

/* -------------------------------------------------------------------------- */
/* Moteur                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Un bien qui intéresse plusieurs acquéreurs vaut mieux qu'un bien qui n'en
 * intéresse qu'un : l'argument au téléphone est plus fort.
 */
function scoreProposition(matches: readonly MatchAcquereur[]): number {
  const meilleur = matches[0]?.score ?? 0;
  const bonus = matches.length >= 3 ? 10 : matches.length === 2 ? 5 : 0;
  return clampScore(meilleur + bonus);
}

export function proposerRapprochementsInverses(
  input: RapprochementInverseInput,
): ProposedAction[] {
  const now = input.now ?? new Date();
  const config = input.config ?? RAPPROCHEMENT_INVERSE_CONFIG;
  const ageMaxMs = config.ageEstimationMaxJours * 86_400_000;

  const moteur = {
    ...RAPPROCHEMENT_CONFIG,
    scoreMinimum: config.scoreMinimum,
    maxAcquereursParBien: config.maxAcquereurs,
  };

  const propositions: ProposedAction[] = [];

  for (const bien of input.biens) {
    // Seules les estimations : un bien déjà au mandat relève du rapprochement
    // classique, déjà présent sur la fiche.
    if (bien.mandatStatut !== 'estimation') continue;

    const t = Date.parse(bien.createdAt);
    if (Number.isFinite(t) && now.getTime() - t > ageMaxMs) continue;

    const matches = rapprocherAcquereurs(bien, input.acquereurs, moteur);
    if (matches.length === 0) continue;

    propositions.push({
      kind: 'rapprochement_inverse',
      // Le meilleur acquéreur fait partie de la clé : un meilleur profil qui
      // arrive plus tard mérite une nouvelle proposition, pas le silence.
      dedupKey: dedupKey('rapprochement_inverse', bien.id, matches[0]!.contact.id),
      titre: titre(matches.length, bien.address),
      detail: detail(bien, matches, now),
      score: scoreProposition(matches),
      assignedTo: bien.assignedTo ?? bien.createdBy ?? null,
      expiresAt: expiresInDays(config.expirationJours, now),
      payload: {
        bienId: bien.id,
        adresse: bien.address,
        codePostal: bien.postalCode,
        prix: bien.price,
        proprietaireName: bien.proprietaireName,
        proprietairePhone: bien.proprietairePhone,
        argumentaire: argumentaireVendeur(bien, matches),
        acquereurs: matches.map((m) => ({
          contactId: m.contact.id,
          nom: m.contact.fullName,
          telephone: m.contact.phone,
          score: m.score,
          raisons: m.raisons,
        })),
      },
    });
  }

  propositions.sort((a, b) => b.score - a.score || a.titre.localeCompare(b.titre, 'fr'));
  return propositions.slice(0, config.maxPropositions);
}
