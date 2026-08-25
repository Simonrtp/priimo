import type { Contact } from '@/types/contact';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import { downloadCsv } from './download-csv';

export const CONTACT_EXPORT_FIELDS = [
  'Prénom',
  'Nom',
  'Téléphone',
  'Email',
  'Type',
  'Secteur',
  'Budget min',
  'Budget max',
  'Surface min',
  'Pièces min',
  'Codes postaux',
  'Résumé',
] as const;

export function exportContactsCsv(contacts: readonly Contact[]): void {
  const rows = contacts.map((c) => ({
    Prénom: c.firstName,
    Nom: c.lastName,
    Téléphone: c.phone ?? '',
    Email: c.email ?? '',
    Type: CONTACT_TYPE_LABELS[c.type],
    Secteur: c.secteur ?? '',
    'Budget min': c.criteria.budgetMin === null ? '' : String(c.criteria.budgetMin),
    'Budget max': c.criteria.budgetMax === null ? '' : String(c.criteria.budgetMax),
    'Surface min': c.criteria.surfaceMin === null ? '' : String(c.criteria.surfaceMin),
    'Pièces min': c.criteria.roomsMin === null ? '' : String(c.criteria.roomsMin),
    'Codes postaux': c.criteria.postalCodes.join(', '),
    Résumé: c.summary ?? '',
  }));
  downloadCsv('priimo-contacts.csv', CONTACT_EXPORT_FIELDS, rows);
}
