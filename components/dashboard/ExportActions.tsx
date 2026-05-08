'use client';

import { Download, Map } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface ExportActionsProps { leads: Lead[] }

export default function ExportActions({ leads }: ExportActionsProps) {
  const btn = 'flex items-center gap-2 border border-black/10 rounded-xl bg-white text-mute hover:text-ink hover:border-black/20 hover:bg-black/[0.02] transition-all duration-150 font-medium';

  return (
    <div className="flex gap-3 mt-6">
      <button
        className={btn}
        style={{ padding: '9px 16px', fontSize: 13 }}
        onClick={() => console.log('Export CSV', leads)}
      >
        <Download size={14} strokeWidth={1.8} />
        Exporter en CSV
      </button>
      <button
        className={btn}
        style={{ padding: '9px 16px', fontSize: 13 }}
        onClick={() => console.log('Open Google Maps', leads)}
      >
        <Map size={14} strokeWidth={1.8} />
        Voir sur Google Maps
      </button>
    </div>
  );
}
