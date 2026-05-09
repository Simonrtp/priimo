'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { formatDate, formatPrice } from '@/lib/utils';
import StatusBadge from './StatusBadge';

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
}

const signalMeta: Record<string, { label: string; pts: number; color: string }> = {
  liquidation_pro:   { label: 'Liquidation professionnelle',  pts: 35, color: '#E8743C' },
  dissolution_sci:   { label: 'Dissolution SCI',              pts: 35, color: '#E8743C' },
  cession_entreprise:{ label: "Cession d'entreprise",         pts: 30, color: '#E8743C' },
  dpe_recent:        { label: 'DPE refait récemment',          pts: 20, color: '#3D5A80' },
  detention_longue:  { label: 'Détention longue durée',       pts: 15, color: '#3D5A80' },
  plus_value:        { label: 'Plus-value élevée',            pts: 20, color: '#7B9AC0' },
  zone_rotation:     { label: 'Zone à forte rotation',        pts: 10, color: '#9CA3AF' },
};

const scoreStyle = (score: number) => {
  if (score >= 80) return { color: '#C25E2C', bar: '#E8743C', bg: '#FFF3EA' };
  if (score >= 50) return { color: '#293F5C', bar: '#3D5A80', bg: '#EEF2F7' };
  return { color: '#6B7280', bar: '#C8C8BF', bg: '#F1F1EE' };
};

const lifeEventLabel: Record<string, string> = {
  liquidation_pro:    '🔥 Liquidation pro détectée',
  dissolution_sci:    '⚡ Dissolution SCI détectée',
  cession_entreprise: "🔄 Cession d'entreprise détectée",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="uppercase text-mute tracking-widest mb-3"
      style={{ fontSize: 9, letterSpacing: '0.18em' }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-black/[0.06] my-5" />;
}

export default function LeadDrawer({ lead, onClose, onUpdateLead }: LeadDrawerProps) {
  const [note, setNote] = useState('');

  useEffect(() => { setNote(''); }, [lead?.id]);

  if (!lead) return null;

  const s = scoreStyle(lead.score);
  const plusValue = (((lead.estimatedValue / lead.purchasePrice) - 1) * 100).toFixed(0);
  const totalPts = lead.signalType.reduce((acc, sig) => acc + (signalMeta[sig]?.pts ?? 0), 0);

  const details = [
    { label: 'Type de bien',    value: lead.propertyType },
    { label: 'Surface',         value: `${lead.surface} m²` },
    { label: 'Acheté le',       value: formatDate(lead.purchaseDate) },
    { label: "Prix d'achat",    value: `${formatPrice(lead.purchasePrice)} €` },
    { label: 'Valeur estimée',  value: `${formatPrice(lead.estimatedValue)} €` },
    { label: 'Plus-value',      value: `+${plusValue}%` },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 animate-overlay-in"
        style={{ backgroundColor: 'rgba(17,24,39,0.18)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 bg-white overflow-y-auto animate-drawer-in"
        style={{ width: 480, boxShadow: '-8px 0 40px rgba(17,24,39,0.10)' }}
      >
        {/* Accent bar at top */}
        <div
          className="h-[4px] flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #E8743C 0%, #7B9AC0 100%)' }}
        />

        <div className="px-7 py-6">
          {/* Close */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-mute hover:text-ink hover:bg-black/[0.05] transition-colors duration-150 mb-5 -ml-1"
          >
            <X size={16} strokeWidth={1.8} />
          </button>

          {/* Address + life event */}
          <p
            className="font-bold text-ink tracking-tight mb-1"
            style={{ fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.3 }}
          >
            {lead.address}
          </p>
          {lead.lifeEvent && (
            <span
              className="inline-block bg-accent/10 text-accent-dark rounded-full font-medium mb-4"
              style={{ fontSize: 11, padding: '3px 10px' }}
            >
              {lifeEventLabel[lead.lifeEvent]}
            </span>
          )}

          {/* Map placeholder */}
          <div
            className="rounded-2xl bg-soft-gray flex items-center justify-center mb-5"
            style={{ height: 164 }}
          >
            <span className="text-mute" style={{ fontSize: 12.5 }}>🗺️ Carte à venir</span>
          </div>

          {/* ── Score ──────────────────────────────────── */}
          <SectionLabel>Score de probabilité</SectionLabel>
          <div className="flex items-end gap-4 mb-3">
            <p
              className="font-bold tabular leading-none"
              style={{ fontSize: 72, color: s.color, letterSpacing: '-0.04em' }}
            >
              {lead.score}
            </p>
            <div className="pb-2">
              <p className="text-mute" style={{ fontSize: 12 }}>/100</p>
              <p className="font-medium" style={{ fontSize: 11.5, color: s.color }}>
                +{totalPts} pts signaux
              </p>
            </div>
          </div>
          {/* Score bar */}
          <div className="rounded-full overflow-hidden bg-soft-gray mb-1" style={{ height: 5 }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${lead.score}%`, backgroundColor: s.bar, transition: 'width 0.5s ease-out' }}
            />
          </div>

          <Divider />

          {/* ── Signaux ────────────────────────────────── */}
          <SectionLabel>Signaux détectés</SectionLabel>
          <div className="flex flex-col gap-3">
            {lead.signalType.map((sig) => {
              const m = signalMeta[sig];
              if (!m) return null;
              const pct = Math.round((m.pts / 35) * 100);
              return (
                <div key={sig}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-full flex-shrink-0"
                        style={{ width: 7, height: 7, backgroundColor: m.color }}
                      />
                      <span className="text-ink" style={{ fontSize: 13 }}>{m.label}</span>
                    </div>
                    <span className="font-semibold tabular text-mute" style={{ fontSize: 11.5 }}>
                      +{m.pts} pts
                    </span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 3, backgroundColor: `${m.color}20` }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: m.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Divider />

          {/* ── Détails du bien ────────────────────────── */}
          <SectionLabel>Détails du bien</SectionLabel>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {details.map(({ label, value }) => (
              <div key={label}>
                <p className="text-mute mb-0.5" style={{ fontSize: 11 }}>{label}</p>
                <p className="font-semibold text-ink tabular" style={{ fontSize: 13.5 }}>{value}</p>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── Statut ─────────────────────────────────── */}
          <SectionLabel>Statut</SectionLabel>
          <StatusBadge
            status={lead.status}
            onChange={(s) => onUpdateLead({ ...lead, status: s })}
          />

          <Divider />

          {/* ── Notes ──────────────────────────────────── */}
          <SectionLabel>Notes</SectionLabel>
          {lead.notes && (
            <p
              className="bg-soft-warm rounded-xl px-4 py-3 text-ink mb-3"
              style={{ fontSize: 13, lineHeight: 1.6 }}
            >
              {lead.notes}
            </p>
          )}
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ajouter une note…"
            className="w-full border border-black/8 rounded-xl px-4 py-3 text-ink resize-none focus:outline-none focus:border-accent/40 placeholder-mute/60"
            style={{ fontSize: 13, lineHeight: 1.6 }}
          />
          <button
            onClick={() => {
              if (note.trim()) { onUpdateLead({ ...lead, notes: note.trim() }); setNote(''); }
            }}
            className="mt-2 btn btn-primary"
            style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
          >
            Enregistrer
          </button>

          <Divider />

          {/* ── Historique ─────────────────────────────── */}
          <SectionLabel>Historique</SectionLabel>
          <div className="flex items-start gap-3">
            <span
              className="mt-[5px] rounded-full bg-black/20 flex-shrink-0"
              style={{ width: 6, height: 6 }}
            />
            <p className="text-mute" style={{ fontSize: 12.5 }}>
              Lead créé — {formatDate(lead.createdAt)}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
