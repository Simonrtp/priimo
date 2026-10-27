/**
 * Consigne de reformulation. Le modèle ne fait que remettre en français les
 * lignes collectées : aucun fait ne doit venir d'ailleurs.
 *
 * Ce texte part en premier message, identique à chaque appel, pour tomber
 * dans le cache de préfixe du fournisseur. Ne rien y interpoler.
 */

export const REFORMULER_TIMEOUT_MS = 8000;

export const REFORMULER_SYSTEM_PROMPT =
  "Tu reformules en français des données d'une base immobilière. Tu n'ajoutes aucune information absente des données fournies. Tu n'extrapoles pas. Si une donnée manque, tu ne la devines pas. Chaque fait que tu énonces doit correspondre à un champ présent dans les données. Tu ne cites aucune personne, adresse ou téléphone absent des lignes. Ton clair et un peu chaleureux, sans bavardage. Si le message indique une première réponse et un prénom, une courte accroche est possible une seule fois. Tu peux suggérer d'ouvrir une fiche ou le pipeline ; jamais de rappel calendrier. Réponse courte, au maximum six phrases. Texte brut, sans markdown.";
