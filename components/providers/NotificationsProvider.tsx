'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Notification } from '@/lib/notifications/types';

type NotificationsContextValue = {
  notifications: Notification[];
  nonLues: number;
  marquerLue: (ids: readonly string[]) => void;
  marquerToutesLues: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  initial,
  children,
}: {
  initial: Notification[];
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState(initial);
  useEffect(() => {
    setNotifications(initial);
  }, [initial]);
  const nowIso = () => new Date().toISOString();

  const marquerLue = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return;
    const set = new Set(ids);
    const at = nowIso();
    setNotifications((prev) =>
      prev.map((n) => (set.has(n.id) && !n.lueLe ? { ...n, lueLe: at } : n)),
    );
    void fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids.length === 1 ? { id: ids[0] } : { id: ids[0], ids }),
    }).catch(() => undefined);
  }, []);

  const marquerToutesLues = useCallback(() => {
    const at = nowIso();
    setNotifications((prev) => prev.map((n) => (n.lueLe ? n : { ...n, lueLe: at })));
    void fetch('/api/dashboard/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tous: true }),
    }).catch(() => undefined);
  }, []);

  const value = useMemo<NotificationsContextValue>(() => {
    const nonLues = notifications.filter((n) => !n.lueLe).length;
    return { notifications, nonLues, marquerLue, marquerToutesLues };
  }, [notifications, marquerLue, marquerToutesLues]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
