import type { AccueilVue } from '@/lib/today/accueil-vue';
import { parseAccueilVue } from '@/lib/today/accueil-vue';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';

/**
 * Vue Accueil pour un directeur.
 * À la connexion → « L'agence » (sauf choix explicite « Ma semaine »).
 */
export function resolveVueAccueilDirecteur(input: {
  cookie: string | undefined | null;
  /** Conservé pour compat ; n'influence plus le défaut. */
  membresAgence: number;
}): AccueilVue {
  void input.membresAgence;
  return parseAccueilVue(input.cookie);
}

/** Agences où le profil a le rôle directeur — jamais une valeur client. */
export function agencesDirecteur(
  memberships: readonly ProfileAgencyMembership[],
): { id: string; name: string }[] {
  return memberships
    .filter((m) => m.role === 'directeur' && m.agency)
    .map((m) => ({ id: m.agency_id, name: m.agency!.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
