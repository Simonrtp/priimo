'use client';

import Link from 'next/link';
import type { DirectorMemberExceptions } from '@/lib/today/director-exceptions';
import { toneColor } from '@/lib/today/counter-severity';

export default function DirectorExceptions({
  rows,
  onOpenMember,
}: {
  rows: readonly DirectorMemberExceptions[];
  onOpenMember: (memberId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-[14px] text-text-muted">Rien à signaler cette semaine</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.memberId}
          className="rounded-clay border border-black/[0.06] bg-surface px-4 py-3 shadow-clay-sm"
        >
          <button
            type="button"
            onClick={() => onOpenMember(row.memberId)}
            className="-mx-1.5 flex min-h-11 w-[calc(100%+0.75rem)] cursor-pointer items-center rounded-lg px-1.5 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-[14.5px] font-semibold text-text-strong">{row.fullName}</span>
          </button>
          <ul className="mt-1 flex flex-col">
            {row.items.map((item) => {
              const inner = (
                <>
                  <span
                    className="mt-1.5 size-1.5 flex-shrink-0 rounded-full"
                    style={{ background: toneColor(item.tone, item.count) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <span className="tabular-nums font-semibold text-text-strong">{item.count}</span>
                </>
              );
              const className =
                'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-[13.5px] text-text hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
              return (
                <li key={`${row.memberId}-${item.kind}`}>
                  {item.href ? (
                    <Link href={item.href} className={className}>
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => onOpenMember(row.memberId)} className={`w-full text-left ${className}`}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
