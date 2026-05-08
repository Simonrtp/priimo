'use client';

import { Download, Map } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface ExportActionsProps {
  leads: Lead[];
}

const btnClass =
  'flex items-center gap-2 px-4 bg-white border border-[#E5E5E5] rounded-[6px] font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-150';

export default function ExportActions({ leads }: ExportActionsProps) {
  return (
    <div className="flex gap-3 mt-8">
      <button
        className={btnClass}
        style={{ padding: '10px 16px', fontSize: '14px' }}
        onClick={() => console.log('Export CSV', leads)}
      >
        <Download size={16} />
        Exporter en CSV
      </button>
      <button
        className={btnClass}
        style={{ padding: '10px 16px', fontSize: '14px' }}
        onClick={() => console.log('Open Google Maps', leads)}
      >
        <Map size={16} />
        Voir sur Google Maps
      </button>
    </div>
  );
}
