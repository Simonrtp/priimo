'use client';

import type { LeadStatus } from '@/types/lead';
import { STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';

interface StatusSelectProps {
  currentStatus: LeadStatus;
  onChange: (status: LeadStatus) => void;
  className?: string;
}

export default function StatusSelect({ currentStatus, onChange, className = '' }: StatusSelectProps) {
  return (
    <div
      className={`min-w-[170px] rounded-xl border border-black/10 bg-white p-1 shadow-lg ring-1 ring-black/[0.04] ${className}`}
    >
      {STATUS_ORDER.map((value) => {
        const meta = STATUS_META[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-fluid-subtle ease-in-out ${
              value === currentStatus
                ? 'bg-black/[0.04] font-medium text-ink'
                : 'text-mute hover:bg-black/[0.04] hover:text-ink'
            }`}
          >
            <span
              className="flex-shrink-0 rounded-full"
              style={{ width: 7, height: 7, backgroundColor: meta.dotColor }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
