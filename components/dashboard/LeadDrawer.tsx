'use client';

import type { LucideIcon } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Lead, LeadStatus, ProspectOutcome, SignalType } from '@/types/lead';
import { mockAgents } from '@/lib/mock-data';
import {
  ICONS,
  ICON_COLORS,
  ICON_SIZE,
  lifeEventDrawerLabel,
  signalIconForType,
} from '@/lib/iconMapping';
import {
  formatDate,
  formatPrice,
  splitStreetAndCity,
  getStatusLabel,
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
  /** Faux pour le rôle agent : masque l’assignation. */
  canAssignLead?: boolean;
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

const outcomeOptions: {
  value: ProspectOutcome;
  label: string;
  Icon: LucideIcon;
  iconColor: string;
}[] = [
  { value: 'mandat_signe', label: 'Mandat signé', Icon: ICONS.check, iconColor: ICON_COLORS.green600 },
  { value: 'vendu_ailleurs', label: 'Vendu ailleurs', Icon: ICONS.arrowRight, iconColor: ICON_COLORS.info },
  { value: 'pas_vendeur', label: 'Pas vendeur', Icon: ICONS.x, iconColor: ICON_COLORS.error },
  { value: 'pas_contacte', label: 'Pas contacté', Icon: ICONS.pause, iconColor: ICON_COLORS.neutral },
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

export default function LeadDrawer({ lead, isPlanPremium, onClose, onUpdateLead, canAssignLead = true }: LeadDrawerProps) {
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
  const plusValueRaw = lead.purchasePrice > 0
    ? (((lead.estimatedValue / lead.purchasePrice) - 1) * 100).toFixed(0)
    : null;
  const plusValue = plusValueRaw !== null
    ? (Number(plusValueRaw) >= 0 ? `+${plusValueRaw}%` : `${plusValueRaw}%`)
    : '—';
  const totalPts = lead.signalType.reduce((acc, sig) => acc + (signalMeta[sig]?.pts ?? 0), 0);
  const isEnterprise = !!lead.legalForm && lead.segment === 'entreprise';
  const year = new Date(lead.purchaseDate).getFullYear();
  const tierLabel = scoreTierLabel(lead.score);
  const showHotStar = lead.score >= 80;

  const statusOptions: LeadStatus[] = ['nouveau', 'contacté', 'intéressé', 'rdv_pris', 'pas_intéressé'];

  const panel = (
    <>
      <div
        role="presentation"
        className={`fixed inset-0 z-40 hidden transition-opacity duration-200 ease-out md:block ${
          drawerEntered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 hidden h-[100dvh] max-h-[100dvh] w-full max-w-[480px] flex-col bg-white transition-transform duration-[225ms] ease-out md:flex ${
          drawerEntered ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.08)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-address"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-shrink-0 justify-end border-b border-black/[0.05] px-7 pb-3 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-mute transition-colors hover:bg-black/[0.05] hover:text-ink"
              aria-label="Fermer"
            >
              <ICONS.x size={20} color={ICON_COLORS.neutral} strokeWidth={2} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-10">
            <div className="mb-1 flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <h2
                  id="drawer-address"
                  className="font-semibold tracking-tight text-ink"
                  style={{ fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1.35 }}
                >
                  {streetLine}
                </h2>
                {cityZipLine && (
                  <p className="mt-1 text-mute" style={{ fontSize: 12.5 }}>
                    {cityZipLine}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lead.lifeEvent && (() => {
                    const { Icon, color, text } = lifeEventDrawerLabel(lead.lifeEvent);
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 font-medium text-accent-dark"
                        style={{ fontSize: 11, padding: '3px 10px' }}
                      >
                        <Icon size={ICON_SIZE.sm} color={color} strokeWidth={2} aria-hidden />
                        {text}
                      </span>
                    );
                  })()}
                  {lead.legalForm && (
                    <span
                      className="inline-block rounded border border-blue/20 bg-blue/12 font-semibold uppercase tracking-wide text-blue-dark"
                      style={{ fontSize: 10, padding: '3px 9px', letterSpacing: '0.07em' }}
                    >
                      {lead.legalForm === 'sci' ? 'SCI' : 'SARL'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-center pt-0.5">
                <ScoreRing score={lead.score} size={72} />
                <p
                  className="mt-2 flex items-center gap-1 text-center font-semibold leading-tight"
                  style={{ fontSize: 11, color: scoreTierAccentColor(lead.score) }}
                >
                  {showHotStar && (
                    <ICONS.star className="flex-shrink-0" size={12} color={scoreTierAccentColor(lead.score)} strokeWidth={2} aria-hidden />
                  )}
                  {tierLabel}
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
                const { Icon, color } = signalIconForType(sig);
                return (
                  <div key={`${sig}-${i}`} className="flex gap-2.5">
                    <span className="flex-shrink-0 pt-0.5" aria-hidden>
                      <Icon size={ICON_SIZE.sm} color={color} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-ink" style={{ fontSize: 13 }}>{m.label}</p>
                        <span className="flex-shrink-0 font-semibold tabular text-mute" style={{ fontSize: 12 }}>
                          +{m.pts}
                        </span>
                      </div>
                      <p className="mt-0.5 text-mute" style={{ fontSize: 11 }}>
                        {src}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 font-medium tabular text-mute" style={{ fontSize: 12 }}>
              Total signaux : +{totalPts} pts
            </p>

            <Divider />

            <SectionLabel>Caractéristiques du bien</SectionLabel>
            <ul className="space-y-2.5 text-ink" style={{ fontSize: 13 }}>
              <li className="flex justify-between gap-4">
                <span className="text-mute">Type</span>
                <span className="text-right font-medium">{lead.propertyType}</span>
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
                <span className="font-medium tabular">{plusValue}</span>
              </li>
            </ul>

            <Divider />

            <SectionLabel>Gestion du lead</SectionLabel>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>Statut</p>
                <select
                  value={lead.status}
                  onChange={(e) => onUpdateLead({ ...lead, status: e.target.value as LeadStatus })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full cursor-pointer rounded-xl border border-black/8 bg-white px-4 py-2.5 text-ink focus:border-accent/40 focus:outline-none"
                  style={{ fontSize: 13 }}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
              </div>
              {canAssignLead && (
              <div>
                <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>Assigné à</p>
                <select
                  value={lead.assignedAgentId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdateLead({ ...lead, assignedAgentId: v === '' ? null : v });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full cursor-pointer rounded-xl border border-black/8 bg-white px-4 py-2.5 text-ink focus:border-accent/40 focus:outline-none"
                  style={{ fontSize: 13 }}
                >
                  <option value="">Non assigné</option>
                  {mockAgents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              )}
              <div>
                <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>Notes internes</p>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Notes visibles uniquement par votre agence…"
                  className="placeholder-mute/60 min-h-[100px] w-full resize-y rounded-xl border border-black/8 px-4 py-3 text-ink focus:border-accent/40 focus:outline-none"
                  style={{ fontSize: 13, lineHeight: 1.6 }}
                />
                {lead.notes?.trim() && (
                  <p
                    className="mt-2 whitespace-pre-wrap rounded-xl bg-soft-warm px-4 py-3 text-ink"
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
                  className="btn btn-primary mt-2"
                  style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
                >
                  Enregistrer
                </button>
              </div>
            </div>

            <Divider />

            <SectionLabel>Issue finale du prospect</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {outcomeOptions.map(({ value, label, Icon, iconColor }) => {
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
                    className={`rounded-xl border text-left font-medium transition-colors duration-150 ${
                      active
                        ? 'border-accent bg-accent/10 text-accent-dark ring-1 ring-accent/30'
                        : 'border-black/[0.08] bg-white text-ink hover:bg-black/[0.02]'
                    }`}
                    style={{ fontSize: 12.5, lineHeight: 1.35, padding: '10px 12px' }}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={20} color={iconColor} strokeWidth={2} aria-hidden />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            {lead.prospectOutcome === 'none' && (
              <p className="mt-2 text-mute" style={{ fontSize: 11 }}>
                Sélectionnez une issue lorsque le dossier est clos.
              </p>
            )}
          </div>
        </div>

        {toast && (
          <div
            className="pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 font-medium text-canvas shadow-soft max-md:bottom-24 md:bottom-6"
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
