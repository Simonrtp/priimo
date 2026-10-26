/**
 * Contacts choisis dans le téléphone (Contact Picker, Chrome sur Android) →
 * mêmes colonnes qu'une vCard. Le téléphone ne donne qu'un nom affiché :
 * le découpage prénom / nom se fait comme pour un « Nom complet ».
 */

import { VCARD_COLONNES } from './vcard';

export type AdresseTelephone = {
  addressLine?: readonly string[];
  postalCode?: string;
  city?: string;
};

export type ContactTelephone = {
  name?: readonly string[];
  tel?: readonly string[];
  email?: readonly string[];
  address?: readonly AdresseTelephone[];
};

export const TELEPHONE_COLONNES = VCARD_COLONNES;

export function contactTelephoneVersValeurs(c: ContactTelephone): Record<string, string> {
  const propres = (liste: readonly string[] | undefined) =>
    [...new Set((liste ?? []).map((v) => v.trim()).filter(Boolean))];
  const tels = propres(c.tel);
  const emails = propres(c.email);
  const adresse = c.address?.[0];
  return {
    Prénom: '',
    Nom: '',
    'Nom complet': propres(c.name)[0] ?? '',
    Téléphone: tels[0] ?? '',
    'Autre téléphone': tels.slice(1).join(' / '),
    Email: emails[0] ?? '',
    Adresse: (adresse?.addressLine ?? []).map((l) => l.trim()).filter(Boolean).join(', '),
    'Code postal': (adresse?.postalCode ?? '').trim(),
    Ville: (adresse?.city ?? '').trim(),
    Notes: emails.length > 1 ? `Autres emails : ${emails.slice(1).join(', ')}` : '',
  };
}
