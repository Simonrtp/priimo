/**
 * Une fiche Google Contacts (People API) → une ligne aux mêmes colonnes
 * qu'une vCard : la correspondance automatique la reconnaît d'elle-même.
 */

import { VCARD_COLONNES } from './vcard';

type Meta = { metadata?: { primary?: boolean } };

export type PersonneGoogle = {
  resourceName?: string;
  names?: (Meta & { displayName?: string; givenName?: string; middleName?: string; familyName?: string })[];
  phoneNumbers?: (Meta & { value?: string; canonicalForm?: string; type?: string })[];
  emailAddresses?: (Meta & { value?: string })[];
  addresses?: (Meta & {
    formattedValue?: string;
    streetAddress?: string;
    postalCode?: string;
    city?: string;
  })[];
  organizations?: (Meta & { name?: string })[];
  biographies?: (Meta & { value?: string })[];
};

export const GOOGLE_COLONNES = VCARD_COLONNES;

/** La valeur principale d'abord, puis l'ordre de Google. */
function principalesDabord<T extends Meta>(items: readonly T[] | undefined): T[] {
  return [...(items ?? [])].sort(
    (a, b) => Number(Boolean(b.metadata?.primary)) - Number(Boolean(a.metadata?.primary)),
  );
}

/** Le portable avant le fixe : c'est lui que l'agent appelle. */
function telephones(p: PersonneGoogle): string[] {
  return principalesDabord(p.phoneNumbers)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => Number(b.t.type === 'mobile') - Number(a.t.type === 'mobile') || a.i - b.i)
    .map(({ t }) => (t.value || t.canonicalForm || '').trim())
    .filter(Boolean);
}

export function personneVersValeurs(p: PersonneGoogle): Record<string, string> {
  const nom = principalesDabord(p.names)[0];
  const prenom = [nom?.givenName, nom?.middleName].filter(Boolean).join(' ').trim();
  const famille = (nom?.familyName ?? '').trim();
  const affiche = (nom?.displayName ?? '').trim();
  const org = (principalesDabord(p.organizations)[0]?.name ?? '').trim();
  const aUnNom = Boolean(prenom || famille || affiche);

  const tels = telephones(p);
  const emails = principalesDabord(p.emailAddresses)
    .map((e) => (e.value ?? '').trim())
    .filter(Boolean);
  const adresse = principalesDabord(p.addresses)[0];
  const rue = (adresse?.streetAddress || adresse?.formattedValue?.split('\n')[0] || '').trim();

  const notes = [
    aUnNom && org ? `Société : ${org}` : '',
    emails.length > 1 ? `Autres emails : ${emails.slice(1).join(', ')}` : '',
    (principalesDabord(p.biographies)[0]?.value ?? '').trim(),
  ].filter(Boolean);

  return {
    Prénom: prenom,
    Nom: famille,
    'Nom complet': prenom || famille ? '' : affiche || org,
    Téléphone: tels[0] ?? '',
    'Autre téléphone': tels.slice(1).join(' / '),
    Email: emails[0] ?? '',
    Adresse: rue.replace(/\n+/g, ', '),
    'Code postal': (adresse?.postalCode ?? '').trim(),
    Ville: (adresse?.city ?? '').trim(),
    Notes: notes.join('\n'),
  };
}
