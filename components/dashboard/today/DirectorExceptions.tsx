'use client';

import Link from 'next/link';
import type { DirectorMemberExceptions } from '@/lib/today/director-exceptions';
import { toneColor } from '@/lib/today/counter-severity';
import AccueilCard from './AccueilCard';
import ProfileAvatar from '@/components/dashboard/ProfileAvatar';

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
        <li key={row.memberId}>
          <AccueilCard className="!py-0">
            <button
              type="button"
              onClick={() => onOpenMember(row.memberId)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 border-b border-black/[0.05] px-1 py-3.5 text-left hover:bg-black/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-0"
            >
              <ProfileAvatar
                firstName={row.firstName}
                lastName={row.lastName}
                avatarUrl={row.avatarUrl}
                size={32}
                className="shrink-0"
              />
              <span className="text-[15px] font-semibold text-text-strong">{row.fullName}</span>
            </button>
            <ul className="flex flex-col py-1">
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
                  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] text-text hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
                return (
                  <li key={`${row.memberId}-${item.kind}`}>
                    {item.href ? (
                      <Link href={item.href} className={className}>
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenMember(row.memberId)}
                        className={`w-full text-left ${className}`}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </AccueilCard>
        </li>
      ))}
    </ul>
  );
}
