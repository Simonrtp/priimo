'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { armPointerShield } from '@/lib/ui/pointer-guard';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  /** Rend l'entrée rouge : suppression, abandon. */
  destructive?: boolean;
}

/**
 * Le menu discret des actions secondaires. Chaque écran n'expose que deux
 * boutons ; tout le reste vit ici.
 */
export default function ActionMenu({
  items,
  label = 'Autres actions',
}: {
  items: ActionMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useOutsideDismiss(open, close, rootRef);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className="flex size-11 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-10 z-30 w-max min-w-[180px] max-w-[min(260px,calc(100vw-2rem))] overflow-hidden rounded-clay border border-black/[0.08] bg-surface py-1 shadow-clay-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                armPointerShield();
                item.onSelect();
              }}
              className={`block w-full px-4 py-2.5 text-left text-[13.5px] transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none ${
                item.destructive ? 'text-danger' : 'text-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
