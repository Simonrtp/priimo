'use client';

import { dateDuJour } from '@/lib/today/cards';
import { FIELD, phraseEtat, phraseNotesReturn } from '@/lib/today/field';
import { useUser } from '@/lib/hooks/useUser';
import { Search } from 'lucide-react';
import { useAssistant } from '@/components/dashboard/assistant/AssistantProvider';
import { AssistantMobileSearchBar } from '@/components/dashboard/assistant/AssistantSearchButton';

function AccountButton({
  onClick,
  tone = 'light',
  className = '',
}: {
  onClick: () => void;
  tone?: 'light' | 'shell';
  className?: string;
}) {
  const { profile } = useUser();
  const initials =
    `${profile.first_name.trim().charAt(0)}${profile.last_name.trim().charAt(0)}`.toUpperCase() || '?';
  const shell = tone === 'shell';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Compte et réglages"
      className={`app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${className}`}
      style={
        shell
          ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }
          : { backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }
      }
    >
      {initials}
    </button>
  );
}

export function StatusBand({
  prenom,
  remaining,
  emptyKind,
  relancesProgrammees,
  rapprochements,
  noUrgent,
  onAccount,
  tone = 'light',
  directorTitle = null,
}: {
  prenom: string;
  remaining: number;
  emptyKind: 'bouclee' | 'rien' | null;
  relancesProgrammees: number;
  rapprochements: number;
  noUrgent: boolean;
  onAccount: () => void;
  tone?: 'light' | 'shell';
  directorTitle?: string | null;
}) {
  const shell = tone === 'shell';
  const title = directorTitle ?? phraseEtat({ remaining, prenom, emptyKind });
  const notesLine = phraseNotesReturn(relancesProgrammees, rapprochements);
  const { openMobileSearch, mobileSearchOpen } = useAssistant();

  return (
    <>
      <header
        className={`z-[10] flex flex-shrink-0 gap-2 px-4 ${
          shell
            ? 'relative items-start pb-2 pt-3'
            : 'sticky top-0 items-center border-b border-black/[0.06] bg-bg-base'
        }`}
        style={{
          paddingTop: shell ? 'calc(12px + env(safe-area-inset-top, 0px))' : 'env(safe-area-inset-top, 0px)',
          minHeight: shell ? undefined : 'calc(72px + env(safe-area-inset-top, 0px))',
        }}
      >
        <div className="min-w-0 flex-1">
          <p
            className={`text-pretty font-brand font-normal tracking-[-0.015em] ${
              shell ? 'text-white' : 'text-text-strong'
            }`}
            style={{ fontSize: shell ? 24 : 22, lineHeight: 1.18 }}
            aria-live="polite"
          >
            {title}
          </p>
          {noUrgent && !directorTitle && emptyKind !== 'rien' && emptyKind !== 'bouclee' ? (
            <p className="mt-0.5 text-[12.5px] font-medium" style={{ color: shell ? '#8FD4A8' : FIELD.vert }}>
              Plus rien d&apos;urgent.
            </p>
          ) : directorTitle ? (
            <p className={`mt-0.5 truncate text-[12.5px] ${shell ? 'text-white/65' : 'text-text-muted'}`}>
              {dateDuJour()}
            </p>
          ) : notesLine ? (
            <p
              className="mt-0.5 line-clamp-2 text-pretty text-[11.5px] sm:hidden"
              style={{ color: shell ? '#B8CDE3' : FIELD.ardoise, lineHeight: 1.35 }}
            >
              {notesLine}
            </p>
          ) : (
            <p className={`mt-0.5 truncate text-[12.5px] ${shell ? 'text-white/65' : 'text-text-muted'}`}>
              {dateDuJour()}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openMobileSearch}
          aria-label="Rechercher"
          className={`app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full ${shell ? 'mt-1' : ''}`}
          style={shell ? { color: '#FFFFFF' } : { color: FIELD.ardoise }}
        >
          <Search size={20} strokeWidth={2} aria-hidden />
        </button>
        <AccountButton onClick={onAccount} tone={tone} className={shell ? 'mt-1' : undefined} />
      </header>
      {mobileSearchOpen ? <AssistantMobileSearchBar /> : null}
    </>
  );
}
