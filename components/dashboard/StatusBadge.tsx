'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { LeadStatus } from '@/types/lead';
import { STATUS_META } from '@/lib/lead-meta';
import StatusSelect from './StatusSelect';

interface StatusBadgeProps {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

const MENU_MIN_WIDTH = 170;
const MENU_GAP = 6;

export default function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function place() {
      const trigger = buttonRef.current;
      const menu = menuRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuHeight = menu?.offsetHeight ?? 240;
      const menuWidth = menu?.offsetWidth ?? MENU_MIN_WIDTH;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + MENU_GAP && rect.top > spaceBelow;

      const top = openUp ? rect.top - menuHeight - MENU_GAP : rect.bottom + MENU_GAP;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );

      setMenuPos({ top, left });
    }

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const meta = STATUS_META[status];

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[32px] items-center gap-1.5 rounded-full bg-black/[0.06] font-medium text-ink transition-opacity duration-fluid-subtle ease-in-out hover:opacity-80"
        style={{ fontSize: 11, padding: '4px 10px 4px 8px', letterSpacing: '0.01em' }}
      >
        <span
          className="flex-shrink-0 rounded-full"
          style={{ width: 7, height: 7, backgroundColor: meta.dotColor }}
          aria-hidden
        />
        {meta.label}
        <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120]"
              style={
                menuPos
                  ? { top: menuPos.top, left: menuPos.left }
                  : { top: -9999, left: -9999, visibility: 'hidden' as const }
              }
            >
              <StatusSelect
                currentStatus={status}
                onChange={(s) => {
                  onChange(s);
                  setOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
