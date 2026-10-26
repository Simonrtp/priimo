'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, Mic, NotebookPen, X } from 'lucide-react';
import type { AssistantSource } from '@/lib/assistant/collecte';
import { lireFluxAssistant, REPONSE_IMPOSSIBLE } from '@/lib/assistant/flux';
import type { VoirTout } from '@/lib/assistant/liste-ecran';
import SignalIA from '@/components/ui/SignalIA';
import AssistantIcon from '@/components/dashboard/assistant/AssistantIcon';
import { Sources } from '@/components/dashboard/assistant/AssistantPanel';
import { useAssistantVoiceInput } from '@/components/dashboard/assistant/useAssistantVoiceInput';

type Echange = {
  id: string;
  question: string;
  reponse: string;
  sources: AssistantSource[];
  voirTout: VoirTout | null;
};

let compteur = 0;

/**
 * La dictée était une question : la feuille de la note devient Mon assistant.
 * Pas de rangement — la réponse vient de toute la base que l'agent a le droit
 * de voir, et le micro pose la question suivante dans le même fil.
 */
export default function QuestionDictee({
  question,
  prete,
  onFermer,
  onGarderCommeNote,
}: {
  /** Ce que l'agent a dit, affiché tout de suite. */
  question: string;
  /** Le texte final de la dictée est arrivé : la question peut partir. */
  prete: boolean;
  /** Ferme la feuille : rien n'est gardé. */
  onFermer: () => void;
  /** C'était une note : la feuille repasse en relecture, avec « Ranger ». */
  onGarderCommeNote: () => void;
}) {
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [draft, setDraft] = useState('');
  const conversationRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lanceeRef = useRef(false);
  const filRef = useRef<HTMLDivElement>(null);
  const saisieId = useId();

  async function demander(texte: string) {
    const q = texte.trim();
    if (!q || abortRef.current) return;
    compteur += 1;
    const id = `q-${compteur}`;
    setEchanges((prev) => [...prev, { id, question: q, reponse: '', sources: [], voirTout: null }]);
    setEnCours(true);
    const patch = (fn: (e: Echange) => Echange) =>
      setEchanges((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/assistant/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, conversationId: conversationRef.current }),
        signal: controller.signal,
      });
      await lireFluxAssistant(res, {
        onMeta: (meta) => {
          if (meta.conversationId) conversationRef.current = meta.conversationId;
          patch((e) => ({ ...e, voirTout: meta.voirTout ?? null }));
        },
        onSources: (sources) => patch((e) => ({ ...e, sources })),
        onDelta: (t) => patch((e) => ({ ...e, reponse: e.reponse + t })),
        onErreur: (message) => patch((e) => ({ ...e, reponse: message })),
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      patch((e) => (e.reponse ? e : { ...e, reponse: REPONSE_IMPOSSIBLE }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setEnCours(false);
    }
  }

  // La question dictée part une seule fois, dès que son texte final est là.
  useEffect(() => {
    if (!prete || lanceeRef.current) return;
    lanceeRef.current = true;
    void demander(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prete]);

  const dernier = echanges[echanges.length - 1];
  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: 'smooth' });
  }, [echanges.length]);
  useEffect(() => {
    const fil = filRef.current;
    if (!fil) return;
    if (fil.scrollHeight - fil.scrollTop - fil.clientHeight < 90) fil.scrollTop = fil.scrollHeight;
  }, [dernier?.reponse, dernier?.sources.length]);

  const { listening, transcribing, toggle, voiceLabel } = useAssistantVoiceInput(
    (texte) => void demander(texte),
    { idle: 'Poser une autre question' },
  );

  function fermer() {
    abortRef.current?.abort();
    onFermer();
  }

  function envoyer() {
    const q = draft.trim();
    if (!q || enCours) return;
    setDraft('');
    void demander(q);
  }

  // Avant le départ de la question, la bulle montre déjà ce qui a été dit.
  const affiches: Echange[] =
    echanges.length > 0
      ? echanges
      : [{ id: 'attente', question, reponse: '', sources: [], voirTout: null }];
  const occupe = enCours || transcribing || !prete;

  return (
    <>
      <header className="flex flex-shrink-0 items-center gap-3 px-5 pb-2 pt-4">
        <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-ia-50 text-ia" aria-hidden>
          <AssistantIcon size={17} />
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold text-text-strong">
          Mon assistant
        </h2>
        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer"
          className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <div ref={filRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
        <div className="flex flex-col gap-6">
          {affiches.map((e, i) => (
            <section key={e.id} aria-label={e.question}>
              <div className="flex flex-col items-end gap-1.5">
                <p className="max-w-[88%] whitespace-pre-wrap break-words text-pretty rounded-2xl rounded-br-md bg-ia-50 px-4 py-2.5 text-[14.5px] leading-relaxed text-text-strong">
                  {e.question}
                </p>
                {i === 0 && affiches.length === 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      abortRef.current?.abort();
                      onGarderCommeNote();
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
                  >
                    <NotebookPen size={13} strokeWidth={2} aria-hidden />
                    Garder comme note
                  </button>
                ) : null}
              </div>

              <div className="mt-3">
                {e.reponse ? (
                  <p className="whitespace-pre-wrap break-words text-pretty text-[14.5px] text-text" style={{ lineHeight: 1.6 }}>
                    {e.reponse}
                  </p>
                ) : (
                  <SignalIA actif>Je cherche dans votre base</SignalIA>
                )}
                <Sources sources={e.sources} voirTout={e.voirTout} onNavigate={fermer} />
              </div>
            </section>
          ))}
        </div>
      </div>

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          envoyer();
        }}
        className="flex-shrink-0 border-t border-black/[0.06] px-4 py-3"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-end gap-2 rounded-full bg-bg-subtle py-1.5 pl-1.5 pr-1.5">
          <button
            type="button"
            onClick={toggle}
            disabled={enCours || !prete}
            aria-label={voiceLabel}
            title={voiceLabel}
            aria-pressed={listening}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-[color,background-color,transform] active:scale-95 disabled:opacity-40 ${
              listening ? 'bg-ia text-white' : 'bg-ia-50 text-ia'
            }`}
          >
            <Mic size={18} strokeWidth={2.2} aria-hidden />
          </button>
          <label htmlFor={saisieId} className="sr-only">
            Une autre question
          </label>
          <textarea
            id={saisieId}
            rows={1}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                envoyer();
              }
            }}
            placeholder={listening ? 'Parlez…' : transcribing ? 'Mise en texte…' : 'Une autre question'}
            disabled={occupe}
            className="max-h-24 min-h-[26px] w-full flex-1 resize-none self-center bg-transparent py-0.5 text-[15px] text-text-strong outline-none placeholder:text-text-subtle disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={occupe || draft.trim().length === 0}
            aria-label="Envoyer la question"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ia text-white transition-[opacity,transform] active:scale-95 disabled:opacity-30"
          >
            <ArrowUp size={18} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </form>
    </>
  );
}
