'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Mail as MailIcon, Phone as PhoneIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, TeamMember } from '@/types/lead';
import { isSciDirectorPending } from '@/types/lead';
import { ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';
import { formatDate } from '@/lib/utils';
import LeadDetailHeader from './LeadDetailHeader';
import LeadDisplaySignals from './LeadDisplaySignals';
import LeadDeleteSection from './LeadDeleteSection';
import LeadAssigneeControl from './LeadAssigneeControl';
import LeadMarketCheck from './LeadMarketCheck';
import { LeadImmeubleContacts, LeadOwnerBlock } from './LeadOwnerContacts';
import LeadStatusControl from './LeadStatusControl';
import SciDirectorPendingNotice from './SciDirectorPendingNotice';
import LeadApproachScript from './LeadApproachScript';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';

const DEFAULT_SELECT =
  'flex w-full items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10';

type LeadDetailBodyProps = {
  lead: Lead;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  canAssignLead?: boolean;
  canDeleteLead?: boolean;
  currentUserId?: string | null;
  teamMembers: TeamMember[];
  /** Variante densités / ancres tour. */
  variant?: 'desktop' | 'mobile';
  headerCompact?: boolean;
  headerTitleId?: string;
};

function EnterpriseBlock({
  lead,
  linkClassName,
  directorSize,
}: {
  lead: Lead;
  linkClassName: string;
  directorSize: number;
}) {
  const directorPending = isSciDirectorPending(lead);

  return (
    <DetailSection>
      <DetailSectionLabel>Société propriétaire</DetailSectionLabel>
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 14 }}>
          <Building2 size={ICON_SIZE.sm} color={ICON_COLORS.muted500} strokeWidth={2} aria-hidden />
          {lead.companyName ?? '—'}
        </p>
        {directorPending ? (
          <SciDirectorPendingNotice />
        ) : (
          <div className="space-y-2">
            <p className="text-mute" style={{ fontSize: 11 }}>
              Dirigeant
            </p>
            <p className="font-medium text-ink" style={{ fontSize: directorSize }}>
              {lead.companyDirector ?? '—'}
            </p>
            {lead.companyPhone && (
              <a href={`tel:${lead.companyPhone}`} className={linkClassName} style={{ fontSize: directorSize }}>
                <PhoneIcon size={ICON_SIZE.sm} color={ICON_COLORS.green600} strokeWidth={2} aria-hidden />
                {lead.companyPhone}
              </a>
            )}
            {lead.companyEmail && (
              <a href={`mailto:${lead.companyEmail}`} className={linkClassName} style={{ fontSize: directorSize }}>
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
    </DetailSection>
  );
}

/**
 * Corps partagé drawer desktop + plein écran mobile.
 */
export default function LeadDetailBody({
  lead,
  onUpdateLead,
  onDeleteLead,
  canAssignLead = true,
  canDeleteLead = false,
  currentUserId,
  teamMembers,
  variant = 'desktop',
  headerCompact = false,
  headerTitleId,
}: LeadDetailBodyProps) {
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setNote('');
  }, [lead.id]);

  const saveNote = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavingNote(true);
    const stamp = formatDate(new Date().toISOString());
    const nextNotes = lead.notes?.trim()
      ? `${lead.notes.trim()}\n\n[${stamp}] ${trimmed}`
      : trimmed;
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
  const isMobile = variant === 'mobile';
  const selectClass = isMobile
    ? 'flex w-full items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-3 text-left text-[14px] text-ink transition-colors hover:border-black/12 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100'
    : DEFAULT_SELECT;
  const noteDirty = Boolean(note.trim());
  const canSave = noteDirty && !savingNote;
  const linkClass = isMobile
    ? 'flex min-h-[44px] items-center gap-2 font-medium text-[#3D5A80]'
    : 'flex items-center gap-2 text-accent-dark hover:underline';

  return (
    <>
      <LeadDetailHeader
        lead={lead}
        compact={headerCompact}
        titleId={headerTitleId}
      />

      {isEnterprise && (
        <EnterpriseBlock
          lead={lead}
          linkClassName={linkClass}
          directorSize={isMobile ? 14 : 13}
        />
      )}

      <LeadOwnerBlock lead={lead} />

      <LeadApproachScript lead={lead} />

      {lead.marcheStatut === 'hors_marche' && lead.marcheVerifieLe && (
        <DetailSection>
          <LeadMarketCheck
            lead={lead}
            tourAnchor={isMobile ? 'drawer-market-mobile' : 'drawer-market'}
          />
        </DetailSection>
      )}

      <DetailSection>
        <div data-tour={isMobile ? 'drawer-signals-mobile' : 'drawer-signals'}>
          <DetailSectionLabel>Signaux détectés</DetailSectionLabel>
          <LeadDisplaySignals
            key={lead.id}
            displaySignals={lead.displaySignals}
            dpeDate={lead.dpeDate}
          />
        </div>
      </DetailSection>

      <LeadImmeubleContacts
        lead={lead}
        tourAnchor={isMobile ? 'drawer-contacts-mobile' : 'drawer-contacts'}
      />

      <DetailSection>
        <DetailSectionLabel>Gestion du lead</DetailSectionLabel>
        <div className="space-y-4">
          <LeadStatusControl
            lead={lead}
            onUpdateLead={onUpdateLead}
            selectTriggerClassName={selectClass}
            reasonFontSize={isMobile ? 14 : undefined}
            tourAnchor={isMobile ? 'drawer-status-mobile' : 'drawer-status'}
          />
          <LeadAssigneeControl
            lead={lead}
            teamMembers={teamMembers}
            onUpdateLead={onUpdateLead}
            canAssignAnyone={canAssignLead}
            currentUserId={currentUserId}
            selectTriggerClassName={selectClass}
          />
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
              className={`placeholder-mute/60 min-h-[100px] w-full resize-y rounded-xl border border-black/8 bg-white px-4 py-3 text-ink focus:outline-none ${
                isMobile
                  ? 'focus:border-[#E8743C]/40 focus:ring-2 focus:ring-[#E8743C]/15'
                  : 'focus:border-accent/40'
              }`}
              style={{ fontSize: isMobile ? 14 : 13, lineHeight: 1.6 }}
            />
            {lead.notes?.trim() && (
              <p
                className="mt-2 whitespace-pre-wrap rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-ink"
                style={{ fontSize: isMobile ? 13 : 12.5, lineHeight: 1.55 }}
              >
                {lead.notes}
              </p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void saveNote();
              }}
              disabled={!canSave}
              className={`mt-3 inline-flex items-center justify-center rounded-[10px] font-semibold transition-colors ${
                isMobile ? 'min-h-[44px] px-5' : 'px-[18px] py-2'
              } ${
                canSave
                  ? 'bg-[#E8743C] text-white hover:bg-[#C25E2C]'
                  : 'cursor-not-allowed bg-[#E8743C]/35 text-white'
              }`}
              style={{ fontSize: isMobile ? 14 : 13 }}
            >
              {savingNote ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <LeadDeleteSection
          leadId={lead.id}
          onDelete={onDeleteLead}
          canDelete={canDeleteLead}
          className="mt-2"
        />
      </DetailSection>
    </>
  );
}
