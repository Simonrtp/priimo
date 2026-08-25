'use client';

import type { ReactNode } from 'react';
import { FIELD } from '@/lib/today/field';
import type { TodayCard } from '@/lib/today/cards';
import { tapProps } from './tap';

export function MaSemaine({
  notes,
  contacts,
  immeubles,
  weekNoteGoal,
}: {
  notes: number;
  contacts: number;
  immeubles: number;
  weekNoteGoal: number;
}) {
  const ratio = weekNoteGoal <= 0 ? 0 : Math.min(1, notes / weekNoteGoal);
  const reached = notes >= weekNoteGoal;

  return (
    <section className="mx-4 mb-2 rounded-[14px] px-3 py-2.5" style={{ backgroundColor: FIELD.creme }}>
      <p className="text-pretty" style={{ color: FIELD.ardoise, fontSize: 12.5, lineHeight: 1.4 }}>
        Cette semaine · {notes === 1 ? '1 note' : `${notes} notes`} ·{' '}
        {contacts === 1 ? '1 contact' : `${contacts} contacts`} ·{' '}
        {immeubles === 1 ? '1 immeuble enrichi' : `${immeubles} immeubles enrichis`}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/[0.06]" aria-hidden>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(ratio * 100)}%`,
            backgroundColor: reached ? FIELD.vert : FIELD.ardoise,
          }}
        />
      </div>
    </section>
  );
}

export function TermineBlock({
  items,
  expanded,
  onToggle,
}: {
  items: readonly { key: string; headline: string; at: string }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="mx-4 overflow-hidden rounded-[16px]" style={{ backgroundColor: FIELD.vertPastel }}>
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between px-4 py-2 text-left"
        aria-expanded={expanded}
        {...tapProps(onToggle)}
      >
        <span className="font-semibold text-text-strong" style={{ fontSize: 14 }}>
          Terminé · {items.length}
        </span>
        <span className="text-[12.5px] text-text-muted">{expanded ? 'Replier' : 'Voir'}</span>
      </button>
      {expanded ? (
        items.length === 0 ? (
          <p className="px-4 pb-3 text-pretty text-text-muted" style={{ fontSize: 13 }}>
            Rien de validé pour l’instant.
          </p>
        ) : (
          <ul className="px-4 pb-3">
            {items.map((item) => (
              <li key={item.key} className="flex items-baseline justify-between gap-3 py-1">
                <p className="min-w-0 truncate text-pretty text-text line-through decoration-black/30" style={{ fontSize: 13.5 }}>
                  {item.headline}
                </p>
                <p className="flex-shrink-0 tabular-nums text-text-subtle" style={{ fontSize: 12 }}>
                  {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.at))}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

export function ConfirmDoneSheet({
  open,
  headline,
  onClose,
  onConfirm,
}: {
  open: boolean;
  headline: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Confirmer">
      <button type="button" className="absolute inset-0 bg-[rgba(21,32,47,0.35)]" aria-label="Fermer" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface px-4 pt-3"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <h2 className="text-balance px-1 pb-1 font-semibold text-text-strong" style={{ fontSize: 16 }}>
          Terminer cette action ?
        </h2>
        <p className="px-1 pb-3 text-pretty text-text-muted" style={{ fontSize: 14 }}>
          {headline}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl font-semibold text-white"
            style={{ backgroundColor: FIELD.vert, fontSize: 15 }}
            {...tapProps(onConfirm)}
          >
            Terminer
          </button>
          <button
            type="button"
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl font-semibold"
            style={{ backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise, fontSize: 15 }}
            {...tapProps(onClose)}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProspectionSection({
  cards,
  renderCard,
}: {
  cards: readonly TodayCard[];
  renderCard: (card: TodayCard) => ReactNode;
}) {
  if (cards.length === 0) return null;
  return (
    <section className="px-4">
      <h2 className="mb-2 font-semibold text-text-muted" style={{ fontSize: 13 }}>
        Prospection · {cards.length} adresse{cards.length > 1 ? 's' : ''}
      </h2>
      <ul className="flex flex-col gap-2">{cards.map((card) => <li key={card.key}>{renderCard(card)}</li>)}</ul>
    </section>
  );
}

export function SnoozeSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: 'demain' | 'trois_jours' | 'semaine') => void;
}) {
  if (!open) return null;

  const options: { kind: 'demain' | 'trois_jours' | 'semaine'; label: string }[] = [
    { kind: 'demain', label: 'Demain' },
    { kind: 'trois_jours', label: 'Dans 3 jours' },
    { kind: 'semaine', label: 'La semaine prochaine' },
  ];

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Reporter">
      <button type="button" className="absolute inset-0 bg-[rgba(21,32,47,0.35)]" aria-label="Fermer" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface px-4 pt-3"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <h2 className="text-balance px-1 pb-2 font-semibold text-text-strong" style={{ fontSize: 16 }}>
          Reporter
        </h2>
        <ul className="flex flex-col gap-2">
          {options.map((opt) => (
            <li key={opt.kind}>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center rounded-xl px-4 text-left font-semibold text-text-strong"
                style={{ backgroundColor: FIELD.ardoisePastel, fontSize: 15 }}
                {...tapProps(() => onPick(opt.kind))}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
