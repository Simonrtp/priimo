'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
}

const defaultTriggerClass =
  'flex w-full min-w-[140px] items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-3 py-2 text-left text-[13px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50';

export default function Select({
  value,
  onChange,
  options,
  id,
  'aria-label': ariaLabel,
  disabled = false,
  className = '',
  triggerClassName = defaultTriggerClass,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setHighlighted(-1);
  }, []);

  const selectOption = useCallback(
    (next: string) => {
      onChange(next);
      close();
    },
    [onChange, close],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open && highlighted >= 0) selectOption(options[highlighted].value);
        else setOpen(true);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setHighlighted((i) => Math.min(i + 1, options.length - 1));
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
        setHighlighted(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={triggerClassName}
      >
        <span className="truncate">{selected?.label ?? '—'}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`flex-shrink-0 text-mute transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-black/8 bg-white p-1 shadow-soft animate-fadeIn"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlighted;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => selectOption(option.value)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-100 ${
                    isHighlighted || isSelected
                      ? 'bg-black/[0.04] text-ink'
                      : 'text-mute hover:bg-black/[0.04] hover:text-ink'
                  } ${isSelected ? 'font-medium' : ''}`}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && <Check size={14} strokeWidth={2.5} className="flex-shrink-0 text-accent-dark" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
