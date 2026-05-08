'use client';

import type { LeadStatus } from '@/types/lead';

const statuses: { value: LeadStatus; label: string; dot: string }[] = [
  { value: 'nouveau',       label: 'Nouveau',        dot: '#3D5A80' },
  { value: 'contacté',      label: 'Contacté',       dot: '#E8743C' },
  { value: 'intéressé',     label: 'Intéressé',      dot: '#059669' },
  { value: 'pas_intéressé', label: 'Pas intéressé',  dot: '#9CA3AF' },
];

interface StatusSelectProps {
  currentStatus: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

export default function StatusSelect({ currentStatus, onChange }: StatusSelectProps) {
  return (
    <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-black/8 rounded-xl shadow-soft p-1 min-w-[160px]">
      {statuses.map(({ value, label, dot }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors duration-100 ${
            value === currentStatus
              ? 'bg-black/[0.04] text-ink font-medium'
              : 'text-mute hover:bg-black/[0.04] hover:text-ink'
          }`}
        >
          <span
            className="rounded-full flex-shrink-0"
            style={{ width: 7, height: 7, backgroundColor: dot }}
          />
          {label}
        </button>
      ))}
    </div>
  );
}
