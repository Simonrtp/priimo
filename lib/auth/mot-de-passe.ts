/**
 * Mot de passe : la règle et les messages, partagés par le parcours « mot de
 * passe oublié » et les réglages. Pur.
 */

export const MOT_DE_PASSE_MIN = 8;

/** bcrypt ignore ce qui dépasse 72 octets : on refuse plutôt que de tronquer en silence. */
const MOT_DE_PASSE_MAX_OCTETS = 72;

/** Durée de validité du lien envoyé, celle de Supabase par défaut. */
export const LIEN_VALIDITE_LIBELLE = 'une heure';

export function verifierNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < MOT_DE_PASSE_MIN) return `Au moins ${MOT_DE_PASSE_MIN} caractères.`;
  if (new TextEncoder().encode(motDePasse).length > MOT_DE_PASSE_MAX_OCTETS) {
    return 'Trop long : 72 caractères au plus.';
  }
  if (motDePasse !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}

type ErreurAuth = { code?: string; message?: string; reasons?: readonly string[] } | null | undefined;

/** Erreur Supabase Auth → phrase pour l'agent. */
export function messageErreurMotDePasse(erreur: ErreurAuth): string {
  const code = erreur?.code ?? '';
  if (code === 'weak_password') {
    if (erreur?.reasons?.includes('pwned')) {
      return 'Ce mot de passe circule dans des fuites de données publiques. Choisissez-en un autre.';
    }
    return 'Mot de passe trop faible : allongez-le ou mêlez lettres, chiffres et symboles.';
  }
  if (code === 'same_password') return 'C’est votre mot de passe actuel : choisissez-en un nouveau.';
  if (code.startsWith('over_') && code.endsWith('rate_limit')) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  return 'Le mot de passe n’a pas pu être changé. Réessayez.';
}

/**
 * Lien du mail. Le jeton n'est vérifié qu'à l'envoi du formulaire : les
 * antivirus de messagerie ouvrent les liens, une vérification à l'ouverture
 * le grillerait avant l'agent.
 */
export function lienReinitialisation(baseUrl: string, jeton: string): string {
  return `${baseUrl.replace(/\/$/, '')}/mot-de-passe/nouveau?jeton=${encodeURIComponent(jeton)}`;
}
