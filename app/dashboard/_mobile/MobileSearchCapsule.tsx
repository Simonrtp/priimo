'use client';

import { Search, X } from 'lucide-react';
import {
  AssistantMobileSearchBar,
  PLACEHOLDER_RECHERCHE,
} from '@/components/dashboard/assistant/AssistantSearchButton';
import { useAssistant } from '@/components/dashboard/assistant/AssistantProvider';
import { AvatarButton } from './MobileAccountMenu';

/**
 * La barre unique, en capsule terrain — la même sur chaque écran et sur la
 * carte : loupe, « un nom, une adresse, une question », puis la photo de profil.
 */
export default function MobileSearchCapsule({
  hideAccount = false,
  onAccount,
  translucent = false,
  accountOpen = false,
}: {
  hideAccount?: boolean;
  onAccount: () => void;
  /** Sur la carte : fond légèrement transparent. */
  translucent?: boolean;
  accountOpen?: boolean;
}) {
  const { openMobileSearch, mobileSearchOpen, closeMobileSearch } = useAssistant();

  return (
    <div
      className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-md ${
        translucent ? 'bg-white/95' : 'bg-white'
      }`}
    >
      {mobileSearchOpen ? (
        <>
          <div className="min-w-0 flex-1">
            <AssistantMobileSearchBar tone="map" />
          </div>
          <button
            type="button"
            onClick={closeMobileSearch}
            aria-label="Fermer la recherche"
            className="app-press flex size-9 shrink-0 items-center justify-center rounded-full text-text"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={openMobileSearch}
            className="app-press flex min-h-[36px] min-w-0 flex-1 items-center gap-2 px-1 text-left"
            aria-label="Chercher un nom, une adresse, ou poser une question"
          >
            <Search size={16} strokeWidth={2} className="shrink-0 text-text-muted" aria-hidden />
            <span className="truncate text-[13px] text-text-muted">{PLACEHOLDER_RECHERCHE}</span>
          </button>
          {!hideAccount ? <AvatarButton onClick={onAccount} expanded={accountOpen} /> : null}
        </>
      )}
    </div>
  );
}
