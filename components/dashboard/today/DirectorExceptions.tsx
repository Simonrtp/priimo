'use client';

import Link from 'next/link';
import type { DirectorMemberExceptions } from '@/lib/today/director-exceptions';

export default function DirectorExceptions({
  rows,
}: {
  rows: readonly DirectorMemberExceptions[];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-[14px] text-text-muted">Aucune exception dans l&apos;équipe.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.memberId}
          className="rounded-clay border border-black/[0.06] bg-surface px-4 py-3 shadow-clay-sm"
        >
          <p className="text-[14.5px] font-semibold text-text-strong">{row.fullName}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {row.items.map((item) => (
              <li key={`${row.memberId}-${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className="flex min-h-10 items-baseline justify-between gap-3 rounded-lg px-1 py-1 text-[13.5px] text-text hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span>{item.label}</span>
                  <span className="tabular-nums font-semibold text-text-strong">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
