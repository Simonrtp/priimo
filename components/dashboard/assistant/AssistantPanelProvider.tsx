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
import type { AssistantSource } from '@/lib/assistant/collecte';

export type PanelTab = 'conversation' | 'historique';

export type VoirTout = { href: string; total: number };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  contenu: string;
  sources: AssistantSource[];
  /** Question à laquelle cette réponse répond — rappelée au-dessus des lignes. */
  question?: string;
  /** Renvoi vers l'écran qui sait afficher toute la liste. */
  voirTout?: VoirTout | null;
};

export type ConversationResume = {
  id: string;
  titre: string;
  createdAt: string;
  updatedAt: string;
};

interface AssistantPanelValue {
  open: boolean;
  openPanel: (question?: string) => void;
  closePanel: () => void;
  tab: PanelTab;
  setTab: (tab: PanelTab) => void;

  messages: ChatMessage[];
  streaming: boolean;
  /** Question pré-remplie venue de la recherche, consommée par la saisie. */
  draft: string;
  setDraft: (value: string) => void;
  envoyer: (question: string) => Promise<void>;
  nouvelleConversation: () => void;

  conversations: ConversationResume[];
  historiqueLoading: boolean;
  rechercheHistorique: string;
  setRechercheHistorique: (q: string) => void;
  reprendre: (id: string) => Promise<void>;
  supprimer: (id: string) => Promise<void>;
}

const AssistantPanelContext = createContext<AssistantPanelValue | null>(null);

export function useAssistantPanel(): AssistantPanelValue {
  const ctx = useContext(AssistantPanelContext);
  if (!ctx) throw new Error('useAssistantPanel must be used within AssistantPanelProvider');
  return ctx;
}

let localId = 0;
function nextId(): string {
  localId += 1;
  return `local-${localId}`;
}

export default function AssistantPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('conversation');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationResume[]>([]);
  const [historiqueLoading, setHistoriqueLoading] = useState(false);
  const [rechercheHistorique, setRechercheHistorique] = useState('');

  const abortRef = useRef<AbortController | null>(null);

  const chargerHistorique = useCallback(async (q: string) => {
    setHistoriqueLoading(true);
    try {
      const res = await fetch(`/api/assistant/conversations?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const body = (await res.json()) as { conversations?: ConversationResume[] };
      setConversations(body.conversations ?? []);
    } catch {
      /* réseau : l'historique reste tel quel */
    } finally {
      setHistoriqueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || tab !== 'historique') return;
    const timer = window.setTimeout(() => void chargerHistorique(rechercheHistorique), 180);
    return () => window.clearTimeout(timer);
  }, [open, tab, rechercheHistorique, chargerHistorique]);

  const openPanel = useCallback((question?: string) => {
    setOpen(true);
    setTab('conversation');
    if (question) setDraft(question);
  }, []);

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  const nouvelleConversation = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setDraft('');
    setTab('conversation');
  }, []);

  const envoyer = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || streaming) return;

      setDraft('');
      setTab('conversation');
      const userMsg: ChatMessage = { id: nextId(), role: 'user', contenu: q, sources: [] };
      const replyId = nextId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: replyId, role: 'assistant', contenu: '', sources: [] },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === replyId ? fn(m) : m)));

      try {
        const res = await fetch('/api/assistant/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, conversationId }),
          signal: controller.signal,
        });

        // Plafond mensuel ou erreur : réponse JSON, pas un flux.
        const type = res.headers.get('content-type') ?? '';
        if (!type.includes('text/event-stream')) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          patch((m) => ({ ...m, contenu: body.error ?? "La réponse n'a pas pu être produite." }));
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

            if (event === 'meta') {
              const meta = data as {
                conversationId?: string;
                question?: string;
                voirTout?: VoirTout | null;
              };
              if (meta.conversationId) setConversationId(meta.conversationId);
              patch((m) => ({
                ...m,
                question: meta.question ?? q,
                voirTout: meta.voirTout ?? null,
              }));
            } else if (event === 'sources') {
              patch((m) => ({ ...m, sources: (data as AssistantSource[]) ?? [] }));
            } else if (event === 'delta') {
              const t = (data as { t?: string }).t ?? '';
              patch((m) => ({ ...m, contenu: m.contenu + t }));
            } else if (event === 'erreur') {
              patch((m) => ({
                ...m,
                contenu: (data as { message?: string }).message ?? "La réponse n'a pas pu être produite.",
              }));
            }
          }
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        notifyError("La réponse n'a pas pu être produite.");
        patch((m) => (m.contenu ? m : { ...m, contenu: "La réponse n'a pas pu être produite." }));
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [conversationId, streaming],
  );

  const reprendre = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/conversations/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const body = (await res.json()) as {
        messages?: Array<{ id: string; role: 'user' | 'assistant'; contenu: string; sources: AssistantSource[] }>;
      };
      setMessages(
        (body.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          contenu: m.contenu,
          sources: m.sources ?? [],
        })),
      );
      setConversationId(id);
      setTab('conversation');
    } catch {
      notifyError("La conversation n'a pas pu être ouverte.");
    }
  }, []);

  const supprimer = useCallback(
    async (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      try {
        const res = await fetch(`/api/assistant/conversations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('delete failed');
        if (conversationId === id) {
          setMessages([]);
          setConversationId(null);
        }
      } catch {
        notifyError("La conversation n'a pas pu être supprimée.");
        void chargerHistorique(rechercheHistorique);
      }
    },
    [conversationId, chargerHistorique, rechercheHistorique],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const value = useMemo(
    () => ({
      open,
      openPanel,
      closePanel,
      tab,
      setTab,
      messages,
      streaming,
      draft,
      setDraft,
      envoyer,
      nouvelleConversation,
      conversations,
      historiqueLoading,
      rechercheHistorique,
      setRechercheHistorique,
      reprendre,
      supprimer,
    }),
    [
      open,
      openPanel,
      closePanel,
      tab,
      messages,
      streaming,
      draft,
      envoyer,
      nouvelleConversation,
      conversations,
      historiqueLoading,
      rechercheHistorique,
      reprendre,
      supprimer,
    ],
  );

  return (
    <AssistantPanelContext.Provider value={value}>{children}</AssistantPanelContext.Provider>
  );
}
