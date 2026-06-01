'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Mail as MailIcon, Phone as PhoneIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, LeadStatus, TeamMember } from '@/types/lead';
import { ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';
import { formatDate } from '@/lib/utils';
import { STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';
import Select from '@/components/ui/Select';
import LeadDetailHeader from './LeadDetailHeader';
import LeadDisplaySignals from './LeadDisplaySignals';
import LeadDeleteSection from './LeadDeleteSection';
import SciDirectorPendingNotice from './SciDirectorPendingNotice';
import { isSciDirectorPending } from '@/types/lead';

const mobileSelectTriggerClass =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-3 text-left text-[14px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10';

interface LeadFullScreenMobileProps {
  lead: Lead;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
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
  onDeleteLead,
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
        <p className="truncate font-semibold text-ink" style={{ fontSize: 15, letterSpacing: '-0.01em' }}>
          Détail du lead
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <LeadDetailHeader lead={lead} compact />

        {isEnterprise && (
          <>
            <Divider />
            <div className="space-y-3">
              <SectionLabel>Société propriétaire</SectionLabel>
              <p className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 14 }}>
                <Building2 size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
                {lead.companyName ?? '—'}
              </p>
              {isSciDirectorPending(lead) ? (
                <SciDirectorPendingNotice />
              ) : (
                <div className="space-y-2">
                  <p className="text-mute" style={{ fontSize: 11.5 }}>
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
              )}
            </div>
          </>
        )}

        <Divider />

        <SectionLabel>Signaux détectés</SectionLabel>
        <LeadDisplaySignals displaySignals={lead.displaySignals} />

        <Divider />

        <SectionLabel>Gestion du lead</SectionLabel>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
              Statut
            </p>
            <Select
              aria-label="Statut du lead"
              value={lead.status}
              triggerClassName={mobileSelectTriggerClass}
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              onChange={(v) => handleStatus(v as LeadStatus)}
            />
          </div>
          {canAssignLead && (
            <div>
              <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
                Assigné à
              </p>
              <Select
                aria-label="Assigné à"
                value={lead.assignedTo ?? ''}
                triggerClassName={mobileSelectTriggerClass}
                options={[
                  { value: '', label: 'Non assigné' },
                  ...teamMembers.map((m) => ({ value: m.id, label: m.fullName })),
                ]}
                onChange={(v) => handleAssign(v === '' ? null : v)}
              />
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

        <LeadDeleteSection leadId={lead.id} onDelete={onDeleteLead} className="mt-6" />
      </div>
    </div>
  );
}
