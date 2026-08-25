import { HONORAIRES_A_CHARGE_LABELS, mandatPermetDiffusion } from '@/types/bien';
import type { Annonce } from './types';

export interface CompletenessIssue {
  field: string;
  label: string;
  /** Les trois champs cités par le métier : prix, DPE, mandat. */
  blocking: boolean;
}

export interface AnnonceCompleteness {
  blockers: CompletenessIssue[];
  warnings: CompletenessIssue[];
}

/**
 * Contrôle avant export. Les blockers n'empêchent pas le téléchargement :
 * ils s'affichent pour que l'agent voie ce qui manquerait à un portail.
 */
export function assessAnnonce(annonce: Annonce): AnnonceCompleteness {
  const blockers: CompletenessIssue[] = [];
  const warnings: CompletenessIssue[] = [];

  if (annonce.prix === null || annonce.prix <= 0) {
    blockers.push({ field: 'prix', label: 'Prix de vente', blocking: true });
  }

  const dpeOk = annonce.dpeVierge || Boolean(annonce.dpeLettre);
  if (!dpeOk) {
    blockers.push({
      field: 'dpe',
      label: 'DPE (étiquette énergie, ou mention « vierge »)',
      blocking: true,
    });
  }

  if (!mandatPermetDiffusion(annonce.mandatStatut)) {
    blockers.push({
      field: 'mandat',
      label: 'Mandat de vente (simple ou exclusif)',
      blocking: true,
    });
  }

  if (!annonce.honorairesMontant || !annonce.honorairesACharge) {
    warnings.push({
      field: 'honoraires',
      label: "Honoraires d'agence (montant TTC et qui les paie)",
      blocking: false,
    });
  }

  if (!annonce.dpeVierge && !annonce.gesLettre) {
    warnings.push({
      field: 'ges',
      label: 'Étiquette GES (climatique), obligatoire avec le DPE',
      blocking: false,
    });
  }

  if (!annonce.titre) {
    warnings.push({ field: 'titre', label: "Titre de l'annonce", blocking: false });
  }
  if (!annonce.description) {
    warnings.push({ field: 'description', label: 'Description', blocking: false });
  }
  if (!annonce.surfaceM2) {
    warnings.push({ field: 'surface', label: 'Surface en m²', blocking: false });
  }
  if (!annonce.pieces) {
    warnings.push({ field: 'pieces', label: 'Nombre de pièces', blocking: false });
  }
  if (!annonce.type) {
    warnings.push({ field: 'type', label: 'Type de bien', blocking: false });
  }
  if (annonce.photos.length === 0) {
    warnings.push({ field: 'photos', label: 'Au moins une photo', blocking: false });
  }
  if (!annonce.mandatNumero) {
    warnings.push({ field: 'mandatNumero', label: 'Numéro de mandat', blocking: false });
  }
  if (!annonce.dpeVierge && !annonce.dpeDate) {
    warnings.push({ field: 'dpeDate', label: 'Date du DPE', blocking: false });
  }

  return { blockers, warnings };
}

/** Mentions à coller dans un flux : honoraires Hoguet + DPE F/G. */
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

  if (annonce.mandatStatut === 'mandat_exclusif') {
    lines.push('Mandat exclusif.');
  } else if (annonce.mandatStatut === 'mandat_simple') {
    lines.push('Mandat simple.');
  }

  return lines;
}
