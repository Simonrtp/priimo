'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import {
  addMonths,
  buildMonthCells,
  formatDatePickerLabel,
  isoDate,
  parseIsoDate,
  startOfMonth,
} from '@/lib/ui/date-picker';

const SLATE = '#3D5A80';

const WEEKDAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'] as const;
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

type DatePickerFieldProps = {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  'aria-label'?: string;
  disabled?: boolean;
  variant?: 'default' | 'compact';
  placeholder?: string;
  className?: string;
  /** Empêche la ligne contact de s’ouvrir au clic. */
  stopPropagation?: boolean;
};

const triggerDefault =
  'flex w-full min-w-0 items-center gap-2 rounded-2xl border border-black/[0.10] bg-surface px-3.5 py-2.5 text-left text-text outline-none transition-colors hover:border-black/[0.14] focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50';

const triggerCompact =
  'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-black/[0.10] bg-white px-3 py-0 text-left text-text-muted outline-none transition-colors hover:border-black/[0.14] hover:bg-[#FFF7F0] focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50';

export default function DatePickerField({
  id,
  value,
  onChange,
  'aria-label': ariaLabel = 'Date de relance',
  disabled = false,
  variant = 'default',
  placeholder,
  className = '',
  stopPropagation = false,
}: DatePickerFieldProps) {
  const compact = variant === 'compact';
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const todayIso = isoDate(new Date());
  const selected = value ? parseIsoDate(value) : null;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));

  const close = useCallback(() => setOpen(false), []);
  useOutsideDismiss(open, close, rootRef);

  useEffect(() => {
    if (!open) return;
    const d = value ? parseIsoDate(value) : null;
    setViewMonth(startOfMonth(d ?? new Date()));
  }, [open, value]);

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const label =
    placeholder ??
    formatDatePickerLabel(value, compact);

  function pick(iso: string) {
    onChange(iso);
    close();
  }

  function onTriggerClick(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    if (!disabled) setOpen((v) => !v);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={onTriggerClick}
        className={compact ? triggerCompact : triggerDefault}
        style={{ fontSize: compact ? 12 : 14 }}
      >
        <CalendarDays
          size={compact ? 13 : 16}
          strokeWidth={2}
          className="flex-shrink-0"
          style={{ color: value ? SLATE : undefined }}
          aria-hidden
        />
        <span className={`min-w-0 truncate ${value ? 'font-medium text-text' : ''}`}>{label}</span>
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel}
          className={`absolute z-50 mt-1.5 w-[17.5rem] overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-clay-lg ${
            compact ? 'right-0' : 'left-0'
          }`}
          onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        >
          <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-3 py-2.5">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronLeft size={16} strokeWidth={2.2} aria-hidden />
            </button>
            <p className="text-center text-[13px] font-semibold capitalize text-text-strong">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ChevronRight size={16} strokeWidth={2.2} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 px-2 pt-2">
            {WEEKDAYS.map((d) => (
              <span
                key={d}
                className="pb-1 text-center text-[10px] font-semibold uppercase text-text-subtle"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
            {cells.map(({ iso, inMonth }) => {
              const isSelected = value === iso;
              const isToday = iso === todayIso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!inMonth}
                  onClick={() => inMonth && pick(iso)}
                  className={`flex size-8 items-center justify-center rounded-lg text-[12.5px] tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                    !inMonth
                      ? 'cursor-default text-transparent'
                      : isSelected
                        ? 'font-semibold text-white'
                        : isToday
                          ? 'font-medium text-text ring-1 ring-inset ring-[#3D5A80]/35 hover:bg-[#FFF7F0]'
                          : 'text-text hover:bg-[#FFF7F0]'
                  }`}
                  style={isSelected ? { background: SLATE } : undefined}
                  aria-label={
                    inMonth
                      ? new Intl.DateTimeFormat('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }).format(parseIsoDate(iso)!)
                      : undefined
                  }
                  aria-pressed={isSelected}
                >
                  {inMonth ? iso.slice(8, 10).replace(/^0/, '') : ''}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                close();
              }}
              className="min-h-9 rounded-lg px-2 text-[12.5px] font-medium text-text-muted transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={() => pick(todayIso)}
              className="min-h-9 rounded-lg px-2 text-[12.5px] font-semibold transition-colors hover:bg-[#FFF7F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ color: SLATE }}
            >
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
