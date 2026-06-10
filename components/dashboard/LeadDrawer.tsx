'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Phone as PhoneIcon, Mail as MailIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, LeadStatus, TeamMember } from '@/types/lead';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';
import { formatDate } from '@/lib/utils';
import { STATUS_META, STATUS_ORDER } from '@/lib/lead-meta';
import Select from '@/components/ui/Select';
import LeadDetailHeader from './LeadDetailHeader';
import LeadDisplaySignals from './LeadDisplaySignals';
import LeadDeleteSection from './LeadDeleteSection';
import LeadMlFeedbackFields from './LeadMlFeedbackFields';
import SciDirectorPendingNotice from './SciDirectorPendingNotice';
import { isSciDirectorPending } from '@/types/lead';

const drawerSelectTriggerClass =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10';

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  canAssignLead?: boolean;
  teamMembers: TeamMember[];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 uppercase tracking-widest text-mute"
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
  const directorPending = isSciDirectorPending(lead);

  return (
    <div className="space-y-3">
      <SectionLabel>Société propriétaire</SectionLabel>
      <p className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 14 }}>
        <Building2 size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
        {lead.companyName ?? '—'}
      </p>
      {directorPending ? (
        <SciDirectorPendingNotice />
      ) : (
        <div className="space-y-2">
          <p className="text-mute" style={{ fontSize: 11.5 }}>
            Dirigeant
          </p>
          <p className="font-medium text-ink" style={{ fontSize: 13 }}>
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
      )}
    </div>
  );
}

export default function LeadDrawer({
  lead,
  onClose,
  onUpdateLead,
  onDeleteLead,
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

  const isEnterprise = lead.ownerType === 'entreprise';

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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-10 pt-6">
            <LeadDetailHeader lead={lead} titleId="drawer-address" />

            {isEnterprise && (
              <>
                <Divider />
                <EnterpriseBlock lead={lead} />
              </>
            )}

            <Divider />

            <SectionLabel>Signaux détectés</SectionLabel>
            <LeadDisplaySignals key={lead.id} displaySignals={lead.displaySignals} />

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
              <LeadMlFeedbackFields
                lead={lead}
                onUpdateLead={onUpdateLead}
                selectTriggerClassName={drawerSelectTriggerClass}
              />
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

            <LeadDeleteSection leadId={lead.id} onDelete={onDeleteLead} className="mt-6" />
          </div>
        </div>
      </aside>
    </>
  );

  return createPortal(panel, document.body);
}
