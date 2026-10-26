'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import ScoreRing from '@/components/dashboard/ScoreRing';
import FacadeLead from '@/components/dashboard/FacadeLead';
import InfoTooltip from '@/components/ui/InfoTooltip';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';
import { nomProprietaireAffiche, noteEssentielle, signauxEssentiels } from '@/lib/lead-apercu';
import { FIELD } from '@/lib/today/field';
import { daysSinceTaken, isStaleEntree } from '@/lib/pipeline/stale';
import { prixBien, resumeBien } from '@/lib/pipeline/bien';

export default function PipelineLeadCard({
  lead,
  stage,
  assignee,
  overlay = false,
  onOpen,
}: {
  lead: Lead;
  stage: LeadStage | undefined;
  assignee: TeamMember | undefined;
  overlay?: boolean;
  onOpen: (id: string) => void;
}) {
  const sortable = useSortable({ id: lead.id, disabled: overlay });
  const stale = isStaleEntree(stage?.type, lead.takenAt);
  const days = daysSinceTaken(lead.takenAt);
  const signaux = signauxEssentiels(lead);
  const proprio = nomProprietaireAffiche(lead);
  const note = noteEssentielle(lead.notes);
  const resume = resumeBien(lead);
  const prix = prixBien(lead.bien?.price);
  const photo = lead.bien?.photo ?? null;
  // Translate seul : entre deux colonnes de hauteurs différentes, la carte ne s'étire pas.
  const style: CSSProperties = overlay
    ? { transform: 'rotate(1.5deg)' }
    : {
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.35 : 1,
        touchAction: 'manipulation',
      };
  const suppressClick = sortable.isDragging || Boolean(sortable.transform);

  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={() => {
        if (!overlay && !suppressClick) onOpen(lead.id);
      }}
      className={`w-full min-w-0 cursor-grab touch-manipulation select-none overflow-hidden rounded-clay bg-white text-left shadow-clay-sm ${
        overlay ? 'cursor-grabbing shadow-clay' : ''
      }`}
    >
      <div className="relative h-[88px] overflow-hidden bg-[#F1EFE8]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo de portail, hors domaines optimisés
          <img
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : (
          <FacadeLead
            leadId={lead.id}
            format="liste"
            lazy
            className="pointer-events-none !absolute inset-x-0 top-0 h-[142%] w-full rounded-none object-cover object-top"
          />
        )}
        {lead.score > 0 ? (
          <div className="absolute right-2 top-2">
            <ScoreRing score={lead.score} size={28} />
          </div>
        ) : null}
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="truncate text-[13.5px] font-semibold text-text-strong">{lead.address}</p>
        {resume || lead.city ? (
          <p className="mt-0.5 truncate text-[11.5px] text-text-muted">
            {[resume, lead.city].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        {prix ? (
          <p className="mt-1 text-[13px] font-semibold tabular-nums text-text-strong">{prix}</p>
        ) : null}

        {signaux.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {signaux.map((signal) => (
              <span
                key={signal}
                className="inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-text-strong"
                style={{ backgroundColor: '#FFE0C4' }}
              >
                {signal}
              </span>
            ))}
          </div>
        ) : null}

        {proprio ? (
          <p className="mt-1.5 truncate text-[12px] font-medium text-text-strong">{proprio}</p>
        ) : null}

        {note ? (
          <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-text-muted">{note}</p>
        ) : null}

        {stale && days != null ? (
          <div className="mt-2">
            <InfoTooltip
              content={`Pris il y a ${days} jour${days > 1 ? 's' : ''}, jamais contacté`}
              placement="top-start"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: FIELD.orange }}
                aria-label={`Pris il y a ${days} jours, jamais contacté`}
              />
            </InfoTooltip>
          </div>
        ) : null}

        {assignee ? (
          <div
            className={`mt-2.5 flex items-center gap-2 ${
              stage?.cle === 'mandat' || stage?.type === 'gagne'
                ? 'rounded-xl bg-[#D5EADF] px-2 py-1.5'
                : 'border-t border-black/[0.06] pt-2'
            }`}
          >
            <ProfileAvatar
              firstName={assignee.firstName}
              lastName={assignee.lastName}
              avatarUrl={assignee.avatarUrl}
              size={32}
              className="shrink-0"
            />
            <span className="min-w-0 truncate text-[13px] font-semibold text-text-strong">
              {assignee.fullName}
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );
}
