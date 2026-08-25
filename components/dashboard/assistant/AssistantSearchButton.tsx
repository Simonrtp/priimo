'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Mic, Search } from 'lucide-react';
import {
  questionForSuggestion,
  type SearchSuggestion,
} from '@/lib/assistant/suggestions';
import { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import { notifyError } from '@/lib/notify';
import { micErrorMessage, pickAudioMimeType, requestMicStream, stopMicStream } from '@/lib/voice/mic';
import AssistantResults from './AssistantResults';
import { useAssistant } from './AssistantProvider';

const PLACEHOLDER = 'Rechercher une adresse, un contact, ou poser une question';

function SearchField({
  className = '',
  autoFocus = false,
  tone = 'light',
}: {
  className?: string;
  autoFocus?: boolean;
  tone?: 'light' | 'shell';
}) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listenTimerRef = useRef<number>(0);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const {
    query,
    setQuery,
    loading,
    result,
    history,
    panelOpen,
    setPanelOpen,
    runSearch,
    registerInput,
    closeResults,
  } = useAssistant();

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        closeResults();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [closeResults]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/assistant/suggestions?q=${encodeURIComponent(q)}`, {
            signal: ctrl.signal,
          });
          if (!res.ok) return;
          const body = (await res.json()) as { suggestions?: SearchSuggestion[] };
          setSuggestions(body.suggestions ?? []);
        } catch {
          /* abort ou réseau */
        }
      })();
    }, 180);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const showSuggestions = suggestions.length > 0 && query.trim().length >= 2 && !loading && !result;
  const showPanel =
    panelOpen && (loading || result !== null || history.length > 0 || showSuggestions);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch();
  };

  const onFocus = () => {
    setPanelOpen(true);
  };

  const pickSuggestion = (s: SearchSuggestion) => {
    const q = questionForSuggestion(s);
    setQuery(q);
    void runSearch(q);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(listenTimerRef.current);
      recorderRef.current?.stop();
      stopMicStream(streamRef.current);
    };
  }, []);

  async function transcribeAndSearch(blob: Blob) {
    if (blob.size === 0) {
      notifyError('Aucun son reçu.');
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'recherche.webm');
      const res = await fetch('/api/assistant/voix', { method: 'POST', body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text?.trim()) {
        notifyError(data.error ?? "La recherche vocale n'a pas pu être comprise");
        return;
      }
      const text = data.text.trim();
      setQuery(text);
      await runSearch(text);
    } catch {
      notifyError("La recherche vocale n'a pas pu être comprise");
    } finally {
      setTranscribing(false);
    }
  }

  async function startVoiceSearch() {
    try {
      const stream = await requestMicStream();
      streamRef.current = stream;
      const mime = pickAudioMimeType();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopMicStream(stream);
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' });
        void transcribeAndSearch(blob);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setListening(true);
      window.clearTimeout(listenTimerRef.current);
      listenTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current === recorder && recorder.state === 'recording') {
          recorder.stop();
          setListening(false);
        }
      }, 20_000);
    } catch (error) {
      notifyError(micErrorMessage(error));
    }
  }

  function toggleVoiceSearch() {
    if (transcribing) return;
    if (listening) {
      window.clearTimeout(listenTimerRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      setListening(false);
      return;
    }
    void startVoiceSearch();
  }

  const voiceLabel = transcribing
    ? 'Mise en texte de la recherche'
    : listening
      ? "Arrêter l'écoute"
      : 'Recherche vocale';

  const shell = tone === 'shell';

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <form
        onSubmit={onSubmit}
        className={`flex min-w-0 items-center gap-2 rounded-xl px-3 transition-colors duration-150 ${
          shell ? 'py-1.5' : 'py-2'
        } ${
          shell
            ? 'border border-white/12 bg-white/[0.08] focus-within:border-white/25 focus-within:bg-white/[0.12]'
            : 'assistant-search-field'
        }`}
      >
        <button
          type="button"
          onClick={toggleVoiceSearch}
          disabled={transcribing}
          aria-label={voiceLabel}
          title={voiceLabel}
          aria-pressed={listening}
          className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50 ${
            listening
              ? 'bg-accent text-white'
              : shell
                ? 'text-white/70 hover:text-white'
                : 'text-mute hover:text-ink'
          }`}
        >
          <Mic size={16} strokeWidth={2} aria-hidden />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Rechercher dans la base
        </label>
        <input
          ref={registerInput}
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setPanelOpen(true);
          }}
          onFocus={onFocus}
          placeholder={listening ? 'Parlez…' : transcribing ? 'Mise en texte…' : PLACEHOLDER}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          className={`min-w-0 flex-1 bg-transparent outline-none md:text-[14px] ${
            shell ? 'text-[13px] text-white placeholder:text-white/45' : 'text-[13px] text-ink placeholder:text-mute'
          }`}
        />
        <button
          type="submit"
          className={`flex shrink-0 items-center justify-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
            shell ? 'text-white/70 hover:text-white' : 'text-mute hover:text-ink'
          }`}
          aria-label="Lancer la recherche"
          title="Lancer la recherche"
        >
          <Search size={16} strokeWidth={2} aria-hidden />
        </button>
      </form>

      {showPanel ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[120] overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-lg"
          role="region"
          aria-live="polite"
          aria-label="Résultats de recherche"
        >
          {showSuggestions ? (
            <div className="border-b border-black/[0.06] px-4 py-3">
              <CardEyebrow>Propositions</CardEyebrow>
              <ul className="mt-2 flex flex-col gap-0.5">
                {suggestions.map((s) => (
                  <li key={`${s.kind}-${s.id}`}>
                    <button
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className="flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04]"
                    >
                      <span className="min-w-0 truncate text-[13px] font-medium text-ink">{s.label}</span>
                      <span className="shrink-0 text-[11px] font-medium uppercase text-mute">{s.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!loading && !result && history.length > 0 ? (
            <div className="border-b border-black/[0.06] px-4 py-3">
              <CardEyebrow>Dernières questions</CardEyebrow>
              <ul className="mt-2 flex flex-col gap-0.5">
                {history.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      onClick={() => void runSearch(q)}
                      className="w-full truncate rounded-lg px-2 py-1.5 text-left text-[13px] text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <AssistantResults loading={loading} result={result} onClose={closeResults} />
        </div>
      ) : null}
    </div>
  );
}

export function AssistantSearchBar({ tone = 'light' }: { tone?: 'light' | 'shell' }) {
  return <SearchField className="max-w-xl flex-1" tone={tone} />;
}

export function AssistantMobileSearchBar() {
  const { mobileSearchOpen } = useAssistant();
  if (!mobileSearchOpen) return null;
  return <SearchField className="w-full" autoFocus />;
}

export function AssistantSearchIconButton({ className = '' }: { className?: string }) {
  const { openMobileSearch } = useAssistant();
  return (
    <button
      type="button"
      onClick={openMobileSearch}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink md:h-9 md:w-9 ${className}`}
      aria-label="Rechercher dans la base"
      title="Rechercher dans la base"
    >
      <Search size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}
