'use client';

import Link from 'next/link';
import type { PortfolioCounter, PortfolioStats } from '@/lib/today/portfolio';

function Counter({ item }: { item: PortfolioCounter }) {
  const zero = item.value === 0;
  return (
    <Link
      href={item.href}
      className="flex min-w-[9.5rem] flex-shrink-0 flex-col justify-center rounded-clay border border-black/[0.06] bg-surface px-4 py-3 shadow-clay-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:min-w-0"
    >
      <span
        className={`tabular-nums text-[28px] font-semibold leading-none ${
          zero ? 'text-text-subtle' : 'text-text-strong'
        }`}
      >
        {item.value}
      </span>
      <span className={`mt-1.5 text-[13px] font-medium ${zero ? 'text-text-subtle' : 'text-text'}`}>
        {item.label}
      </span>
      {item.subtitle ? (
        <span className="mt-0.5 text-[12px] text-text-muted">{item.subtitle}</span>
      ) : null}
    </Link>
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
