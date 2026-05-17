'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Lock, Mail as MailIcon, Phone as PhoneIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, LeadStatus, MlFeedback, TeamMember } from '@/types/lead';
import { ICON_COLORS, ICON_SIZE, signalIconForType } from '@/lib/iconMapping';
import {
  formatDate,
  formatPrice,
  splitStreetAndCity,
  scoreTierLabel,
  scoreTierAccentColor,
} from '@/lib/utils';
import { ML_FEEDBACK_OPTIONS, SIGNAL_META, STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';
import ScoreRing from './ScoreRing';

interface LeadFullScreenMobileProps {
  lead: Lead;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  canAssignLead?: boolean;
  teamMembers: TeamMember[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 uppercase tracking-widest text-mute" style={{ fontSize: 9, letterSpacing: '0.18em' }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-black/[0.05] my-5" />;
}

export default function LeadFullScreenMobile({
  lead,
  onClose,
  onUpdateLead,
  canAssignLead = true,
  teamMembers,
}: LeadFullScreenMobileProps) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote('');
  }, [lead.id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleStatus = useCallback(
    async (next: LeadStatus) => {
      try {
        await onUpdateLead(lead.id, { status: next });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors du changement de statut.');
      }
    },
    [lead.id, onUpdateLead],
  );

  const handleAssign = useCallback(
    async (memberId: string | null) => {
      try {
        await onUpdateLead(lead.id, { assignedTo: memberId });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'assignation.");
      }
    },
    [lead.id, onUpdateLead],
  );

  const handleFeedback = useCallback(
    async (next: MlFeedback) => {
      try {
        await onUpdateLead(lead.id, { mlFeedback: next });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors de l’enregistrement du feedback.');
      }
    },
    [lead.id, onUpdateLead],
  );

  const saveNote = useCallback(async () => {
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
  }, [lead.id, lead.notes, note, onUpdateLead]);

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

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white md:hidden">
      <header
        className="flex flex-shrink-0 items-center gap-2 border-b border-black/[0.05] bg-white px-3 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink"
          aria-label="Retour"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold text-ink" style={{ fontSize: 15 }}>
          {streetLine}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {cityZipLine && (
              <p className="text-mute" style={{ fontSize: 13 }}>
                {cityZipLine}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-center">
            <ScoreRing score={lead.score} size={64} />
            <p
              className="mt-1 text-center font-semibold"
              style={{ fontSize: 11, color: scoreTierAccentColor(lead.score) }}
            >
              {scoreTierLabel(lead.score)}
            </p>
          </div>
        </div>

        <Divider />

        {isEnterprise ? (
          <div className="space-y-4">
            <SectionLabel>Société propriétaire</SectionLabel>
            <p className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 14 }}>
              <Building2 size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
              {lead.companyName ?? '—'}
            </p>
            <div className="rounded-xl border border-black/[0.06] bg-[#F1F1EE]/90 px-4 py-3 space-y-3">
              <p className="uppercase tracking-widest text-mute" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
                Dirigeant
              </p>
              <p className="font-medium text-ink" style={{ fontSize: 14 }}>
                {lead.companyDirector ?? '—'}
              </p>
              {lead.companyPhone && (
                <a
                  href={`tel:${lead.companyPhone}`}
                  className="flex min-h-[44px] items-center gap-2 text-accent-dark"
                  style={{ fontSize: 14 }}
                >
                  <PhoneIcon size={18} color={ICON_COLORS.green600} strokeWidth={2} aria-hidden />
                  {lead.companyPhone}
                </a>
              )}
              {lead.companyEmail && (
                <a
                  href={`mailto:${lead.companyEmail}`}
                  className="flex min-h-[44px] items-center gap-2 text-accent-dark"
                  style={{ fontSize: 14 }}
                >
                  <MailIcon size={18} color={ICON_COLORS.neutral} strokeWidth={2} aria-hidden />
                  {lead.companyEmail}
                </a>
              )}
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border border-black/[0.06] bg-soft-gray/60 px-4 py-4 text-mute"
            style={{ fontSize: 12.5, lineHeight: 1.6 }}
          >
            <p className="mb-2 flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 13 }}>
              <Lock size={20} color={ICON_COLORS.neutral} strokeWidth={2} aria-hidden />
              Conformité RGPD
            </p>
            <p>Coordonnées personnelles non affichées.</p>
          </div>
        )}

        <Divider />

        <SectionLabel>Signaux détectés</SectionLabel>
        {lead.signals.length === 0 ? (
          <p className="text-mute" style={{ fontSize: 12.5 }}>
            Aucun signal enregistré.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {lead.signals.map((s, i) => {
              const meta = SIGNAL_META[s.type];
              const { Icon, color } = signalIconForType(s.type);
              const label = s.label || meta.label;
              const pts = s.pts ?? meta.pts;
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
                      {s.source || 'Source Priimo'}
                    </p>
                  </div>
                </div>
              );
            })}
            <p className="font-medium tabular text-mute" style={{ fontSize: 12 }}>
              Total : +{totalPts} pts
            </p>
          </div>
        )}

        <Divider />

        <SectionLabel>Caractéristiques du bien</SectionLabel>
        <ul className="space-y-2.5 text-ink" style={{ fontSize: 13 }}>
          {lead.propertyType && (
            <li className="flex justify-between gap-4">
              <span className="text-mute">Type</span>
              <span className="font-medium">{lead.propertyType}</span>
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
        </ul>

        <Divider />

        <SectionLabel>Gestion du lead</SectionLabel>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
              Statut
            </p>
            <select
              value={lead.status}
              onChange={(e) => handleStatus(e.target.value as LeadStatus)}
              className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-ink focus:border-accent/40 focus:outline-none"
              style={{ fontSize: 14 }}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          {canAssignLead && (
            <div>
              <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
                Assigné à
              </p>
              <select
                value={lead.assignedTo ?? ''}
                onChange={(e) => handleAssign(e.target.value === '' ? null : e.target.value)}
                className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-ink focus:border-accent/40 focus:outline-none"
                style={{ fontSize: 14 }}
              >
                <option value="">Non assigné</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
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
              placeholder="Notes visibles uniquement par votre agence…"
              className="placeholder-mute/60 min-h-[100px] w-full resize-y rounded-xl border border-black/8 px-4 py-3 text-ink focus:border-accent/40 focus:outline-none"
              style={{ fontSize: 14, lineHeight: 1.6 }}
            />
            {lead.notes?.trim() && (
              <p
                className="mt-2 whitespace-pre-wrap rounded-xl bg-soft-warm px-4 py-3 text-ink"
                style={{ fontSize: 13, lineHeight: 1.55 }}
              >
                {lead.notes}
              </p>
            )}
            <button
              type="button"
              onClick={saveNote}
              disabled={savingNote || !note.trim()}
              className="btn btn-primary mt-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ padding: '10px 22px', fontSize: 14, borderRadius: 10 }}
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
                onClick={() => handleFeedback(lead.mlFeedback === value ? null : value)}
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
      </div>
    </div>
  );
}
