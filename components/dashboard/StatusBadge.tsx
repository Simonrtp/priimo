'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LeadStatus } from '@/types/lead';
import StatusSelect from './StatusSelect';

const statusStyles: Record<LeadStatus, string> = {
  nouveau:       'bg-blue/10 text-blue-dark',
  contacté:      'bg-accent/10 text-accent-dark',
  intéressé:     'bg-emerald-500/10 text-emerald-700',
  pas_intéressé: 'bg-black/[0.07] text-mute',
  rdv_pris:      'bg-violet-500/10 text-violet-800',
};

const statusLabels: Record<LeadStatus, string> = {
  nouveau:       'Nouveau',
  contacté:      'Contacté',
  intéressé:     'Intéressé',
  pas_intéressé: 'Pas intéressé',
  rdv_pris:      'RDV pris',
};

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

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-full font-medium transition-opacity duration-150 hover:opacity-80 ${statusStyles[status]}`}
        style={{ fontSize: 11, padding: '3px 10px 3px 10px', letterSpacing: '0.01em' }}
      >
        {statusLabels[status]}
        <ChevronDown size={10} strokeWidth={2.5} />
      </button>
      {open && (
        <StatusSelect
          currentStatus={status}
          onChange={(s) => { onChange(s); setOpen(false); }}
        />
      )}
    </div>
  );
}
