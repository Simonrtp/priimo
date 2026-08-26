import { HONORAIRES_A_CHARGE_LABELS, mandatPermetDiffusion } from '@/types/bien';
import type { Annonce, PortailId } from './types';
import { PORTAIL_LABELS } from './types';

export interface CompletenessIssue {
  field: string;
  label: string;
  blocking: boolean;
}

export interface AnnonceCompleteness {
  blockers: CompletenessIssue[];
  warnings: CompletenessIssue[];
}

export interface PortailValidationRules {
  portail: PortailId;
  minPhotos: number;
  maxPhotos: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
  maxTitreLength: number;
}

/** Règles métier / techniques par portail (ordre de grandeur marché). */
export const PORTAIL_RULES: Record<PortailId, PortailValidationRules> = {
  seloger: {
    portail: 'seloger',
    minPhotos: 1,
    maxPhotos: 30,
    minDescriptionLength: 50,
    maxDescriptionLength: 4000,
    maxTitreLength: 100,
  },
  bienici: {
    portail: 'bienici',
    minPhotos: 1,
    maxPhotos: 25,
    minDescriptionLength: 40,
    maxDescriptionLength: 5000,
    maxTitreLength: 120,
  },
  logicimmo: {
    portail: 'logicimmo',
    minPhotos: 1,
    maxPhotos: 20,
    minDescriptionLength: 50,
    maxDescriptionLength: 3500,
    maxTitreLength: 100,
  },
  leboncoin: {
    portail: 'leboncoin',
    minPhotos: 1,
    maxPhotos: 20,
    minDescriptionLength: 30,
    maxDescriptionLength: 4000,
    maxTitreLength: 70,
  },
  ouestfrance: {
    portail: 'ouestfrance',
    minPhotos: 1,
    maxPhotos: 20,
    minDescriptionLength: 40,
    maxDescriptionLength: 4000,
    maxTitreLength: 100,
  },
  autre: {
    portail: 'autre',
    minPhotos: 1,
    maxPhotos: 30,
    minDescriptionLength: 30,
    maxDescriptionLength: 5000,
    maxTitreLength: 120,
  },
};

/**
 * Obligations françaises non négociables (toute annonce).
 * Bloquantes avant envoi — un refus asynchrone du portail est trop tard.
 */
export function assessObligationsFrancaises(annonce: Annonce): CompletenessIssue[] {
  const blockers: CompletenessIssue[] = [];

  if (annonce.prix === null || annonce.prix <= 0) {
    blockers.push({ field: 'prix', label: 'Prix de vente', blocking: true });
  }

  if (!mandatPermetDiffusion(annonce.mandatStatut)) {
    blockers.push({
      field: 'mandat',
      label: 'Mandat de vente (simple ou exclusif)',
      blocking: true,
    });
  }

  if (!annonce.dpeVierge) {
    if (!annonce.dpeLettre) {
      blockers.push({
        field: 'dpe',
        label: 'DPE — étiquette énergie (ou mention « vierge »)',
        blocking: true,
      });
    }
    if (annonce.dpeKwh == null) {
      blockers.push({
        field: 'dpe_kwh',
        label: 'DPE — consommation chiffrée (kWh/m²/an)',
        blocking: true,
      });
    }
    if (!annonce.gesLettre) {
      blockers.push({
        field: 'ges',
        label: 'GES — étiquette climat',
        blocking: true,
      });
    }
    if (annonce.gesKgCo2 == null) {
      blockers.push({
        field: 'ges_kg',
        label: 'GES — émissions chiffrées (kg CO₂/m²/an)',
        blocking: true,
      });
    }
  }

  if (!annonce.honorairesMontant || !annonce.honorairesACharge) {
    blockers.push({
      field: 'honoraires',
      label: "Honoraires d'agence (montant TTC et qui les paie)",
      blocking: true,
    });
  }

  if (annonce.estCopropriete) {
    if (annonce.nombreLots == null || annonce.nombreLots <= 0) {
      blockers.push({
        field: 'copro_lots',
        label: 'Copropriété — nombre de lots',
        blocking: true,
      });
    }
    if (annonce.chargesAnnuelles == null) {
      blockers.push({
        field: 'copro_charges',
        label: 'Copropriété — montant des charges',
        blocking: true,
      });
    }
    if (annonce.procedureEnCours === true) {
      const desc = (annonce.description ?? '').toLowerCase();
      if (!desc.includes('procédure') && !desc.includes('procedure')) {
        blockers.push({
          field: 'copro_procedure',
          label: 'Copropriété — mentionner la procédure en cours dans la description',
          blocking: true,
        });
      }
    }
  }

  return blockers;
}

function assessPortailTechnique(
  annonce: Annonce,
  rules: PortailValidationRules,
): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  const photos = annonce.photos.length;
  if (photos < rules.minPhotos) {
    issues.push({
      field: 'photos',
      label: `Au moins ${rules.minPhotos} photo(s) (${PORTAIL_LABELS[rules.portail]})`,
      blocking: true,
    });
  } else if (photos > rules.maxPhotos) {
    issues.push({
      field: 'photos_max',
      label: `Maximum ${rules.maxPhotos} photos (${PORTAIL_LABELS[rules.portail]})`,
      blocking: true,
    });
  }

  const desc = (annonce.description ?? '').trim();
  if (desc.length < rules.minDescriptionLength) {
    issues.push({
      field: 'description',
      label: `Description ≥ ${rules.minDescriptionLength} caractères`,
      blocking: true,
    });
  } else if (desc.length > rules.maxDescriptionLength) {
    issues.push({
      field: 'description_max',
      label: `Description ≤ ${rules.maxDescriptionLength} caractères`,
      blocking: true,
    });
  }

  const titre = (annonce.titre ?? '').trim();
  if (!titre) {
    issues.push({ field: 'titre', label: "Titre de l'annonce", blocking: true });
  } else if (titre.length > rules.maxTitreLength) {
    issues.push({
      field: 'titre_max',
      label: `Titre ≤ ${rules.maxTitreLength} caractères`,
      blocking: true,
    });
  }

  if (!annonce.surfaceM2) {
    issues.push({ field: 'surface', label: 'Surface en m²', blocking: true });
  }
  if (!annonce.pieces) {
    issues.push({ field: 'pieces', label: 'Nombre de pièces', blocking: false });
  }
  if (!annonce.type) {
    issues.push({ field: 'type', label: 'Type de bien', blocking: true });
  }
  if (!annonce.mandatNumero) {
    issues.push({ field: 'mandatNumero', label: 'Numéro de mandat', blocking: false });
  }
  if (!annonce.dpeVierge && !annonce.dpeDate) {
    issues.push({ field: 'dpeDate', label: 'Date du DPE', blocking: false });
  }

  return issues;
}

/**
 * Validateur par portail : obligations FR + règles techniques du portail.
 */
export function assessAnnonceForPortail(
  annonce: Annonce,
  portail: PortailId,
): AnnonceCompleteness {
  const rules = PORTAIL_RULES[portail];
  const all = [
    ...assessObligationsFrancaises(annonce),
    ...assessPortailTechnique(annonce, rules),
  ];
  const blockers = all.filter((i) => i.blocking);
  const warnings = all.filter((i) => !i.blocking);
  return { blockers, warnings };
}

/**
 * Compat : export local. Honoraires / GES deviennent bloquants (aligné obligations FR).
 */
export function assessAnnonce(annonce: Annonce): AnnonceCompleteness {
  return assessAnnonceForPortail(annonce, 'autre');
}

/** Mentions à coller dans un flux : honoraires Hoguet + DPE F/G + copro. */
export function mentionsLegales(annonce: Annonce): string[] {
  const lines: string[] = [];

  if (annonce.honorairesMontant && annonce.honorairesACharge) {
    const qui = HONORAIRES_A_CHARGE_LABELS[annonce.honorairesACharge].toLowerCase();
    const montant = new Intl.NumberFormat('fr-FR').format(annonce.honorairesMontant);
    const pct =
      annonce.honorairesPourcent !== null
        ? ` (${annonce.honorairesPourcent.toString().replace('.', ',')} % du prix)`
        : '';
    lines.push(`Honoraires d'agence de ${montant} € TTC${pct}, ${qui}.`);
  }

  if (annonce.dpeVierge) {
    lines.push('DPE vierge.');
  } else if (annonce.dpeLettre === 'F' || annonce.dpeLettre === 'G') {
    lines.push('Logement à consommation énergétique excessive.');
  }

  if (annonce.estCopropriete) {
    const lots =
      annonce.nombreLots != null ? `${annonce.nombreLots} lots` : 'nombre de lots à préciser';
    const charges =
      annonce.chargesAnnuelles != null
        ? `charges annuelles ${new Intl.NumberFormat('fr-FR').format(annonce.chargesAnnuelles)} €`
        : 'charges à préciser';
    lines.push(`Bien en copropriété (${lots}, ${charges}).`);
    if (annonce.procedureEnCours) {
      lines.push('Procédure en cours affectant la copropriété.');
    }
  }

  if (annonce.mandatStatut === 'mandat_exclusif') {
    lines.push('Mandat exclusif.');
  } else if (annonce.mandatStatut === 'mandat_simple') {
    lines.push('Mandat simple.');
  }

  return lines;
}

export function canPublish(annonce: Annonce, portail: PortailId): boolean {
  return assessAnnonceForPortail(annonce, portail).blockers.length === 0;
}
