'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Phone as PhoneIcon, Mail as MailIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, LeadStatus, MlFeedback, TeamMember } from '@/types/lead';
import {
  ICONS,
  ICON_COLORS,
  ICON_SIZE,
  signalIconForType,
} from '@/lib/iconMapping';
import {
  formatDate,
  formatPrice,
  splitStreetAndCity,
  scoreTierLabel,
  scoreTierAccentColor,
} from '@/lib/utils';
import { ML_FEEDBACK_OPTIONS, SIGNAL_META, STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';
import Select from '@/components/ui/Select';
import ScoreRing from './ScoreRing';

const drawerSelectTriggerClass =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10';

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  canAssignLead?: boolean;
  teamMembers: TeamMember[];
}

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

function EnterpriseBlock({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <SectionLabel>Société propriétaire</SectionLabel>
      <p className="font-semibold text-ink flex items-center gap-2" style={{ fontSize: 14 }}>
        <Building2 size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
        {lead.companyName ?? '—'}
      </p>
      <div className="rounded-xl border border-black/[0.06] bg-[#F1F1EE]/90 px-4 py-3 space-y-3">
        <p
          className="text-mute uppercase tracking-widest"
          style={{ fontSize: 9, letterSpacing: '0.15em' }}
        >
          Dirigeant
        </p>
        <p className="font-medium text-ink" style={{ fontSize: 14 }}>
          {lead.companyDirector ?? '—'}
        </p>
        {lead.companyPhone && (
          <a
            href={`tel:${lead.companyPhone}`}
            className="flex items-center gap-2 text-accent-dark hover:underline"
            style={{ fontSize: 13 }}
          >
            <PhoneIcon size={ICON_SIZE.sm} color={ICON_COLORS.green600} strokeWidth={2} aria-hidden />
            {lead.companyPhone}
          </a>
        )}
        {lead.companyEmail && (
          <a
            href={`mailto:${lead.companyEmail}`}
            className="flex items-center gap-2 text-accent-dark hover:underline"
            style={{ fontSize: 13 }}
          >
            <MailIcon size={ICON_SIZE.sm} color={ICON_COLORS.neutral} strokeWidth={2} aria-hidden />
            {lead.companyEmail}
          </a>
        )}
        {!lead.companyPhone && !lead.companyEmail && (
          <p className="text-mute" style={{ fontSize: 12 }}>
            Coordonnées non disponibles.
          </p>
        )}
      </div>
    </div>
  );
}

function IndividualBlock() {
  return (
    <div
      className="rounded-xl border border-black/[0.06] bg-soft-gray/60 px-4 py-4 text-mute"
      style={{ fontSize: 12.5, lineHeight: 1.6 }}
    >
      <p className="mb-2 flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 13 }}>
        <Lock size={20} color={ICON_COLORS.neutral} strokeWidth={2} aria-hidden />
        Conformité RGPD
      </p>
      <p className="mb-2">Les coordonnées personnelles des particuliers ne sont jamais affichées.</p>
      <p className="text-ink/90">
        Action recommandée : porte-à-porte ou courrier ciblé à l’adresse ci-dessus.
      </p>
    </div>
  );
}

export default function LeadDrawer({
  lead,
  onClose,
  onUpdateLead,
  canAssignLead = true,
  teamMembers,
}: LeadDrawerProps) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);

  useEffect(() => {
    setNote('');
  }, [lead?.id]);

  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lead, onClose]);

  const leadId = lead?.id ?? null;
  useEffect(() => {
    if (leadId === null) {
      setDrawerEntered(false);
      return;
    }
    setDrawerEntered(false);
    const t = window.setTimeout(() => setDrawerEntered(true), 16);
    return () => window.clearTimeout(t);
  }, [leadId]);

  useEffect(() => {
    if (!lead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lead]);

  const handleStatus = useCallback(
    async (next: LeadStatus) => {
      if (!lead) return;
      try {
        await onUpdateLead(lead.id, { status: next });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors du changement de statut.');
      }
    },
    [lead, onUpdateLead],
  );

  const handleAssign = useCallback(
    async (memberId: string | null) => {
      if (!lead) return;
      try {
        await onUpdateLead(lead.id, { assignedTo: memberId });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'assignation.");
      }
    },
    [lead, onUpdateLead],
  );

  const handleFeedback = useCallback(
    async (next: MlFeedback) => {
      if (!lead) return;
      try {
        await onUpdateLead(lead.id, { mlFeedback: next });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement du feedback.');
      }
    },
    [lead, onUpdateLead],
  );

  const saveNote = useCallback(async () => {
    if (!lead) return;
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavingNote(true);
    const stamp = formatDate(new Date().toISOString());
    const nextNotes = lead.notes?.trim() ? `${lead.notes.trim()}\n\n[${stamp}] ${trimmed}` : trimmed;
    try {
      await onUpdateLead(lead.id, { notes: nextNotes });
      setNote('');
      toast.success('Note enregistrée');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'enregistrer la note.");
    } finally {
      setSavingNote(false);
    }
  }, [lead, note, onUpdateLead]);

  if (!lead) return null;

  const { streetLine, cityZipLine } = splitStreetAndCity(
    [lead.address, lead.postalCode, lead.city].filter(Boolean).join(', '),
  );
  const plusValueRaw =
    lead.acquiredPrice && lead.acquiredPrice > 0 && lead.estimatedValue
      ? (((lead.estimatedValue / lead.acquiredPrice) - 1) * 100).toFixed(0)
      : null;
  const plusValue =
    plusValueRaw !== null ? (Number(plusValueRaw) >= 0 ? `+${plusValueRaw}%` : `${plusValueRaw}%`) : '—';
  const totalPts = lead.signals.reduce((acc, s) => acc + (s.pts ?? SIGNAL_META[s.type]?.pts ?? 0), 0);
  const isEnterprise = lead.ownerType === 'entreprise';
  const tierLabel = scoreTierLabel(lead.score);
  const showHotStar = lead.score >= 80;

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
              </div>
              <div className="flex flex-shrink-0 flex-col items-center pt-0.5">
                <ScoreRing score={lead.score} size={72} />
                <p
                  className="mt-2 flex items-center gap-1 text-center font-semibold leading-tight"
                  style={{ fontSize: 11, color: scoreTierAccentColor(lead.score) }}
                >
                  {showHotStar && (
                    <ICONS.star
                      className="flex-shrink-0"
                      size={12}
                      color={scoreTierAccentColor(lead.score)}
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                  {tierLabel}
                </p>
              </div>
            </div>

            <Divider />

            {isEnterprise ? <EnterpriseBlock lead={lead} /> : <IndividualBlock />}

            <Divider />

            <SectionLabel>Signaux détectés</SectionLabel>
            <div className="flex flex-col gap-4">
              {lead.signals.length === 0 && (
                <p className="text-mute" style={{ fontSize: 12.5 }}>
                  Aucun signal enregistré pour ce prospect.
                </p>
              )}
              {lead.signals.map((s, i) => {
                const meta = SIGNAL_META[s.type];
                const { Icon, color } = signalIconForType(s.type);
                const label = s.label || meta.label;
                const pts = s.pts ?? meta.pts;
                const src = s.source || 'Source Priimo';
                return (
                  <div key={`${s.type}-${i}`} className="flex gap-2.5">
                    <span className="flex-shrink-0 pt-0.5" aria-hidden>
                      <Icon size={ICON_SIZE.sm} color={color} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-ink" style={{ fontSize: 13 }}>
                          {label}
                        </p>
                        <span
                          className="flex-shrink-0 font-semibold tabular text-mute"
                          style={{ fontSize: 12 }}
                        >
                          +{pts}
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
            {lead.signals.length > 0 && (
              <p className="mt-4 font-medium tabular text-mute" style={{ fontSize: 12 }}>
                Total signaux : +{totalPts} pts
              </p>
            )}

            <Divider />

            <SectionLabel>Caractéristiques du bien</SectionLabel>
            <ul className="space-y-2.5 text-ink" style={{ fontSize: 13 }}>
              {lead.propertyType && (
                <li className="flex justify-between gap-4">
                  <span className="text-mute">Type</span>
                  <span className="text-right font-medium">{lead.propertyType}</span>
                </li>
              )}
              {lead.surfaceM2 != null && (
                <li className="flex justify-between gap-4">
                  <span className="text-mute">Surface</span>
                  <span className="font-medium tabular">{lead.surfaceM2} m²</span>
                </li>
              )}
              {lead.acquiredPrice != null && (
                <li className="flex justify-between gap-4">
                  <span className="text-mute">Prix d’acquisition</span>
                  <span className="font-medium tabular">
                    {formatPrice(lead.acquiredPrice)} €{lead.acquiredYear ? ` (${lead.acquiredYear})` : ''}
                  </span>
                </li>
              )}
              {lead.estimatedValue != null && (
                <li className="flex justify-between gap-4">
                  <span className="text-mute">Valeur estimée</span>
                  <span className="font-medium tabular">{formatPrice(lead.estimatedValue)} €</span>
                </li>
              )}
              {plusValueRaw !== null && (
                <li className="flex justify-between gap-4">
                  <span className="text-mute">Plus-value</span>
                  <span className="font-medium tabular">{plusValue}</span>
                </li>
              )}
              {lead.dpeClass && (
                <li className="flex justify-between gap-4">
                  <span className="text-mute">DPE</span>
                  <span className="font-medium tabular">{lead.dpeClass}</span>
                </li>
              )}
            </ul>

            <Divider />

            <SectionLabel>Gestion du lead</SectionLabel>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
                  Statut
                </p>
                <div onClick={(e) => e.stopPropagation()}>
                  <Select
                    aria-label="Statut du lead"
                    value={lead.status}
                    triggerClassName={drawerSelectTriggerClass}
                    options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
                    onChange={(v) => handleStatus(v as LeadStatus)}
                  />
                </div>
              </div>
              {canAssignLead && (
                <div>
                  <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
                    Assigné à
                  </p>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      aria-label="Assigné à"
                      value={lead.assignedTo ?? ''}
                      triggerClassName={drawerSelectTriggerClass}
                      options={[
                        { value: '', label: 'Non assigné' },
                        ...teamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                      ]}
                      onChange={(v) => handleAssign(v === '' ? null : v)}
                    />
                  </div>
                </div>
              )}
              <div>
                <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
                  Notes internes
                </p>
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
                    saveNote();
                  }}
                  disabled={savingNote || !note.trim()}
                  className="btn btn-primary mt-2 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10 }}
                >
                  {savingNote ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>

            <Divider />

            <SectionLabel>Feedback ML</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {ML_FEEDBACK_OPTIONS.map(({ value, label, Icon, color }) => {
                const active = lead.mlFeedback === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFeedback(lead.mlFeedback === value ? null : value);
                    }}
                    className={`rounded-xl border text-left font-medium transition-colors duration-150 ${
                      active
                        ? 'border-accent bg-accent/10 text-accent-dark ring-1 ring-accent/30'
                        : 'border-black/[0.08] bg-white text-ink hover:bg-black/[0.02]'
                    }`}
                    style={{ fontSize: 12.5, lineHeight: 1.35, padding: '10px 12px' }}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={20} color={color} strokeWidth={2} aria-hidden />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
            {lead.mlFeedback === null && (
              <p className="mt-2 text-mute" style={{ fontSize: 11 }}>
                Sélectionnez une issue lorsque le dossier est clos pour aider Priimo à mieux scorer
                les prochains prospects.
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );

  return createPortal(panel, document.body);
}
