'use client';

import {
  ESTIMATION_SOURCES_DISCLAIMER,
  resolveEstimationSources,
  type EstimationSourceId,
} from '@/lib/estimation/sources';
import { FIELD } from '@/lib/today/field';

export default function SourceBadges({
  sources,
  className = '',
}: {
  sources: readonly EstimationSourceId[] | null | undefined;
  className?: string;
}) {
  const items = resolveEstimationSources(sources ?? []);
  if (items.length === 0) return null;

  return (
    <section className={className} aria-label="Estimation basée sur">
      <p className="text-[12px] font-medium text-text-muted">Basée sur</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            title={item.subtitle}
            className="rounded-full px-2.5 py-1 font-semibold text-ink"
            style={{ backgroundColor: FIELD.creme, fontSize: 12 }}
          >
            {item.title}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-pretty text-text-subtle" style={{ fontSize: 11, lineHeight: 1.35 }}>
        {ESTIMATION_SOURCES_DISCLAIMER}
      </p>
    </section>
  );
}
