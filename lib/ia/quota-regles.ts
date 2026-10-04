/**
 * Plafond quotidien d'appels à Mistral, par agent : les chiffres et les
 * messages. Pur ; l'appel à la base est dans quota.ts.
 *
 * Mesuré en octobre 2026 : 6 notes et 6 questions à l'assistant par agent et
 * par jour, au plus. Les plafonds sont des dizaines de fois au-dessus : ils
 * ne gênent personne et ne servent qu'à borner la facture d'un compte volé
 * ou d'une boucle folle côté client.
 */
export const PLAFONDS_IA_JOUR = {
  /** Fichier audio → texte : la note enregistrée, une question vocale. */
  transcription: 400,
  /** Les morceaux transcrits pendant l'enregistrement, avant l'arrêt. */
  pre_transcription: 2000,
  /** Les cartes qui s'affichent pendant la dictée : un appel toutes les quelques secondes. */
  comprehension: 3000,
  /** Jetons de dictée en temps réel (Voxtral Realtime, ≈ 15 min chacun). */
  temps_reel: 150,
  /** Mémoire d'un contact ou d'un immeuble, champs d'estimation dictés. */
  redaction: 300,
  script_approche: 100,
  assistant: 400,
} as const;

export type UsageIa = keyof typeof PLAFONDS_IA_JOUR;

export const MESSAGE_QUOTA_IA =
  'Limite quotidienne atteinte pour cette fonction. Elle se rouvre demain ; si vous en avez besoin, prévenez votre directeur.';

/** La fonction n'existe pas encore en base (migration non appliquée). */
export function quotaIndisponible(erreur: { code?: string; message?: string } | null): boolean {
  if (!erreur) return false;
  return (
    erreur.code === 'PGRST202' ||
    erreur.code === '42883' ||
    /could not find the function|does not exist/i.test(erreur.message ?? '')
  );
}
