'use client';

import Link from 'next/link';
import { toneColor } from '@/lib/today/counter-severity';
import type { PortfolioCounter, PortfolioStats } from '@/lib/today/portfolio';

function Counter({ item }: { item: PortfolioCounter }) {
  const zero = item.value === 0;
  const figureColor = toneColor(item.tone, item.value);
  const hasSubtitle = Boolean(item.subtitle);
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-clay border border-black/[0.06] bg-surface shadow-clay-sm">
      <Link
        href={item.href}
        className={`cursor-pointer px-3.5 pt-3 outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4 ${
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
            className="mt-auto cursor-pointer px-3.5 pb-3 pt-0.5 text-[12px] text-text-muted underline-offset-2 hover:bg-black/[0.03] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-4"
          >
            {item.subtitle}
          </Link>
        ) : (
          <span className="mt-auto px-3.5 pb-3 pt-0.5 text-[12px] text-text-muted sm:px-4">
            {item.subtitle}
          </span>
        )
      ) : null}
    </div>
  );
}

export default function PortfolioBand({ stats }: { stats: PortfolioStats }) {
  return (
    <section aria-label="État du portefeuille" className="mb-6 md:mb-8">
      {/* Mobile : 2 × 2, jamais une bande à faire défiler. */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {stats.counters.map((item) => (
          <Counter key={item.kind} item={item} />
        ))}
      </div>
    </section>
  );
}
