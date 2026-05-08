'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getStatusColor, getStatusLabel } from '@/lib/utils';
import type { LeadStatus } from '@/types/lead';
import StatusSelect from './StatusSelect';

interface StatusBadgeProps {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

export default function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const colors = getStatusColor(status);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-[6px] font-medium flex-shrink-0"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          padding: '4px 10px',
          fontSize: '12px',
        }}
      >
        {getStatusLabel(status)}
        <ChevronDown size={12} />
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
