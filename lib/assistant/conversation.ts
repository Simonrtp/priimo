/**
 * Mémoire d'un fil, à coût constant.
 *
 * On ne renvoie JAMAIS l'historique complet au modèle : les six derniers
 * messages en clair, plus un résumé roulant des précédents stocké dans
 * `assistant_conversations.resume`, régénéré tous les six messages.
 * Sans cela le coût d'une conversation croît de façon quadratique.
 */

export const FENETRE_MESSAGES = 6;
export const RESUME_MAX_CHARS = 900;
export const TITRE_MAX_CHARS = 70;

export type ConversationMessage = {
  role: 'user' | 'assistant';
  contenu: string;
};

export type MemoireContexte = {
  /** Résumé des messages sortis de la fenêtre, ou null. */
  resume: string | null;
  /** Les six derniers messages, dans l'ordre. */
  recents: ConversationMessage[];
  /** Messages couverts par le résumé — sert à savoir quand le régénérer. */
  couvertsParResume: number;
};

export function construireContexte(
  messages: readonly ConversationMessage[],
  resume: string | null,
): MemoireContexte {
  const recents = messages.slice(-FENETRE_MESSAGES);
  const couverts = Math.max(0, messages.length - recents.length);
  return {
    resume: couverts > 0 ? (resume?.trim() || null) : null,
    recents: recents.map((m) => ({ role: m.role, contenu: m.contenu })),
    couvertsParResume: couverts,
  };
}

/**
 * Vrai quand des messages sont sortis de la fenêtre depuis la dernière
 * régénération. Le compteur avance par paliers de six, pas à chaque tour.
 */
export function doitRegenererResume(
  totalMessages: number,
  messagesDejaResumes: number,
): boolean {
  const horsFenetre = Math.max(0, totalMessages - FENETRE_MESSAGES);
  if (horsFenetre <= 0) return false;
  return horsFenetre - messagesDejaResumes >= FENETRE_MESSAGES;
}

/** Nombre de messages que le prochain résumé doit couvrir. */
export function messagesAResumer(totalMessages: number): number {
  return Math.max(0, totalMessages - FENETRE_MESSAGES);
}

/**
 * Titre d'une conversation : la première question, coupée proprement.
 * Aucun appel de modèle — un titre ne vaut pas un aller-retour.
 */
export function titreDepuisQuestion(question: string): string {
  const nettoye = question
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'«»]+/, '')
    .trim();
  if (!nettoye) return 'Conversation';
  if (nettoye.length <= TITRE_MAX_CHARS) return nettoye;
  const coupe = nettoye.slice(0, TITRE_MAX_CHARS);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > 30 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/** Messages envoyés au modèle : système, résumé éventuel, puis la fenêtre. */
export function messagesPourModele(
  systemPrompt: string,
  contexte: MemoireContexte,
  questionCourante: string,
  donnees: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];
  if (contexte.resume) {
    out.push({
      role: 'system',
      content: `Résumé des échanges précédents :\n${contexte.resume.slice(0, RESUME_MAX_CHARS)}`,
    });
  }
  for (const m of contexte.recents) {
    out.push({ role: m.role, content: m.contenu });
  }
  out.push({
    role: 'user',
    content: `Question : ${questionCourante}\n\nDonnées :\n${donnees}`,
  });
  return out;
}
