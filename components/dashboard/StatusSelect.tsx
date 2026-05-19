'use client';

import type { LeadStatus } from '@/types/lead';
import { STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';

interface StatusSelectProps {
  currentStatus: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

export default function StatusSelect({ currentStatus, onChange }: StatusSelectProps) {
  return (
    <div
      className="absolute right-0 top-full z-[60] mt-1.5 min-w-[170px] rounded-xl border border-black/10 bg-white p-1 shadow-lg ring-1 ring-black/[0.04]"
      style={{ backgroundColor: '#ffffff' }}
    >
      {STATUS_ORDER.map((value) => {
        const meta = STATUS_META[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors duration-100 ${
              value === currentStatus
                ? 'bg-black/[0.04] text-ink font-medium'
                : 'text-mute hover:bg-black/[0.04] hover:text-ink'
            }`}
          >
            <span
              className="rounded-full flex-shrink-0"
              style={{ width: 7, height: 7, backgroundColor: meta.dotColor }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
