'use client';

import { Search, X } from 'lucide-react';
import { AssistantMobileSearchBar } from '@/components/dashboard/assistant/AssistantSearchButton';
import { useAssistant } from '@/components/dashboard/assistant/AssistantProvider';
import { AvatarButton } from './MobileAccountMenu';

/**
 * Capsule de recherche terrain — celle de la carte Prospection.
 * Même forme partout : loupe + placeholder, photo de profil à droite.
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
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 shadow-md ${
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
            className="app-press flex size-11 shrink-0 items-center justify-center rounded-full text-text"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={openMobileSearch}
            className="app-press flex min-h-[44px] min-w-0 flex-1 items-center gap-2 px-1 text-left"
            aria-label="Rechercher une adresse, un contact"
          >
            <Search size={18} strokeWidth={2} className="shrink-0 text-text-muted" aria-hidden />
            <span className="truncate text-[14px] text-text-muted">
              Rechercher une adresse, un contact
            </span>
          </button>
          {!hideAccount ? <AvatarButton onClick={onAccount} expanded={accountOpen} /> : null}
        </>
      )}
    </div>
  );
}
