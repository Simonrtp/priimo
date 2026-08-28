'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  MessageSquarePlus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { AssistantSource } from '@/lib/assistant/collecte';
import { useAssistantPanel, type ChatMessage } from './AssistantPanelProvider';

const PANEL_W = 420;
const PANEL_H = 560;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
}

function formatDateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

/** Les lignes de base qui ont produit la réponse, cliquables vers la fiche. */
function Sources({ sources, onNavigate }: { sources: readonly AssistantSource[]; onNavigate: () => void }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {sources.map((s) => {
        const meta = [s.typeLabel, formatDate(s.date), s.auteur].filter(Boolean).join(' · ');
        const inner = (
          <>
            <span className="block truncate text-[12.5px] font-medium text-ink">{s.titre}</span>
            <span className="block truncate text-[11.5px] text-mute">{meta}</span>
          </>
        );
        return (
          <li key={`${s.kind}-${s.id}`}>
            {s.href ? (
              <Link
                href={s.href}
                onClick={onNavigate}
                className="block rounded-lg border border-black/[0.06] bg-surface px-2.5 py-1.5 transition-colors hover:bg-black/[0.03]"
              >
                {inner}
              </Link>
            ) : (
              <div className="rounded-lg border border-black/[0.06] bg-surface px-2.5 py-1.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Bulle({ message, onNavigate }: { message: ChatMessage; onNavigate: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] text-pretty rounded-2xl rounded-br-md bg-primary-50 px-3 py-2 text-[13.5px] text-ink">
          {message.contenu}
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-pretty whitespace-pre-wrap text-[13.5px] text-text" style={{ lineHeight: 1.55 }}>
        {message.contenu}
        {!message.contenu ? (
          <span className="inline-flex gap-1 align-middle" aria-label="Réponse en cours">
            <span className="size-1.5 animate-pulse rounded-full bg-black/25" />
            <span className="size-1.5 animate-pulse rounded-full bg-black/25" style={{ animationDelay: '120ms' }} />
            <span className="size-1.5 animate-pulse rounded-full bg-black/25" style={{ animationDelay: '240ms' }} />
          </span>
        ) : null}
      </p>
      <Sources sources={message.sources} onNavigate={onNavigate} />
    </div>
  );
}

function Conversation() {
  const { messages, streaming, draft, setDraft, envoyer, closePanel } = useAssistantPanel();
  const saisieId = useId();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void envoyer(draft);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span
              className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"
              aria-hidden
            >
              <Sparkles size={19} strokeWidth={2} />
            </span>
            <p className="mt-3 text-[13.5px] font-medium text-ink">Posez une question sur votre base</p>
            <p className="mt-1 text-pretty text-[12.5px] text-mute">
              Une adresse, une personne, des acquéreurs, l&apos;activité récente. Les réponses ne
              viennent que de vos données.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <Bulle key={m.id} message={m} onNavigate={closePanel} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex-shrink-0 border-t border-black/[0.06] p-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-black/[0.08] bg-surface px-3 py-2 focus-within:border-accent">
          <label htmlFor={saisieId} className="sr-only">
            Votre question
          </label>
          <textarea
            id={saisieId}
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void envoyer(draft);
              }
            }}
            placeholder="Votre question"
            className="max-h-24 min-h-[24px] w-full flex-1 resize-none bg-transparent text-[13.5px] text-ink outline-none placeholder:text-mute"
          />
          <button
            type="submit"
            disabled={streaming || draft.trim().length === 0}
            aria-label="Envoyer"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-35"
          >
            <ArrowUp size={16} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </form>
    </>
  );
}

function Historique() {
  const {
    conversations,
    historiqueLoading,
    rechercheHistorique,
    setRechercheHistorique,
    reprendre,
    supprimer,
  } = useAssistantPanel();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-shrink-0 px-3 pt-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            aria-hidden
          />
          <input
            type="search"
            value={rechercheHistorique}
            onChange={(e) => setRechercheHistorique(e.target.value)}
            placeholder="Rechercher dans vos conversations"
            aria-label="Rechercher dans vos conversations"
            className="w-full rounded-xl border border-black/[0.08] bg-surface py-2 pl-9 pr-3 text-[13px] text-ink outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {historiqueLoading && conversations.length === 0 ? (
          <p className="px-1 text-[13px] text-mute">Chargement…</p>
        ) : conversations.length === 0 ? (
          <p className="px-1 text-pretty text-[13px] text-mute">
            {rechercheHistorique
              ? 'Aucune conversation ne correspond.'
              : 'Vos conversations apparaîtront ici.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void reprendre(c.id)}
                  className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition-colors hover:bg-black/[0.04]"
                >
                  <span className="block truncate text-[13px] font-medium text-ink">{c.titre}</span>
                  <span className="block text-[11.5px] text-mute">{formatDateHeure(c.updatedAt)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void supprimer(c.id)}
                  aria-label={`Supprimer « ${c.titre} »`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
                >
                  <Trash2 size={15} strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Onglet({
  actif,
  label,
  onClick,
}: {
  actif: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={actif}
      role="tab"
      className={`min-h-[34px] rounded-lg px-3 text-[13px] font-semibold transition-colors ${
        actif ? 'bg-white text-ink shadow-sm' : 'text-mute hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/** Contenu commun au popover (desktop) et à la feuille (mobile). */
function PanelBody() {
  const { tab, setTab, closePanel, nouvelleConversation } = useAssistantPanel();

  return (
    <>
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-black/[0.06] px-3 py-2.5">
        <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1" role="tablist" aria-label="Assistant">
          <Onglet
            actif={tab === 'conversation'}
            label="Conversation"
            onClick={() => setTab('conversation')}
          />
          <Onglet
            actif={tab === 'historique'}
            label="Historique"
            onClick={() => setTab('historique')}
          />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={nouvelleConversation}
            aria-label="Nouvelle conversation"
            title="Nouvelle conversation"
            className="flex size-8 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <MessageSquarePlus size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={closePanel}
            aria-label="Fermer l'assistant"
            className="flex size-8 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {tab === 'conversation' ? <Conversation /> : <Historique />}
    </>
  );
}

/**
 * Bouton Assistant + son panneau. Popover ancré sous le bouton sur desktop —
 * la page reste visible et utilisable derrière. Feuille remontant du bas sur
 * mobile.
 */
export default function AssistantPanel({
  variant = 'desktop',
  className = '',
}: {
  /** Deux boutons dans la TopBar, une seule surface ouverte : celle du bon gabarit. */
  variant?: 'desktop' | 'mobile';
  className?: string;
}) {
  const { open, openPanel, closePanel } = useAssistantPanel();
  const rootRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const porteLaSurface = variant === (mobile ? 'mobile' : 'desktop');

  useEffect(() => {
    if (!open || mobile || !porteLaSurface) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closePanel();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, mobile, porteLaSurface, closePanel]);

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-expanded={open}
        aria-label="Assistant"
        title="Assistant"
        className={`flex size-11 items-center justify-center rounded-full transition-colors md:size-9 md:rounded-lg ${
          open
            ? 'bg-primary-50 text-primary-600'
            : 'text-mute hover:bg-black/[0.04] hover:text-ink'
        }`}
      >
        <Sparkles size={18} strokeWidth={2} aria-hidden />
      </button>

      {open && !mobile && porteLaSurface ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[130] flex flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-clay-lg"
          style={{ width: PANEL_W, height: PANEL_H, maxHeight: 'calc(100dvh - 96px)' }}
          role="dialog"
          aria-label="Assistant"
        >
          <PanelBody />
        </div>
      ) : null}

      {open && mobile && porteLaSurface ? (
        <>
          <button
            type="button"
            aria-label="Fermer l'assistant"
            onClick={closePanel}
            className="animate-app-scrim fixed inset-0 z-[125] bg-[rgba(21,32,47,0.28)]"
          />
          <div
            className="animate-app-sheet fixed inset-x-0 bottom-0 z-[130] flex flex-col overflow-hidden rounded-t-2xl bg-white shadow-clay-lg"
            style={{ height: '80dvh' }}
            role="dialog"
            aria-modal="true"
            aria-label="Assistant"
          >
            <PanelBody />
          </div>
        </>
      ) : null}
    </div>
  );
}
