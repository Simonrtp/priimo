'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Affiche un champ de filtre dans le menu (listes longues). */
  searchable?: boolean;
  searchPlaceholder?: string;
}

/** Aligné sur TextInput : même rayon, même bordure — pas de « pilule ». */
const defaultTriggerClass =
  'flex w-full min-w-[140px] items-center justify-between gap-2 rounded-xl border border-black/[0.10] bg-surface px-3 py-2.5 text-left text-[14px] text-text outline-none transition-[color,background-color,border-color,box-shadow] duration-fluid-subtle ease-in-out hover:border-black/[0.14] focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50';

const MENU_GAP = 6;

function normalizeQuery(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function Select({
  value,
  onChange,
  options,
  id,
  'aria-label': ariaLabel,
  disabled = false,
  className = '',
  triggerClassName = defaultTriggerClass,
  searchable = false,
  searchPlaceholder = 'Rechercher…',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchId = useId();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = normalizeQuery(query);
    return options.filter((o) => normalizeQuery(o.label).includes(needle));
  }, [options, query, searchable]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlighted(-1);
    setQuery('');
  }, []);

  const selectOption = useCallback(
    (next: string) => {
      onChange(next);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close],
  );

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - MENU_GAP - 8;
      const spaceAbove = r.top - MENU_GAP - 8;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(280, Math.max(160, openUp ? spaceAbove : spaceBelow));
      const top = openUp ? Math.max(8, r.top - maxHeight - MENU_GAP) : r.bottom + MENU_GAP;
      setMenuPos({
        top,
        left: r.left,
        width: Math.max(r.width, searchable ? 260 : r.width),
        maxHeight,
      });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, options.length, searchable, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : filtered.length > 0 ? 0 : -1);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open || !searchable) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | PointerEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    // La saisie dans le champ recherche ne doit pas être détournée.
    if (searchable && e.target === searchRef.current) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && highlighted >= 0 && filtered[highlighted]) {
        e.preventDefault();
        selectOption(filtered[highlighted].value);
        return;
      }
      return;
    }
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && highlighted >= 0 && filtered[highlighted]) {
          selectOption(filtered[highlighted].value);
        } else {
          setOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlighted((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setHighlighted(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlighted(filtered.length - 1);
        break;
      default:
        break;
    }
  };

  const listBody =
    filtered.length === 0 ? (
      <p className="px-3 py-3 text-[13.5px] text-text-muted">Aucun résultat</p>
    ) : (
      <ul id={listId} role="listbox" aria-label={ariaLabel} className="overflow-y-auto p-1">
        {filtered.map((option, index) => {
          const isSelected = option.value === value;
          const isHighlighted = index === highlighted;
          return (
            <li key={option.value || `empty-${index}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => selectOption(option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] transition-colors duration-fluid-subtle ease-in-out ${
                  isHighlighted || isSelected
                    ? 'bg-black/[0.04] text-text'
                    : 'text-text-muted hover:bg-black/[0.04] hover:text-text'
                } ${isSelected ? 'font-medium' : ''}`}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <Check size={14} strokeWidth={2.5} className="flex-shrink-0 text-accent-dark" aria-hidden />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );

  const list =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
            className="fixed z-[200] flex flex-col overflow-hidden rounded-xl border border-black/[0.10] bg-surface shadow-clay-lg"
          >
            {searchable ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.06] px-2.5 py-2">
                <Search size={15} strokeWidth={2} className="shrink-0 text-text-muted" aria-hidden />
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-subtle"
                />
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">{listBody}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={triggerClassName}
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`flex-shrink-0 text-text-muted transition-transform duration-fluid-subtle ease-in-out ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {list}
    </div>
  );
}
