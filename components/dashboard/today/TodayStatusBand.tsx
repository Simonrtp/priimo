'use client';

import { dateDuJour, phraseCharge } from '@/lib/today/cards';
import { FIELD, phraseEtat, phraseNotesReturn } from '@/lib/today/field';
import ProgressRing from './ProgressRing';

export default function TodayStatusBand({
  prenom,
  remaining,
  total,
  initialTotal,
  emptyKind,
  relancesProgrammees,
  rapprochements,
  noUrgent,
}: {
  prenom: string;
  remaining: number;
  total: number;
  initialTotal: number;
  emptyKind: 'bouclee' | 'rien' | null;
  relancesProgrammees: number;
  rapprochements: number;
  noUrgent: boolean;
}) {
  const showRing = emptyKind !== 'rien' && total > 0;
  const ringComplete = emptyKind === 'bouclee' || (noUrgent && remaining > 0);
  const notesLine = phraseNotesReturn(relancesProgrammees, rapprochements);

  let title: string;
  if (emptyKind === 'rien') {
    title = phraseEtat({ remaining: 0, prenom, emptyKind: 'rien' });
  } else if (emptyKind === 'bouclee' || remaining === 0) {
    title = 'Journée bouclée.';
  } else if (noUrgent) {
    title = prenom.trim() ? `Bonjour ${prenom.trim()}.` : 'Bonjour.';
  } else {
    title = `${prenom.trim() ? `Bonjour ${prenom.trim()}. ` : 'Bonjour. '}${phraseCharge(remaining)}`;
  }

  return (
    <header className="mb-6 flex items-center gap-4 border-b border-black/[0.06] pb-5 md:mb-8">
      {showRing ? (
        <ProgressRing
          remaining={emptyKind === 'bouclee' ? 0 : remaining}
          total={Math.max(total, 1)}
          complete={ringComplete}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-balance font-semibold text-text-strong" style={{ fontSize: 18, lineHeight: 1.3 }} aria-live="polite">
          {title}
        </p>
        {noUrgent && emptyKind !== 'rien' && emptyKind !== 'bouclee' ? (
          <p className="mt-1 text-[14px] font-medium" style={{ color: FIELD.vert }}>
            Plus rien d&apos;urgent.
          </p>
        ) : emptyKind === 'rien' ? (
          <p className="mt-1 text-[13.5px] text-text-muted">{dateDuJour()}</p>
        ) : remaining > 0 ? (
          <p className="mt-1 text-[13.5px] text-text-muted">{dateDuJour()}</p>
        ) : initialTotal > 0 ? (
          <p className="mt-1 text-[13.5px] text-text-muted">Tout est traité pour aujourd&apos;hui.</p>
        ) : null}
      </div>
      {notesLine ? (
        <p
          className="hidden max-w-[34%] flex-shrink-0 text-right text-pretty lg:block"
          style={{ color: FIELD.ardoise, fontSize: 13, lineHeight: 1.4 }}
        >
          {notesLine}
        </p>
      ) : null}
    </header>
  );
}
