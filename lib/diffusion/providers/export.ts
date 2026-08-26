import {
  HONORAIRES_A_CHARGE_LABELS,
  MANDAT_STATUT_LABELS,
} from '@/types/bien';
import { mentionsLegales } from '../completeness';
import type { Annonce, DiffusionFile, DiffusionProvider, DiffusionResult } from '../types';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function el(name: string, value: string | number | null | boolean | undefined, indent = '    '): string {
  if (value === null || value === undefined || value === '') {
    return `${indent}<${name}/>`;
  }
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  return `${indent}<${name}>${xmlEscape(text)}</${name}>`;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function slug(annonce: Annonce): string {
  const ville = (annonce.ville ?? 'annonce')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${ville || 'annonce'}-${annonce.reference.slice(0, 8)}`;
}

function buildXml(annonce: Annonce): string {
  const mentions = mentionsLegales(annonce);
  const photos = annonce.photos
    .map((url, i) => `      <photo rang="${i + 1}" url="${xmlEscape(url)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<flux format="priimo-annonce" version="1.0" genere="${xmlEscape(new Date().toISOString())}">
  <!-- Flux normalisé Priimo. Ce n'est le format d'aucun portail en particulier.
       Une passerelle réelle s'ajoutera comme autre DiffusionProvider, sans modifier ce fichier. -->
  <annonce reference="${xmlEscape(annonce.reference)}">
${el('titre', annonce.titre)}
${el('description', annonce.description)}
${el('type', annonce.type)}
${el('adresse', annonce.adresse)}
${el('code_postal', annonce.codePostal)}
${el('ville', annonce.ville)}
${el('prix_euros', annonce.prix)}
${el('surface_m2', annonce.surfaceM2)}
${el('pieces', annonce.pieces)}
    <dpe>
${el('vierge', annonce.dpeVierge, '      ')}
${el('lettre_energie', annonce.dpeLettre, '      ')}
${el('kwh_m2_an', annonce.dpeKwh, '      ')}
${el('lettre_ges', annonce.gesLettre, '      ')}
${el('kg_co2_m2_an', annonce.gesKgCo2, '      ')}
${el('date', annonce.dpeDate, '      ')}
    </dpe>
    <mandat>
${el('type', MANDAT_STATUT_LABELS[annonce.mandatStatut], '      ')}
${el('code', annonce.mandatStatut, '      ')}
${el('numero', annonce.mandatNumero, '      ')}
${el('date', annonce.mandatDate, '      ')}
    </mandat>
    <honoraires>
${el('montant_ttc_euros', annonce.honorairesMontant, '      ')}
${el('a_charge', annonce.honorairesACharge, '      ')}
${el('a_charge_libelle', annonce.honorairesACharge ? HONORAIRES_A_CHARGE_LABELS[annonce.honorairesACharge] : null, '      ')}
${el('pourcent', annonce.honorairesPourcent, '      ')}
    </honoraires>
    <copropriete>
${el('est_copropriete', annonce.estCopropriete, '      ')}
${el('nombre_lots', annonce.nombreLots, '      ')}
${el('charges_annuelles', annonce.chargesAnnuelles, '      ')}
${el('procedure_en_cours', annonce.procedureEnCours, '      ')}
    </copropriete>
    <photos>
${photos || '      <!-- aucune -->'}
    </photos>
    <mentions_legales>
${mentions.map((m) => `      <mention>${xmlEscape(m)}</mention>`).join('\n') || '      <!-- aucune -->'}
    </mentions_legales>
${el('agence', annonce.agenceNom)}
  </annonce>
</flux>
`;
}

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(annonce: Annonce): string {
  const headers = [
    'reference',
    'titre',
    'description',
    'type',
    'adresse',
    'code_postal',
    'ville',
    'prix_euros',
    'surface_m2',
    'pieces',
    'dpe_vierge',
    'dpe_lettre',
    'dpe_kwh_m2_an',
    'ges_lettre',
    'ges_kg_co2_m2_an',
    'dpe_date',
    'mandat_type',
    'mandat_numero',
    'mandat_date',
    'honoraires_montant_ttc',
    'honoraires_a_charge',
    'honoraires_pourcent',
    'photos',
    'mentions_legales',
    'agence',
  ];

  const row = [
    annonce.reference,
    annonce.titre,
    annonce.description,
    annonce.type,
    annonce.adresse,
    annonce.codePostal,
    annonce.ville,
    annonce.prix,
    annonce.surfaceM2,
    annonce.pieces,
    annonce.dpeVierge ? 'oui' : 'non',
    annonce.dpeLettre,
    annonce.dpeKwh,
    annonce.gesLettre,
    annonce.gesKgCo2,
    annonce.dpeDate,
    annonce.mandatStatut,
    annonce.mandatNumero,
    annonce.mandatDate,
    annonce.honorairesMontant,
    annonce.honorairesACharge,
    annonce.honorairesPourcent,
    annonce.photos.join(' | '),
    mentionsLegales(annonce).join(' | '),
    annonce.agenceNom,
  ];

  return `${headers.join(',')}\n${row.map(csvCell).join(',')}\n`;
}

/**
 * Première implémentation : un fichier à télécharger. Aucun appel réseau,
 * aucune identifiant de portail. `retirer` ne fait rien d'autre que le dire.
 */
export class ExportDiffusionProvider implements DiffusionProvider {
  readonly id = 'export';
  readonly label = 'Export de flux';

  format: 'xml' | 'csv';

  constructor(format: 'xml' | 'csv' = 'xml') {
    this.format = format;
  }

  async diffuser(annonce: Annonce): Promise<DiffusionFile> {
    const base = `annonce-${slug(annonce)}-${stamp()}`;
    if (this.format === 'csv') {
      return {
        kind: 'file',
        filename: `${base}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        content: buildCsv(annonce),
      };
    }
    return {
      kind: 'file',
      filename: `${base}.xml`,
      mimeType: 'application/xml;charset=utf-8',
      content: buildXml(annonce),
    };
  }

  async retirer(annonce: Annonce): Promise<DiffusionResult> {
    return {
      kind: 'ack',
      message: `Rien à retirer : l'annonce ${annonce.reference} n'a été envoyée à aucun portail. Supprimez simplement le fichier exporté.`,
    };
  }
}
