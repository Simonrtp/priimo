import { tonRapport, type EstimationMotif } from '@/lib/estimation/cycle';
import {
  MENTION_PEU_FIABLE,
  SEUIL_CRITERES_FIABLES,
  criteresRenseignes,
  type GrilleSaisie,
} from '@/lib/estimation/grille';

export const MENTION_LEGALE_AVIS =
  'Avis de valeur à titre indicatif — ne constitue pas une expertise immobilière au sens de la réglementation. Adresses exactes des biens comparables non communiquées.';

export const MENTION_CONFIDENTIEL =
  'n’apparaît jamais dans les documents remis au client';

/** Ce qui peut sortir sur /avis ou à l'impression. Jamais les notes internes. */
export function payloadPublic(input: {
  motif: EstimationMotif;
  dateValeur: string | null;
  commentairesPublics: string | null;
  commentairesConfidentiels: string | null;
  grille?: GrilleSaisie;
  criteresRenseignes?: number;
}): {
  titre: string;
  accroche: string;
  dateValeur: string | null;
  commentaires: string | null;
  mentionLegale: string;
  alerteFiabilite: string | null;
} {
  const ton = tonRapport(input.motif);
  const n =
    input.criteresRenseignes ??
    (input.grille ? criteresRenseignes(input.grille) : 0);
  return {
    titre: ton.titre,
    accroche: ton.accroche,
    dateValeur: ton.exigeDateValeur ? input.dateValeur : input.dateValeur,
    commentaires: input.commentairesPublics?.trim() || null,
    mentionLegale: MENTION_LEGALE_AVIS,
    alerteFiabilite: n < SEUIL_CRITERES_FIABLES ? MENTION_PEU_FIABLE : null,
  };
}

export function exclutConfidentiel<T extends { commentaires_confidentiels?: unknown }>(
  row: T,
): Omit<T, 'commentaires_confidentiels'> {
  const { commentaires_confidentiels: _ignore, ...rest } = row;
  return rest;
}
