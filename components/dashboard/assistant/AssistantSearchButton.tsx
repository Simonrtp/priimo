'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Mic, Search } from 'lucide-react';
import type { SearchHit } from '@/lib/assistant/search';
import { notifyError } from '@/lib/notify';
import { micErrorMessage, pickAudioMimeType, requestMicStream, stopMicStream } from '@/lib/voice/mic';
import AssistantSearchHits from './AssistantSearchHits';
import { useAssistant } from './AssistantProvider';
import { useAssistantPanel } from './AssistantPanelProvider';

/**
 * Barre de recherche. Recherche pure : ce qui est tapé va à `fetchSearchRows`,
 * rien d'autre. Aucune phrase, aucun point d'interrogation ne déclenche
 * l'assistant — il a son propre bouton.
 */
const PLACEHOLDER = 'Rechercher une adresse, un contact';
const PREVIEW_MAX = 8;
const DEBOUNCE_MS = 180;

function SearchField({
  className = '',
  autoFocus = false,
  tone = 'light',
}: {
  className?: string;
  autoFocus?: boolean;
  tone?: 'light' | 'shell' | 'map';
}) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listenTimerRef = useRef<number>(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const {
    query,
    setQuery,
    panelOpen,
    setPanelOpen,
    registerInput,
    closeResults,
  } = useAssistant();
  const { openPanel } = useAssistantPanel();

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeResults();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [closeResults]);

  // Recherche instantanée : une frappe, une requête, aucun modèle.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    const ctrl = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/assistant/search?q=${encodeURIComponent(q)}`, {
            signal: ctrl.signal,
          });
          if (!res.ok) return;
          const body = (await res.json()) as { hits?: SearchHit[] };
          setHits((body.hits ?? []).slice(0, PREVIEW_MAX));
        } catch {
          /* abandon ou réseau */
        } finally {
          if (!ctrl.signal.aborted) setSearching(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const trimmed = query.trim();
  const showPanel = panelOpen && trimmed.length >= 2;

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
      setQuery(data.text.trim());
      setPanelOpen(true);
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
  const map = tone === 'map';

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <form
        onSubmit={(e) => e.preventDefault()}
        className={`flex min-w-0 items-center gap-2 transition-colors duration-150 ${
          shell
            ? 'min-h-11 rounded-full bg-white px-3.5 shadow-sm focus-within:ring-2 focus-within:ring-white/35 md:h-9 md:min-h-0'
            : map
              ? 'min-h-[44px] px-1'
              : 'rounded-xl px-3.5 py-2 assistant-search-field'
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
            listening ? 'bg-accent text-white' : 'text-mute hover:text-ink'
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
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setPanelOpen(true);
          }}
          onFocus={() => setPanelOpen(true)}
          placeholder={listening ? 'Parlez…' : transcribing ? 'Mise en texte…' : PLACEHOLDER}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          className="min-w-0 flex-1 truncate bg-transparent text-[13px] text-ink outline-none placeholder:text-mute md:text-[14px]"
        />
        <span className="flex shrink-0 items-center justify-center text-mute" aria-hidden>
          <Search size={16} strokeWidth={2} />
        </span>
      </form>

      {showPanel ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[120] max-h-[min(50vh,360px)] overflow-y-auto overflow-x-hidden rounded-xl border border-black/[0.08] bg-white/95 shadow-lg backdrop-blur-sm"
          role="region"
          aria-live="polite"
          aria-label="Résultats de recherche"
        >
          {searching && hits.length === 0 ? (
            <div className="flex justify-center px-4 py-4" role="status" aria-label="Recherche en cours">
              <span
                className="size-5 rounded-full border-2 border-black/10 border-t-[#E8743C] motion-safe:animate-spin"
                aria-hidden
              />
            </div>
          ) : (
            <AssistantSearchHits
              hits={hits}
              query={trimmed}
              onClose={closeResults}
              onAskAssistant={() => {
                closeResults();
                openPanel(trimmed);
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AssistantSearchBar({ tone = 'light' }: { tone?: 'light' | 'shell' }) {
  return <SearchField className="w-full" tone={tone} />;
}

export function AssistantMobileSearchBar({ tone = 'light' }: { tone?: 'light' | 'shell' | 'map' }) {
  const { mobileSearchOpen } = useAssistant();
  if (!mobileSearchOpen) return null;
  return <SearchField className="w-full" autoFocus tone={tone} />;
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
