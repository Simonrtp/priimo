/**
 * Consommation de l'assistant, par agence et par mois.
 *
 * Agrégats uniquement : jamais le contenu d'un message. Les conversations
 * restent privées, l'admin ne voit que des compteurs.
 */

import { normalizeTexte } from '@/lib/assistant/normalize';

export type UsageRow = {
  agencyId: string;
  agencyName: string;
  mois: string;
  tokens: number;
  messages: number;
  conversations: number;
};

export type FormeFrequente = {
  forme: string;
  exemple: string;
  occurrences: number;
  /** Part des questions restées sans ligne collectée. */
  sansResultat: number;
};

export function moisDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'inconnu';
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export type MessageAgrege = {
  agencyId: string;
  conversationId: string;
  createdAt: string;
  tokens: number;
};

/** Un tableau par (agence, mois), trié du plus récent au plus ancien. */
export function agregerUsage(
  messages: readonly MessageAgrege[],
  noms: ReadonlyMap<string, string>,
): UsageRow[] {
  const cles = new Map<string, UsageRow & { fils: Set<string> }>();

  for (const m of messages) {
    const mois = moisDe(m.createdAt);
    const cle = `${m.agencyId}:${mois}`;
    const row = cles.get(cle) ?? {
      agencyId: m.agencyId,
      agencyName: noms.get(m.agencyId) ?? 'Agence inconnue',
      mois,
      tokens: 0,
      messages: 0,
      conversations: 0,
      fils: new Set<string>(),
    };
    row.tokens += m.tokens;
    row.messages += 1;
    row.fils.add(m.conversationId);
    cles.set(cle, row);
  }

  return [...cles.values()]
    .map(({ fils, ...row }) => ({ ...row, conversations: fils.size }))
    .sort((a, b) => (a.mois === b.mois ? b.tokens - a.tokens : b.mois.localeCompare(a.mois)));
}

/** Les cinq premiers mots normalisés : assez pour reconnaître une tournure. */
export function formeDeQuestion(question: string): string {
  const mots = normalizeTexte(question).split(' ').filter(Boolean);
  return mots.slice(0, 5).join(' ') || 'question vide';
}

/**
 * Formulations les plus fréquentes, pour étendre le routeur déterministe sur
 * des questions réellement posées — pas sur des suppositions.
 */
export function formesFrequentes(
  questions: readonly { question: string; lignesCount: number }[],
  limite = 25,
): FormeFrequente[] {
  const cles = new Map<string, FormeFrequente>();
  for (const q of questions) {
    const forme = formeDeQuestion(q.question);
    const row = cles.get(forme) ?? { forme, exemple: q.question, occurrences: 0, sansResultat: 0 };
    row.occurrences += 1;
    if (q.lignesCount === 0) row.sansResultat += 1;
    cles.set(forme, row);
  }
  return [...cles.values()]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, limite);
}
