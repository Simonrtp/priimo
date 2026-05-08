'use client';

import { getStatusColor, getStatusLabel } from '@/lib/utils';
import type { LeadStatus } from '@/types/lead';

const statuses: LeadStatus[] = ['nouveau', 'contacté', 'intéressé', 'pas_intéressé'];

interface StatusSelectProps {
  currentStatus: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

export default function StatusSelect({ currentStatus, onChange }: StatusSelectProps) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E5E5E5] rounded-[8px] shadow-md p-1 min-w-[160px]">
      {statuses.map((s) => {
        const colors = getStatusColor(s);
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-[4px] text-[14px] text-gray-700 hover:bg-gray-50 text-left transition-colors duration-100 ${
              s === currentStatus ? 'bg-gray-50' : ''
            }`}
          >
            <span
              className="rounded-full flex-shrink-0"
              style={{ width: '8px', height: '8px', backgroundColor: colors.text }}
            />
            {getStatusLabel(s)}
          </button>
        );
      })}
    </div>
  );
}
