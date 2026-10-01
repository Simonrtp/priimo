/**
 * Une question dictée au micro de la note passe à Mon assistant.
 *
 * Le fournisseur de l'assistant vit sous celui de la dictée : un événement
 * navigateur évite de croiser les deux contextes.
 */

export const EVENEMENT_QUESTION_ASSISTANT = 'priimo:assistant-question';

export type QuestionAssistantDetail = { question: string };

export function demanderAMonAssistant(question: string): void {
  const q = question.trim();
  if (!q || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<QuestionAssistantDetail>(EVENEMENT_QUESTION_ASSISTANT, { detail: { question: q } }),
  );
}
