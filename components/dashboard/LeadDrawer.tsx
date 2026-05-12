'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Lead, LeadStatus, ProspectOutcome, SignalType } from '@/types/lead';
import { mockAgents } from '@/lib/mock-data';
import {
  formatDate,
  formatPrice,
  splitStreetAndCity,
  getStatusLabel,
  signalTierEmoji,
  scoreTierLabel,
  scoreTierAccentColor,
} from '@/lib/utils';
import ScoreRing from './ScoreRing';
import LeadDrawerEnterprise from './LeadDrawerEnterprise';
import LeadDrawerIndividual from './LeadDrawerIndividual';

interface LeadDrawerProps {
  lead: Lead | null;
  isPlanPremium: boolean;
  onClose: () => void;
  onUpdateLead: (lead: Lead) => void;
}

const signalMeta: Record<SignalType, { label: string; pts: number }> = {
  dissolution_sci: { label: 'Dissolution SCI en cours', pts: 35 },
  liquidation: { label: 'Liquidation (amiable ou judiciaire)', pts: 35 },
  cession_parts: { label: 'Cession de parts sociales', pts: 30 },
  changement_gerant: { label: 'Changement de gérant', pts: 25 },
  deces_associe: { label: "Décès d'associé", pts: 28 },
  dpe_recent: { label: 'DPE refait récemment', pts: 20 },
  dpe_passoire: { label: 'DPE passoire (classes F ou G)', pts: 22 },
  detention_longue: { label: 'Détention longue durée', pts: 15 },
  plus_value: { label: 'Plus-value estimée élevée', pts: 20 },
  travaux_recents: { label: 'Travaux récents (permis SITADEL)', pts: 18 },
  zone_rotation: { label: 'Zone à forte rotation', pts: 12 },
};

const lifeEventLabel: Record<NonNullable<Lead['lifeEvent']>, string> = {
  dissolution_sci: '⚡ Dissolution SCI détectée',
  liquidation: '🔥 Liquidation détectée',
  cession_parts: '🔄 Cession de parts détectée',
  changement_gerant: '👤 Changement de gérant',
  deces_associe: '⚫ Décès associé signalé',
};

const outcomeOptions: { value: ProspectOutcome; label: string }[] = [
  { value: 'mandat_signe', label: '✅ Mandat signé' },
  { value: 'vendu_ailleurs', label: '➡️ Vendu ailleurs' },
  { value: 'pas_vendeur', label: '❌ Pas vendeur' },
  { value: 'pas_contacte', label: '⏸️ Pas contacté' },
];

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
  return <div className="h-px bg-black/[0.05] my-5" />;
}

export default function LeadDrawer({ lead, isPlanPremium, onClose, onUpdateLead }: LeadDrawerProps) {
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [drawerEntered, setDrawerEntered] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => { setNote(''); }, [lead?.id]);

  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lead, onClose]);

  useEffect(() => {
    if (!lead) {
      setDrawerEntered(false);
      return;
    }
    setDrawerEntered(false);
    const t = window.setTimeout(() => setDrawerEntered(true), 16);
    return () => window.clearTimeout(t);
  }, [lead?.id]);

  useEffect(() => {
    if (!lead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lead]);

  if (!lead) return null;

  const { streetLine, cityZipLine } = splitStreetAndCity(lead.address);
  const plusValue = (((lead.estimatedValue / lead.purchasePrice) - 1) * 100).toFixed(0);
  const totalPts = lead.signalType.reduce((acc, sig) => acc + (signalMeta[sig]?.pts ?? 0), 0);
  const isEnterprise = !!lead.legalForm && lead.segment === 'entreprise';
  const year = new Date(lead.purchaseDate).getFullYear();

  const statusOptions: LeadStatus[] = ['nouveau', 'contacté', 'intéressé', 'rdv_pris', 'pas_intéressé'];

  const panel = (
    <>
      <div
        role="presentation"
        className={`fixed inset-0 z-[90] transition-opacity duration-200 ease-out ${
          drawerEntered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed right-0 top-0 z-[100] flex h-full w-full flex-col bg-white transition-transform duration-[225ms] ease-out xl:w-[480px] relative ${
          drawerEntered ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-address"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex justify-end items-center px-7 pt-5 pb-3 border-b border-black/[0.05]">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-mute hover:text-ink hover:bg-black/[0.05] transition-colors"
            aria-label="Fermer"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 pb-10">
          <div className="flex justify-between gap-5 items-start mb-1">
            <div className="min-w-0 flex-1">
              <h2
                id="drawer-address"
                className="font-semibold text-ink tracking-tight"
                style={{ fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1.35 }}
              >
                {streetLine}
              </h2>
              {cityZipLine && (
                <p className="text-mute mt-1" style={{ fontSize: 12.5 }}>
                  {cityZipLine}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {lead.lifeEvent && (
                  <span
                    className="inline-block bg-accent/10 text-accent-dark rounded-full font-medium"
                    style={{ fontSize: 11, padding: '3px 10px' }}
                  >
                    {lifeEventLabel[lead.lifeEvent]}
                  </span>
                )}
                {lead.legalForm && (
                  <span
                    className="inline-block rounded font-semibold uppercase tracking-wide bg-blue/12 text-blue-dark border border-blue/20"
                    style={{ fontSize: 10, padding: '3px 9px', letterSpacing: '0.07em' }}
                  >
                    {lead.legalForm === 'sci' ? 'SCI' : 'SARL'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
              <ScoreRing score={lead.score} size={72} />
              <p
                className="mt-2 font-semibold text-center leading-tight"
                style={{ fontSize: 11, color: scoreTierAccentColor(lead.score) }}
              >
                {scoreTierLabel(lead.score)}
              </p>
            </div>
          </div>

          <Divider />

          {isEnterprise ? (
            <LeadDrawerEnterprise
              lead={lead}
              isPlanPremium={isPlanPremium}
              onCopied={() => showToast('Copié')}
            />
          ) : (
            <LeadDrawerIndividual />
          )}

          <Divider />

          <SectionLabel>Signaux détectés</SectionLabel>
          <div className="flex flex-col gap-4">
            {lead.signalType.map((sig, i) => {
              const m = signalMeta[sig];
              if (!m) return null;
              const src = lead.signalSources[i] ?? 'Source Priimo';
              const emoji = signalTierEmoji(m.pts);
              return (
                <div key={`${sig}-${i}`} className="flex gap-2.5">
                  <span className="flex-shrink-0 text-[15px] leading-none pt-0.5" aria-hidden>{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-ink font-medium" style={{ fontSize: 13 }}>{m.label}</p>
                      <span className="font-semibold tabular text-mute flex-shrink-0" style={{ fontSize: 12 }}>
                        +{m.pts}
                      </span>
                    </div>
                    <p className="text-mute mt-0.5" style={{ fontSize: 11 }}>
                      {src}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-mute mt-4 font-medium tabular" style={{ fontSize: 12 }}>
            Total signaux : +{totalPts} pts
          </p>

          <Divider />

          <SectionLabel>Caractéristiques du bien</SectionLabel>
          <ul className="space-y-2.5 text-ink" style={{ fontSize: 13 }}>
            <li className="flex justify-between gap-4">
              <span className="text-mute">Type</span>
              <span className="font-medium text-right">{lead.propertyType}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-mute">Surface</span>
              <span className="font-medium tabular">{lead.surface} m²</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-mute">Prix d’achat</span>
              <span className="font-medium tabular">{formatPrice(lead.purchasePrice)} € ({year})</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-mute">Valeur estimée</span>
              <span className="font-medium tabular">{formatPrice(lead.estimatedValue)} €</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-mute">Plus-value</span>
              <span className="font-medium tabular">+{plusValue}%</span>
            </li>
          </ul>

          <Divider />

          <SectionLabel>Gestion du lead</SectionLabel>
          <div className="space-y-4">
            <div>
              <p className="text-mute mb-1.5" style={{ fontSize: 11 }}>Statut</p>
              <select
                value={lead.status}
                onChange={(e) => onUpdateLead({ ...lead, status: e.target.value as LeadStatus })}
                onClick={(e) => e.stopPropagation()}
                className="w-full border border-black/8 rounded-xl px-4 py-2.5 text-ink bg-white focus:outline-none focus:border-accent/40 cursor-pointer"
                style={{ fontSize: 13 }}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{getStatusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-mute mb-1.5" style={{ fontSize: 11 }}>Assigné à</p>
              <select
                value={lead.assignedAgentId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdateLead({ ...lead, assignedAgentId: v === '' ? null : v });
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full border border-black/8 rounded-xl px-4 py-2.5 text-ink bg-white focus:outline-none focus:border-accent/40 cursor-pointer"
                style={{ fontSize: 13 }}
              >
                <option value="">Non assigné</option>
                {mockAgents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-mute mb-1.5" style={{ fontSize: 11 }}>Notes internes</p>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Notes visibles uniquement par votre agence…"
                className="w-full min-h-[100px] border border-black/8 rounded-xl px-4 py-3 text-ink resize-y focus:outline-none focus:border-accent/40 placeholder-mute/60"
                style={{ fontSize: 13, lineHeight: 1.6 }}
              />
              {lead.notes?.trim() && (
                <p
                  className="mt-2 bg-soft-warm rounded-xl px-4 py-3 text-ink whitespace-pre-wrap"
                  style={{ fontSize: 12.5, lineHeight: 1.55 }}
                >
                  {lead.notes}
                </p>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!note.trim()) return;
                  const stamp = formatDate(new Date().toISOString());
                  const addition = note.trim();
                  const next = lead.notes?.trim()
                    ? `${lead.notes.trim()}\n\n[${stamp}] ${addition}`
                    : addition;
                  onUpdateLead({ ...lead, notes: next });
                  setNote('');
                }}
                className="mt-2 btn btn-primary"
                style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
              >
                Enregistrer
              </button>
            </div>
          </div>

          <Divider />

          <SectionLabel>Issue finale du prospect</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {outcomeOptions.map(({ value, label }) => {
              const active = lead.prospectOutcome === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = lead.prospectOutcome === value ? 'none' : value;
                    onUpdateLead({ ...lead, prospectOutcome: next });
                  }}
                  className={`rounded-xl border text-left font-medium transition-colors duration-150 px-3 py-3 ${
                    active
                      ? 'border-accent bg-accent/10 text-accent-dark ring-1 ring-accent/30'
                      : 'border-black/[0.08] bg-white text-ink hover:bg-black/[0.02]'
                  }`}
                  style={{ fontSize: 12.5, lineHeight: 1.35 }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {lead.prospectOutcome === 'none' && (
            <p className="text-mute mt-2" style={{ fontSize: 11 }}>
              Sélectionnez une issue lorsque le dossier est clos.
            </p>
          )}
        </div>

        {toast && (
          <div
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] rounded-full bg-ink text-canvas px-4 py-2 font-medium shadow-soft"
            style={{ fontSize: 12 }}
            role="status"
          >
            {toast}
          </div>
        )}
      </aside>
    </>
  );

  return createPortal(panel, document.body);
}
