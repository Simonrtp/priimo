import { isValidFrenchPhone, normalizeFrenchPhone } from '@/lib/phone';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInviteFields(
  fields: {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
    agencyName?: string;
    acceptedCgu?: boolean;
  },
  options: { requireAgencyName?: boolean } = {}
): string | null {
  const firstName = (fields.firstName ?? '').trim();
  if (!firstName) return 'Le prénom est obligatoire.';

  const lastName = (fields.lastName ?? '').trim();
  if (!lastName) return 'Le nom est obligatoire.';

  const email = (fields.email ?? '').trim();
  if (!email) return "L'email est obligatoire.";
  if (!EMAIL_REGEX.test(email)) return "Format d'email invalide.";

  const phone = normalizeFrenchPhone(fields.phone ?? '');
  if (!phone) return 'Le numéro de téléphone est obligatoire.';
  if (!isValidFrenchPhone(phone)) return 'Format de téléphone invalide (ex. 06 12 34 56 78).';

  const password = fields.password ?? '';
  if (!password) return 'Le mot de passe est obligatoire.';
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';

  if (options.requireAgencyName) {
    const agencyName = (fields.agencyName ?? '').trim();
    if (!agencyName) return "Le nom de l'agence est obligatoire.";
  }

  if (fields.acceptedCgu !== true) {
    return "Vous devez accepter les Conditions Générales d'Utilisation.";
  }

  return null;
}

export { normalizeFrenchPhone };
