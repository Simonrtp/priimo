/**
 * Lecture du flux de `/api/assistant/conversation` (événements `meta`,
 * `sources`, `delta`, `erreur`). Partagée par le panneau de Mon assistant et
 * par la question dictée au micro de la note.
 */

import type { AssistantSource } from './collecte';
import type { VoirTout } from './liste-ecran';

export const REPONSE_IMPOSSIBLE = "La réponse n'a pas pu être produite.";

export type MetaFlux = {
  conversationId?: string;
  question?: string;
  voirTout?: VoirTout | null;
};

export type EcouteFlux = {
  onMeta?: (meta: MetaFlux) => void;
  /** Peut arriver deux fois : une question sur toute la base cite ses fiches à la fin. */
  onSources?: (sources: AssistantSource[]) => void;
  onDelta?: (fragment: string) => void;
  onErreur?: (message: string) => void;
};

/**
 * Plafond mensuel ou erreur : la réponse est un JSON, pas un flux, et son
 * message part dans `onErreur`. Une coupure en cours de lecture remonte.
 */
export async function lireFluxAssistant(res: Response, ecoute: EcouteFlux): Promise<void> {
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    ecoute.onErreur?.(body.error ?? REPONSE_IMPOSSIBLE);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('flux indisponible');
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let cut = buffer.indexOf('\n\n');
    while (cut >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf('\n\n');

      const eventLine = block.split('\n').find((l) => l.startsWith('event:'));
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.slice(6).trim();
      let data: unknown;
      try {
        data = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }

      if (event === 'meta') ecoute.onMeta?.(data as MetaFlux);
      else if (event === 'sources') ecoute.onSources?.((data as AssistantSource[]) ?? []);
      else if (event === 'delta') ecoute.onDelta?.((data as { t?: string }).t ?? '');
      else if (event === 'erreur') {
        ecoute.onErreur?.((data as { message?: string }).message ?? REPONSE_IMPOSSIBLE);
      }
    }
  }
}
