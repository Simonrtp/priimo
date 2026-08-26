'use client';

import Link from 'next/link';
import { toneColor } from '@/lib/today/counter-severity';
import type { PortfolioCounter, PortfolioStats } from '@/lib/today/portfolio';

function Counter({ item }: { item: PortfolioCounter }) {
  const zero = item.value === 0;
  const figureColor = toneColor(item.tone, item.value);
  const hasSubtitle = Boolean(item.subtitle);
  return (
    <div className="flex min-w-[10.5rem] flex-shrink-0 flex-col justify-center overflow-hidden rounded-clay border border-black/[0.06] bg-surface shadow-clay-sm sm:min-w-0">
      <Link
        href={item.href}
        className={`cursor-pointer px-4 pt-3 outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          hasSubtitle ? 'pb-1.5' : 'pb-3'
        }`}
      >
        <span
          className="block tabular-nums text-[28px] font-semibold leading-none"
          style={{ color: figureColor }}
        >
          {item.value}
        </span>
        <span className={`mt-1.5 block text-[13px] font-medium ${zero ? 'text-text-subtle' : 'text-text'}`}>
          {item.label}
        </span>
        {item.deltaLabel ? (
          <span className="mt-0.5 block text-[11px] text-text-muted">{item.deltaLabel}</span>
        ) : null}
      </Link>
      {item.subtitle ? (
        item.subtitleHref ? (
          <Link
            href={item.subtitleHref}
            className="cursor-pointer px-4 pb-3 pt-0.5 text-[12px] text-text-muted underline-offset-2 hover:bg-black/[0.03] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {item.subtitle}
          </Link>
        ) : (
          <span className="px-4 pb-3 pt-0.5 text-[12px] text-text-muted">{item.subtitle}</span>
        )
      ) : null}
    </div>
  );
}

export default function PortfolioBand({ stats }: { stats: PortfolioStats }) {
  return (
    <section aria-label="État du portefeuille" className="mb-6 md:mb-8">
      <div className="app-snap -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:px-0">
        {stats.counters.map((item) => (
          <Counter key={item.kind} item={item} />
        ))}
      </div>
    </section>
  );
}
