'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { useNotifications } from '@/components/providers/NotificationsProvider';
import { useOutsideDismiss } from '@/lib/hooks/useOutsideDismiss';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import { FIELD } from '@/lib/today/field';
import NotificationsPanel from './NotificationsPanel';

function Pastille({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-semibold tabular-nums text-white"
      style={{ backgroundColor: FIELD.orange, fontSize: 10 }}
    >
      {n > 9 ? '9+' : n}
    </span>
  );
}

export default function NotificationsBell({
  tone = 'shell',
}: {
  /** shell = barre bleue (icône claire). light = fond clair. */
  tone?: 'shell' | 'light';
}) {
  const device = useDevice();
  const mobile = device === 'mobile';
  const { nonLues } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  useOutsideDismiss(open && !mobile, close, rootRef);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || !mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = panelRef.current?.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    first?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, mobile]);

  const label =
    nonLues > 0
      ? `Notifications, ${nonLues > 9 ? 'plus de 9' : nonLues} non lue${nonLues > 1 ? 's' : ''}`
      : 'Notifications';

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={panelId}
      aria-haspopup="dialog"
      onClick={() => setOpen((v) => !v)}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-fluid-subtle ease-in-out md:size-9 ${
        tone === 'shell'
          ? 'text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'
          : 'text-ink hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
      }`}
    >
      <Bell size={20} strokeWidth={1.75} aria-hidden />
      <Pastille n={nonLues} />
    </button>
  );

  if (mobile) {
    return (
      <div className="relative shrink-0">
        {trigger}
        {open ? (
          <div
            className="fixed inset-0 z-[70]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${panelId}-title`}
          >
            <button
              type="button"
              className="absolute inset-0 bg-[rgba(21,32,47,0.28)]"
              aria-label="Fermer les notifications"
              onPointerDown={(e) => {
                e.preventDefault();
                armPointerShield();
                close();
                triggerRef.current?.focus();
              }}
            />
            <div
              ref={panelRef}
              id={panelId}
              className="animate-app-sheet absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-clay-lg"
              style={{
                height: '75dvh',
                paddingBottom: 'var(--field-nav-height)',
              }}
            >
              <div className="flex shrink-0 flex-col items-center pt-2">
                <div className="h-1.5 w-10 rounded-full bg-black/20" aria-hidden />
                <h2
                  id={`${panelId}-title`}
                  className="w-full px-5 pb-1 pt-3 text-balance font-semibold text-text-strong"
                  style={{ fontSize: 16 }}
                >
                  Notifications
                </h2>
              </div>
              <NotificationsPanel onNavigate={close} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      {trigger}
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="absolute right-0 top-[calc(100%+8px)] z-30 overflow-y-auto rounded-clay-lg border border-black/12 bg-surface shadow-clay"
          style={{ width: 380, maxHeight: 520 }}
        >
          <h2 id={`${panelId}-title`} className="sr-only">
            Notifications
          </h2>
          <NotificationsPanel onNavigate={close} />
        </div>
      ) : null}
    </div>
  );
}
