import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { TODAY_CARD_LABELS, type TodayCard } from '@/lib/today/cards';
import { ctaCourt, dotColorFor } from '@/lib/today/field';
import { lienAction } from '@/lib/today/lien';
import { isOverdue, temporalMention } from '@/lib/today/visual-level';

/**
 * Ce qu'il y a à faire à cette heure-ci, juste sous l'en-tête.
 *
 * Une seule tâche : c'est un rappel, pas une liste. La liste complète reste
 * plus bas, dans « Aujourd'hui ».
 */
export default function TacheDuMoment({ card }: { card: TodayCard | null }) {
  if (!card) return null;

  const href = lienAction(card.action);
  const enRetard = isOverdue(card);
  const mention = temporalMention(card) ?? (enRetard ? 'En retard' : 'Maintenant');
  const couleur = dotColorFor(card.type);
  const libelleCta = ctaCourt(card);

  return (
    <section className="flex min-w-0 flex-wrap items-center gap-3 rounded-clay-lg bg-surface p-4 shadow-clay sm:gap-4">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-clay"
        style={{ backgroundColor: `${couleur}1F`, color: couleur }}
      >
        <Clock size={17} strokeWidth={2.3} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold">
          <span style={{ color: couleur }}>{mention}</span>
          <span className="text-text-subtle" aria-hidden>
            ·
          </span>
          <span className="truncate text-text-muted">{TODAY_CARD_LABELS[card.type]}</span>
        </p>
        <p className="truncate text-[15px] font-bold text-text-strong">{card.headline}</p>
        {card.context ? (
          <p className="truncate text-[12px] text-text-muted">{card.context}</p>
        ) : null}
      </div>

      {href ? (
        href.startsWith('tel:') ? (
          <a
            href={href}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-clay bg-surface-2 px-3.5 text-[13px] font-semibold text-text-strong shadow-clay-sm transition-shadow duration-fluid-subtle hover:shadow-clay active:shadow-clay-pressed"
          >
            {libelleCta}
            <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
          </a>
        ) : (
          <Link
            href={href}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-clay bg-surface-2 px-3.5 text-[13px] font-semibold text-text-strong shadow-clay-sm transition-shadow duration-fluid-subtle hover:shadow-clay active:shadow-clay-pressed"
          >
            {libelleCta}
            <ArrowRight size={15} strokeWidth={2.2} aria-hidden />
          </Link>
        )
      ) : null}
    </section>
  );
}
