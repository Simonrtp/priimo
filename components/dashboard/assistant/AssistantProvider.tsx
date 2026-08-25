'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { notifyError } from '@/lib/notify';
import type { AssistantIntent } from '@/lib/assistant/intent';
import type { AssistantRepondrePayload } from './AssistantResults';

const HISTORY_MAX = 3;

interface AssistantContextValue {
  query: string;
  setQuery: (q: string) => void;
  loading: boolean;
  result: AssistantRepondrePayload | null;
  history: string[];
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  runSearch: (question?: string) => Promise<void>;
  focusSearch: () => void;
  registerInput: (el: HTMLInputElement | null) => void;
  mobileSearchOpen: boolean;
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
  closeResults: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}

export default function AssistantProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const registerInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
  }, []);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssistantRepondrePayload | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const remember = useCallback((question: string) => {
    setHistory((prev) => {
      const next = [question, ...prev.filter((q) => q !== question)];
      return next.slice(0, HISTORY_MAX);
    });
  }, []);

  const runSearch = useCallback(
    async (question?: string) => {
      const q = (question ?? query).trim();
      if (!q || loading) return;
      setQuery(q);
      setLoading(true);
      setResult(null);
      setPanelOpen(true);
      try {
        const interpRes = await fetch('/api/assistant/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });
        const interpJson = (await interpRes.json()) as { intent?: AssistantIntent; error?: string };
        if (!interpRes.ok) {
          notifyError(interpJson.error ?? 'La recherche a échoué.');
          setPanelOpen(false);
          return;
        }

        const repondreRes = await fetch('/api/assistant/repondre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, intent: interpJson.intent }),
        });
        const payload = (await repondreRes.json()) as AssistantRepondrePayload & { error?: string };
        if (!repondreRes.ok) {
          notifyError(payload.error ?? 'La recherche a échoué.');
          setPanelOpen(false);
          return;
        }
        setResult(payload);
        remember(q);
      } catch {
        notifyError('La recherche a échoué.');
        setPanelOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [query, loading, remember],
  );

  const focusSearch = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileSearchOpen(true);
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const openMobileSearch = useCallback(() => {
    setMobileSearchOpen(true);
    setPanelOpen(true);
  }, []);

  const closeMobileSearch = useCallback(() => {
    setMobileSearchOpen(false);
    setPanelOpen(false);
  }, []);

  const closeResults = useCallback(() => {
    setPanelOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
      }
      if (e.key === 'Escape') {
        setPanelOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusSearch]);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      loading,
      result,
      history,
      panelOpen,
      setPanelOpen,
      runSearch,
      focusSearch,
      registerInput,
      mobileSearchOpen,
      openMobileSearch,
      closeMobileSearch,
      closeResults,
    }),
    [
      query,
      loading,
      result,
      history,
      panelOpen,
      runSearch,
      focusSearch,
      registerInput,
      mobileSearchOpen,
      openMobileSearch,
      closeMobileSearch,
      closeResults,
    ],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
