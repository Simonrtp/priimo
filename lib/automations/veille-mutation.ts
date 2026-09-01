/**
 * Veille mutations (DVF) — ce qui s'est vendu autour de vous.
 *
 * Une mutation fraîchement publiée sert deux fois :
 *   — sur une adresse que l'agence suivait, c'est un mandat perdu. Personne
 *     n'aime l'apprendre, tout le monde a besoin de le savoir : c'est la seule
 *     façon de comprendre ce qui se perd et de relancer le bon contact.
 *   — ailleurs dans le secteur, c'est un repère de prix daté et un prétexte
 *     d'appel au voisinage, qui vaut mieux que n'importe quel porte-à-porte.
 *
 * Subtilité DVF : la base publie avec plusieurs mois de décalage. La fraîcheur
 * d'un signal se mesure donc à la date où *nous* l'avons découvert, pas à la
 * date de vente — sans quoi tout serait toujours périmé.
 */

import { formatEuro } from '@/lib/estimation/resultat';
import { dedupKey } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';
import { memeAdresse, type AdresseSuivie } from './veille-dpe';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface VeilleMutationConfig {
  /** Depuis combien de jours au plus la mutation est-elle entrée chez nous. */
  fraicheurDecouverteJours: number;
  /** Au-delà, le prix ne sert plus d'argument de marché. */
  ancienneteMutationMaxMois: number;
  maxPropositions: number;
  expirationJours: number;
}

export const VEILLE_MUTATION_CONFIG: VeilleMutationConfig = {
  fraicheurDecouverteJours: 30,
  ancienneteMutationMaxMois: 18,
  maxPropositions: 10,
  expirationJours: 30,
};

/* -------------------------------------------------------------------------- */
/* Entrées                                                                    */
/* -------------------------------------------------------------------------- */

/** Une mutation, adresse déjà résolue par la couche requête. */
export interface MutationRecente {
  id: string;
  idMutation: string | null;
  adresse: string;
  codePostal: string | null;
  /** Date de vente (YYYY-MM-DD). */
  dateMutation: string;
  /** Date d'entrée de la ligne chez nous — la vraie mesure de fraîcheur. */
  decouverteLe: string;
  valeurFonciere: number | null;
  surfaceM2: number | null;
  prixM2: number | null;
  typeLocal: string | null;
}

export interface VeilleMutationInput {
  mutations: readonly MutationRecente[];
  secteur: readonly string[];
  adressesSuivies: readonly AdresseSuivie[];
  now?: Date;
  config?: VeilleMutationConfig;
}

/* -------------------------------------------------------------------------- */
/* Formulation                                                                */
/* -------------------------------------------------------------------------- */

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « mars 2026 » — une date de vente n'a jamais besoin du jour. */
export function moisEnToutesLettres(dateIso: string): string | null {
  const m = dateIso.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const mois = MOIS_FR[Number(m[2]) - 1];
  return mois ? `${mois} ${m[1]}` : null;
}

function moisDepuis(dateIso: string, now: Date): number | null {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / (30 * 86_400_000);
}

function joursDepuis(dateIso: string, now: Date): number | null {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / 86_400_000;
}

function prixM2Lisible(prixM2: number | null): string | null {
  if (prixM2 === null || !Number.isFinite(prixM2) || prixM2 <= 0) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(prixM2))} €/m²`;
}

/**
 * L'accroche au voisinage. Honnête par construction : on ne prétend jamais
 * avoir vendu le bien, on annonce un fait public et on propose une valeur.
 */
export function argumentaireVoisinage(mutation: MutationRecente): string {
  const prix = prixM2Lisible(mutation.prixM2);
  const repere = prix ? ` à ${prix}` : '';
  const quand = moisEnToutesLettres(mutation.dateMutation);
  const date = quand ? ` en ${quand}` : '';
  return `Bonjour, une vente vient d'être enregistrée dans votre rue${date}${repere}. Souhaitez-vous savoir ce que vaut votre bien aujourd'hui ?`;
}

function detailMutation(mutation: MutationRecente): string {
  const bouts: string[] = [];
  const quand = moisEnToutesLettres(mutation.dateMutation);
  if (quand) bouts.push(`Vendu en ${quand}`);
  if (mutation.valeurFonciere !== null) bouts.push(formatEuro(mutation.valeurFonciere));
  if (mutation.surfaceM2) bouts.push(`${Math.round(mutation.surfaceM2)} m²`);
  const prix = prixM2Lisible(mutation.prixM2);
  if (prix) bouts.push(prix);
  return bouts.join(' · ');
}

/* -------------------------------------------------------------------------- */
/* Moteur                                                                     */
/* -------------------------------------------------------------------------- */

export function proposerVeilleMutations(input: VeilleMutationInput): ProposedAction[] {
  const now = input.now ?? new Date();
  const config = input.config ?? VEILLE_MUTATION_CONFIG;
  const secteur = new Set(input.secteur);
  if (secteur.size === 0) return [];

  const propositions: ProposedAction[] = [];

  for (const mutation of input.mutations) {
    if (!mutation.codePostal || !secteur.has(mutation.codePostal)) continue;

    const jours = joursDepuis(mutation.decouverteLe, now);
    if (jours === null || jours > config.fraicheurDecouverteJours) continue;

    const mois = moisDepuis(mutation.dateMutation, now);
    if (mois === null || mois > config.ancienneteMutationMaxMois) continue;

    const suivi =
      input.adressesSuivies.find((a) =>
        memeAdresse({ adresse: mutation.adresse, codePostal: mutation.codePostal }, a),
      ) ?? null;

    const detail = detailMutation(mutation);

    if (suivi) {
      propositions.push({
        kind: 'veille_mutation',
        dedupKey: dedupKey('veille_mutation', mutation.idMutation ?? mutation.id),
        titre: `Vendu sans nous — ${mutation.adresse}`,
        detail: `${detail}. Fiche suivie : ${suivi.label ?? suivi.entite}. À clôturer, et à comprendre.`,
        score: clampScore(80),
        assignedTo: suivi.assignedTo,
        expiresAt: expiresInDays(config.expirationJours, now),
        payload: {
          mutationId: mutation.id,
          adresse: mutation.adresse,
          codePostal: mutation.codePostal,
          dateMutation: mutation.dateMutation,
          valeurFonciere: mutation.valeurFonciere,
          prixM2: mutation.prixM2,
          surfaceM2: mutation.surfaceM2,
          perdu: true,
          suivi: { entite: suivi.entite, id: suivi.id, label: suivi.label },
        },
      });
      continue;
    }

    propositions.push({
      kind: 'veille_mutation',
      dedupKey: dedupKey('veille_mutation', mutation.idMutation ?? mutation.id),
      titre: `Vente au ${mutation.adresse}`,
      detail: `${detail}. Prétexte d'appel pour le voisinage.`,
      score: clampScore(55),
      assignedTo: null,
      expiresAt: expiresInDays(config.expirationJours, now),
      payload: {
        mutationId: mutation.id,
        adresse: mutation.adresse,
        codePostal: mutation.codePostal,
        dateMutation: mutation.dateMutation,
        valeurFonciere: mutation.valeurFonciere,
        prixM2: mutation.prixM2,
        surfaceM2: mutation.surfaceM2,
        perdu: false,
        argumentaire: argumentaireVoisinage(mutation),
      },
    });
  }

  propositions.sort((a, b) => b.score - a.score || a.titre.localeCompare(b.titre, 'fr'));
  return propositions.slice(0, config.maxPropositions);
}
