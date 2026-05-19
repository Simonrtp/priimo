'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LeadStatus } from '@/types/lead';
import { STATUS_META } from '@/lib/lead-meta';
import StatusSelect from './StatusSelect';

interface StatusBadgeProps {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

export default function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Remonte la ligne au-dessus des cartes suivantes (sinon le menu passe sous les autres lignes).
  useEffect(() => {
    const row = ref.current?.closest('[data-lead-card]');
    if (!row || !(row instanceof HTMLElement)) return;
    if (open) {
      row.style.zIndex = '40';
      row.style.position = 'relative';
    } else {
      row.style.zIndex = '';
      row.style.position = '';
    }
    return () => {
      row.style.zIndex = '';
      row.style.position = '';
    };
  }, [open]);

  const meta = STATUS_META[status];

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-full font-medium transition-opacity duration-150 hover:opacity-80 ${meta.chipClass}`}
        style={{ fontSize: 11, padding: '3px 10px 3px 10px', letterSpacing: '0.01em' }}
      >
        {meta.label}
        <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
      </button>
      {open && (
        <StatusSelect
          currentStatus={status}
          onChange={(s) => {
            onChange(s);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
