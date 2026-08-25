'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Mic } from 'lucide-react';
import type { TodayCard } from '@/lib/today/cards';
import type { Lead } from '@/types/lead';
import type { GeoCoord } from '@/lib/carte/coords';
import { dateKeyParis } from '@/lib/today/calendar';
import { notifyError } from '@/lib/notify';
import { useVoiceCapture } from '@/components/dashboard/voice/VoiceCaptureProvider';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import TodayCardView from './TodayCardView';
import AgencyOverviewBlock from './AgencyOverviewBlock';
import type { AgencyOverview } from '@/lib/today/agency-overview';
import { organizeTodayLayout, visualLevel } from '@/lib/today/visual-level';
import TodayStatusBand from './TodayStatusBand';
import SortiePanel from './SortiePanel';
import SortieMode from './SortieMode';
import TodayTermineBlock from './TodayTermineBlock';
import type { SortiePlan, SortieProgress } from '@/lib/today/sortie';
import { sortieStorageKey } from '@/lib/today/sortie';

type DoneItem = { key: string; headline: string; at: string };

function readJson<T>(key: string, fallback: T): T {
  if (typeof sessionStorage === 'undefined') return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function EmptyState({ onDictate }: { onDictate: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--primary-100)' }}
        aria-hidden
      >
        <Check size={26} strokeWidth={2.2} style={{ color: 'var(--primary-700)' }} />
      </div>
      <h2 className="mt-6 text-[19px] font-semibold text-text-strong">Vous êtes à jour.</h2>
      <p className="mt-2 max-w-md text-pretty text-[14px] text-text-muted" style={{ lineHeight: 1.6 }}>
        Rien ne vous attend pour le moment. Ce que vous croisez sur le terrain se note ici en quelques secondes.
      </p>
      <div className="mt-8">
        <WorkspaceButton type="button" onClick={onDictate}>
          <Mic size={16} strokeWidth={2} aria-hidden />
          Dicter une note
        </WorkspaceButton>
      </div>
    </div>
  );
}

export default function TodayClient({
  initialCards,
  initialLeads,
  profileId,
  firstName,
  sectorCenter,
  agencyOverview = null,
  relancesProgrammees = 0,
  rapprochements = 0,
}: {
  initialCards: TodayCard[];
  initialLeads: Lead[];
  profileId: string;
  firstName: string;
  sectorCenter: GeoCoord | null;
  agencyOverview?: AgencyOverview | null;
  relancesProgrammees?: number;
  rapprochements?: number;
}) {
  const day = dateKeyParis(new Date());
  const [cards, setCards] = useState(initialCards);
  const [doneToday, setDoneToday] = useState<DoneItem[]>([]);
  const [termineOpen, setTermineOpen] = useState(false);
  const [sortieOpen, setSortieOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<SortiePlan | null>(null);
  const [sortieProgress, setSortieProgress] = useState<SortieProgress>({
    signature: '',
    done: [],
    skipped: [],
    dictees: [],
  });
  const { openCapture } = useVoiceCapture();
  const now = useMemo(() => new Date(), [day]);

  const initialTotal = initialCards.length;
  const hadLevel1Initially = useMemo(
    () => initialCards.some((c) => visualLevel(c) === 1),
    [initialCards],
  );

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  useEffect(() => {
    setDoneToday(readJson(`priimo-today-done:${day}`, []));
    setSortieProgress(
      readJson(sortieStorageKey(profileId, day), {
        signature: '',
        done: [],
        skipped: [],
        dictees: [],
      }),
    );
  }, [day, profileId]);

  useEffect(() => {
    sessionStorage.setItem(`priimo-today-done:${day}`, JSON.stringify(doneToday));
  }, [day, doneToday]);

  useEffect(() => {
    sessionStorage.setItem(sortieStorageKey(profileId, day), JSON.stringify(sortieProgress));
  }, [day, profileId, sortieProgress]);

  const layout = useMemo(() => organizeTodayLayout(cards, now, true), [cards, now]);
  const workCards = useMemo(
    () => [...layout.level1, ...layout.level2, ...layout.level3Other],
    [layout],
  );

  const remaining = cards.length;
  const total = remaining + doneToday.length;
  const emptyKind = total === 0 && initialTotal === 0 ? 'rien' : remaining === 0 && total > 0 ? 'bouclee' : null;
  const noUrgent =
    hadLevel1Initially && layout.level1.length === 0 && (remaining > 0 || doneToday.length > 0);

  async function dismiss(card: TodayCard, snoozedUntil: string | null, asDone = false) {
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
      notifyError("La carte n'a pas pu être mise de côté");
    }
  }

  function handleSnooze(card: TodayCard, days: number) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(6, 0, 0, 0);
    void dismiss(card, until.toISOString());
  }

  function handleStartSortie(plan: SortiePlan) {
    setActivePlan(plan);
    setSortieProgress((prev) =>
      prev.signature === plan.signature ? prev : { signature: plan.signature, done: [], skipped: [], dictees: [] },
    );
    setSortieOpen(true);
  }

  function markSortieDone(key: string) {
    setSortieProgress((prev) =>
      prev.done.includes(key) ? prev : { ...prev, done: [...prev.done, key] },
    );
  }

  return (
    <div className="w-full min-w-0 pt-2 max-md:pb-24">
      <TodayStatusBand
        prenom={firstName}
        remaining={remaining}
        total={total}
        initialTotal={initialTotal}
        emptyKind={emptyKind}
        relancesProgrammees={relancesProgrammees}
        rapprochements={rapprochements}
        noUrgent={noUrgent}
      />

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <div className="min-w-0 lg:col-span-3">
          {workCards.length === 0 && emptyKind === 'rien' ? (
            <EmptyState onDictate={openCapture} />
          ) : workCards.length === 0 ? (
            <p className="py-6 text-[14px] text-text-muted">Aucune tâche en attente dans la pile.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {layout.level1ContextLine ? (
                <p className="text-[13.5px] font-medium text-text-muted">{layout.level1ContextLine}</p>
              ) : null}
              {layout.level1.map((card) => (
                <TodayCardView
                  key={card.key}
                  card={card}
                  onSnooze={handleSnooze}
                  onIgnore={(c) => void dismiss(c, null)}
                />
              ))}
              {layout.level2.map((card) => (
                <TodayCardView
                  key={card.key}
                  card={card}
                  onSnooze={handleSnooze}
                  onIgnore={(c) => void dismiss(c, null)}
                />
              ))}
              {layout.level3Other.map((card) => (
                <TodayCardView
                  key={card.key}
                  card={card}
                  onSnooze={handleSnooze}
                  onIgnore={(c) => void dismiss(c, null)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 lg:col-span-2">
          <div className="lg:sticky lg:top-4">
            <SortiePanel
              leads={initialLeads}
              profileId={profileId}
              sectorCenter={sectorCenter}
              progress={sortieProgress}
              onStart={handleStartSortie}
            />
          </div>
        </div>
      </div>

      {total > 0 || doneToday.length > 0 ? (
        <TodayTermineBlock
          items={doneToday}
          expanded={termineOpen || emptyKind === 'bouclee'}
          onToggle={() => setTermineOpen((v) => !v)}
        />
      ) : null}

      {agencyOverview ? (
        <div className="mt-8">
          <AgencyOverviewBlock overview={agencyOverview} defaultCollapsed />
        </div>
      ) : null}

      {sortieOpen && activePlan ? (
        <SortieMode
          plan={activePlan}
          progress={sortieProgress}
          onClose={() => setSortieOpen(false)}
          onDone={(stop) => markSortieDone(stop.key)}
          onSkip={(stop) =>
            setSortieProgress((prev) =>
              prev.skipped.includes(stop.key) ? prev : { ...prev, skipped: [...prev.skipped, stop.key] },
            )
          }
          onDicter={(stop) => {
            setSortieProgress((prev) =>
              prev.dictees.includes(stop.key) ? prev : { ...prev, dictees: [...prev.dictees, stop.key] },
            );
            openCapture({ adresse: stop.address });
          }}
        />
      ) : null}
    </div>
  );
}
