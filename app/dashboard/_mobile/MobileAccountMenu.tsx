'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';

function initials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0).toUpperCase()}${lastName.trim().charAt(0).toUpperCase()}` || '?';
}

export default function MobileAccountMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { profile, isDirector } = useUser();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Compte">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(21,32,47,0.4)]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        className="absolute right-4 overflow-hidden rounded-2xl bg-surface shadow-clay-lg"
        style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))', width: 240 }}
      >
        <div className="border-b border-black/[0.06] px-4 py-3">
          <p className="truncate font-semibold text-text-strong" style={{ fontSize: 14.5 }}>
            {profile.first_name} {profile.last_name}
          </p>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            {isDirector ? 'Directeur' : 'Collaborateur'}
          </p>
        </div>
        <ul className="py-1">
          <li>
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              className="app-press flex min-h-[44px] items-center px-4 text-[14px] font-medium text-text"
            >
              Paramètres
            </Link>
          </li>
          {isDirector ? (
            <li>
              <Link
                href="/dashboard/settings?tab=team"
                onClick={onClose}
                className="app-press flex min-h-[44px] items-center px-4 text-[14px] font-medium text-text"
              >
                Équipe
              </Link>
            </li>
          ) : null}
        </ul>
        <form action="/api/auth/signout" method="post" className="border-t border-black/[0.06]">
          <button
            type="submit"
            className="app-press flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-[14px] font-medium text-text"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}

export function AvatarButton({
  onClick,
  className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  const { profile } = useUser();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Compte et réglages"
      className={`app-press flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 ${className}`}
    >
      {initials(profile.first_name, profile.last_name)}
    </button>
  );
}
