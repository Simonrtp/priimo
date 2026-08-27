'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TodayCard } from '@/lib/today/cards';
import type { FieldWeekSnapshot } from '@/lib/today/semaine';
import type { GeoCoord } from '@/lib/carte/coords';
import type { Lead } from '@/types/lead';
import type { HomeNote } from '@/lib/notes/inbox';
import type { PortfolioStats } from '@/lib/today/portfolio';
import type { DirectorMemberExceptions } from '@/lib/today/director-exceptions';
import { phraseEquipe } from '@/lib/today/accueil-vue';
import { dateKeyParis } from '@/lib/today/calendar';
import { snoozeUntil, SHELL_BG_CLASS } from '@/lib/today/field';
import {
  buildSortie,
  buildTourneeFromSortie,
  sortieStorageKey,
  type SortiePlan,
  type SortieProgress,
} from '@/lib/today/sortie';
import { organizeTodayLayout, visualLevel } from '@/lib/today/visual-level';
import { notifyError } from '@/lib/notify';
import { vibrateBrief } from './aujourdhui/tap';
import MobileAccountMenu from './MobileAccountMenu';
import { StatusBand } from './aujourdhui/StatusBand';
import {
  ConfirmDoneSheet,
  MaSemaine,
  SnoozeSheet,
  TermineBlock,
} from './aujourdhui/Blocks';
import TaskCard from './aujourdhui/TaskCard';
import PortfolioBand from '@/components/dashboard/today/PortfolioBand';
import RecentNotesCard from '@/components/dashboard/today/RecentNotesCard';
import ZoneDuJourCard from '@/components/dashboard/today/ZoneDuJourCard';
import DirectorExceptions from '@/components/dashboard/today/DirectorExceptions';
import DirectorMemberPanel from '@/components/dashboard/today/DirectorMemberPanel';

type DoneItem = { key: string; headline: string; at: string };

function doneStorageKey(day: string) {
  return `priimo-today-done:${day}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function AujourdhuiMobile({
  initialCards,
  initialLeads,
  profileId,
  firstName,
  week,
  sectorRef: _sectorRef,
  portfolio,
  recentNotes,
  agencyOrigin,
  isDirector = false,
  previewingAgent = false,
  directorExceptions = [],
}: {
  initialCards: TodayCard[];
  initialLeads: Lead[];
  profileId: string;
  firstName: string;
  week: FieldWeekSnapshot;
  sectorRef: GeoCoord | null;
  portfolio: PortfolioStats;
  recentNotes: readonly HomeNote[];
  agencyOrigin: GeoCoord | null;
  isDirector?: boolean;
  previewingAgent?: boolean;
  directorExceptions?: readonly DirectorMemberExceptions[];
}) {
  const router = useRouter();
  const day = dateKeyParis(new Date());
  const now = useMemo(() => new Date(), [day]);
  const [cards, setCards] = useState(initialCards);
  const [doneToday, setDoneToday] = useState<DoneItem[]>([]);
  const [sortieProgress, setSortieProgress] = useState<SortieProgress>({
    signature: '',
    done: [],
    skipped: [],
    dictees: [],
  });
  const [origin, setOrigin] = useState<GeoCoord | null>(agencyOrigin);
  const [accountOpen, setAccountOpen] = useState(false);
  const [snoozeCard, setSnoozeCard] = useState<TodayCard | null>(null);
  const [confirmDone, setConfirmDone] = useState<TodayCard | null>(null);
  const [termineOpen, setTermineOpen] = useState(false);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const directorLayout = isDirector && !previewingAgent;

  const initialTotal = initialCards.length;
  const hadLevel1Initially = useMemo(
    () => initialCards.some((c) => visualLevel(c) === 1),
    [initialCards],
  );

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  useEffect(() => {
    setDoneToday(readJson(doneStorageKey(day), []));
  }, [day]);

  useEffect(() => {
    // Plan de sortie : toujours depuis l'agence. Le recalcul GPS se propose dans /tournee.
    setOrigin(agencyOrigin);
  }, [agencyOrigin]);

  useEffect(() => {
    sessionStorage.setItem(doneStorageKey(day), JSON.stringify(doneToday));
  }, [day, doneToday]);

  const sortiePlan = useMemo(
    () => buildSortie(initialLeads, profileId, origin),
    [initialLeads, profileId, origin],
  );
  const tournee = useMemo(() => buildTourneeFromSortie(sortiePlan), [sortiePlan]);

  useEffect(() => {
    const signature = sortiePlan?.signature ?? '';
    const stored = readJson<SortieProgress>(sortieStorageKey(profileId, day), {
      signature: '',
      done: [],
      skipped: [],
      dictees: [],
    });
    if (stored.signature === signature) {
      setSortieProgress(stored);
      return;
    }
    setSortieProgress({ signature, done: [], skipped: [], dictees: [] });
  }, [day, profileId, sortiePlan?.signature]);

  useEffect(() => {
    sessionStorage.setItem(sortieStorageKey(profileId, day), JSON.stringify(sortieProgress));
  }, [day, profileId, sortieProgress]);

  const layout = useMemo(
    () => organizeTodayLayout(cards, now, tournee != null),
    [cards, now, tournee],
  );

  const remaining = cards.length;
  const total = remaining + doneToday.length;
  const emptyKind =
    total === 0 && initialTotal === 0 ? 'rien' : remaining === 0 && total > 0 ? 'bouclee' : null;
  const termineExpanded = termineOpen || emptyKind === 'bouclee';
  const noUrgent =
    hadLevel1Initially && layout.level1.length === 0 && (remaining > 0 || doneToday.length > 0);

  async function dismiss(card: TodayCard, snoozedUntil: string | null, asDone: boolean) {
    const previous = cards;
    setCards((list) => list.filter((c) => c.key !== card.key));
    if (asDone) {
      setDoneToday((list) =>
        list.some((d) => d.key === card.key)
          ? list
          : [...list, { key: card.key, headline: card.headline, at: new Date().toISOString() }],
      );
    }
    try {
      const res = await fetch('/api/dashboard/today/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardKey: card.key, snoozedUntil }),
      });
      if (!res.ok) throw new Error('dismiss failed');
    } catch {
      setCards(previous);
      if (asDone) setDoneToday((list) => list.filter((d) => d.key !== card.key));
      notifyError("L'action n'a pas pu être mise de côté");
    }
  }

  function runAction(card: TodayCard) {
    const action = card.action;
    if (action.kind === 'appeler') {
      window.location.href = `tel:${action.phone.replace(/\s+/g, '')}`;
      return;
    }
    if (action.kind === 'ouvrir_contact') {
      router.push(`/dashboard/contacts?fiche=${action.contactId}`);
      return;
    }
    if (action.kind === 'ouvrir_lead') {
      router.push(`/dashboard/prospection?lead=${action.leadId}`);
      return;
    }
    if (action.kind === 'voir_acquereurs') {
      router.push(`/dashboard/biens?fiche=${action.bienId}`);
      return;
    }
    if (action.kind === 'ouvrir_bien') {
      router.push(`/dashboard/biens?fiche=${action.bienId}`);
      return;
    }
    if (action.kind === 'ouvrir_promesse') {
      router.push('/dashboard');
      return;
    }
    if (action.kind === 'ouvrir_rdv') {
      router.push('/dashboard');
      return;
    }
    if (action.kind === 'ouvrir_liste') {
      router.push(`/dashboard?filtre=${action.cardType}`);
      return;
    }
    if (action.kind === 'ouvrir_estimation') {
      router.push(`/dashboard/estimation?historique=1&id=${action.estimationId}`);
    }
  }

  function renderTaskCard(card: TodayCard) {
    return (
      <TaskCard
        card={card}
        onAction={() => runAction(card)}
        onSnooze={() => setSnoozeCard(card)}
        onDone={() => void dismiss(card, null, true)}
        onConfirmDone={() => setConfirmDone(card)}
      />
    );
  }

  function startZone(_plan: SortiePlan) {
    router.push('/dashboard/tournee');
  }

  return (
    <div className="field-page-enter flex min-h-0 flex-1 flex-col bg-[#15202F]">
      <div className={`${SHELL_BG_CLASS} flex-shrink-0 overflow-hidden`}>
        <StatusBand
          prenom={firstName}
          remaining={remaining}
          emptyKind={directorLayout ? null : emptyKind}
          relancesProgrammees={week.relancesProgrammees}
          rapprochements={week.rapprochements}
          noUrgent={noUrgent}
          onAccount={() => setAccountOpen(true)}
          tone="shell"
          directorTitle={directorLayout ? phraseEquipe(directorExceptions.length) : null}
        />
      </div>

      <div className="relative z-[1] -mt-2 flex min-h-0 flex-1 flex-col gap-5 rounded-t-[24px] bg-bg-base px-0 pb-4 pt-6">
        {previewingAgent ? (
          <p className="mx-4 rounded-clay border border-black/[0.06] bg-white px-4 py-2.5 text-[13px] text-text-muted">
            Vue agent — ce que voit un collaborateur.{' '}
            <a href="/dashboard/settings?tab=profile" className="font-medium text-text underline underline-offset-2">
              Désactiver dans Paramètres
            </a>
            .
          </p>
        ) : null}
        <div className="px-4">
          <PortfolioBand stats={portfolio} />
        </div>

        {directorLayout ? (
          <div className="px-4">
            <DirectorExceptions rows={directorExceptions} onOpenMember={setOpenMemberId} />
          </div>
        ) : emptyKind !== 'rien' ? (
          <>
            {layout.level1ContextLine ? (
              <p className="px-4 text-[13px] font-medium text-text-muted">{layout.level1ContextLine}</p>
            ) : null}

            {layout.level1.length > 0 ? (
              <ul className="flex flex-col gap-4 px-4">
                {layout.level1.map((card) => (
                  <li key={card.key}>{renderTaskCard(card)}</li>
                ))}
              </ul>
            ) : null}

            {layout.level2.length > 0 ? (
              <ul className="flex flex-col gap-4 px-4">
                {layout.level2.map((card) => (
                  <li key={card.key}>{renderTaskCard(card)}</li>
                ))}
              </ul>
            ) : null}

            {layout.level3Other.length > 0 ? (
              <ul className="flex flex-col gap-3 px-4">
                {layout.level3Other.map((card) => (
                  <li key={card.key}>{renderTaskCard(card)}</li>
                ))}
              </ul>
            ) : null}

            <TermineBlock
              items={doneToday}
              expanded={termineExpanded}
              onToggle={() => setTermineOpen((v) => !v)}
            />
          </>
        ) : null}

        <div className="flex flex-col gap-4 px-4">
          <RecentNotesCard notes={recentNotes} />
          {directorLayout ? null : <ZoneDuJourCard plan={sortiePlan} onStart={startZone} />}
        </div>

        {directorLayout ? null : (
          <div className="mt-auto pt-2">
            <MaSemaine
              notes={week.notes}
              contacts={week.contacts}
              immeubles={week.immeubles}
              weekNoteGoal={week.weekNoteGoal}
            />
          </div>
        )}
      </div>

      <SnoozeSheet
        open={snoozeCard !== null}
        onClose={() => setSnoozeCard(null)}
        onPick={(kind) => {
          const card = snoozeCard;
          setSnoozeCard(null);
          if (card) void dismiss(card, snoozeUntil(kind).toISOString(), false);
        }}
      />

      <ConfirmDoneSheet
        open={confirmDone !== null}
        headline={confirmDone?.headline ?? ''}
        onClose={() => setConfirmDone(null)}
        onConfirm={() => {
          const card = confirmDone;
          setConfirmDone(null);
          if (card) {
            vibrateBrief();
            void dismiss(card, null, true);
          }
        }}
      />

      <MobileAccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />

      {openMemberId ? (
        <DirectorMemberPanel memberId={openMemberId} onClose={() => setOpenMemberId(null)} />
      ) : null}
    </div>
  );
}
