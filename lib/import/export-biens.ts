import type { Bien } from '@/types/bien';
import { MANDAT_STATUT_LABELS } from '@/types/bien';
import { downloadCsv } from './download-csv';

export const BIEN_EXPORT_FIELDS = [
  'Adresse',
  'Code postal',
  'Ville',
  'Type',
  'Surface',
  'Pièces',
  'Prix',
  'Statut du mandat',
  'Titre',
  'Description',
  'Notes',
] as const;

export function exportBiensCsv(biens: readonly Bien[]): void {
  const rows = biens.map((b) => ({
    Adresse: b.address,
    'Code postal': b.postalCode ?? '',
    Ville: b.city ?? '',
    Type: b.propertyType ?? '',
    Surface: b.surfaceM2 === null ? '' : String(b.surfaceM2),
    Pièces: b.rooms === null ? '' : String(b.rooms),
    Prix: b.price === null ? '' : String(b.price),
    'Statut du mandat': MANDAT_STATUT_LABELS[b.mandatStatut],
    Titre: b.listingTitle ?? '',
    Description: b.listingDescription ?? '',
    Notes: b.notes ?? '',
  }));
  downloadCsv('priimo-biens.csv', BIEN_EXPORT_FIELDS, rows);
}
