'use client';

import type { PortfolioStats } from '@/lib/today/portfolio';
import AccueilKpiFoldCard from './AccueilKpiFoldCard';

export default function PortfolioBand({ stats }: { stats: PortfolioStats }) {
  return (
    <section aria-label="État du portefeuille" className="mb-6 md:mb-8">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {stats.counters.map((item) => (
          <AccueilKpiFoldCard key={item.kind} item={item} />
        ))}
      </div>
    </section>
  );
}
