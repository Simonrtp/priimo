'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { flushQueue, listQueue } from '@/lib/offline/queue';

type OfflineQueueContextValue = {
  pending: number;
  flush: () => Promise<void>;
  refresh: () => Promise<void>;
};

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function useOfflineQueue(): OfflineQueueContextValue {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    return {
      pending: 0,
      flush: async () => undefined,
      refresh: async () => undefined,
    };
  }
  return ctx;
}

export default function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    const items = await listQueue();
    setPending(items.length);
  }, []);

  const flush = useCallback(async () => {
    await flushQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();
    function onOnline() {
      void flush();
    }
    function onFocus() {
      void flush();
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [flush, refresh]);

  const value = useMemo(
    () => ({ pending, flush, refresh }),
    [pending, flush, refresh],
  );

  return (
    <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>
  );
}
