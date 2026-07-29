'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Mail as MailIcon, Phone as PhoneIcon } from 'lucide-react';
import type { Lead, TeamMember } from '@/types/lead';
import { isSciDirectorPending } from '@/types/lead';
import { useUser } from '@/lib/hooks/useUser';
import { ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';
import { notifyError, notifySuccess } from '@/lib/notify';
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

/** En-tête d’une note : date + auteur + heure. */
function formatNoteMeta(author: string, at: Date = new Date()): string {
  const day = formatDate(at.toISOString());
  const time = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `[${day}] Fait par : ${author} à ${time}`;
}

function resolveAuthorName(
  profile: { first_name?: string | null; last_name?: string | null },
  currentUserId: string | null | undefined,
  teamMembers: TeamMember[],
): string {
  const fromProfile = [profile.first_name, profile.last_name]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' ');
  if (fromProfile) return fromProfile;
  if (currentUserId) {
    const member = teamMembers.find((m) => m.id === currentUserId);
    if (member?.fullName?.trim()) return member.fullName.trim();
  }
  return 'Agent';
}

type NoteEntry = { meta: string | null; body: string };

/** Découpe le blob notes pour un affichage lisible (rétrocompat anciennes notes). */
function parseNotesEntries(raw: string): NoteEntry[] {
  return raw
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      const first = lines[0] ?? '';
      const authored = first.match(
        /^\[([^\]]+)\]\s*Fait par\s*:\s*(.+?)\s+à\s+(\d{1,2}[:h]\d{2})\s*$/i,
      );
      if (authored) {
        return {
          meta: `${authored[1]} · Fait par : ${authored[2]} à ${authored[3].replace('h', ':')}`,
          body: lines.slice(1).join('\n').trim() || '—',
        };
      }
      const dated = first.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (dated) {
        const restSameLine = dated[2]?.trim() ?? '';
        const rest = [restSameLine, ...lines.slice(1)].filter(Boolean).join('\n').trim();
        return {
          meta: dated[1],
          body: rest || '—',
        };
      }
      return { meta: null, body: block };
    });
}

type LeadDetailBodyProps = {
  lead: Lead;
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
  onScriptApprocheChange?: (script: NonNullable<Lead['scriptApproche']>) => void;
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
  onScriptApprocheChange,
  canAssignLead = true,
  canDeleteLead = false,
  currentUserId,
  teamMembers,
  variant = 'desktop',
  headerCompact = false,
  headerTitleId,
}: LeadDetailBodyProps) {
  const { profile } = useUser();
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const authorName = useMemo(
    () => resolveAuthorName(profile, currentUserId, teamMembers),
    [profile, currentUserId, teamMembers],
  );

  const noteEntries = useMemo(
    () => (lead.notes?.trim() ? parseNotesEntries(lead.notes) : []),
    [lead.notes],
  );

  useEffect(() => {
    setNote('');
  }, [lead.id]);

  const saveNote = useCallback(async () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    setSavingNote(true);
    const entry = `${formatNoteMeta(authorName)}\n${trimmed}`;
    const nextNotes = lead.notes?.trim() ? `${lead.notes.trim()}\n\n${entry}` : entry;
    try {
      await onUpdateLead(lead.id, { notes: nextNotes });
      setNote('');
      notifySuccess('Note enregistrée', { id: `note-${lead.id}` });
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Impossible d'enregistrer la note.");
    } finally {
      setSavingNote(false);
    }
  }, [authorName, lead.id, lead.notes, note, onUpdateLead]);

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

      <LeadApproachScript lead={lead} onScriptChange={onScriptApprocheChange} />

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
            {noteEntries.length > 0 && (
              <ul className="mt-2 space-y-2">
                {noteEntries.map((entry, index) => (
                  <li
                    key={`${entry.meta ?? 'note'}-${index}`}
                    className="rounded-xl border border-black/[0.06] bg-white px-4 py-3"
                  >
                    {entry.meta && (
                      <p className="text-mute" style={{ fontSize: 11, lineHeight: 1.4 }}>
                        {entry.meta}
                      </p>
                    )}
                    <p
                      className={`whitespace-pre-wrap text-ink ${entry.meta ? 'mt-1' : ''}`}
                      style={{ fontSize: isMobile ? 13 : 12.5, lineHeight: 1.55 }}
                    >
                      {entry.body}
                    </p>
                  </li>
                ))}
              </ul>
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
