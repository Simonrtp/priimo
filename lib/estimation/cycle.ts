import type { RecordViewer } from '@/lib/agency/visibility';

export const ESTIMATION_MOTIFS = [
  'projet_vente',
  'patrimoniale',
  'fiscale',
  'succession',
  'projet_achat',
] as const;

export type EstimationMotif = (typeof ESTIMATION_MOTIFS)[number];

export const ESTIMATION_ETATS = [
  'brouillon',
  'rendez_vous_pris',
  'realisee',
  'envoyee',
  'mandat_signe',
  'sans_suite',
] as const;

export type EstimationEtat = (typeof ESTIMATION_ETATS)[number];

export type EstimationOccupation = 'libre' | 'occupe';

export const MOTIF_LABELS: Record<EstimationMotif, string> = {
  projet_vente: 'Projet de vente',
  patrimoniale: 'Patrimoniale',
  fiscale: 'Fiscale',
  succession: 'Succession',
  projet_achat: 'Projet d’achat',
};

export const ETAT_LABELS: Record<EstimationEtat, string> = {
  brouillon: 'Brouillon',
  rendez_vous_pris: 'Rendez-vous pris',
  realisee: 'Réalisée',
  envoyee: 'Envoyée',
  mandat_signe: 'Mandat signé',
  sans_suite: 'Sans suite',
};

/** Ce que le motif met en avant sur le document remis. */
export function tonRapport(motif: EstimationMotif): {
  titre: string;
  accroche: string;
  exigeDateValeur: boolean;
} {
  switch (motif) {
    case 'succession':
      return {
        titre: 'Avis de valeur successorale',
        accroche: 'Valeur à la date retenue, pour le partage ou la déclaration.',
        exigeDateValeur: true,
      };
    case 'fiscale':
      return {
        titre: 'Avis de valeur — cadrage fiscal',
        accroche: 'Fourchette prudente, adossée aux ventes constatées du secteur.',
        exigeDateValeur: false,
      };
    case 'patrimoniale':
      return {
        titre: 'Avis de valeur patrimoniale',
        accroche: 'Photographie du bien dans son marché, hors projet de vente immédiat.',
        exigeDateValeur: false,
      };
    case 'projet_achat':
      return {
        titre: 'Avis de valeur — projet d’achat',
        accroche: 'Ce que le marché paie aujourd’hui pour un bien comparable.',
        exigeDateValeur: false,
      };
    default:
      return {
        titre: 'Avis de valeur',
        accroche: 'Fourchette de mise en marché, à partir des ventes réactualisées du secteur.',
        exigeDateValeur: false,
      };
  }
}

export function isMotif(raw: unknown): raw is EstimationMotif {
  return typeof raw === 'string' && (ESTIMATION_MOTIFS as readonly string[]).includes(raw);
}

export function isEtat(raw: unknown): raw is EstimationEtat {
  return typeof raw === 'string' && (ESTIMATION_ETATS as readonly string[]).includes(raw);
}

/** Le référent se change au directeur, pas au négociateur. */
export function canChangeReferent(viewer: RecordViewer): boolean {
  return viewer.role === 'directeur';
}

export function poussePipelineEstimation(etat: EstimationEtat): boolean {
  return etat === 'realisee';
}
