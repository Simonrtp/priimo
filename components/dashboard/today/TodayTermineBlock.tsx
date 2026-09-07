'use client';

import { ACCUEIL } from '@/lib/today/field';

export default function TodayTermineBlock({
  items,
  expanded,
  onToggle,
}: {
  items: readonly { key: string; headline: string; at: string }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-[18px] text-ink" style={{ backgroundColor: ACCUEIL.vert }}>
      <button
        type="button"
        className="flex min-h-[48px] w-full items-center justify-between px-5 py-3 text-left"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="font-semibold text-ink" style={{ fontSize: 15 }}>
          Terminé aujourd&apos;hui · {items.length}
        </span>
        <span className="text-[13px] text-ink/65">{expanded ? 'Replier' : 'Voir'}</span>
      </button>
      {expanded ? (
        items.length === 0 ? (
          <p className="px-5 pb-4 text-[14px] text-ink/65">Rien de validé pour l&apos;instant.</p>
        ) : (
          <ul className="border-t border-black/[0.06] px-5 pb-4">
            {items.map((item) => (
              <li key={item.key} className="flex items-baseline justify-between gap-3 border-b border-black/[0.04] py-2.5 last:border-0">
                <p className="min-w-0 truncate text-[14px] text-ink line-through decoration-black/30">
                  {item.headline}
                </p>
                <p className="flex-shrink-0 tabular-nums text-[12px] text-ink/55">
                  {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.at))}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
