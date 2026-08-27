'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { LeadStage } from '@/types/lead';

export default function LeadStageBadge({
  stage,
  stages,
  onChange,
}: {
  stage: LeadStage | null;
  stages: readonly LeadStage[];
  onChange: (stageId: string) => void;
}) {
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
      const menuWidth = Math.max(menu?.offsetWidth ?? 170, 170);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 6 && rect.top > spaceBelow;
      const top = openUp ? rect.top - menuHeight - 6 : rect.bottom + 6;
      const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
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

  const label = stage?.libelle ?? 'Sans étape';

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-black/[0.06] px-3 font-medium text-ink transition-opacity duration-150 hover:opacity-80"
        style={{ fontSize: 12.5 }}
      >
        {label}
        <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] min-w-[170px] overflow-hidden rounded-xl border border-black/[0.08] bg-white py-1 shadow-clay-lg"
              style={
                menuPos
                  ? { top: menuPos.top, left: menuPos.left }
                  : { top: -9999, left: -9999, visibility: 'hidden' as const }
              }
              role="listbox"
            >
              {stages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === stage?.id}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className={`flex w-full px-3 py-2 text-left text-[13px] ${
                    item.id === stage?.id ? 'font-semibold text-text-strong' : 'text-text'
                  } hover:bg-black/[0.04]`}
                >
                  {item.libelle}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
