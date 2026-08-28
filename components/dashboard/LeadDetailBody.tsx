'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lead, TeamMember } from '@/types/lead';
import { useUser } from '@/lib/hooks/useUser';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatDate } from '@/lib/utils';
import LeadDetailHeader from './LeadDetailHeader';
import FacadeLead from './FacadeLead';
import LeadDisplaySignals from './LeadDisplaySignals';
import LeadDeleteSection from './LeadDeleteSection';
import LeadAssigneeControl from './LeadAssigneeControl';
import ActionMenu from '@/components/dashboard/workspace/ActionMenu';
import { postAgencyAlert } from '@/lib/agency/post-alert';
import { LeadWhoYouSpeakTo } from './LeadOwnerContacts';
import LeadStatusControl from './LeadStatusControl';
import LeadApproachScript from './LeadApproachScript';
import LeadActionBar from './LeadActionBar';
import { DetailSection, DetailSectionLabel } from './LeadDetailSection';
import NotesTerrainList from '@/components/dashboard/notes/NotesTerrainList';

const SUIVI_SELECT =
  'flex w-full items-center justify-between gap-2 rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-left text-[12.5px] text-ink/85 transition-colors duration-fluid-subtle ease-in-out hover:border-black/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10';

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

type NoteEntry = {
  dateLabel: string | null;
  authorLabel: string | null;
  body: string;
  hasAuthor: boolean;
};

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
          dateLabel: authored[1],
          authorLabel: `Fait par : ${authored[2]} à ${authored[3].replace('h', ':')}`,
          body: lines.slice(1).join('\n').trim() || '—',
          hasAuthor: true,
        };
      }
      const dated = first.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (dated) {
        const restSameLine = dated[2]?.trim() ?? '';
        const rest = [restSameLine, ...lines.slice(1)].filter(Boolean).join('\n').trim();
        return {
          dateLabel: dated[1],
          authorLabel: null,
          body: rest || '—',
          hasAuthor: false,
        };
      }
      return { dateLabel: null, authorLabel: null, body: block, hasAuthor: false };
    });
}

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
  const { profile } = useUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const authorName = useMemo(
    () => resolveAuthorName(profile, currentUserId, teamMembers),
    [profile, currentUserId, teamMembers],
  );

  const noteEntries = useMemo(() => {
    const parsed = lead.notes?.trim() ? parseNotesEntries(lead.notes) : [];
    // Plus récente en premier (les notes sont appendées en fin de blob).
    return [...parsed].reverse();
  }, [lead.notes]);

  const showAuthorOnNotes = useMemo(
    () => noteEntries.length > 0 && noteEntries.every((e) => e.hasAuthor),
    [noteEntries],
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

  const isMobile = variant === 'mobile';
  const noteDirty = Boolean(note.trim());
  const canAdd = noteDirty && !savingNote;
  const padX = isMobile ? 'px-4 min-[400px]:px-5' : 'px-7';
  const suiviSelect = isMobile
    ? 'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-left text-[14px] text-ink/90 transition-colors duration-fluid-subtle ease-in-out hover:border-black/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10'
    : SUIVI_SELECT;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Pas de padding horizontal ici : sinon le sticky laisse le contenu défiler dans les marges. */}
      <div
        ref={scrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className={`${padX} pt-4 min-[400px]:pt-5`}>
          <FacadeLead leadId={lead.id} className="h-[200px] w-full" />
          <p className="mt-1.5 text-mute" style={{ fontSize: 12 }}>
            Façade de l&apos;immeuble
          </p>
        </div>

        <LeadDetailHeader
          lead={lead}
          dense={headerCompact || isMobile}
          titleId={headerTitleId}
          scrollParentRef={scrollRef}
          marketTourAnchor={isMobile ? 'drawer-market-mobile' : 'drawer-market'}
          padClassName={padX}
        />

        <div className={`min-w-0 ${padX} pb-6`}>
          <DetailSection>
            <div data-tour={isMobile ? 'drawer-signals-mobile' : 'drawer-signals'}>
              <DetailSectionLabel>Pourquoi cette adresse</DetailSectionLabel>
              <LeadDisplaySignals
                key={lead.id}
                displaySignals={lead.displaySignals}
                dpeDate={lead.dpeDate}
              />
            </div>
          </DetailSection>

          <LeadWhoYouSpeakTo
            lead={lead}
            tourAnchor={isMobile ? 'drawer-contacts-mobile' : 'drawer-contacts'}
          />

          <LeadApproachScript lead={lead} />

          <DetailSection>
            <div className="flex items-start justify-between gap-3">
              <DetailSectionLabel>Suivi</DetailSectionLabel>
              <ActionMenu
                items={[
                  {
                    label: 'Signaler une baisse de prix',
                    onSelect: () => {
                      void postAgencyAlert({ kind: 'baisse_prix', leadId: lead.id });
                    },
                  },
                  {
                    label: 'Signaler un mandat à récupérer',
                    onSelect: () => {
                      void postAgencyAlert({ kind: 'mandat_a_recuperer', leadId: lead.id });
                    },
                  },
                ]}
              />
            </div>
            <div className="space-y-3.5">
              <LeadStatusControl
                lead={lead}
                onUpdateLead={onUpdateLead}
                selectTriggerClassName={suiviSelect}
                reasonFontSize={isMobile ? 14 : 12.5}
                labelClassName="mb-1 text-mute/80"
                labelFontSize={11}
                tourAnchor={isMobile ? 'drawer-status-mobile' : 'drawer-status'}
                stackTrailing={isMobile}
                trailing={
                  <LeadAssigneeControl
                    lead={lead}
                    teamMembers={teamMembers}
                    onUpdateLead={onUpdateLead}
                    canAssignAnyone={canAssignLead}
                    currentUserId={currentUserId}
                    selectTriggerClassName={suiviSelect}
                  />
                }
              />

              <div>
                <p className="mb-1 text-mute/80" style={{ fontSize: 11 }}>
                  Notes
                </p>
                <div className={`flex gap-2 ${isMobile ? 'flex-col items-stretch' : 'items-start'}`}>
                  <textarea
                    rows={isMobile ? 3 : 2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Ajouter une note…"
                    className="placeholder-mute/55 min-h-[64px] w-full min-w-0 resize-y rounded-lg border border-black/[0.08] bg-white px-3 py-2.5 text-ink/90 focus:border-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                    style={{ fontSize: isMobile ? 16 : 12.5, lineHeight: 1.5 }}
                  />
                  {noteDirty && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void saveNote();
                      }}
                      disabled={!canAdd}
                      className={`rounded-lg font-semibold transition-colors duration-fluid-subtle ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
                        isMobile ? 'min-h-11 w-full px-4 py-2.5' : 'shrink-0 px-3.5 py-2'
                      } ${
                        canAdd
                          ? 'bg-[#E8743C] text-white hover:bg-[#C25E2C]'
                          : 'cursor-not-allowed bg-black/[0.08] text-mute'
                      }`}
                      style={{ fontSize: isMobile ? 14 : 12.5 }}
                    >
                      {savingNote ? '…' : 'Ajouter'}
                    </button>
                  )}
                </div>

                {noteEntries.length > 0 && (
                  <ul className="mt-3 space-y-0 divide-y divide-black/[0.05] border-t border-black/[0.05]">
                    {noteEntries.map((entry, index) => {
                      const meta = showAuthorOnNotes
                        ? [entry.dateLabel, entry.authorLabel].filter(Boolean).join(' · ')
                        : entry.dateLabel;
                      return (
                        <li key={`${entry.dateLabel ?? 'note'}-${index}`} className="py-2.5">
                          {meta && (
                            <p className="text-mute/75" style={{ fontSize: 11, lineHeight: 1.4 }}>
                              {meta}
                            </p>
                          )}
                          <p
                            className={`whitespace-pre-wrap text-ink/85 ${meta ? 'mt-0.5' : ''}`}
                            style={{ fontSize: isMobile ? 13 : 12.5, lineHeight: 1.5 }}
                          >
                            {entry.body}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-black/[0.05] pt-4">
              <DetailSectionLabel>Notes terrain</DetailSectionLabel>
              <NotesTerrainList
                entiteType="lead"
                entiteId={lead.id}
                currentUserId={currentUserId ?? undefined}
              />
            </div>

            <div className="mt-6 border-t border-black/[0.05] pt-4">
              <LeadDeleteSection
                leadId={lead.id}
                onDelete={onDeleteLead}
                canDelete={canDeleteLead}
                className="!pt-0 text-left"
              />
            </div>
          </DetailSection>
        </div>
      </div>

      <div className={padX}>
        <LeadActionBar lead={lead} dense={isMobile} />
      </div>
    </div>
  );
}
