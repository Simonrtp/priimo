'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Mic, PenLine, Search, Sparkles, Trash2, X } from 'lucide-react';
import { PriimoLogo } from '@/components/brand/PriimoLogo';
import type { AssistantSource, SourceKind } from '@/lib/assistant/collecte';
import { useUser } from '@/lib/hooks/useUser';
import { useAssistantPanel, type ChatMessage } from './AssistantPanelProvider';
import { useAssistantVoiceInput } from './useAssistantVoiceInput';

const PANEL_W = 420;
const PANEL_H = 560;

type Amorce = {
  label: string;
  /** Texte envoyé, ou début de phrase à compléter si `envoi` est faux. */
  question: string;
  envoi: boolean;
};

type FamilleAmorces = { titre: string; amorces: Amorce[] };

/**
 * Ce que l'assistant sait lire, famille par famille. Les quatre familles
 * correspondent exactement aux quatre collectes disponibles — aucune
 * suggestion ne promet une réponse que la base ne peut pas donner.
 *
 * Les formulations retenues tombent dans le routage déterministe : la
 * découverte guide vers les questions qui ne coûtent aucun appel.
 */
function famillesAmorces(codePostal: string | null): FamilleAmorces[] {
  const cp = codePostal ?? '';
  return [
    {
      titre: 'Une adresse',
      amorces: [
        { label: "Qu'est-ce qu'on sait sur…", question: "Qu'est-ce qu'on sait sur ", envoi: false },
        { label: "Qui s'occupe du…", question: "Qui s'occupe du ", envoi: false },
      ],
    },
    {
      titre: 'Une personne',
      amorces: [
        { label: 'Le dossier…', question: 'Le dossier ', envoi: false },
        { label: 'Des nouvelles de…', question: 'Des nouvelles de ', envoi: false },
      ],
    },
    {
      titre: 'Des acquéreurs',
      amorces: [
        cp
          ? { label: `Qui cherche dans le ${cp}`, question: `Qui cherche dans le ${cp} ?`, envoi: true }
          : { label: 'Qui cherche dans le…', question: 'Qui cherche dans le ', envoi: false },
        { label: 'Quels acquéreurs pour…', question: 'Quels acquéreurs pour ', envoi: false },
      ],
    },
    {
      titre: 'Votre activité',
      amorces: [
        { label: 'Combien de leads ce mois', question: 'Combien de leads ce mois ?', envoi: true },
        {
          label: "Qu'est-ce qu'on a fait cette semaine",
          question: "Qu'est-ce qu'on a fait cette semaine ?",
          envoi: true,
        },
        { label: 'Que dois-je faire aujourd’hui', question: "Que dois-je faire aujourd'hui ?", envoi: true },
      ],
    },
  ];
}

/** Pastille discrète par type de ligne — pas de chip, juste un repère. */
const TEINTE_KIND: Record<SourceKind, string> = {
  lead: 'var(--primary-600)',
  contact: 'var(--info)',
  bien: 'var(--success)',
  note: 'var(--warning)',
  interaction: 'var(--text-subtle)',
};

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
function Sources({
  sources,
  onNavigate,
}: {
  sources: readonly AssistantSource[];
  onNavigate: () => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
        Sources · {sources.length}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {sources.map((s) => {
          const meta = [s.typeLabel, formatDate(s.date), s.auteur].filter(Boolean).join(' · ');
          const inner = (
            <>
              <span
                className="mt-[7px] size-1.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: TEINTE_KIND[s.kind] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-text-strong">
                  {s.titre}
                </span>
                <span className="block truncate text-[11px] text-text-muted">{meta}</span>
              </span>
            </>
          );
          const base =
            'flex items-start gap-2 rounded-clay border border-primary-100 bg-surface-2 px-2.5 py-2';
          return (
            <li key={`${s.kind}-${s.id}`}>
              {s.href ? (
                <Link
                  href={s.href}
                  onClick={onNavigate}
                  className={`${base} transition-all duration-150 hover:-translate-y-px hover:shadow-clay-sm`}
                >
                  {inner}
                </Link>
              ) : (
                <div className={base}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PointsDeFrappe() {
  return (
    <span className="inline-flex items-center gap-1 py-1.5" aria-label="Réponse en cours">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="assistant-dot size-1.5 rounded-full bg-primary-400"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}

function Bulle({ message, onNavigate }: { message: ChatMessage; onNavigate: () => void }) {
  if (message.role === 'user') {
    return (
      <div className="assistant-ligne flex justify-end">
        <p className="max-w-[85%] text-pretty rounded-clay rounded-br-md bg-primary-50 px-3 py-2 text-[13.5px] text-text-strong shadow-clay-sm">
          {message.contenu}
        </p>
      </div>
    );
  }
  return (
    <div className="assistant-ligne">
      {message.contenu ? (
        <p
          className="text-pretty whitespace-pre-wrap text-[13.5px] text-text"
          style={{ lineHeight: 1.6 }}
        >
          {message.contenu}
        </p>
      ) : (
        <PointsDeFrappe />
      )}
      <Sources sources={message.sources} onNavigate={onNavigate} />
    </div>
  );
}

function Amorces({
  familles,
  onPick,
}: {
  familles: readonly FamilleAmorces[];
  onPick: (question: string, envoi: boolean) => void;
}) {
  return (
    <div className="mt-5 flex w-full flex-col gap-3.5 text-left">
      {familles.map((famille) => (
        <section key={famille.titre}>
          <p className="px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
            {famille.titre}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {famille.amorces.map((a) => (
              <li key={a.label}>
                <button
                  type="button"
                  onClick={() => onPick(a.question, a.envoi)}
                  className="rounded-clay border border-primary-100 bg-surface px-2.5 py-1.5 text-[12px] font-medium text-text transition-all duration-150 hover:-translate-y-px hover:border-primary-200 hover:text-text-strong hover:shadow-clay-sm"
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Conversation() {
  const { messages, streaming, draft, setDraft, envoyer, closePanel } = useAssistantPanel();
  const { agency } = useUser();
  const saisieId = useId();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const familles = useMemo(
    () => famillesAmorces(agency.codes_postaux?.[0] ?? null),
    [agency.codes_postaux],
  );
  const { listening, transcribing, toggle: toggleVoice, voiceLabel } = useAssistantVoiceInput((text) => {
    void envoyer(text);
  });

  const inputDisabled = streaming || transcribing;
  const placeholder = listening
    ? 'Parlez…'
    : transcribing
      ? 'Mise en texte…'
      : 'Votre question';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pick = (question: string, envoi: boolean) => {
    if (envoi) {
      void envoyer(question);
      return;
    }
    setDraft(question);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center px-1 pt-1 text-center">
            <span
              className="flex size-14 items-center justify-center rounded-clay-lg bg-surface shadow-clay"
              aria-hidden
            >
              <PriimoLogo variant="mark" className="size-8" />
            </span>
            <p className="mt-3.5 font-display text-[15px] font-semibold text-text-strong">
              Posez une question sur votre base
            </p>
            <p className="mt-1.5 max-w-[17rem] text-pretty text-[12.5px] leading-relaxed text-text-muted">
              Chaque réponse ne cite que vos données. Voici ce que je sais lire.
            </p>
            <Amorces familles={familles} onPick={pick} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((m) => (
              <Bulle key={m.id} message={m} onNavigate={closePanel} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void envoyer(draft);
        }}
        className="flex-shrink-0 px-3 pb-3 pt-1"
      >
        <div className="flex items-end gap-2 rounded-clay bg-bg-subtle px-3 py-2 shadow-clay-inset transition-shadow focus-within:ring-2 focus-within:ring-primary-200">
          <button
            type="button"
            onClick={toggleVoice}
            disabled={inputDisabled}
            aria-label={voiceLabel}
            title={voiceLabel}
            aria-pressed={listening}
            className={`mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-[11px] transition-colors disabled:opacity-40 ${
              listening
                ? 'bg-primary-600 text-white shadow-clay-primary'
                : 'text-text-muted hover:bg-primary-50 hover:text-primary-600'
            }`}
          >
            <Mic size={16} strokeWidth={2.2} aria-hidden />
          </button>
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
            placeholder={placeholder}
            disabled={inputDisabled}
            className="max-h-24 min-h-[26px] w-full flex-1 resize-none self-center bg-transparent py-0.5 text-[13.5px] text-text-strong outline-none placeholder:text-text-subtle disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={inputDisabled || draft.trim().length === 0}
            aria-label="Envoyer"
            className="flex size-8 shrink-0 items-center justify-center rounded-[11px] bg-primary-600 text-white shadow-clay-primary transition-all duration-150 enabled:hover:-translate-y-px disabled:bg-primary-200 disabled:shadow-none"
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
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={rechercheHistorique}
            onChange={(e) => setRechercheHistorique(e.target.value)}
            placeholder="Rechercher dans vos conversations"
            aria-label="Rechercher dans vos conversations"
            className="w-full rounded-clay bg-bg-subtle py-2.5 pl-9 pr-3 text-[13px] text-text-strong shadow-clay-inset outline-none transition-shadow placeholder:text-text-subtle focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {historiqueLoading && conversations.length === 0 ? (
          <p className="px-1 text-[13px] text-text-muted">Chargement…</p>
        ) : conversations.length === 0 ? (
          <p className="px-1 text-pretty text-[13px] text-text-muted">
            {rechercheHistorique
              ? 'Aucune conversation ne correspond.'
              : 'Vos conversations apparaîtront ici.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void reprendre(c.id)}
                  className="min-w-0 flex-1 rounded-clay px-2.5 py-2 text-left transition-colors hover:bg-primary-50"
                >
                  <span className="block truncate text-[13px] font-medium text-text-strong">
                    {c.titre}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-text-subtle">
                    {formatDateHeure(c.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void supprimer(c.id)}
                  aria-label={`Supprimer « ${c.titre} »`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-text-subtle transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
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

/** Segmenté clay : piste creusée, pastille en relief sur l'onglet actif. */
function Onglets() {
  const { tab, setTab } = useAssistantPanel();
  const items = [
    { id: 'conversation' as const, label: 'Conversation' },
    { id: 'historique' as const, label: 'Historique' },
  ];
  return (
    <div
      className="flex gap-1 rounded-clay bg-bg-subtle p-1 shadow-clay-inset"
      role="tablist"
      aria-label="Assistant"
    >
      {items.map((item) => {
        const actif = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={actif}
            onClick={() => setTab(item.id)}
            className={`min-h-[32px] flex-1 rounded-[12px] px-3 text-[12.5px] font-semibold transition-all duration-150 ${
              actif
                ? 'bg-surface text-text-strong shadow-clay-sm'
                : 'text-text-muted hover:text-text-strong'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ActionIcone({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-[10px] text-text-subtle transition-colors hover:bg-primary-50 hover:text-primary-600"
    >
      {children}
    </button>
  );
}

/** Contenu commun au popover (desktop) et à la feuille (mobile). */
function PanelBody({ poignee = false }: { poignee?: boolean }) {
  const { tab, closePanel, nouvelleConversation } = useAssistantPanel();

  return (
    <>
      {poignee ? (
        <div className="flex flex-shrink-0 justify-center pt-2" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-primary-100" />
        </div>
      ) : null}

      <div className="flex flex-shrink-0 items-center gap-2 px-3 pb-2.5 pt-3">
        <span
          className="flex size-7 items-center justify-center rounded-[10px] bg-surface shadow-clay-sm ring-1 ring-primary-100"
          aria-hidden
        >
          <PriimoLogo variant="mark" className="size-4" />
        </span>
        <p className="font-display text-[14px] font-semibold tracking-[-0.01em] text-text-strong">
          Assistant
        </p>
        <div className="ml-auto flex items-center gap-0.5">
          <ActionIcone label="Nouvelle conversation" onClick={nouvelleConversation}>
            <PenLine size={15} strokeWidth={2} aria-hidden />
          </ActionIcone>
          <ActionIcone label="Fermer l'assistant" onClick={closePanel}>
            <X size={16} strokeWidth={2} aria-hidden />
          </ActionIcone>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pb-2">
        <Onglets />
      </div>

      <div className="mx-3 h-px flex-shrink-0 bg-primary-100" aria-hidden />

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
  const { open, openPanel, closePanel, streaming } = useAssistantPanel();
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
      {/* Halo : une réponse arrive alors que le panneau est fermé. */}
      {streaming && !open ? (
        <span
          className="assistant-halo pointer-events-none absolute -inset-1 rounded-[18px] bg-primary-200"
          aria-hidden
        />
      ) : null}

      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-expanded={open}
        aria-label="Assistant"
        title="Assistant"
        className={`relative flex size-11 items-center justify-center rounded-[14px] transition-all duration-150 md:size-9 md:rounded-[13px] ${
          open
            ? 'bg-primary-600 text-white shadow-clay-primary'
            : 'bg-surface text-primary-600 shadow-clay-sm hover:-translate-y-px hover:shadow-clay active:translate-y-0 active:shadow-clay-pressed'
        }`}
      >
        <Sparkles size={18} strokeWidth={2} aria-hidden />
      </button>

      {open && !mobile && porteLaSurface ? (
        <div
          className="assistant-pop absolute right-0 top-[calc(100%+10px)] z-[130] flex flex-col overflow-hidden rounded-clay-lg border border-primary-100 bg-surface shadow-clay-lg"
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
            className="animate-app-scrim fixed inset-0 z-[125] bg-[rgba(30,27,75,0.32)] backdrop-blur-[2px]"
          />
          <div
            className="animate-app-sheet fixed inset-x-0 bottom-0 z-[130] flex flex-col overflow-hidden rounded-t-clay-lg bg-surface shadow-clay-lg"
            style={{ height: '80dvh' }}
            role="dialog"
            aria-modal="true"
            aria-label="Assistant"
          >
            <PanelBody poignee />
          </div>
        </>
      ) : null}
    </div>
  );
}
