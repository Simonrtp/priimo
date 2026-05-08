'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { getScoreColor, formatDate, formatPrice } from '@/lib/utils';
import StatusBadge from './StatusBadge';

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
}

const signalMeta: Record<string, { label: string; points: string; color: string }> = {
  liquidation_pro: { label: 'Liquidation professionnelle détectée', points: '+35', color: '#EF4444' },
  dissolution_sci: { label: 'Dissolution SCI détectée', points: '+35', color: '#EF4444' },
  cession_entreprise: { label: "Cession d'entreprise détectée", points: '+30', color: '#EF4444' },
  dpe_recent: { label: 'DPE refait récemment', points: '+20', color: '#F59E0B' },
  detention_longue: { label: 'Détention de longue durée', points: '+15', color: '#3B82F6' },
  plus_value: { label: 'Plus-value élevée détectée', points: '+20', color: '#8B5CF6' },
  zone_rotation: { label: 'Zone à forte rotation', points: '+10', color: '#10B981' },
};

export default function LeadDrawer({ lead, onClose, onUpdateLead }: LeadDrawerProps) {
  const [noteValue, setNoteValue] = useState('');

  useEffect(() => {
    setNoteValue('');
  }, [lead?.id]);

  if (!lead) return null;

  const colors = getScoreColor(lead.score);
  const plusValue = ((lead.estimatedValue / lead.purchasePrice - 1) * 100).toFixed(0);

  const detailRows = [
    { label: 'Type', value: lead.propertyType },
    { label: 'Surface', value: `${lead.surface} m²` },
    { label: 'Acheté le', value: formatDate(lead.purchaseDate) },
    { label: "Prix d'achat", value: `${formatPrice(lead.purchasePrice)} €` },
    { label: 'Valeur estimée', value: `${formatPrice(lead.estimatedValue)} €` },
    { label: 'Plus-value', value: `+${plusValue}%` },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
        onClick={onClose}
      />

      <aside
        className="fixed right-0 top-0 bottom-0 bg-white z-50 overflow-y-auto animate-drawer-in"
        style={{
          width: '440px',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        }}
      >
        <div className="p-6">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 transition-colors duration-150 mb-6"
          >
            <X size={20} />
          </button>

          <p className="font-semibold tracking-tight text-gray-900 mb-4" style={{ fontSize: '20px' }}>
            {lead.address}
          </p>

          <div
            className="bg-gray-100 rounded-[8px] flex items-center justify-center mb-6"
            style={{ height: '180px' }}
          >
            <span className="font-medium text-gray-400" style={{ fontSize: '13px' }}>
              🗺️ Carte à venir
            </span>
          </div>

          <div className="mb-6">
            <p className="font-medium uppercase tracking-wider text-gray-500 mb-2" style={{ fontSize: '12px' }}>
              Score
            </p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="font-bold leading-none" style={{ fontSize: '36px', color: colors.text }}>
                {lead.score}
              </span>
              <span className="text-gray-500" style={{ fontSize: '16px' }}>/100</span>
            </div>
            <div className="rounded-full overflow-hidden bg-gray-200" style={{ height: '6px' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${lead.score}%`, backgroundColor: colors.dot }}
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="font-semibold text-gray-900 mb-3" style={{ fontSize: '16px' }}>
              Signaux détectés
            </p>
            {lead.signalType.map((signal) => {
              const info = signalMeta[signal];
              if (!info) return null;
              return (
                <div key={signal} className="flex items-center gap-3 mb-2">
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{ width: '8px', height: '8px', backgroundColor: info.color }}
                  />
                  <span className="flex-1 text-gray-700" style={{ fontSize: '14px' }}>
                    {info.label}
                  </span>
                  <span className="font-medium text-gray-500" style={{ fontSize: '12px' }}>
                    {info.points}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mb-6">
            <p className="font-semibold text-gray-900 mb-3" style={{ fontSize: '16px' }}>
              Détails du bien
            </p>
            <div className="grid grid-cols-2 gap-3">
              {detailRows.map(({ label, value }) => (
                <div key={label}>
                  <p className="text-gray-500" style={{ fontSize: '12px' }}>
                    {label}
                  </p>
                  <p className="font-medium text-gray-900" style={{ fontSize: '14px' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="font-medium uppercase tracking-wider text-gray-500 mb-2" style={{ fontSize: '12px' }}>
              Statut
            </p>
            <StatusBadge
              status={lead.status}
              onChange={(s) => onUpdateLead({ ...lead, status: s })}
            />
          </div>

          <div className="mb-6">
            <p className="font-medium uppercase tracking-wider text-gray-500 mb-2" style={{ fontSize: '12px' }}>
              Notes
            </p>
            {lead.notes && (
              <p
                className="text-gray-600 mb-3 bg-gray-50 rounded-[6px] p-3"
                style={{ fontSize: '13px' }}
              >
                {lead.notes}
              </p>
            )}
            <textarea
              rows={4}
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Ajouter une note..."
              className="w-full border border-[#E5E5E5] rounded-[6px] p-3 text-gray-900 resize-none focus:outline-none focus:border-[#2563EB] placeholder-gray-400"
              style={{ fontSize: '14px' }}
            />
            <button
              onClick={() => {
                if (noteValue.trim()) {
                  onUpdateLead({ ...lead, notes: noteValue.trim() });
                  setNoteValue('');
                }
              }}
              className="mt-2 bg-[#2563EB] text-white font-semibold rounded-[6px] hover:bg-[#1D4ED8] transition-colors duration-150"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Enregistrer
            </button>
          </div>

          <div className="mb-6">
            <p className="font-medium uppercase tracking-wider text-gray-500 mb-3" style={{ fontSize: '12px' }}>
              Historique
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <span
                  className="rounded-full bg-gray-400 flex-shrink-0 mt-[5px]"
                  style={{ width: '6px', height: '6px' }}
                />
                <p className="text-gray-600" style={{ fontSize: '13px' }}>
                  Lead créé — {formatDate(lead.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
