'use client';

import type { Lead } from '@/types/lead';
import ScoreBadge from './ScoreBadge';
import StatusBadge from './StatusBadge';
import { getMainSignalLabel, formatPrice } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  onStatusChange: (status: Lead['status']) => void;
}

export default function LeadCard({ lead, onClick, onStatusChange }: LeadCardProps) {
  const purchaseYear = new Date(lead.purchaseDate).getFullYear();
  const mainSignal = getMainSignalLabel(lead);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E5E5E5] rounded-[8px] flex items-center gap-4 cursor-pointer hover:bg-[#F9FAFB] transition-colors duration-150"
      style={{ padding: '16px 20px', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)' }}
    >
      <ScoreBadge score={lead.score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 truncate" style={{ fontSize: '15px' }}>
            {lead.address}
          </span>
          {lead.lifeEvent && (
            <span
              className="flex-shrink-0 bg-red-50 text-red-700 font-medium rounded-[4px]"
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              {lead.lifeEvent === 'liquidation_pro' && '🔥 Liquidation pro'}
              {lead.lifeEvent === 'dissolution_sci' && '⚡ Dissolution SCI'}
              {lead.lifeEvent === 'cession_entreprise' && '🔄 Cession entreprise'}
            </span>
          )}
        </div>

        <p className="text-gray-600" style={{ fontSize: '13px' }}>
          {mainSignal} · {lead.propertyType} · {lead.surface} m²
        </p>

        <p className="text-gray-500 mt-0.5" style={{ fontSize: '12px' }}>
          Acheté en {purchaseYear} · {formatPrice(lead.purchasePrice)} €
        </p>
      </div>

      <StatusBadge status={lead.status} onChange={onStatusChange} />
    </div>
  );
}
