'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  Handshake,
  HousePlus,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Users,
  Inbox,
  Calculator,
  type LucideIcon,
} from 'lucide-react';
import type { TodayCard, TodayCardType } from '@/lib/today/cards';
import { FIELD, ctaCourt, ctaLink, dotColorFor, pastelFor } from '@/lib/today/field';
import { isOverdue, temporalMention, visualLevel } from '@/lib/today/visual-level';
import WorkspaceCard from '@/components/dashboard/workspace/WorkspaceCard';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ActionMenu from '@/components/dashboard/workspace/ActionMenu';

const TYPE_ICONS: Record<TodayCardType, LucideIcon> = {
  echeance_contractuelle: AlertTriangle,
  post_visite: MessageSquare,
  promesse: Handshake,
  mandat_sans_visite: Building2,
  relance: Phone,
  rapprochement: Users,
  nouvelle_adresse: MapPin,
  rendez_vous: Calendar,
  transmis: Send,
  alerte: Bell,
  demande_portail: Inbox,
  demande_estimation: HousePlus,
  estimation_vuee: Calculator,
};

export default function TodayCardView({
  card,
  onSnooze,
  onIgnore,
}: {
  card: TodayCard;
  onSnooze: (card: TodayCard, days: number) => void;
  onIgnore: (card: TodayCard) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const level = visualLevel(card);
  const Icon = TYPE_ICONS[card.type];
  const mention = temporalMention(card);
  const overdue = isOverdue(card);
  const dotColor = dotColorFor(card.type);

  function runPrimary() {
    const action = card.action;
    switch (action.kind) {
      case 'appeler':
        window.location.href = `tel:${action.phone.replace(/\s+/g, '')}`;
        break;
      case 'ouvrir_contact':
        router.push(`/dashboard/contacts?fiche=${action.contactId}`);
        break;
      case 'ouvrir_lead':
        router.push(`/dashboard/prospection?lead=${action.leadId}`);
        break;
      case 'voir_acquereurs':
        setExpanded((v) => !v);
        break;
      case 'ouvrir_bien':
        router.push(`/dashboard/biens?fiche=${action.bienId}`);
        break;
      case 'ouvrir_liste':
        router.push(`/dashboard?filtre=${action.cardType}`);
        break;
      case 'ouvrir_estimation':
        router.push(`/dashboard/estimation?historique=1&id=${action.estimationId}`);
        break;
      default:
        break;
    }
  }

  const isExpandable = card.action.kind === 'voir_acquereurs';

  if (level === 3) {
    return (
      <article
        className="flex min-h-[80px] items-start gap-3 rounded-[16px] px-4 py-3"
        style={{ backgroundColor: FIELD.creme }}
      >
        <span className="mt-1.5 size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden />
        <Icon size={17} strokeWidth={2.2} className="mt-1 flex-shrink-0 text-text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-strong">{card.headline}</h2>
            <ActionMenu
              items={[
                { label: 'Reporter à demain', onSelect: () => onSnooze(card, 1) },
                { label: 'Reporter à la semaine prochaine', onSelect: () => onSnooze(card, 7) },
                { label: 'Ne plus me le proposer', onSelect: () => onIgnore(card), destructive: true },
              ]}
            />
          </div>
          {card.context ? (
            <p className="mt-0.5 truncate text-[13px] text-text-muted">{card.context}</p>
          ) : null}
          <button
            type="button"
            onClick={runPrimary}
            className="mt-2 font-semibold text-text-strong underline decoration-black/25 underline-offset-2"
            style={{ fontSize: 13.5 }}
          >
            {ctaLink(card)}
          </button>
        </div>
      </article>
    );
  }

  const isBurn = level === 1;

  return (
    <WorkspaceCard className={isBurn ? '!border-0 !bg-white shadow-clay-sm' : undefined} style={isBurn ? { borderLeft: `4px solid ${overdue ? FIELD.rouge : FIELD.orange}` } : undefined}>
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-2 size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden />
          <Icon size={18} strokeWidth={2.2} className="mt-1.5 flex-shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            {mention ? (
              <p
                className="mb-1 text-right font-medium tabular-nums sm:text-left"
                style={{ fontSize: 12, color: overdue ? FIELD.rouge : FIELD.orange }}
              >
                {mention}
              </p>
            ) : null}
            <h2
              className="text-balance text-[16.5px] font-semibold text-text-strong sm:text-[19px]"
              style={{ letterSpacing: '-0.015em', lineHeight: 1.3 }}
            >
              {card.headline}
            </h2>
            <p className="mt-1.5 text-pretty text-[13px] text-text-muted sm:text-[13.5px]">{card.context}</p>
          </div>
        </div>

        <ActionMenu
          items={[
            { label: 'Reporter à demain', onSelect: () => onSnooze(card, 1) },
            { label: 'Reporter à la semaine prochaine', onSelect: () => onSnooze(card, 7) },
            { label: 'Ne plus me le proposer', onSelect: () => onIgnore(card), destructive: true },
          ]}
        />
      </div>

      <div className="mt-4 sm:mt-5">
        <WorkspaceButton type="button" onClick={runPrimary} className="max-sm:w-full">
          {card.action.kind === 'appeler' ? <Phone size={16} strokeWidth={2} aria-hidden /> : null}
          {ctaCourt(card)}
          {isExpandable ? (
            <ChevronDown
              size={16}
              strokeWidth={2}
              aria-hidden
              className="transition-transform duration-fluid-subtle ease-in-out motion-reduce:transition-none"
              style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
            />
          ) : null}
        </WorkspaceButton>
      </div>

      {expanded && card.matches ? (
        <ul className="mt-5 divide-y divide-black/[0.06] border-t border-black/[0.06]">
          {card.matches.map((m) => (
            <li key={m.contactId} className="flex items-center justify-between gap-3 py-3.5 sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-text-strong sm:text-[15px]">{m.name}</p>
                {m.raisons.length > 0 ? (
                  <p className="mt-0.5 truncate text-[12.5px] text-text-muted sm:text-[13px]">
                    {m.raisons.join(' · ')}
                  </p>
                ) : null}
              </div>
              {m.phone ? (
                <a
                  href={`tel:${m.phone.replace(/\s+/g, '')}`}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-text transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  style={{ fontSize: 13.5 }}
                >
                  <Phone size={14} strokeWidth={2} aria-hidden />
                  Appeler
                </a>
              ) : (
                <span className="flex-shrink-0 text-text-subtle" style={{ fontSize: 13 }}>
                  Pas de numéro
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </WorkspaceCard>
  );
}
